-- ============================================================
-- SUPABASE — FiveM Crash Analyzer
-- À coller dans : Supabase → SQL Editor → Run
--
-- ⚠ Ne touche PAS à ta table 'config' existante.
--   Ajoute seulement la table 'crashes' + Storage bucket.
-- ============================================================

-- ── 1. TABLE crashes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crashes (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  code        TEXT NOT NULL,
  severity    TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  cat         TEXT NOT NULL,
  tags        JSONB    DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  fix         JSONB    DEFAULT '[]',
  media       JSONB    DEFAULT '[]',
  views       INTEGER  DEFAULT 0,
  published   BOOLEAN  DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Auto updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crashes_set_updated_at ON crashes;
CREATE TRIGGER crashes_set_updated_at
  BEFORE UPDATE ON crashes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. RLS — lecture publique ─────────────────────────────────
ALTER TABLE crashes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published" ON crashes;
CREATE POLICY "public_read_published" ON crashes
  FOR SELECT USING (published = true);

-- ── 4. Storage bucket pour les médias ─────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('crash-media', 'crash-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_read_crash_media" ON storage.objects;
CREATE POLICY "public_read_crash_media" ON storage.objects
  FOR SELECT USING (bucket_id = 'crash-media');

DROP POLICY IF EXISTS "service_upload_crash_media" ON storage.objects;
CREATE POLICY "service_upload_crash_media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'crash-media');

DROP POLICY IF EXISTS "service_delete_crash_media" ON storage.objects;
CREATE POLICY "service_delete_crash_media" ON storage.objects
  FOR DELETE USING (bucket_id = 'crash-media');

-- ── 5. Fonction incrémenter les vues ──────────────────────────
CREATE OR REPLACE FUNCTION increment_crash_views(crash_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE crashes SET views = views + 1 WHERE id = crash_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Catégories par défaut dans config (si vide seulement) ──
INSERT INTO config (key, value)
VALUES (
  'categories',
  '[
    {"id":"gpu",       "icon":"🖥️","name":"GPU/DirectX",  "color":"#a855f7","desc":"Erreurs GPU et DirectX"},
    {"id":"memory",    "icon":"💾", "name":"Mémoire",      "color":"#ff6b35","desc":"RAM, heap, mémoire virtuelle"},
    {"id":"network",   "icon":"🌐", "name":"Réseau",        "color":"#00d4ff","desc":"Connexion, firewall, DNS"},
    {"id":"scripts",   "icon":"📜", "name":"Scripts",       "color":"#ffdd57","desc":"Erreurs Lua et ressources"},
    {"id":"streaming", "icon":"📦", "name":"Streaming",     "color":"#23d160","desc":"Téléchargement des assets"},
    {"id":"launcher",  "icon":"🚀", "name":"Launcher",      "color":"#ff3860","desc":"Mise à jour FiveM"},
    {"id":"anticheat", "icon":"🛡️","name":"Anti-Cheat",   "color":"#7fff00","desc":"EAC et Cfx anti-cheat"}
  ]'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ── 7. Quelques erreurs de départ ─────────────────────────────
INSERT INTO crashes (id, title, code, severity, cat, tags, description, fix, views) VALUES
(
  '#001','Erreur DirectX Init','ERR_GFX_D3D_INIT','critical','gpu',
  '["DirectX","GPU","Drivers"]'::jsonb,
  'FiveM ne peut pas initialiser DirectX 11. Causé par des drivers GPU obsolètes ou DirectX corrompu.',
  '[{"title":"Mettre à jour les drivers GPU","desc":"Installation propre avec DDU recommandée.","code":"DDU → Mode sans échec → Nettoyer → Installer"},{"title":"Réinstaller DirectX Runtime","desc":"Package depuis Microsoft.","code":"dxwebsetup.exe"},{"title":"Vérifier les logs","desc":"","code":"%AppData%\\\\CitizenFX\\\\logs\\\\CitizenFX.log"}]'::jsonb,
  4218
),
(
  '#002','Erreur Mémoire Heap','ERR_MEM_HEAP_UNKOWN','critical','memory',
  '["RAM","Memory Leak"]'::jsonb,
  'Débordement de la mémoire heap. RAM insuffisante ou ressources qui fuient.',
  '[{"title":"Augmenter la mémoire virtuelle","desc":"Fichier déchange → 8-16 GB."},{"title":"Activer Large Pages","desc":"","code":"CitizenFX.ini → AdditionalFlags=--use-heap-pagefile"}]'::jsonb,
  3812
),
(
  '#003','Timeout Connexion','TIMEOUT_CONNECTING','medium','network',
  '["Connexion","Firewall","DNS"]'::jsonb,
  'FiveM ne parvient pas à se connecter. Firewall, DNS ou serveur surchargé.',
  '[{"title":"Exception Firewall","desc":"Autoriser FiveM.exe. Port UDP 30120.","code":"UDP 30120 → Autoriser"},{"title":"Changer DNS","desc":"","code":"DNS: 1.1.1.1 / 8.8.8.8"},{"title":"Flush DNS","desc":"","code":"ipconfig /flushdns"}]'::jsonb,
  6102
),
(
  '#007','Anti-Cheat Kick','ANTICHEAT_GLOBAL_DENY','critical','anticheat',
  '["Anti-cheat","Ban"]'::jsonb,
  'Anti-cheat détecté une modification. Peut être un faux positif avec certains logiciels.',
  '[{"title":"Fermer les overlays","desc":"MSI Afterburner, Rivatuner, CheatEngine → tout fermer avant FiveM."},{"title":"Vérifier le dossier GTA V","desc":"Aucun mod dans le dossier GTA V.","code":"Aucun fichier .asi ou .dll modifié"}]'::jsonb,
  8943
)
ON CONFLICT (id) DO NOTHING;
