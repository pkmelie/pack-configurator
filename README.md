# Pack Configurator — Guide de déploiement Vercel

## Structure du projet

```
pack-configurator/
├── api/
│   ├── login.js        ← Vérifie le mot de passe (lit ADMIN_PASSWORD depuis l'env)
│   └── categories.js   ← API pour sauvegarder les catégories (optionnel)
├── public/
│   └── index.html      ← Frontend complet
├── vercel.json         ← Config Vercel
└── README.md
```

---

## Déploiement en 5 étapes

### 1. Crée un repo GitHub
```bash
git init
git add .
git commit -m "init pack configurator"
# Crée un repo sur github.com puis :
git remote add origin https://github.com/TON_PSEUDO/pack-configurator.git
git push -u origin main
```

### 2. Importe sur Vercel
- Va sur https://vercel.com/new
- Clique **"Import Git Repository"**
- Sélectionne ton repo `pack-configurator`
- Clique **Deploy** (ne touche rien d'autre pour l'instant)

### 3. Ajoute la variable d'environnement
- Dans ton projet Vercel → **Settings** → **Environment Variables**
- Ajoute :
  ```
  Nom   : ADMIN_PASSWORD
  Valeur: ton-mot-de-passe-secret
  ```
- Coche les 3 environnements : Production, Preview, Development
- Clique **Save**

### 4. Redéploie pour appliquer la variable
- Onglet **Deployments** → clique les **3 points** sur le dernier déploiement → **Redeploy**

### 5. C'est en ligne ! 🎉
- URL : `https://pack-configurator-XXX.vercel.app`

---

## Tester en local

Si tu veux tester avant de pousser sur Vercel :

```bash
npm i -g vercel
vercel dev
```

Puis crée un fichier `.env.local` :
```
ADMIN_PASSWORD=ton-mot-de-passe-secret
```

---

## Changer le mot de passe

1. Va dans Vercel → Settings → Environment Variables
2. Modifie `ADMIN_PASSWORD`
3. Redéploie (Deployments → Redeploy)

---

## Persistance des données (optionnel)

Actuellement, les catégories sont stockées en mémoire côté serveur.
Si tu veux qu'elles persistent entre les déploiements, connecte une base de données :

**Option simple (gratuit) → Supabase**
1. Crée un projet sur https://supabase.com
2. Crée une table `categories` avec une colonne `data` (jsonb)
3. Ajoute `SUPABASE_URL` et `SUPABASE_KEY` dans les env vars Vercel
4. Adapte `api/categories.js` pour lire/écrire dans Supabase

---

## Sécurité

- ✅ Le mot de passe n'est **jamais** dans le code source
- ✅ Il est lu uniquement côté serveur (fonction Vercel)
- ✅ Le frontend reçoit juste un token temporaire, pas le vrai mot de passe
- ⚠️ Pour de la production sérieuse → utilise JWT signé avec `jsonwebtoken`
