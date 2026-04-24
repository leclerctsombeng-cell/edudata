/**
 * EduData — Application principale
 * INF 232 EC2 · Analyse de données scolaires
 * Frontend JS : communication avec l'API Python (FastAPI)
 */

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
const API_BASE = 'https://edudata-aoe7.onrender.com';  // Changer pour l'URL du serveur en production

// ─── ÉTAT LOCAL ──────────────────────────────────────────────────────────────
let localData = [];
let charts = {};

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

function getMention(note) {
  if (note >= 16) return { label: 'Très Bien',  code: 'A' };
  if (note >= 14) return { label: 'Bien',        code: 'B' };
  if (note >= 12) return { label: 'Assez Bien',  code: 'C' };
  if (note >= 10) return { label: 'Passable',    code: 'D' };
  return               { label: 'Insuffisant', code: 'E' };
}

function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => { el.className = 'toast'; }, 3000);
}

function updateBadge() {
  document.getElementById('nav-badge').textContent = localData.length;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiGet(path) {
  const r = await fetch(API_BASE + path);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Erreur serveur' }));
    throw new Error(err.detail || 'Erreur serveur');
  }
  return r.json();
}

async function apiDelete(path) {
  const r = await fetch(API_BASE + path, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ─── CHARGEMENT DES DONNÉES ───────────────────────────────────────────────────

async function loadData(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.filiere) params.append('filiere', filters.filiere);
    if (filters.niveau)  params.append('niveau',  filters.niveau);
    if (filters.semestre) params.append('semestre', filters.semestre);
    const path = '/resultats' + (params.toString() ? '?' + params : '');
    localData = await apiGet(path);
    updateBadge();
    updateApiStatus(true);
  } catch (e) {
    console.warn('API indisponible, mode hors-ligne :', e.message);
    updateApiStatus(false);
  }
}

// ─── PAGE : SAISIE ───────────────────────────────────────────────────────────

async function enregistrer() {
  const nom     = document.getElementById('f-nom').value.trim();
  const mat     = document.getElementById('f-mat').value.trim();
  const filiere = document.getElementById('f-filiere').value;
  const niveau  = document.getElementById('f-niveau').value;
  const matiere = document.getElementById('f-matiere').value.trim();
  const noteRaw = document.getElementById('f-note').value;
  const note    = parseFloat(noteRaw);
  const sem     = document.getElementById('f-semestre').value;
  const annee   = document.getElementById('f-annee').value;

  if (!nom || !mat || !filiere || !niveau || !matiere || isNaN(note) || note < 0 || note > 20 || !sem) {
    showToast('Veuillez remplir tous les champs correctement.', true);
    return;
  }

  const btn = document.getElementById('btn-enregistrer');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enregistrement...';

  try {
    await apiPost('/resultats', { nom, matricule: mat, filiere, niveau, matiere, note, semestre: sem, annee });
    await loadData();
    showToast('Donnée enregistrée avec succès !');
    // Reset form
    ['f-nom','f-mat','f-note','f-matiere'].forEach(id => document.getElementById(id).value = '');
    ['f-filiere','f-niveau','f-semestre'].forEach(id => document.getElementById(id).value = '');
  } catch (e) {
    showToast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Enregistrer';
  }
}

async function importBulk() {
  const raw = document.getElementById('f-bulk').value.trim();
  if (!raw) { showToast('Aucune donnée à importer.', true); return; }

  const lines = raw.split('\n').filter(l => l.trim());
  const records = [];

  for (const line of lines) {
    const p = line.split(';').map(s => s.trim());
    if (p.length < 6) continue;
    const note = parseFloat(p[5]);
    if (isNaN(note) || note < 0 || note > 20) continue;
    records.push({
      nom: p[0], matricule: p[1], filiere: p[2],
      niveau: p[3], matiere: p[4], note,
      semestre: p[6] || 'Semestre 1', annee: '2024-2025'
    });
  }

  if (!records.length) { showToast('Aucune ligne valide trouvée.', true); return; }

  const btn = document.getElementById('btn-import');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Import en cours...';

  try {
    const res = await apiPost('/resultats/bulk', { records });
    await loadData();
    document.getElementById('f-bulk').value = '';
    showToast(`${res.imported} ligne(s) importée(s) avec succès !`);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg> Importer les données';
  }
}

