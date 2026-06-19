// ============================================================
// main.js — Routeur principal compatible GitHub Pages
// ============================================================

function showView(v) {
  document.getElementById('vLogin').style.display  = v==='login'  ? 'block':'none';
  document.getElementById('vAdmin').style.display  = v==='admin'  ? 'block':'none';
  document.getElementById('vClient').style.display = v==='client' ? 'block':'none';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 3000);
}

function getToken() {
  // Méthode 1 : chemin réel /client/TOKEN (Netlify)
  const parts = location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('client');
  if (idx !== -1 && parts[idx+1]) return parts[idx+1];

  // Méthode 2 : redirection GitHub Pages via sessionStorage
  const redirect = sessionStorage.getItem('gh_redirect');
  if (redirect) {
    sessionStorage.removeItem('gh_redirect');
    const rparts = redirect.split('/').filter(Boolean);
    const ridx = rparts.indexOf('client');
    if (ridx !== -1 && rparts[ridx+1]) return rparts[ridx+1];
  }

  // Méthode 3 : ?token=TOKEN
  return new URLSearchParams(location.search).get('token');
}

window.onload = function() {
  const token = getToken();
  if (token) {
    showView('client');
    initClient(token);
  } else if (sessionStorage.getItem('lm_auth')==='ok') {
    showView('admin');
    loadAll();
  } else {
    showView('login');
    document.getElementById('lpwd')?.addEventListener('keydown', e => {
      if (e.key==='Enter') doLogin();
    });
  }
};
