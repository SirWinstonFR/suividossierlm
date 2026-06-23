// ============================================================
// auth.js — Authentification multi-rôle
// Rôles : 'admin' | 'chef' | 'conseiller'
// ============================================================

// Retourne le rôle courant depuis sessionStorage
function getRole()        { return sessionStorage.getItem('lm_role') || null; }
function getConseillerSession() {
  const s = sessionStorage.getItem('lm_conseiller');
  return s ? JSON.parse(s) : null;
}
function isAdmin()       { return getRole() === 'admin'; }
function isChef()        { return getRole() === 'chef'; }
function isConseiller()  { return getRole() === 'conseiller'; }
function canEdit(dossierConseiller) {
  if (isAdmin()) return true;
  if (isChef())  return false; // lecture seule
  if (isConseiller()) {
    const c = getConseillerSession();
    return c && dossierConseiller && dossierConseiller.toLowerCase() === c.nom.toLowerCase();
  }
  return false;
}

function doLogout() {
  ['lm_auth','lm_role','lm_conseiller'].forEach(k => sessionStorage.removeItem(k));
  showView('vLogin');
  renderLoginPage();
}

// ============================================================
// PAGE DE LOGIN — affiche les 3 modes
// ============================================================
function renderLoginPage() {
  document.getElementById('loginCont').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;justify-content:center">
          <div class="tri"></div>
          <div><div class="logo-t">LEROY MERLIN</div><div class="logo-s">Suivi Pose</div></div>
        </div>

        <div id="login-tabs" style="display:flex;gap:6px;margin-bottom:22px;background:#f5f5f3;border-radius:8px;padding:4px">
          <button id="ltab-conseiller" class="ltab ltab-active" onclick="switchLoginTab('conseiller')">Conseiller</button>
          <button id="ltab-chef" class="ltab" onclick="switchLoginTab('chef')">Chef de Secteur</button>
          <button id="ltab-admin" class="ltab" onclick="switchLoginTab('admin')">Admin</button>
        </div>

        <div id="login-form-conseiller">
          <div class="fg" style="margin-bottom:12px">
            <label>Votre nom</label>
            <input id="lpwd-nom" placeholder="ex: Sophie Leclerc" onkeydown="if(event.key==='Enter')doLoginConseiller()">
          </div>
          <div class="fg" style="margin-bottom:16px" id="lpwd-wrap" style="display:none">
            <label>Mot de passe</label>
            <input id="lpwd-conseiller" type="password" placeholder="Votre mot de passe" onkeydown="if(event.key==='Enter')doLoginConseiller()">
          </div>
          <button class="btn btn-p" style="width:100%" onclick="doLoginConseiller()">Se connecter</button>
          <div id="lerr-conseiller" style="color:#c0392b;font-size:13px;margin-top:10px;min-height:18px"></div>
        </div>

        <div id="login-form-chef" style="display:none">
          <div class="fg" style="margin-bottom:16px">
            <label>Mot de passe Chef de Secteur</label>
            <input id="lpwd-chef" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLoginChef()">
          </div>
          <button class="btn btn-p" style="width:100%" onclick="doLoginChef()">Accéder au dashboard</button>
          <div id="lerr-chef" style="color:#c0392b;font-size:13px;margin-top:10px;min-height:18px"></div>
        </div>

        <div id="login-form-admin" style="display:none">
          <div class="fg" style="margin-bottom:16px">
            <label>Mot de passe Admin</label>
            <input id="lpwd-admin" type="password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLoginAdmin()">
          </div>
          <button class="btn btn-p" style="width:100%" onclick="doLoginAdmin()">Connexion Admin</button>
          <div id="lerr-admin" style="color:#c0392b;font-size:13px;margin-top:10px;min-height:18px"></div>
        </div>

      </div>
    </div>`;
}

function switchLoginTab(tab) {
  ['conseiller','chef','admin'].forEach(t => {
    document.getElementById(`ltab-${t}`).classList.toggle('ltab-active', t===tab);
    document.getElementById(`login-form-${t}`).style.display = t===tab?'block':'none';
  });
}

// ============================================================
// CONNEXION ADMIN
// ============================================================
function doLoginAdmin() {
  const pwd = document.getElementById('lpwd-admin')?.value;
  if (pwd === CFG.ADMIN_PWD) {
    sessionStorage.setItem('lm_auth','ok');
    sessionStorage.setItem('lm_role','admin');
    showView('vAdmin');
    loadAll();
  } else {
    document.getElementById('lerr-admin').textContent = 'Mot de passe incorrect.';
  }
}

// ============================================================
// CONNEXION CHEF DE SECTEUR
// ============================================================
function doLoginChef() {
  const pwd = document.getElementById('lpwd-chef')?.value;
  if (pwd === CFG.CHEF_PWD) {
    sessionStorage.setItem('lm_auth','ok');
    sessionStorage.setItem('lm_role','chef');
    showView('vAdmin');
    loadAll();
  } else {
    document.getElementById('lerr-chef').textContent = 'Mot de passe incorrect.';
  }
}

// ============================================================
// CONNEXION CONSEILLER — via Apps Script (vérif nom + mot de passe)
// ============================================================
let _premierConnexionId = null;

async function doLoginConseiller() {
  const nom = document.getElementById('lpwd-nom')?.value.trim();
  const pwd = document.getElementById('lpwd-conseiller')?.value.trim();
  const errEl = document.getElementById('lerr-conseiller');
  errEl.textContent = '';
  if (!nom) { errEl.textContent = 'Saisissez votre nom.'; return; }

  const btn = document.querySelector('#login-form-conseiller .btn');
  const restore = btnLoad(btn);
  try {
    await sheetsWrite('conseillerAuth', { nom, mot_de_passe: pwd });
    // Comme no-cors ne retourne rien, on relit directement via GET
    const conseillers = await conseillersGetAll();
    const c = conseillers.find(x => x.nom.toLowerCase() === nom.toLowerCase());
    if (!c) { errEl.textContent = 'Nom non trouvé. Contactez votre administrateur.'; restore(); return; }
    if (c.premier_connexion === 'oui') {
      _premierConnexionId = c.id;
      restore();
      showSetPasswordForm(c.nom);
      return;
    }
    if (c.mot_de_passe !== pwd) { errEl.textContent = 'Mot de passe incorrect.'; restore(); return; }
    sessionStorage.setItem('lm_auth','ok');
    sessionStorage.setItem('lm_role','conseiller');
    sessionStorage.setItem('lm_conseiller', JSON.stringify({id:c.id, nom:c.nom, email:c.email}));
    restore();
    showView('vAdmin');
    loadAll();
  } catch(e) { errEl.textContent = 'Erreur : '+e.message; restore(); }
}

// ============================================================
// PREMIER MOT DE PASSE — formulaire à la 1ère connexion
// ============================================================
function showSetPasswordForm(nom) {
  document.getElementById('loginCont').innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">Bienvenue ${nom} !</div>
        <div style="font-size:13px;color:var(--mut);margin-bottom:22px">C'est votre première connexion. Choisissez un mot de passe personnel.</div>
        <div class="fg" style="margin-bottom:12px">
          <label>Nouveau mot de passe</label>
          <input id="new-pwd-1" type="password" placeholder="Minimum 6 caractères">
        </div>
        <div class="fg" style="margin-bottom:16px">
          <label>Confirmer le mot de passe</label>
          <input id="new-pwd-2" type="password" placeholder="Répétez le mot de passe" onkeydown="if(event.key==='Enter')saveNewPassword()">
        </div>
        <button class="btn btn-p" style="width:100%" onclick="saveNewPassword()">Valider et accéder</button>
        <div id="new-pwd-err" style="color:#c0392b;font-size:13px;margin-top:10px;min-height:18px"></div>
      </div>
    </div>`;
}

async function saveNewPassword() {
  const p1 = document.getElementById('new-pwd-1').value;
  const p2 = document.getElementById('new-pwd-2').value;
  const errEl = document.getElementById('new-pwd-err');
  if (p1.length < 6) { errEl.textContent = 'Minimum 6 caractères.'; return; }
  if (p1 !== p2) { errEl.textContent = 'Les mots de passe ne correspondent pas.'; return; }
  const btn = document.querySelector('#loginCont .btn');
  const restore = btnLoad(btn);
  await sheetsWrite('conseillerSetPassword', { id: _premierConnexionId, mot_de_passe: p1 });
  await new Promise(r => setTimeout(r, 1200));
  const conseillers = await conseillersGetAll();
  const c = conseillers.find(x => x.id === _premierConnexionId);
  if (!c) { errEl.textContent = 'Erreur — rechargez la page.'; restore(); return; }
  sessionStorage.setItem('lm_auth','ok');
  sessionStorage.setItem('lm_role','conseiller');
  sessionStorage.setItem('lm_conseiller', JSON.stringify({id:c.id, nom:c.nom, email:c.email}));
  restore();
  showView('vAdmin');
  loadAll();
}
