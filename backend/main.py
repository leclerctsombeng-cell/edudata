"""
EduData — Backend API
INF 232 EC2 · Analyse de données scolaires
Framework : FastAPI + SQLite (via aiosqlite)
Auteur    : TP INF 232
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List
import sqlite3
import os
import math
from datetime import datetime

# ─── CONFIGURATION ────────────────────────────────────────────────────────────

DB_PATH = "edudata.db"

app = FastAPI(
    title="EduData API",
    description="API de collecte et analyse descriptive des données scolaires — INF 232 EC2",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS : autorise le frontend (développement et production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # En production, remplacer par l'URL exacte du frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── BASE DE DONNÉES ──────────────────────────────────────────────────────────

def get_db():
    """Retourne une connexion SQLite avec row_factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Crée les tables si elles n'existent pas."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS resultats (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nom         TEXT    NOT NULL,
            matricule   TEXT    NOT NULL,
            filiere     TEXT    NOT NULL,
            niveau      TEXT    NOT NULL,
            matiere     TEXT    NOT NULL,
            note        REAL    NOT NULL CHECK(note >= 0 AND note <= 20),
            semestre    TEXT,
            annee       TEXT    DEFAULT '2024-2025',
            created_at  TEXT    DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_filiere  ON resultats(filiere);
        CREATE INDEX IF NOT EXISTS idx_niveau   ON resultats(niveau);
        CREATE INDEX IF NOT EXISTS idx_semestre ON resultats(semestre);
        CREATE INDEX IF NOT EXISTS idx_matiere  ON resultats(matiere);
    """)
    conn.commit()
    conn.close()

# ─── MODÈLES PYDANTIC ─────────────────────────────────────────────────────────

class ResultatCreate(BaseModel):
    nom:       str = Field(..., min_length=2, max_length=100, description="Nom complet de l'étudiant")
    matricule: str = Field(..., min_length=3, max_length=20,  description="Matricule universitaire")
    filiere:   str = Field(..., min_length=2, max_length=60,  description="Filière d'études")
    niveau:    str = Field(..., min_length=2, max_length=30,  description="Niveau d'études")
    matiere:   str = Field(..., min_length=2, max_length=100, description="Matière évaluée")
    note:      float = Field(..., ge=0, le=20,                description="Note sur 20")
    semestre:  Optional[str] = Field(None, description="Semestre 1 ou 2")
    annee:     Optional[str] = Field("2024-2025",             description="Année académique")

    @validator('note')
    def note_multiple_025(cls, v):
        """Accepte les notes multiples de 0.25"""
        if round(v * 4) != v * 4:
            raise ValueError("La note doit être un multiple de 0.25")
        return round(v, 2)

class ResultatResponse(BaseModel):
    id:         int
    nom:        str
    matricule:  str
    filiere:    str
    niveau:     str
    matiere:    str
    note:       float
    semestre:   Optional[str]
    annee:      Optional[str]
    created_at: Optional[str]

class BulkImport(BaseModel):
    records: List[ResultatCreate] = Field(..., min_items=1, description="Liste des résultats à importer")

class StatistiquesResponse(BaseModel):
    n:             int
    moyenne:       float
    mediane:       float
    ecart_type:    float
    variance:      float
    minimum:       float
    maximum:       float
    etendue:       float
    taux_reussite: float
    par_mention:   dict
    par_filiere:   dict

# ─── HELPERS ─────────────────────────────────────────────────────────────────

def row_to_dict(row) -> dict:
    return dict(row)

def get_mention(note: float) -> str:
    if note >= 16: return "Très Bien"
    if note >= 14: return "Bien"
    if note >= 12: return "Assez Bien"
    if note >= 10: return "Passable"
    return "Insuffisant"

def calcul_stats(notes: List[float]) -> dict:
    n = len(notes)
    if n == 0:
        return {}
    notes_sorted = sorted(notes)
    moy  = sum(notes_sorted) / n
    med  = (notes_sorted[n//2 - 1] + notes_sorted[n//2]) / 2 if n % 2 == 0 else notes_sorted[n//2]
    var  = sum((x - moy) ** 2 for x in notes_sorted) / n
    std  = math.sqrt(var)
    return {
        "n":          n,
        "moyenne":    round(moy, 3),
        "mediane":    round(med, 3),
        "ecart_type": round(std, 3),
        "variance":   round(var, 3),
        "minimum":    round(min(notes_sorted), 2),
        "maximum":    round(max(notes_sorted), 2),
        "etendue":    round(max(notes_sorted) - min(notes_sorted), 2),
        "taux_reussite": round(len([x for x in notes_sorted if x >= 10]) / n * 100, 1)
    }

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.get("/", tags=["Info"])
def root():
    """Point d'entrée de l'API — vérification de l'état."""
    return {
        "app": "EduData API",
        "version": "1.0.0",
        "cours": "INF 232 EC2",
        "status": "running",
        "docs": "/docs"
    }

