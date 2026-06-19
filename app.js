// ============================================================
// app.js — Logique interface Admin
// ============================================================

const STEPS = [
  { label: 'Démarche lancée',      icon: '🚀' },
  { label: 'Rendez-vous planifié', icon: '📅' },
  { label: 'Retour technicien',    icon: '📐' },
  { label: 'Devis final envoyé',   icon: '📋' },
  { label: 'Commande confirmée',   icon: '✅' },
  { label: 'Pose effectuée',       icon: '🏠' },
];

let _dossiers  = [];
let _currentId = null;

// ---- AUTH ----
function checkAuth() {
  return sessionStorage.getItem('lm_auth') === 'ok';
}
function login() {
  const pwd = document.getElementById('login-pwd').value;
  if (pwd === CONFIG.ADMIN_PASSWORD) {
    sessionStorage.setItem('lm_auth', 'ok');
    document.getElementById('view-login').style.display  = 'none';
    document.getElementById('view-admin').style.display  = 'block';
    loadDossiers();
  } else {
    document.getElementById('login-error').textContent = 'Mot de passe incorrect.';
  }
}
function logout() {
  sessionStorage.removeItem('lm_auth');
  location.reload();
}

// ---- CHARGEMENT ----
async function loadDossiers() {
  showLoading(true);
  try {
    _dossiers = await sheetsGetAll();
  } catch(e) {
    showToast('Erreur de connexion à Google Sheets');
    _dossiers = [];
  }
  showLoading(false);
  renderListe();
}

function showLoading(v) {
  const el = document.getElementById('loading-bar');
  if (el) el.style.display = v ? 'block' : 'none';
}

// ---- LISTE ----
function renderListe(filtre) {
  let list = _dossiers;
  if (filtre === 'en-cours') list = _dossiers.filter(d => parseInt(d.etape) < 6);
  if (filtre === 'termine')  list = _dossiers.filter(d => parseInt(d.etape) === 6);

  const cont = document.getElementById('liste-dossiers');
  if (!cont) return;

  if (list.length === 0) {
    cont.innerHTML = '<div style="color:#aaa;padding:20px 0;font-size:14px">Aucun dossier.</div>';
    return;
  }

  cont.innerHTML = list.map(d => {
    const etape = parseInt(d.etape) || 1;
    const step  = STEPS[etape - 1] || STEPS[0];
    const prix  = d.prix_final ? parseInt(d.prix_final).toLocaleString('fr-FR') + ' €' : '—';
    const signe = d.signe === 'true' ? '<span style="color:#78BE20;font-size:11px;font-weight:700"> ✓ Signé</span>' : '';
    return `
    <div class="dossier-card" onclick="openDetail('${d.id}')">
      <div class="dossier-info">
        <div class="dossier-nom">${d.nom}${signe}</div>
        <div class="dossier-meta">${d.id} · ${d.gamme || '—'} · ${d.conseiller || '—'}</div>
      </div>
      <span class="step-pill step-${etape}">${step.label}</span>
      <div class="dossier-prix">${prix}</div>
      <div class="dossier-actions" onclick="event.stopPropagation()">
        <button class="btn btn-sm" style="background:#1a1a1a;color:white" onclick="copyLink('${d.token}')">🔗 Lien</button>
        <button class="btn btn-primary btn-sm" onclick="previewClient('${d.token}')">👁</button>
      </div>
    </div>`;
  }).join('');
}

// ---- CRÉER DOSSIER ----
async function creerDossier() {
  const nom = document.getElementById('f-nom').value.trim();
  if (!nom) { showToast('Veuillez saisir un nom de client.'); return; }

  const id    = await getNextId();
  const token = generateToken();
  const today = new Date().toLocaleDateString('fr-FR');

  const row = {
    id,
    nom,
    gamme:         document.getElementById('f-gamme').value || '',
    etape:         '1',
    prix_est:      document.getElementById('f-prix-est').value || '',
    prix_final:    document.getElementById('f-prix-final').value || '',
    token,
    email:         document.getElementById('f-email').value || '',
    tel:           document.getElementById('f-tel').value || '',
    conseiller:    document.getElementById('f-conseiller').value || '',
    tel_conseiller:document.getElementById('f-telc').value || '',
    notes:         document.getElementById('f-notes').value || '',
    date1: today, date2:'', date3:'', date4:'', date5:'', date6:'',
    signe: 'false', sig_date: ''
  };

  await sheetsAppend(row);
  _dossiers.unshift(row);
  showToast('✓ Dossier ' + id + ' créé !');
  showTab('liste');
  renderListe();

  // Afficher le lien généré
  const link = location.origin + '/client/' + token;
  showToast('Lien client : ' + link);
}

// ---- DÉTAIL ----
function openDetail(id) {
  _currentId = id;
  const d = _dossiers.find(x => x.id === id);
  if (!d) return;
  renderDetail(d);
  document.getElementById('view-liste').style.display = 'none';
  document.getElementById('view-detail').style.display = 'block';
}

