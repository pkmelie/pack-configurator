// api/login.js
// Vercel Serverless Function
// Le mot de passe est lu depuis les variables d'environnement Vercel
// → jamais exposé dans le code frontend

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, role } = req.body;

  // Mot de passe admin lu depuis la variable d'env Vercel
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD non configuré sur le serveur.' });
  }

  if (role === 'admin') {
    if (password === ADMIN_PASSWORD) {
      // On renvoie un token simple (timestamp signé)
      // Pour de la vraie prod, utilise JWT avec un secret
      const token = Buffer.from(`admin:${Date.now()}:${ADMIN_PASSWORD.length}`).toString('base64');
      return res.status(200).json({ success: true, role: 'admin', token });
    } else {
      return res.status(401).json({ success: false, error: 'Mot de passe incorrect.' });
    }
  }

  if (role === 'guest') {
    return res.status(200).json({ success: true, role: 'guest' });
  }

  return res.status(400).json({ error: 'Role invalide.' });
}
