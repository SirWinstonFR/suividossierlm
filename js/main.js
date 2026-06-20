// ============================================================
// main.js — Routeur principal
// ============================================================

function showView(v) {
  ['vLogin','vAdmin','vClient'].forEach(id => {
    document.getElementById(id).style.display = id===v ? 'block' : 'none';
  });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function getToken() {
  const parts = location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('client');
  if (idx !== -1 && parts[idx+1]) return parts[idx+1];

  const redirect = sessionStorage.getItem('gh_redirect');
  if (redirect) {
    sessionStorage.removeItem('gh_redirect');
    const rparts = redirect.split('/').filter(Boolean);
    const ridx = rparts.indexOf('client');
    if (ridx !== -1 && rparts[ridx+1]) return rparts[ridx+1];
  }
  return null;
}

window.onload = function() {
  const token = getToken();
  const savedId = sessionStorage.getItem('cli_dossier_id');

  if (token || savedId) {
    showView('vClient');
    initClient(token);
  } else if (sessionStorage.getItem('lm_auth') === 'ok') {
    showView('vAdmin');
    loadAll();
  } else {
    showView('vLogin');
    document.getElementById('lpwd')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  }
};
