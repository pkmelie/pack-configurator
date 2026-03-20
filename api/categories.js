// api/categories.js — Vercel Serverless Function
// Garde la même structure que l'original (config table, key='categories')
//
// GET    /api/categories          → lire la liste (public)
// POST   /api/categories          → remplacer toute la liste (admin) — compatible avec l'ancien
// PUT    /api/categories          → modifier une catégorie (admin)
// DELETE /api/categories?id=X     → supprimer une catégorie (admin)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase non configuré (SUPABASE_URL / SUPABASE_KEY manquants)' });
  }

  const sb = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };

  // Lire les catégories depuis config
  async function readCategories() {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/config?key=eq.categories&select=value`,
      { headers: sb }
    );
    if (!r.ok) throw new Error('Erreur lecture Supabase');
    const rows = await r.json();
    return (rows && rows.length > 0) ? (rows[0].value || []) : [];
  }

  // Sauvegarder toute la liste de catégories dans config
  async function saveCategories(categories) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
      method: 'POST',
      headers: { ...sb, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: 'categories', value: categories }),
    });
    if (!r.ok) throw new Error('Erreur sauvegarde: ' + await r.text());
  }

  // ── GET — public ──────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const categories = await readCategories();
      return res.status(200).json({ categories });
    } catch (e) {
      return res.status(500).json({ error: e.message, categories: [] });
    }
  }

  // ── Auth ──────────────────────────────────────────────────────
  if (!verifyToken(req)) return res.status(401).json({ error: 'Non autorisé' });

  // ── POST — remplacer toute la liste (compatible ancien comportement) ──
  if (req.method === 'POST') {
    // Deux modes : { categories: [...] } (ancien) ou { id, name, ... } (nouvelle catégorie)
    const body = req.body;

    if (body.categories && Array.isArray(body.categories)) {
      // Ancien mode — remplacer toute la liste
      try {
        await saveCategories(body.categories);
        return res.status(200).json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: e.message });
      }
    }

    // Nouveau mode — ajouter une catégorie
    if (!body.id || !body.name) return res.status(400).json({ error: 'id et name requis' });
    try {
      const categories = await readCategories();
      if (categories.find(c => c.id === body.id)) {
        return res.status(409).json({ error: 'Une catégorie avec cet id existe déjà' });
      }
      const newCat = {
        id:    body.id.toLowerCase().replace(/\s+/g, '_'),
        name:  body.name,
        icon:  body.icon  || '📁',
        color: body.color || '#00d4ff',
        desc:  body.desc  || '',
      };
      categories.push(newCat);
      await saveCategories(categories);
      return res.status(201).json({ success: true, category: newCat });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── PUT — modifier une catégorie ──────────────────────────────
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const categories = await readCategories();
      const idx = categories.findIndex(c => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Catégorie non trouvée' });
      categories[idx] = { ...categories[idx], ...updates, id }; // id ne change pas
      await saveCategories(categories);
      return res.status(200).json({ success: true, category: categories[idx] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE — supprimer une catégorie ─────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const categories = await readCategories();
      const filtered = categories.filter(c => c.id !== id);
      if (filtered.length === categories.length) {
        return res.status(404).json({ error: 'Catégorie non trouvée' });
      }
      await saveCategories(filtered);
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  try { return Buffer.from(auth.split(' ')[1], 'base64').toString('utf8').startsWith('admin:'); }
  catch { return false; }
}