function renderDetail(d) {
  const etape = parseInt(d.etape) || 1;
  const pct   = Math.round((etape / 6) * 100);
  const link  = location.origin + '/client/' + d.token;

  const tl = STEPS.map((s, i) => {
    const n = i + 1;
    const state = n < etape ? 'done' : n === etape ? 'current' : 'pending';
    const dateKey = 'date' + n;
    return `
    <div class="tl-item ${state}">
      <div class="tl-line"></div>
      <div class="tl-dot ${state}">${state === 'done' ? '✓' : n}</div>
      <div class="tl-content">
        <div class="tl-title">${s.icon} ${s.label}</div>
        ${d[dateKey] ? `<div class="tl-date">${d[dateKey]}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const stepBtns = STEPS.map((s, i) => `
    <button class="step-btn ${etape === i+1 ? 'selected' : ''}" onclick="setEtape(${i+1})">
      ${s.icon} ${s.label}
    </button>`).join('');

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-header">
      <div>
        <div class="detail-nom">${d.nom} ${d.signe==='true'?'<span class="badge-signe">✓ Signé</span>':''}</div>
        <div class="detail-meta">${d.id} · ${d.gamme||'—'}</div>
        <div class="detail-meta" style="margin-top:6px">📞 ${d.tel||'—'} &nbsp;·&nbsp; ✉️ ${d.email||'—'}</div>
        <div class="progress-bar" style="width:260px;margin-top:12px"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div style="font-size:12px;color:#666;margin-top:4px">Étape ${etape}/6 — ${pct}%</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#666">Prix final</div>
        <div style="font-size:22px;font-weight:800;color:#5a9118">${d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':'—'}</div>
        ${d.signe==='true'?`<div style="font-size:12px;color:#5a9118;margin-top:6px">✓ Signé le ${d.sig_date}</div>`:'<div style="font-size:12px;color:#e65100;margin-top:6px">⏳ En attente de signature</div>'}
      </div>
    </div>

    <div class="detail-cols">
      <div>
        <div class="info-card"><div class="info-card-title">Avancement</div><div class="admin-tl">${tl}</div></div>
      </div>
      <div>
        <div class="info-card"><div class="info-card-title">Changer l'étape</div><div class="step-selector">${stepBtns}</div></div>
        <div class="info-card">
          <div class="info-card-title">Informations</div>
          <div class="info-row"><span class="info-label">Conseiller</span><span class="info-value">${d.conseiller||'—'}</span></div>
          <div class="info-row"><span class="info-label">Tél.</span><span class="info-value">${d.tel_conseiller||'—'}</span></div>
          <div class="info-row"><span class="info-label">Gamme</span><span class="info-value">${d.gamme||'—'}</span></div>
          <div class="info-row"><span class="info-label">Estimatif</span><span class="info-value">${d.prix_est?parseInt(d.prix_est).toLocaleString('fr-FR')+' €':'—'}</span></div>
          <div class="info-row"><span class="info-label">Prix final</span><span class="info-value" style="color:#5a9118">${d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':'—'}</span></div>
          ${d.notes?`<div style="margin-top:8px;font-size:12px;background:#f5f5f5;padding:8px 10px;border-radius:4px;color:#444">📝 ${d.notes}</div>`:''}
        </div>
        <div class="info-card">
          <div class="info-card-title">Lien client</div>
          <div style="font-family:monospace;font-size:11px;color:#5a9118;background:#f4fae8;border:1px dashed #78BE20;padding:10px;border-radius:6px;word-break:break-all;margin-bottom:8px">${link}</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" style="flex:1" onclick="copyLink('${d.token}')">📋 Copier</button>
            <button class="btn btn-sm" style="background:#1a1a1a;color:white;flex:1" onclick="previewClient('${d.token}')">👁 Prévisualiser</button>
          </div>
        </div>
      </div>
    </div>`;
}

async function setEtape(n) {
  const d = _dossiers.find(x => x.id === _currentId);
  if (!d) return;
  d.etape = String(n);
  const dateKey = 'date' + n;
  if (!d[dateKey]) d[dateKey] = new Date().toLocaleDateString('fr-FR');
  await sheetsUpdate(_currentId, { etape: d.etape, [dateKey]: d[dateKey] });
  renderDetail(d);
  showToast('✓ Étape mise à jour : ' + STEPS[n-1].label);
}

// ---- UTILITAIRES ----
function copyLink(token) {
  const link = location.origin + '/client/' + token;
  navigator.clipboard.writeText(link).then(() => showToast('✓ Lien copié dans le presse-papier !'));
}

function previewClient(token) {
  window.open('/client/' + token, '_blank');
}

function showTab(tab) {
  document.getElementById('form-nouveau').style.display  = tab === 'nouveau' ? 'block' : 'none';
  document.getElementById('liste-dossiers').style.display = tab === 'liste'   ? 'flex'  : (tab === 'nouveau' ? 'none' : 'flex');
  if (tab === 'liste') renderListe();
}

function filterTab(f, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('form-nouveau').style.display = 'none';
  renderListe(f);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ---- INIT ----
window.onload = () => {
  if (checkAuth()) {
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-admin').style.display = 'block';
    loadDossiers();
  }
  const pwd = document.getElementById('login-pwd');
  if (pwd) pwd.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
};
