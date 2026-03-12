// api/categories.js
// Stockage des catégories en mémoire (persist tant que la fonction est "chaude")
// Pour de la vraie persistance → connecte une DB (Supabase, PlanetScale, etc.)

let categoriesStore = null; // null = utilise les données par défaut du frontend

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — retourner les catégories
  if (req.method === 'GET') {
    return res.status(200).json({ categories: categoriesStore });
  }

  // POST — sauvegarder les catégories (admin seulement)
  if (req.method === 'POST') {
    // Vérif token basique
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const token = auth.split(' ')[1];
    // Vérif simple du token (même logique que login.js)
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const [role] = decoded.split(':');
      if (role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });
    } catch {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ error: 'Format invalide' });

    categoriesStore = categories;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
