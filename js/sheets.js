// ============================================================
// sheets.js — Lecture Google Sheets + écriture via Apps Script
// ============================================================

async function sheetsGetAllFrom(sheetName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.SHEET_ID}/values/${encodeURIComponent(sheetName)}?key=${CFG.API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Erreur Sheets ' + r.status);
  const d = await r.json();
  if (!d.values || d.values.length < 2) return [];
  const [h, ...rows] = d.values;
  return rows.map(row => { const o = {}; h.forEach((k,i) => o[k] = row[i]||''); return o; });
}

async function sheetsGetAll() {
  return sheetsGetAllFrom(CFG.SHEET_NAME);
}

async function savGetAll() {
  try { return await sheetsGetAllFrom(CFG.SAV_SHEET_NAME); }
  catch(e) { return []; } // l'onglet n'existe peut-être pas encore
}

async function catalogueGetAll() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.SHEET_ID}/values/${encodeURIComponent('Catalogue')}?key=${CFG.API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return []; // l'onglet n'existe peut-être pas encore
  const d = await r.json();
  if (!d.values || d.values.length < 2) return [];
  const [h, ...rows] = d.values;
  return rows.map(row => { const o = {}; h.forEach((k,i) => o[k] = row[i]||''); return o; });
}

async function creneauxGetAll() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.SHEET_ID}/values/${encodeURIComponent('Creneaux')}?key=${CFG.API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const d = await r.json();
  if (!d.values || d.values.length < 2) return [];
  const [h, ...rows] = d.values;
  return rows.map(row => { const o = {}; h.forEach((k,i) => o[k] = row[i]||''); return o; });
}

async function sheetsGetById(id) {
  const all = await sheetsGetAll();
  return all.find(d => d.id === id) || null;
}

async function sheetsGetByToken(token) {
  const all = await sheetsGetAll();
  return all.find(d => d.token === token) || null;
}

async function savGetById(id) {
  const all = await savGetAll();
  return all.find(d => d.id === id) || null;
}

async function savGetByToken(token) {
  const all = await savGetAll();
  return all.find(d => d.token === token) || null;
}

async function sheetsWrite(action, payload) {
  try {
    await fetch(CFG.SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    });
  } catch(e) { console.warn('Apps Script:', e); }
}

function genToken() { return Math.random().toString(36).slice(2,10); }

async function checkIdAvailable(id) {
  const [poseAll, savAll] = await Promise.all([sheetsGetAll(), savGetAll()]);
  return !poseAll.some(d => d.id === id) && !savAll.some(d => d.id === id);
}
