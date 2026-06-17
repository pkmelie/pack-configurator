const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
    if (req.method !== "GET") {
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

    const { data, error } = await supabase
        .from("profiles")
        .select("credits, email")
        .eq("id", authData.user.id)
        .single();

    if (error) return res.status(500).json({ error: "Impossible de charger le profil." });

    res.json(data);
};
