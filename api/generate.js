const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

const SYSTEM_PROMPT = "Tu es un expert en rédaction SEO francophone. Réponds toujours en français avec un Markdown bien structuré.";

// -----------------------------------------------------------------------
// Appelle Gemini (gratuit, pour les tests)
// -----------------------------------------------------------------------
async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { maxOutputTokens: 4000 },
        }),
    });

    const data = await res.json();

    if (data.error) {
        throw new Error(data.error.message || "Erreur Gemini inconnue.");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Réponse Gemini vide ou bloquée par les filtres de sécurité.");

    return text;
}

// -----------------------------------------------------------------------
// Appelle Claude (production, payant mais peu cher)
// -----------------------------------------------------------------------
async function callClaude(prompt) {
    const Anthropic = require("@anthropic-ai/sdk");
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await claude.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
    });

    return msg.content[0].text;
}

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Non authentifié." });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
        return res.status(401).json({ error: "Session invalide." });
    }

    const userId = authData.user.id;
    const { mode, keyword, tone, length, existingText } = req.body;

    if (!keyword || keyword.trim() === "") {
        return res.status(400).json({ error: "Le mot-clé est obligatoire." });
    }
    if (mode === "score" && (!existingText || existingText.trim() === "")) {
        return res.status(400).json({ error: "Le texte à analyser est obligatoire pour l'audit." });
    }

    const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", userId)
        .single();

    if (profErr) return res.status(500).json({ error: "Impossible de vérifier ton solde." });
    if (profile.credits <= 0) return res.status(402).json({ error: "Plus de crédits disponibles." });

    const prompt = buildPrompt(mode, keyword, tone, length, existingText);

    // Bascule automatique : si GEMINI_API_KEY existe, on l'utilise (gratuit).
    // Sinon on utilise Claude (production). Pour forcer Claude même avec une
    // clé Gemini présente, mets AI_PROVIDER=claude dans les variables d'env.
    const useGemini = process.env.AI_PROVIDER !== "claude" && !!process.env.GEMINI_API_KEY;

    try {
        const text = useGemini ? await callGemini(prompt) : await callClaude(prompt);

        const nouveauSolde = profile.credits - 1;
        await supabase.from("profiles").update({ credits: nouveauSolde }).eq("id", userId);

        res.json({ text, creditsLeft: nouveauSolde, provider: useGemini ? "gemini" : "claude" });
    } catch (err) {
        console.error("Erreur IA:", err.message);
        res.status(500).json({ error: "Erreur de génération : // " + err.message });
    }
};