// api/crashes.js — Vercel Serverless Function
// GET    /api/crashes         → liste publique (published=true)
// GET    /api/crashes?admin=1 → tout (token admin requis)
// POST   /api/crashes         → créer (admin)
// PUT    /api/crashes         → modifier (admin)
// DELETE /api/crashes?id=X    → supprimer (admin)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase non configuré' });
  }

  const sb = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };

  // GET
  if (req.method === 'GET') {
    const { id, cat, search, admin } = req.query;
    const isAdmin = admin === '1' && verifyToken(req);

    let url = `${SUPABASE_URL}/rest/v1/crashes?select=*&order=created_at.desc`;
    if (!isAdmin) url += '&published=eq.true';
    if (id)       url += `&id=eq.${encodeURIComponent(id)}`;
    if (cat)      url += `&cat=eq.${encodeURIComponent(cat)}`;
    if (search)   url += `&or=(title.ilike.*${encodeURIComponent(search)}*,code.ilike.*${encodeURIComponent(search)}*,description.ilike.*${encodeURIComponent(search)}*)`;

    const r = await fetch(url, { headers: sb });
    if (!r.ok) return res.status(500).json({ error: 'Erreur lecture Supabase', crashes: [] });
    return res.status(200).json({ crashes: await r.json() });
  }

  // Routes admin
  if (!verifyToken(req)) return res.status(401).json({ error: 'Non autorisé' });

  // POST — créer
  if (req.method === 'POST') {
    const crash = { ...req.body };
    if (!crash.title || !crash.code || !crash.severity || !crash.cat) {
      return res.status(400).json({ error: 'Champs requis: title, code, severity, cat' });
    }
    if (!crash.id) crash.id = '#' + String(Date.now()).slice(-4).padStart(3, '0');
    crash.views     = crash.views     ?? 0;
    crash.published = crash.published ?? true;
    crash.tags      = crash.tags      || [];
    crash.fix       = crash.fix       || [];
    crash.media     = crash.media     || [];

    const r = await fetch(`${SUPABASE_URL}/rest/v1/crashes`, {
      method: 'POST',
      headers: { ...sb, 'Prefer': 'return=representation' },
      body: JSON.stringify(crash),
    });
    if (!r.ok) {
      const err = await r.text();
      if (err.includes('23505')) return res.status(409).json({ error: 'ID ou code déjà existant' });
      return res.status(500).json({ error: 'Erreur création: ' + err });
    }
    return res.status(201).json({ success: true, crash: (await r.json())[0] });
  }

  // PUT — modifier
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id requis' });
    updates.updated_at = new Date().toISOString();

    const r = await fetch(`${SUPABASE_URL}/rest/v1/crashes?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...sb, 'Prefer': 'return=representation' },
      body: JSON.stringify(updates),
    });
    if (!r.ok) return res.status(500).json({ error: 'Erreur modification: ' + await r.text() });
    return res.status(200).json({ success: true, crash: (await r.json())[0] });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/crashes?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: sb,
    });
    if (!r.ok) return res.status(500).json({ error: 'Erreur suppression' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  try { return Buffer.from(auth.split(' ')[1], 'base64').toString('utf8').startsWith('admin:'); }
  catch { return false; }
}
