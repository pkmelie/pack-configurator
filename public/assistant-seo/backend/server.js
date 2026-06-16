const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Client Supabase côté serveur — utilise la clé service_role (accès total,
// jamais exposée au frontend) pour pouvoir créditer n'importe quel utilisateur.
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Packs de crédits — prix fixes, crédits calculés pour marges cibles
// Micro: 50% marge | Starter: 30% marge | Pro: 20% marge
const PACKS = {
    micro: { credits: 23, price: 100, name: "Pack Micro — 23 crédits" },
    starter: { credits: 159, price: 500, name: "Pack Starter — 159 crédits" },
    pro: { credits: 291, price: 800, name: "Pack Pro — 291 crédits" },
};

// -----------------------------------------------------------------------
// Middleware d'authentification : vérifie le token Supabase envoyé par le
// frontend dans le header Authorization, et attache req.userId
// -----------------------------------------------------------------------
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Non authentifié. Connecte-toi." });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        return res.status(401).json({ error: "Session invalide. Reconnecte-toi." });
    }

    req.userId = data.user.id;
    req.userEmail = data.user.email;
    next();
}

// -----------------------------------------------------------------------
// WEBHOOK STRIPE — doit recevoir le body BRUT (raw), donc déclaré AVANT
// express.json() global.
// -----------------------------------------------------------------------
app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error("⚠️ Signature webhook invalide:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const packId = session.metadata.packId;
        const pack = PACKS[packId];

        if (!pack || !userId) {
            console.error("⚠️ Métadonnées manquantes sur la session Stripe");
            return res.json({ received: true });
        }

        // Évite de créditer deux fois la même session (Stripe peut renvoyer
        // le même événement plusieurs fois)
        const { data: existing } = await supabase
            .from("payments")
            .select("id")
            .eq("stripe_session_id", session.id)
            .maybeSingle();

        if (existing) {
            console.log("ℹ️ Session déjà traitée, on ignore.");
            return res.json({ received: true });
        }

        // Récupère le solde actuel et ajoute les crédits
        const { data: profile, error: fetchErr } = await supabase
            .from("profiles")
            .select("credits")
            .eq("id", userId)
            .single();

        if (fetchErr) {
            console.error("⚠️ Profil introuvable:", fetchErr.message);
            return res.json({ received: true });
        }

        const nouveauSolde = profile.credits + pack.credits;

        await supabase
            .from("profiles")
            .update({ credits: nouveauSolde })
            .eq("id", userId);

        await supabase.from("payments").insert({
            user_id: userId,
            stripe_session_id: session.id,
            pack_id: packId,
            credits_added: pack.credits,
            amount_cents: pack.price,
        });

        console.log(`✅ Utilisateur ${userId} crédité de +${pack.credits} (nouveau solde: ${nouveauSolde})`);
    }

    res.json({ received: true });
});

// Routes normales : JSON classique
app.use(cors({ origin: "*" }));
app.use(express.json());

// -----------------------------------------------------------------------
function buildPrompt(mode, keyword, tone, length, existingText) {
    if (mode === "article") {
        return `Tu es un expert SEO et rédacteur web. Génère un article de blog optimisé SEO pour le mot-clé : "${keyword}".
Paramètres :
- Ton : ${tone}
- Longueur cible : ${length}

Structure :
1. Un titre H1 accrocheur avec le mot-clé
2. Introduction engageante (hook + promesse)
3. 4 à 6 sections H2 avec contenu substantiel
4. Conclusion avec call-to-action
5. FAQ avec 3 questions

Règles SEO : mot-clé dans le H1, premier paragraphe, 2-3 H2, densité 1-2%, variations sémantiques naturelles.
Format : Markdown.`;
    }

    if (mode === "meta") {
        return `Tu es un expert SEO. Pour le sujet "${keyword}", génère :
1. 3 propositions de titres H1 (55-65 caractères, mot-clé en début)
2. 3 méta-descriptions (150-160 caractères, call-to-action, mot-clé présent)
3. 1 slug URL optimisé (minuscules, tirets, sans accents)
4. 5 mots-clés secondaires longue traîne
5. 1 balise Open Graph title
Pour chaque proposition, indique le nombre de caractères entre parenthèses.
Format : Markdown.`;
    }

    if (mode === "score") {
        return `Tu es un expert SEO. Analyse ce texte et fournis un audit détaillé.

TEXTE :
"""
${existingText}
"""
MOT-CLÉ CIBLE : "${keyword}"

## Score SEO global : X/100

### Analyse par critère (sur 10) :
- Titre et H1
- Densité du mot-clé
- Structure (Hn)
- Lisibilité
- Longueur du contenu
- Champ sémantique
- Call-to-action

### ✅ Points forts (3 minimum)
### ⚠️ Axes d'amélioration (top 5)
### 🔧 3 extraits à réécrire avec version améliorée

Format : Markdown.`;
    }
}

// -----------------------------------------------------------------------
// ROUTES (toutes protégées par requireAuth, sauf le webhook ci-dessus)
// -----------------------------------------------------------------------

// Infos utilisateur (crédits actuels)
app.get("/api/user", requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from("profiles")
        .select("credits, email")
        .eq("id", req.userId)
        .single();

    if (error) return res.status(500).json({ error: "Impossible de charger le profil." });
    res.json(data);
});

// Crée une session de paiement Stripe Checkout, liée à l'utilisateur connecté
app.post("/api/create-checkout-session", requireAuth, async (req, res) => {
    const { packId } = req.body;
    const pack = PACKS[packId];

    if (!pack) return res.status(400).json({ error: "Pack invalide." });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: req.userEmail,
            line_items: [{
                price_data: {
                    currency: "eur",
                    product_data: { name: pack.name },
                    unit_amount: pack.price,
                },
                quantity: 1,
            }],
            // C'est CETTE ligne qui permet au webhook de savoir qui créditer
            metadata: { userId: req.userId, packId },
            success_url: "http://localhost:5000/?paiement=succes",
            cancel_url: "http://localhost:5000/?paiement=annule",
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("Erreur Stripe:", err.message);
        res.status(500).json({ error: "Erreur lors de la création du paiement." });
    }
});

// Génération de contenu
app.post("/api/generate", requireAuth, async (req, res) => {
    const { mode, keyword, tone, length, existingText } = req.body;

    if (!keyword || keyword.trim() === "") {
        return res.status(400).json({ error: "Le mot-clé est obligatoire." });
    }
    if (mode === "score" && (!existingText || existingText.trim() === "")) {
        return res.status(400).json({ error: "Le texte à analyser est obligatoire pour l'audit." });
    }

    // Vérifie le solde dans Supabase (source de vérité, pas en mémoire)
    const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", req.userId)
        .single();

    if (profErr) return res.status(500).json({ error: "Impossible de vérifier ton solde." });
    if (profile.credits <= 0) return res.status(402).json({ error: "Plus de crédits disponibles." });

    const prompt = buildPrompt(mode, keyword, tone, length, existingText);

    try {
        const msg = await claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4000,
            system: "Tu es un expert en rédaction SEO francophone. Réponds toujours en français avec un Markdown bien structuré.",
            messages: [{ role: "user", content: prompt }],
        });

        const nouveauSolde = profile.credits - 1;
        await supabase.from("profiles").update({ credits: nouveauSolde }).eq("id", req.userId);

        res.json({ text: msg.content[0].text, creditsLeft: nouveauSolde });
    } catch (err) {
        console.error("Erreur Claude:", err.message);
        res.status(500).json({ error: "Erreur API Claude : " + err.message });
    }
});

// -----------------------------------------------------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Serveur démarré sur http://localhost:${PORT}`));