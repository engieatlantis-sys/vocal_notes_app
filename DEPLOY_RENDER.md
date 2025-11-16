# Déployer Vocal Notes App sur Render + Netlify

Ce guide couvre le déploiement complet : backend sur Render, frontend sur Netlify.

## Architecture
- **Backend (Render)**: Express server avec OpenAI Whisper + Chat, MongoDB
- **Frontend (Netlify)**: React/Vite PWA qui appelle le backend public

---

## Étape 1 : Déployer le Backend sur Render

### 1.1 Prérequis
- Compte Render (render.com)
- Repo GitHub avec le dossier `server/` (ou le repo complet)
- Clé OpenAI et URL MongoDB Atlas (que vous avez déjà)

### 1.2 Créer un Web Service sur Render

1. **Connecter GitHub**
   - Allez sur render.com → Connectez votre compte GitHub

2. **Créer un nouveau Web Service**
   - Cliquez "New +" → "Web Service"
   - Sélectionnez votre repo contenant `server/`

3. **Configurer le service**
   - **Name**: `vocal-notes-api` (ou le nom que vous voulez)
   - **Region**: choisissez votre région (ex: Frankfurt, Oregon, etc.)
   - **Branch**: `main` (ou votre branche par défaut)
   - **Root Directory**: `server` (si votre repo est mono/multi-dossier, sinon laissez blank)
   - **Runtime**: Node
   - **Build Command**: `npm install` (laissez vide si Render autodetecte — il le fera)
   - **Start Command**: `npm start`

4. **Ajouter les variables d'environnement**
   - Scroll down → "Environment" → Add Environment Variables:
   
   | Variable | Valeur |
   |----------|--------|
   | `OPENAI_API_KEY` | `sk-...` (votre clé OpenAI) |
   | `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/vocal_notes_app?...` |
   | `PORT` | `3001` (optionnel — Render affecte un port auto) |
   | `NODE_ENV` | `production` (optionnel) |

5. **Déployer**
   - Cliquez "Create Web Service"
   - Render lance le build (logs visibles en temps réel)
   - Une fois ready, vous recevrez une URL : `https://vocal-notes-api.onrender.com` (exemple)

### 1.3 Vérifier que le backend fonctionne

Ouvrez un terminal et testez :
```bash
# Remplacez par votre URL Render
curl -sS https://vocal-notes-api.onrender.com/api/notes
```

Vous devriez voir un tableau JSON (même vide). Si erreur 500, check Render logs.

---

## Étape 2 : Configurer Netlify Frontend

### 2.1 Ajouter la variable d'environnement

1. **Sur Netlify**
   - Allez à votre site → **Site Settings** → **Build & deploy** → **Environment**
   - Cliquez "Edit variables"

2. **Ajouter la variable**
   - Key: `VITE_API_URL`
   - Value: `https://vocal-notes-api.onrender.com` (l'URL de votre Render service)

3. **Redeploy**
   - Allez à "Deploys" → Cliquez le deploy le plus récent
   - Cliquez "Redeploy" (pour rerun la build avec la nouvelle env var)

### 2.2 Vérifier la build

- Attendez que Netlify recompile et déploie
- Allez sur votre site Netlify
- DevTools → Console et Network
- Vérifiez que l'URL de l'API est la bonne : ouvrez Network, enregistrez une note, cherchez une requête vers `https://vocal-notes-api.onrender.com`

---

## Étape 3 : Test End-to-End

1. **Ouvrez votre site Netlify**
   - Ex: `https://your-site.netlify.app`

2. **Enregistrez une note**
   - Appuyez sur le micro
   - Dites quelque chose (ex: "Réunion demain à 10h")
   - Arrêtez l'enregistrement

3. **Regardez la Network tab**
   - `POST /api/transcribe` → doit voir status 200 de Render
   - `POST /api/analyze-note` → doit voir status 200
   - `POST /api/notes` → doit voir status 200 et response JSON avec `id`

4. **Attendez la modale**
   - La modale devrait afficher le titre/contenu transcrits et analysés
   - Cliquez "Enregistrer"

5. **Vérifiez que la note apparaît**
   - Voilà ! Si tout fonctionne, la note s'affiche dans l'UI

### Dépannage

| Problème | Cause | Solution |
|----------|-------|----------|
| Pas de transcription | API backend non accessible | Vérifiez URL Render, VITE_API_URL sur Netlify |
| 401/403 OpenAI | Clé invalide ou expirée | Vérifiez `OPENAI_API_KEY` sur Render |
| 500 MongoDB | Connection string invalide | Vérifiez `MONGO_URI` sur Render (network access sur Atlas) |
| CORS error | Frontend origin non autorisée | Sur `server/index.js`, passez la bonne origine à `cors()` |
| Service Worker failed | PWA config | Pas bloquant — feature amélioration; l'app fonctionne sans |

---

## Étape 4 : Optionnel — Améliorer la Prod

- **CORS sécurisé**: Mettez à jour `server/index.js` pour autoriser uniquement votre Netlify domain:
  ```js
  app.use(cors({ origin: 'https://your-site.netlify.app' }));
  ```

- **Health check**: Ajouter un endpoint `/health` pour monitorer:
  ```js
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
  ```

- **Domaine personnalisé**: Sur Netlify, ajoutez un domaine dans "Site settings" → "Domain management"

- **PWA**: Sur mobile, ouvrez votre site et cherchez "Ajouter à l'écran d'accueil" (Android) ou "Partager → Sur l'écran d'accueil" (iOS)

---

## Commandes utiles

```bash
# Test local avant déploiement
cd /Users/touati/Downloads/vocal_notes_app/server
npm install
OPENAI_API_KEY=sk-... MONGO_URI=mongodb+srv://... npm start

# Frontend preview build
cd /Users/touati/Downloads/vocal_notes_app
npm run build
npm run preview

# Check Render logs via CLI (si Render CLI installed)
render logs <service-id>
```

---

## Support

- **Render docs**: render.com/docs
- **Netlify docs**: netlify.com/docs
- **OpenAI API**: platform.openai.com/docs

Vous êtes prêt ! Testez et signalez tout problème. 🎉
