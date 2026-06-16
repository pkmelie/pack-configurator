// api/upload.js — Vercel Serverless Function
// Upload d'image ou vidéo vers Supabase Storage
// POST /api/upload — multipart/form-data avec field "file"
// Retourne { url, path }

const { Readable } = require('stream');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyToken(req)) return res.status(401).json({ error: 'Non autorisé' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase non configuré' });

  try {
    // Lire le body brut (Vercel parse le body en buffer pour les multipart)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);

    // Extraire le Content-Type et boundary
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type doit être multipart/form-data' });
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'Boundary manquant' });

    // Parser le multipart manuellement (pas de lib externe disponible)
    const parsed = parseMultipart(rawBody, boundary);
    const filePart = parsed.find(p => p.name === 'file');

    if (!filePart) return res.status(400).json({ error: 'Champ "file" manquant' });

    // Vérification type
    const allowedTypes = ['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/webm'];
    if (!allowedTypes.includes(filePart.contentType)) {
      return res.status(400).json({ error: 'Type de fichier non autorisé. Acceptés: JPG, PNG, GIF, WEBP, MP4, WEBM' });
    }

    // Taille max 10MB
    if (filePart.data.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Fichier trop volumineux (max 10MB)' });
    }

    // Générer un nom de fichier unique
    const ext = filePart.contentType.split('/')[1].replace('jpeg','jpg');
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const storagePath = `crashes/${fileName}`;

    // Upload vers Supabase Storage
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/crash-media/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': filePart.contentType,
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
        body: filePart.data,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return res.status(500).json({ error: 'Erreur upload Supabase: ' + err });
    }

    // URL publique
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/crash-media/${storagePath}`;

    return res.status(200).json({
      success: true,
      url: publicUrl,
      path: storagePath,
      type: filePart.contentType.startsWith('video/') ? 'video' : 'image',
    });

  } catch (err) {
    console.error('[UPLOAD]', err);
    return res.status(500).json({ error: 'Erreur serveur: ' + err.message });
  }
};

// Parser multipart/form-data basique (sans lib externe)
function parseMultipart(body, boundary) {
  const parts = [];
  const sep = Buffer.from('--' + boundary);
  const end = Buffer.from('--' + boundary + '--');

  let start = 0;
  while (start < body.length) {
    const boundaryIdx = indexOf(body, sep, start);
    if (boundaryIdx === -1) break;

    const headerStart = boundaryIdx + sep.length + 2; // skip \r\n
    if (body.slice(boundaryIdx, boundaryIdx + end.length).equals(end)) break;

    // Trouver la fin des headers (double \r\n)
    const headerEnd = indexOf(body, Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd === -1) break;

    const headerStr = body.slice(headerStart, headerEnd).toString('utf8');
    const dataStart = headerEnd + 4;

    // Trouver la fin des données
    const nextBoundary = indexOf(body, sep, dataStart);
    const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : body.length; // -2 pour \r\n

    // Parser les headers
    const part = { name: null, filename: null, contentType: 'text/plain', data: body.slice(dataStart, dataEnd) };
    for (const line of headerStr.split('\r\n')) {
      const lower = line.toLowerCase();
      if (lower.startsWith('content-disposition:')) {
        const nameMatch = line.match(/name="([^"]+)"/);
        const fileMatch = line.match(/filename="([^"]+)"/);
        if (nameMatch) part.name = nameMatch[1];
        if (fileMatch) part.filename = fileMatch[1];
      }
      if (lower.startsWith('content-type:')) {
        part.contentType = line.split(':')[1].trim();
      }
    }

    parts.push(part);
    start = nextBoundary !== -1 ? nextBoundary : body.length;
  }

  return parts;
}

function indexOf(buf, search, start = 0) {
  for (let i = start; i <= buf.length - search.length; i++) {
    if (buf.slice(i, i + search.length).equals(search)) return i;
  }
  return -1;
}

function verifyToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  try { return Buffer.from(auth.split(' ')[1], 'base64').toString('utf8').startsWith('admin:'); }
  catch { return false; }
}