# ── Résultats ──

@app.post("/resultats", response_model=ResultatResponse, status_code=201, tags=["Résultats"])
def creer_resultat(body: ResultatCreate):
    """Enregistre un nouveau résultat étudiant."""
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO resultats (nom, matricule, filiere, niveau, matiere, note, semestre, annee)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (body.nom, body.matricule, body.filiere, body.niveau,
              body.matiere, body.note, body.semestre, body.annee))
        conn.commit()
        row = cur.execute("SELECT * FROM resultats WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Erreur base de données : {e}")
    finally:
        conn.close()

@app.post("/resultats/bulk", tags=["Résultats"])
def import_bulk(body: BulkImport):
    """Import groupé de plusieurs résultats en une seule requête."""
    conn = get_db()
    imported = 0
    errors   = []
    try:
        cur = conn.cursor()
        for i, rec in enumerate(body.records):
            try:
                cur.execute("""
                    INSERT INTO resultats (nom, matricule, filiere, niveau, matiere, note, semestre, annee)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (rec.nom, rec.matricule, rec.filiere, rec.niveau,
                      rec.matiere, rec.note, rec.semestre, rec.annee))
                imported += 1
            except Exception as e:
                errors.append({"ligne": i + 1, "erreur": str(e)})
        conn.commit()
        return {"imported": imported, "errors": errors}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/resultats", response_model=List[ResultatResponse], tags=["Résultats"])
def lister_resultats(
    filiere:  Optional[str] = Query(None),
    niveau:   Optional[str] = Query(None),
    semestre: Optional[str] = Query(None),
    matiere:  Optional[str] = Query(None),
    note_min: Optional[float] = Query(None, ge=0, le=20),
    note_max: Optional[float] = Query(None, ge=0, le=20),
    limit:    int = Query(1000, ge=1, le=5000),
    offset:   int = Query(0, ge=0)
):
    """Retourne la liste des résultats avec filtres optionnels."""
    conn = get_db()
    try:
        sql    = "SELECT * FROM resultats WHERE 1=1"
        params = []
        if filiere:  sql += " AND filiere  = ?"; params.append(filiere)
        if niveau:   sql += " AND niveau   = ?"; params.append(niveau)
        if semestre: sql += " AND semestre = ?"; params.append(semestre)
        if matiere:  sql += " AND matiere  = ?"; params.append(matiere)
        if note_min is not None: sql += " AND note >= ?"; params.append(note_min)
        if note_max is not None: sql += " AND note <= ?"; params.append(note_max)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        rows = conn.execute(sql, params).fetchall()
        return [row_to_dict(r) for r in rows]
    finally:
        conn.close()

@app.get("/resultats/{resultat_id}", response_model=ResultatResponse, tags=["Résultats"])
def get_resultat(resultat_id: int):
    """Retourne un résultat par son ID."""
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM resultats WHERE id = ?", (resultat_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Résultat non trouvé")
        return row_to_dict(row)
    finally:
        conn.close()

@app.delete("/resultats/{resultat_id}", tags=["Résultats"])
def supprimer_resultat(resultat_id: int):
    """Supprime un résultat par son ID."""
    conn = get_db()
    try:
        row = conn.execute("SELECT id FROM resultats WHERE id = ?", (resultat_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Résultat non trouvé")
        conn.execute("DELETE FROM resultats WHERE id = ?", (resultat_id,))
        conn.commit()
        return {"message": "Résultat supprimé", "id": resultat_id}
    finally:
        conn.close()

@app.delete("/resultats", tags=["Résultats"])
def vider_resultats():
    """Supprime tous les résultats (réinitialisation complète)."""
    conn = get_db()
    try:
        n = conn.execute("SELECT COUNT(*) FROM resultats").fetchone()[0]
        conn.execute("DELETE FROM resultats")
        conn.execute("DELETE FROM sqlite_sequence WHERE name='resultats'")
        conn.commit()
        return {"message": f"{n} enregistrement(s) supprimé(s)"}
    finally:
        conn.close()

# ── Statistiques ──

@app.get("/statistiques", tags=["Analyse"])
def statistiques_globales(
    filiere:  Optional[str] = Query(None),
    niveau:   Optional[str] = Query(None),
    semestre: Optional[str] = Query(None)
):
    """
    Calcule les statistiques descriptives globales ou filtrées :
    moyenne, médiane, écart-type, variance, min, max, taux de réussite, répartition par mention.
    """
    conn = get_db()
    try:
        sql    = "SELECT note, filiere FROM resultats WHERE 1=1"
        params = []
        if filiere:  sql += " AND filiere  = ?"; params.append(filiere)
        if niveau:   sql += " AND niveau   = ?"; params.append(niveau)
        if semestre: sql += " AND semestre = ?"; params.append(semestre)
        rows = conn.execute(sql, params).fetchall()

        if not rows:
            raise HTTPException(status_code=404, detail="Aucune donnée trouvée pour ces filtres")

        notes = [r["note"] for r in rows]
        stats = calcul_stats(notes)

        # Répartition par mention
        mentions = {}
        for n in notes:
            m = get_mention(n)
            mentions[m] = mentions.get(m, 0) + 1

        # Moyenne par filière
        filieres = {}
        for r in rows:
            f = r["filiere"]
            if f not in filieres:
                filieres[f] = []
            filieres[f].append(r["note"])
        moy_filiere = {f: round(sum(ns)/len(ns), 2) for f, ns in filieres.items()}

        return {**stats, "par_mention": mentions, "par_filiere": moy_filiere}
    finally:
        conn.close()

@app.get("/statistiques/filieres", tags=["Analyse"])
def stats_par_filiere():
    """Statistiques détaillées groupées par filière."""
    conn = get_db()
    try:
        filieres = [r[0] for r in conn.execute("SELECT DISTINCT filiere FROM resultats").fetchall()]
        result = {}
        for f in filieres:
            notes = [r[0] for r in conn.execute("SELECT note FROM resultats WHERE filiere = ?", (f,)).fetchall()]
            result[f] = calcul_stats(notes)
        return result
    finally:
        conn.close()

@app.get("/statistiques/niveaux", tags=["Analyse"])
def stats_par_niveau():
    """Statistiques descriptives groupées par niveau d'études."""
    conn = get_db()
    try:
        niveaux = [r[0] for r in conn.execute("SELECT DISTINCT niveau FROM resultats").fetchall()]
        result = {}
        for nv in niveaux:
            notes = [r[0] for r in conn.execute("SELECT note FROM resultats WHERE niveau = ?", (nv,)).fetchall()]
            result[nv] = calcul_stats(notes)
        return result
    finally:
        conn.close()

@app.get("/export/csv", tags=["Export"])
def export_csv():
    """Exporte toutes les données en format CSV (texte brut)."""
    from fastapi.responses import Response
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM resultats ORDER BY filiere, nom").fetchall()
        lines = ["id;nom;matricule;filiere;niveau;matiere;note;mention;semestre;annee;created_at"]
        for r in rows:
            d = dict(r)
            m = get_mention(d["note"])
            lines.append(f"{d['id']};{d['nom']};{d['matricule']};{d['filiere']};{d['niveau']};{d['matiere']};{d['note']};{m};{d['semestre']};{d['annee']};{d['created_at']}")
        csv_content = "\n".join(lines)
        return Response(
            content="\ufeff" + csv_content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=edudata_export.csv"}
        )
    finally:
        conn.close()

# ─── DÉMARRAGE ────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    """Initialise la base de données au démarrage."""
    init_db()
    print("✅ EduData API démarrée — base de données initialisée")
    print(f"📄 Documentation : http://localhost:8000/docs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