function exportCSV() {
  if (!localData.length) { showToast('Aucune donnée à exporter.', true); return; }
  const header = 'Nom;Matricule;Filière;Niveau;Matière;Note;Mention;Semestre;Année\n';
  const rows = localData.map(d => {
    const m = getMention(d.note);
    return [d.nom, d.matricule, d.filiere, d.niveau, d.matiere, d.note, m.label, d.semestre, d.annee].join(';');
  });
  const csv = header + rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'edudata_export.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── PAGE : DONNÉES ───────────────────────────────────────────────────────────

function renderTable() {
  const ff     = document.getElementById('filter-filiere').value;
  const fn     = document.getElementById('filter-niveau').value;
  const fs     = document.getElementById('filter-sem').value;
  const search = document.getElementById('filter-search').value.toLowerCase();

  // Mettre à jour les options des filtres
  const filieres = [...new Set(localData.map(d => d.filiere))].filter(Boolean).sort();
  const niveaux  = [...new Set(localData.map(d => d.niveau))].filter(Boolean).sort();

  const selF = document.getElementById('filter-filiere');
  const curF = selF.value;
  selF.innerHTML = '<option value="">Toutes les filières</option>' +
    filieres.map(f => `<option ${f === curF ? 'selected' : ''}>${f}</option>`).join('');

  const selN = document.getElementById('filter-niveau');
  const curN = selN.value;
  selN.innerHTML = '<option value="">Tous les niveaux</option>' +
    niveaux.map(n => `<option ${n === curN ? 'selected' : ''}>${n}</option>`).join('');

  let filtered = localData.filter(d =>
    (!ff || d.filiere === ff) &&
    (!fn || d.niveau  === fn) &&
    (!fs || d.semestre === fs) &&
    (!search || d.nom.toLowerCase().includes(search) || d.matricule.toLowerCase().includes(search))
  );

  const tbody  = document.getElementById('table-body');
  const empty  = document.getElementById('empty-donnees');
  const footer = document.getElementById('table-footer');

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    footer.textContent = '';
    return;
  }

  empty.style.display = 'none';
  footer.textContent = `${filtered.length} enregistrement(s) affiché(s)`;

  tbody.innerHTML = filtered.map((d, i) => {
    const m = getMention(d.note);
    return `<tr>
      <td>${i + 1}</td>
      <td>${d.nom}</td>
      <td><code style="background:var(--bg-hover);padding:2px 6px;border-radius:4px;font-size:11px">${d.matricule}</code></td>
      <td>${d.filiere}</td>
      <td>${d.niveau}</td>
      <td>${d.matiere}</td>
      <td>${parseFloat(d.note).toFixed(2)}</td>
      <td><span class="mention-pill m-${m.code}">${m.label}</span></td>
      <td>${d.semestre || '—'}</td>
      <td>
        <button class="btn-row-del" onclick="supprimer(${d.id})" title="Supprimer">✕</button>
      </td>
    </tr>`;
  }).join('');
}

async function supprimer(id) {
  if (!confirm('Supprimer cet enregistrement ?')) return;
  try {
    await apiDelete(`/resultats/${id}`);
    await loadData();
    renderTable();
    showToast('Enregistrement supprimé.');
  } catch (e) {
    showToast(e.message, true);
  }
}

async function viderTout() {
  if (!confirm('Vider TOUTES les données ? Cette action est irréversible.')) return;
  try {
    await apiDelete('/resultats');
    await loadData();
    renderTable();
    showToast('Toutes les données ont été supprimées.');
  } catch (e) {
    showToast(e.message, true);
  }
}

// ─── PAGE : ANALYSE ───────────────────────────────────────────────────────────

