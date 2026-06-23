// ============================================================
// conseillers-admin.js — Interface admin de gestion des conseillers
// ============================================================

let _conseillers = [];

async function loadConseillers() {
  try { _conseillers = await conseillersGetAll(); }
  catch(e) { _conseillers = []; }
}

async function openConseillersView() {
  hideAllAdminViews();
  document.getElementById('vConseillers').style.display = 'block';
  await loadConseillers();
  renderConseillersView();
}
function closeConseillersView() {
  document.getElementById('vConseillers').style.display = 'none';
  document.getElementById('vListe').style.display = 'block';
}

function renderConseillersView() {
  document.getElementById('conseillersContenu').innerHTML = `
    <div class="page" style="max-width:700px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <div style="font-size:22px;font-weight:700">Conseillers</div>
          <div style="font-size:13px;color:var(--mut);margin-top:4px">Gérez les accès de vos conseillers. Chaque conseiller choisit son mot de passe à la première connexion.</div>
        </div>
        <button class="btn btn-p btn-sm" onclick="showAddConseiller()">${icon('plus',14)} Ajouter</button>
      </div>
      <div id="add-conseiller-form" style="display:none;margin-bottom:16px"></div>
      <div id="conseillers-list"></div>
    </div>`;
  renderConseillersList();
}

function showAddConseiller() {
  document.getElementById('add-conseiller-form').style.display = 'block';
  document.getElementById('add-conseiller-form').innerHTML = `
    <div class="form-card">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">Nouveau conseiller</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="fg"><label>Nom complet</label><input id="add-c-nom" placeholder="Sophie Leclerc"></div>
        <div class="fg"><label>Email (optionnel)</label><input id="add-c-email" type="email" placeholder="s.leclerc@mail.fr"></div>
      </div>
      <div style="font-size:11px;color:var(--mut);margin-top:8px">Le conseiller choisira son mot de passe à sa première connexion.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-d btn-sm" onclick="document.getElementById('add-conseiller-form').style.display='none'">Annuler</button>
        <button class="btn btn-p btn-sm" onclick="saveWithFeedback(event, addConseiller, '✓ Conseiller ajouté')">${icon('check',13)} Ajouter</button>
      </div>
    </div>`;
}

async function addConseiller() {
  const nom = document.getElementById('add-c-nom').value.trim();
  const email = document.getElementById('add-c-email').value.trim();
  if (!nom) { showToastError('Nom requis'); return; }
  await sheetsWrite('conseillerAdd', { nom, email });
  await new Promise(r => setTimeout(r, 1200));
  await loadConseillers();
  document.getElementById('add-conseiller-form').style.display = 'none';
  renderConseillersList();
}

function renderConseillersList() {
  const cont = document.getElementById('conseillers-list');
  if (!_conseillers.length) {
    cont.innerHTML = '<div style="color:var(--mut2);padding:30px 0;text-align:center">Aucun conseiller configuré.</div>';
    return;
  }
  cont.innerHTML = _conseillers.map(c => {
    const ini = c.nom.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
    const premierConnexion = c.premier_connexion === 'oui';
    const dossiersCount = [..._dossiers, ..._savDossiers].filter(d => (d.conseiller||'').toLowerCase() === c.nom.toLowerCase()).length;
    return `<div class="das-card" style="display:flex;align-items:center;gap:14px;background:white;border:1px solid var(--mid);border-radius:10px;padding:14px 18px;margin-bottom:8px">
      <div class="dash-conseiller-av">${ini}</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">${c.nom}</div>
        <div style="font-size:12px;color:var(--mut);margin-top:2px">${c.email||'—'} · ${dossiersCount} dossier${dossiersCount>1?'s':''}</div>
        ${premierConnexion ? `<span style="font-size:11px;background:#fef0db;color:#9a5b00;padding:2px 9px;border-radius:10px;font-weight:700;margin-top:4px;display:inline-block">En attente de 1ère connexion</span>` : `<span style="font-size:11px;background:var(--gl);color:var(--gd);padding:2px 9px;border-radius:10px;font-weight:700;margin-top:4px;display:inline-block">${icon('check',11)} Actif</span>`}
      </div>
      ${isAdmin() ? `<button class="btn btn-o btn-sm" style="border-color:#f0c0c0;color:#c0392b" onclick="saveWithFeedback(event, ()=>deleteConseiller('${c.id}'))">${icon('x',12)}</button>` : ''}
    </div>`;
  }).join('');
}

async function deleteConseiller(id) {
  if (!confirm('Supprimer ce conseiller ? Il ne pourra plus se connecter.')) return;
  await sheetsWrite('conseillerDelete', { id });
  await new Promise(r => setTimeout(r, 800));
  await loadConseillers();
  renderConseillersList();
}
