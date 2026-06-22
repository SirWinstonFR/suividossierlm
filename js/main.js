// ============================================================
// main.js — Routeur principal + utilitaires globaux
// ============================================================

function showView(v) {
  ['vLogin','vAdmin','vClient'].forEach(id => {
    document.getElementById(id).style.display = id===v ? 'block' : 'none';
  });
}

// Toast — succès (vert), erreur (rouge), neutre (noir)
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (type==='error' ? ' toast-error' : type==='ok' ? ' toast-ok' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}
function showToastOk(msg)    { showToast(msg, 'ok'); }
function showToastError(msg) { showToast(msg, 'error'); }

// Barre de progression globale — contrôlée manuellement
const lbar = {
  _el: null,
  _prog: 0,
  _raf: null,
  el() { return this._el || (this._el = document.getElementById('lbar')); },
  start() {
    this._prog = 10;
    this.el().style.display = 'block';
    this.el().style.transition = 'none';
    this.el().style.width = '10%';
    this._tick();
  },
  _tick() {
    if (this._prog >= 85) return;
    this._prog += Math.random() * 8 + 2;
    this.el().style.transition = 'width 0.4s ease';
    this.el().style.width = Math.min(this._prog, 85) + '%';
    this._raf = setTimeout(() => this._tick(), 500);
  },
  done() {
    clearTimeout(this._raf);
    this._prog = 100;
    this.el().style.transition = 'width 0.2s ease';
    this.el().style.width = '100%';
    setTimeout(() => {
      this.el().style.display = 'none';
      this.el().style.width = '0%';
    }, 300);
  }
};

// Feedback bouton — désactive + spinner pendant une action async
// Usage : const restore = btnLoad(btn); ... await action(); btnDone(restore);
function btnLoad(btn) {
  if (!btn) return () => {};
  const orig = btn.innerHTML;
  const origDisabled = btn.disabled;
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-spin"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> En cours...`;
  return function restore(newHtml) {
    btn.innerHTML = newHtml || orig;
    btn.disabled = origDisabled;
    btn.style.opacity = '';
  };
}

// Raccourci pour wrapper toute action async sur un bouton
// Usage : withBtnLoad(event, async () => { ... }, 'Message succès')
async function withBtnLoad(btnOrEvent, fn, successMsg) {
  const btn = btnOrEvent?.currentTarget || btnOrEvent?.target || btnOrEvent;
  const restore = btnLoad(btn instanceof HTMLElement ? btn : null);
  try {
    await fn();
    if (successMsg) showToastOk(successMsg);
    restore();
  } catch(e) {
    showToastError('Erreur : ' + (e.message || e));
    restore();
  }
}

function getToken(type) {
  const parts = location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf(type);
  if (idx !== -1 && parts[idx+1]) return parts[idx+1];

  const redirect = sessionStorage.getItem('gh_redirect');
  if (redirect) {
    sessionStorage.removeItem('gh_redirect');
    const rparts = redirect.split('/').filter(Boolean);
    const ridx = rparts.indexOf(type);
    if (ridx !== -1 && rparts[ridx+1]) return rparts[ridx+1];
  }
  return null;
}

window.onload = function() {
  const poseToken = getToken('client');
  const savToken = getToken('sav');
  const savedId = sessionStorage.getItem('cli_dossier_id');
  const savedSavId = sessionStorage.getItem('sav_dossier_id');

  if (savToken || savedSavId) {
    showView('vClient');
    initSav(savToken);
  } else if (poseToken || savedId) {
    showView('vClient');
    initClient(poseToken);
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