function renderAnalyse() {
  const emptyEl   = document.getElementById('empty-analyse');
  const contentEl = document.getElementById('analyse-content');

  if (!localData.length) {
    emptyEl.style.display = 'block';
    contentEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  contentEl.style.display = 'block';

  const notes = localData.map(d => parseFloat(d.note)).sort((a, b) => a - b);
  const n   = notes.length;
  const moy = notes.reduce((a, b) => a + b, 0) / n;
  const med = n % 2 === 0 ? (notes[n/2 - 1] + notes[n/2]) / 2 : notes[Math.floor(n/2)];
  const variance = notes.reduce((a, b) => a + Math.pow(b - moy, 2), 0) / n;
  const std  = Math.sqrt(variance);
  const min  = notes[0];
  const max  = notes[n - 1];
  const taux = Math.round(notes.filter(x => x >= 10).length / n * 100);

  document.getElementById('s-n').textContent       = n;
  document.getElementById('s-moy').textContent     = moy.toFixed(2);
  document.getElementById('s-med').textContent     = med.toFixed(2);
  document.getElementById('s-std').textContent     = std.toFixed(2);
  document.getElementById('s-min').textContent     = min.toFixed(2);
  document.getElementById('s-max').textContent     = max.toFixed(2);
  document.getElementById('s-var').textContent     = variance.toFixed(2);
  document.getElementById('s-reussite').textContent = taux + '%';

  // ── Histogramme ──
  const bins  = [0, 4, 8, 10, 12, 14, 16, 20];
  const lbls  = ['0-4', '4-8', '8-10', '10-12', '12-14', '14-16', '16-20'];
  const cnts  = lbls.map((_, i) => notes.filter(x => x >= bins[i] && x < bins[i+1]).length);
  const colorsHist = cnts.map((_, i) => {
    const v = bins[i];
    if (v < 8)  return 'rgba(240,82,82,0.7)';
    if (v < 10) return 'rgba(240,160,37,0.7)';
    if (v < 14) return 'rgba(124,110,245,0.7)';
    return 'rgba(54,201,126,0.7)';
  });

  if (charts.hist) charts.hist.destroy();
  charts.hist = new Chart(document.getElementById('chartHist'), {
    type: 'bar',
    data: {
      labels: lbls,
      datasets: [{ data: cnts, backgroundColor: colorsHist, borderRadius: 5, borderSkipped: false }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8a90a0' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#8a90a0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  // ── Doughnut mentions ──
  const mc = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  localData.forEach(d => mc[getMention(parseFloat(d.note)).code]++);

  if (charts.mention) charts.mention.destroy();
  charts.mention = new Chart(document.getElementById('chartMention'), {
    type: 'doughnut',
    data: {
      labels: ['Très Bien ≥16', 'Bien ≥14', 'Assez Bien ≥12', 'Passable ≥10', 'Insuffisant'],
      datasets: [{
        data: [mc.A, mc.B, mc.C, mc.D, mc.E],
        backgroundColor: ['#36c97e', '#7c6ef5', '#f0a025', '#f08052', '#f05252'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8a90a0', font: { size: 11 }, padding: 14 } }
      }
    }
  });

  // ── Bar filières ──
  const filieres = [...new Set(localData.map(d => d.filiere))].filter(Boolean);
  const moyF = filieres.map(f => {
    const ns = localData.filter(d => d.filiere === f).map(d => parseFloat(d.note));
    return +(ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(2);
  });

  if (charts.filiere) charts.filiere.destroy();
  charts.filiere = new Chart(document.getElementById('chartFiliere'), {
    type: 'bar',
    data: {
      labels: filieres,
      datasets: [{
        label: 'Moyenne /20',
        data: moyF,
        backgroundColor: 'rgba(124,110,245,0.5)',
        borderColor: '#7c6ef5',
        borderWidth: 1,
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8a90a0' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { min: 0, max: 20, ticks: { color: '#8a90a0' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelector(`[data-page="${id}"]`).classList.add('active');
  if (id === 'donnees') renderTable();
  if (id === 'analyse') renderAnalyse();
}

// ─── API STATUS INDICATOR ─────────────────────────────────────────────────────

function updateApiStatus(online) {
  let el = document.getElementById('api-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'api-status';
    el.className = 'api-status';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="api-dot${online ? '' : ' offline'}"></div> API ${online ? 'connectée' : 'hors-ligne'}`;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showPage(item.dataset.page);
    });
  });

  // Boutons
  document.getElementById('btn-enregistrer').addEventListener('click', enregistrer);
  document.getElementById('btn-import').addEventListener('click', importBulk);
  document.getElementById('btn-export').addEventListener('click', exportCSV);
  document.getElementById('btn-vider').addEventListener('click', viderTout);

  // Filtres
  ['filter-filiere','filter-niveau','filter-sem','filter-search'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTable);
  });

  // Chargement initial
  await loadData();
  renderTable();
});
