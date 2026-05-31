// api/categories.js — ORIGINAL pack-configurator (restauré)
// Gère les catégories du pack-configurator via config(key='categories')
// NE PAS MODIFIER — utilisé par public/index.html et public/admin/index.html

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_KEY manquants)' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };

  // GET — lire les catégories du pack-configurator
  if (req.method === 'GET') {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/config?key=eq.categories&select=value`,
      { headers }
    );

    if (!response.ok) {
      return res.status(500).json({ error: 'Erreur lecture Supabase', categories: [] });
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      return res.status(200).json({ categories: [] });
    }

    return res.status(200).json({ categories: rows[0].value });
  }

  // POST — sauvegarder les catégories du pack-configurator
  if (req.method === 'POST') {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
    try {
      const decoded = Buffer.from(auth.split(' ')[1], 'base64').toString('utf8');
      if (!decoded.startsWith('admin:')) return res.status(403).json({ error: 'Accès refusé' });
    } catch {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ error: 'Format invalide' });

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/config`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: 'categories', value: categories }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Erreur sauvegarde Supabase: ' + err });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
