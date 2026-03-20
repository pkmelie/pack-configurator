// api/categories.js — Vercel Serverless Function
// Utilise config(key='crash_categories') pour ne pas
// entrer en conflit avec l'autre projet (pack-configurator)
// qui utilise config(key='categories')

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

  // Clé dédiée au crash analyzer — différente du pack-configurator
  const CONFIG_KEY = 'crash_categories';

  async function read() {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/config?key=eq.${CONFIG_KEY}&select=value`,
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
      body: JSON.stringify({ key: CONFIG_KEY, value: categories }),
    });
    if (!r.ok) throw new Error('Erreur sauvegarde: ' + await r.text());
  }

  // GET — public
  if (req.method === 'GET') {
    try {
      return res.status(200).json({ categories: await read() });
    } catch (e) {
      return res.status(200).json({ categories: DEFAULT_CATEGORIES });
    }
  }

  if (!verifyToken(req)) return res.status(401).json({ error: 'Non autorisé' });

  // POST — ajouter ou remplacer toute la liste
  if (req.method === 'POST') {
    const body = req.body;
    // Mode ancien : { categories: [...] }
    if (body.categories && Array.isArray(body.categories)) {
      try { await save(body.categories); return res.status(200).json({ success: true }); }
      catch (e) { return res.status(500).json({ error: e.message }); }
    }
    // Mode nouveau : { id, name, ... } → ajouter une catégorie
    if (!body.id || !body.name) return res.status(400).json({ error: 'id et name requis' });
    try {
      const cats = await read();
      if (cats.find(c => c.id === body.id)) return res.status(409).json({ error: 'ID déjà existant' });
      const newCat = { id: body.id.toLowerCase().replace(/\s+/g,'_'), name: body.name, icon: body.icon||'📁', color: body.color||'#00d4ff', desc: body.desc||'' };
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
      const filtered = cats.filter(c => c.id !== id);
      await save(filtered);
      return res.status(200).json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

// Catégories par défaut si la clé n'existe pas encore en DB
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
