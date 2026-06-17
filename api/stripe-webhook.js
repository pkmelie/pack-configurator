const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const PACKS = {
    micro: { credits: 23, price: 100 },
    starter: { credits: 159, price: 500 },
    pro: { credits: 291, price: 800 },
};

// IMPORTANT : Vercel parse le body en JSON par défaut, mais Stripe a besoin
// du body BRUT pour vérifier la signature. Ce bloc désactive le parsing auto.
module.exports.config = {
    api: {
        bodyParser: false,
    },
};

// Lit le body brut depuis le flux de la requête
function getRawBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
        req.on("error", reject);
    });
}

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Méthode non autorisée." });
    }

    const sig = req.headers["stripe-signature"];
    const rawBody = await getRawBody(req);

    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
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

        const { data: existing } = await supabase
            .from("payments")
            .select("id")
            .eq("stripe_session_id", session.id)
            .maybeSingle();

        if (existing) {
            console.log("ℹ️ Session déjà traitée, on ignore.");
            return res.json({ received: true });
        }

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

        await supabase.from("profiles").update({ credits: nouveauSolde }).eq("id", userId);

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
};
