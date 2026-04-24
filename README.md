# EduData — Application de collecte et analyse de données scolaires
## INF 232 · EC2 · Analyse de données

---

## Structure du projet

```
edudata/
├── frontend/
│   ├── index.html      ← Interface principale
│   ├── style.css       ← Feuille de styles
│   └── app.js          ← Logique JavaScript & appels API
│
└── backend/
    ├── main.py         ← API Python (FastAPI + SQLite)
    ├── requirements.txt
    └── edudata.db      ← Base de données (créée automatiquement)
```

---

## Installation et lancement

### 1. Backend (Python / FastAPI)

```bash
# Aller dans le dossier backend
cd backend

# Créer un environnement virtuel (recommandé)
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python main.py
# ou :
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Le serveur démarre sur : **http://localhost:8000**
Documentation interactive : **http://localhost:8000/docs**

---

### 2. Frontend (HTML / CSS / JS)

#### Option A — Serveur local simple
```bash
cd frontend
python -m http.server 5500
# Ouvrir : http://localhost:5500
```

#### Option B — Extension VS Code
Utiliser **Live Server** (extension VS Code) → clic droit sur `index.html` → "Open with Live Server"

---

## Déploiement en ligne (pour le TP)

### Backend → Render.com (gratuit)
1. Créer un compte sur https://render.com
2. Nouveau service → Web Service → connecter GitHub
3. Build command : `pip install -r requirements.txt`
4. Start command : `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend → Vercel ou Netlify (gratuit)
1. Mettre à jour `API_BASE` dans `app.js` avec l'URL Render
2. Déposer le dossier `frontend/` sur Vercel/Netlify
3. Récupérer le lien → envoyer à **rollinfrancis28@gmail.com**

---

## Endpoints de l'API

| Méthode | Route                    | Description                        |
|---------|--------------------------|------------------------------------|
| GET     | /                        | Statut de l'API                    |
| POST    | /resultats               | Créer un résultat                  |
| POST    | /resultats/bulk          | Import groupé                      |
| GET     | /resultats               | Lister (avec filtres)              |
| GET     | /resultats/{id}          | Détail d'un résultat               |
| DELETE  | /resultats/{id}          | Supprimer un résultat              |
| DELETE  | /resultats               | Vider toute la base                |
| GET     | /statistiques            | Stats globales (moyenne, écart-type…) |
| GET     | /statistiques/filieres   | Stats par filière                  |
| GET     | /statistiques/niveaux    | Stats par niveau                   |
| GET     | /export/csv              | Export CSV complet                 |

---

## Fonctionnalités

- **Saisie individuelle** — formulaire complet (nom, matricule, filière, niveau, matière, note, semestre)
- **Import groupé** — coller plusieurs lignes au format CSV
- **Export CSV** — télécharger toutes les données
- **Filtres** — par filière, niveau, semestre, recherche textuelle
- **Suppression** — par ligne ou totale
- **Analyse descriptive** — moyenne, médiane, écart-type, variance, min/max, taux de réussite
- **Graphiques** — histogramme des notes, répartition par mention (doughnut), moyenne par filière

---

## Technologies utilisées

| Couche    | Technologie        |
|-----------|--------------------|
| Frontend  | HTML5, CSS3, JS ES6 |
| Graphiques| Chart.js 4.4       |
| Backend   | Python 3.10+, FastAPI |
| Base de données | SQLite 3   |
| ORM       | sqlite3 (stdlib)   |

---

*TP INF 232 EC2 — Cours Mercredi 7H–10H*
