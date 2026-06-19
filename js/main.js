// ============================================================
// main.js — Routeur principal + utilitaires partagés
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

function isClientRoute() {
  return location.pathname.includes('/client/');
}

window.onload = function() {
  if (isClientRoute()) {
    showView('client');
    initClient();
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
