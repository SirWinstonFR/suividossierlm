// ============================================================
// sheets.js — Lecture Google Sheets + écriture via Apps Script
// ============================================================

async function sheetsGetAll() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CFG.SHEET_ID}/values/${encodeURIComponent(CFG.SHEET_NAME)}?key=${CFG.API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Erreur Sheets ' + r.status);
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

async function nextId() {
  const all = await sheetsGetAll();
  const max = Math.max(0, ...all.map(d => parseInt(d.id?.replace('DOS-',''))||0));
  return 'DOS-' + String(max+1).padStart(3,'0');
}
