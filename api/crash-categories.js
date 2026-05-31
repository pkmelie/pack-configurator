// api/crash-categories.js — Dédié au crash analyzer
// Utilise config(key='crash_categories') — séparé du pack-configurator
// GET    /api/crash-categories         → liste publique
// POST   /api/crash-categories         → ajouter (admin)
// PUT    /api/crash-categories         → modifier (admin)
// DELETE /api/crash-categories?id=X   → supprimer (admin)

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

  async function read() {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/config?key=eq.crash_categories&select=value`,
      { headers: sb }
    );
    if (!r.ok) throw new Error('Erreur lecture Supabase');
    const rows = await r.json();
    return (rows && rows.length > 0) ? (rows[0].value || []) : DEFAULT_CATEGORIES;
  }

  async function save(categories) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
      method: 'POST',
      headers: { ...sb, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: 'crash_categories', value: categories }),
    });
    if (!r.ok) throw new Error('Erreur sauvegarde: ' + await r.text());
  }

  // GET — public
  if (req.method === 'GET') {
    try {
      return res.status(200).json({ categories: await read() });
    } catch {
      return res.status(200).json({ categories: DEFAULT_CATEGORIES });
    }
  }

  if (!verifyToken(req)) return res.status(401).json({ error: 'Non autorisé' });

  // POST — ajouter une catégorie
  if (req.method === 'POST') {
    const body = req.body;
    if (!body.id || !body.name) return res.status(400).json({ error: 'id et name requis' });
    try {
      const cats = await read();
      if (cats.find(c => c.id === body.id)) return res.status(409).json({ error: 'ID déjà existant' });
      const newCat = {
        id:    body.id.toLowerCase().replace(/\s+/g, '_'),
        name:  body.name,
        icon:  body.icon  || '📁',
        color: body.color || '#00d4ff',
        desc:  body.desc  || '',
      };
      cats.push(newCat);
      await save(cats);
      return res.status(201).json({ success: true, category: newCat });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT — modifier
  if (req.method === 'PUT') {
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const cats = await read();
      const idx = cats.findIndex(c => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Catégorie non trouvée' });
      cats[idx] = { ...cats[idx], ...updates, id };
      await save(cats);
      return res.status(200).json({ success: true, category: cats[idx] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const cats = await read();
      await save(cats.filter(c => c.id !== id));
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

const DEFAULT_CATEGORIES = [
  { id:'gpu',       icon:'🖥️', name:'GPU/DirectX',  color:'#a855f7', desc:'Erreurs liées au GPU et DirectX' },
  { id:'memory',    icon:'💾',  name:'Mémoire',       color:'#ff6b35', desc:'RAM, heap, mémoire virtuelle'    },
  { id:'network',   icon:'🌐',  name:'Réseau',         color:'#00d4ff', desc:'Connexion, ping, firewall, DNS'  },
  { id:'scripts',   icon:'📜',  name:'Scripts',        color:'#ffdd57', desc:'Erreurs Lua et ressources'       },
  { id:'streaming', icon:'📦',  name:'Streaming',      color:'#23d160', desc:'Téléchargement des assets'       },
  { id:'launcher',  icon:'🚀',  name:'Launcher',       color:'#ff3860', desc:'Mise à jour et lancement FiveM'  },
  { id:'anticheat', icon:'🛡️', name:'Anti-Cheat',    color:'#7fff00', desc:'EAC et Cfx anti-cheat'           },
];

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  try { return Buffer.from(auth.split(' ')[1], 'base64').toString('utf8').startsWith('admin:'); }
  catch { return false; }
}
