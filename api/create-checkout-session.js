const { createClient } = require("@supabase/supabase-js");
const Stripe = require("stripe");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Packs de crédits — prix fixes, crédits calculés pour marges cibles
// Micro: 50% marge | Starter: 30% marge | Pro: 20% marge
const PACKS = {
    micro: { credits: 4, price: 100, name: "Pack Micro — 5 crédits" },
    starter: { credits: 20, price: 500, name: "Pack Starter — 10 crédits" },
    pro: { credits: 50, price: 900, name: "Pack Pro — 25 crédits" },
};

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

    const { packId } = req.body;
    const pack = PACKS[packId];
    if (!pack) return res.status(400).json({ error: "Pack invalide." });

    // Construit l'URL de base à partir de la requête (fonctionne en local et en prod)
    const baseUrl = `https://${req.headers.host}`;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "payment",
            customer_email: authData.user.email,
            line_items: [{
                price_data: {
                    currency: "eur",
                    product_data: { name: pack.name },
                    unit_amount: pack.price,
                },
                quantity: 1,
            }],
            metadata: { userId: authData.user.id, packId },
            success_url: `${baseUrl}/assistant-seo/?paiement=succes`,
            cancel_url: `${baseUrl}/?paiement=annule`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("Erreur Stripe:", err.message);
        res.status(500).json({ error: "Erreur lors de la création du paiement." });
    }
};
