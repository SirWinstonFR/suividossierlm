// ============================================================
// sheets.js — Lecture Google Sheets (API publique)
// Écriture via Google Apps Script (proxy)
// ============================================================

const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values`;

// Lire tous les dossiers
async function sheetsGetAll() {
  const url = `${BASE_URL}/${encodeURIComponent(CONFIG.SHEET_NAME)}?key=${CONFIG.API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Erreur Sheets ' + r.status);
  const data = await r.json();
  if (!data.values || data.values.length < 2) return [];
  const [headers, ...rows] = data.values;
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i] || '');
    return obj;
  });
}

// Trouver par token (lien client)
async function sheetsGetByToken(token) {
  const all = await sheetsGetAll();
  return all.find(d => d.token === token) || null;
}

// Trouver par ID
async function sheetsGetById(id) {
  const all = await sheetsGetAll();
  return all.find(d => d.id === id) || null;
}

// Générer un token unique
function generateToken() {
  return Math.random().toString(36).slice(2, 10);
}

// Générer le prochain ID
async function getNextId() {
  const all = await sheetsGetAll();
  const nums = all.map(d => parseInt(d.id?.replace('DOS-', '')) || 0);
  const next = Math.max(0, ...nums) + 1;
  return 'DOS-' + String(next).padStart(3, '0');
}

// Écriture via Google Apps Script
async function sheetsWrite(action, payload) {
  if (!CONFIG.APPS_SCRIPT_URL) {
    console.warn('Apps Script URL manquante — écriture simulée');
    return { ok: true, simulated: true };
  }
  try {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
    return { ok: true };
  } catch(e) {
    console.error('Erreur Apps Script', e);
    return { ok: false };
  }
}

async function sheetsAppend(row) {
  return sheetsWrite('append', { row });
}

async function sheetsUpdate(id, fields) {
  return sheetsWrite('update', { id, fields });
}
