// ============================================================
// creneaux.js — Gestion des créneaux de RDV (admin + client)
// ============================================================

let _creneaux = [];

async function loadCreneaux() {
  try { _creneaux = await creneauxGetAll(); }
  catch(e) { _creneaux = []; }
}

// === VUE ADMIN — Gestion des créneaux ===
async function openCreneauxView() {
  document.getElementById('vListe').style.display = 'none';
  document.getElementById('vDetail').style.display = 'none';
  document.getElementById('vCatalogue').style.display = 'none';
  document.getElementById('vCreneaux').style.display = 'block';
  await loadCreneaux();
  renderCreneauxView();
}
function closeCreneauxView() {
  document.getElementById('vCreneaux').style.display = 'none';
  document.getElementById('vListe').style.display = 'block';
}

function renderCreneauxView() {
  document.getElementById('creneauxCont').innerHTML = `
    <div class="page" style="max-width:760px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <div style="font-size:22px;font-weight:700">Créneaux de RDV</div>
          <div style="font-size:13px;color:var(--mut);margin-top:4px">Disponibilités proposées au client dès l'étape "Devis envoyé".</div>
        </div>
        <button class="btn btn-p btn-sm" onclick="showCreneauForm()">${icon('plus',14)} Ajouter un créneau</button>
      </div>

      <div id="creneauFormZone" style="display:none;margin-bottom:20px"></div>

      <div id="creneauxList"></div>
    </div>`;
  renderCreneauxList();
}

function showCreneauForm() {
  document.getElementById('creneauFormZone').style.display = 'block';
  document.getElementById('creneauFormZone').innerHTML = `
    <div class="form-card">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">Nouveau créneau</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="fg"><label>Date</label><input id="cr-date" type="date"></div>
        <div class="fg"><label>Heure début</label><input id="cr-debut" type="time" value="09:00"></div>
        <div class="fg"><label>Heure fin</label><input id="cr-fin" type="time" value="10:00"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-d btn-sm" onclick="document.getElementById('creneauFormZone').style.display='none'">Annuler</button>
        <button class="btn btn-p btn-sm" onclick="saveCreneau()">${icon('check',13)} Ajouter</button>
      </div>
    </div>`;
}

async function saveCreneau() {
  const date = document.getElementById('cr-date').value;
  const debut = document.getElementById('cr-debut').value;
  const fin = document.getElementById('cr-fin').value;
  if (!date || !debut || !fin) { showToast('Tous les champs sont requis'); return; }

  const [a,m,j] = date.split('-');
  const dateFr = `${j}/${m}/${a}`;

  await sheetsWrite('creneauAdd', { date: dateFr, heure_debut: debut, heure_fin: fin });
  await loadCreneaux();
  document.getElementById('creneauFormZone').style.display = 'none';
  renderCreneauxList();
  showToast('✓ Créneau ajouté');
}

function renderCreneauxList() {
  const cont = document.getElementById('creneauxList');
  if (!_creneaux.length) {
    cont.innerHTML = '<div style="color:var(--mut2);padding:30px 0;text-align:center">Aucun créneau configuré.</div>';
    return;
  }
  // Tri par date puis heure
  const sorted = [..._creneaux].sort((a,b) => {
    const da = toSortableDate(a.date) + a.heure_debut;
    const db = toSortableDate(b.date) + b.heure_debut;
    return da.localeCompare(db);
  });
  cont.innerHTML = sorted.map(c => `
    <div class="creneau-item ${c.statut==='pris'?'creneau-pris':''}">
      <div class="creneau-date">
        <div class="creneau-date-jour">${c.date}</div>
        <div class="creneau-date-heure">${c.heure_debut} — ${c.heure_fin}</div>
      </div>
      <span class="creneau-statut ${c.statut==='pris'?'pris':'libre'}">${c.statut==='pris'?'Réservé · Dossier '+c.dossier_id:'Disponible'}</span>
      ${c.statut!=='pris'?`<button class="btn btn-o btn-sm" style="border-color:#f0c0c0;color:#c0392b" onclick="deleteCreneau('${c.id}')">${icon('x',12)}</button>`:''}
    </div>`).join('');
}

function toSortableDate(dateFr) {
  const [j,m,a] = (dateFr||'').split('/');
  if (!j||!m||!a) return '';
  return `${a}-${m.padStart(2,'0')}-${j.padStart(2,'0')}`;
}

async function deleteCreneau(id) {
  if (!confirm('Supprimer ce créneau ?')) return;
  await sheetsWrite('creneauDelete', { id });
  _creneaux = _creneaux.filter(c => c.id !== id);
  renderCreneauxList();
  showToast('✓ Créneau supprimé');
}

// === VUE CLIENT — choix d'un créneau ===
function renderCreneauxClient(dossierId) {
  const libres = _creneaux.filter(c => c.statut === 'libre')
    .sort((a,b) => (toSortableDate(a.date)+a.heure_debut).localeCompare(toSortableDate(b.date)+b.heure_debut));

  if (!libres.length) {
    return `<div class="sc">
      <div class="ict">Prendre rendez-vous</div>
      <div class="devis-text">Aucun créneau disponible pour le moment. Votre conseiller vous recontactera prochainement.</div>
    </div>`;
  }

  return `<div class="sc">
    <div class="ict">Prendre rendez-vous</div>
    <div class="devis-text">Choisissez un créneau pour la visite technique :</div>
    <div class="creneau-client-grid">
      ${libres.slice(0,8).map(c => `
        <button class="creneau-client-btn" onclick="reserverCreneau('${c.id}','${dossierId}')">
          <span class="creneau-client-date">${c.date}</span>
          <span class="creneau-client-heure">${c.heure_debut} — ${c.heure_fin}</span>
        </button>`).join('')}
    </div>
  </div>`;
}

async function reserverCreneau(creneauId, dossierId) {
  showToast('Réservation en cours...');
  await sheetsWrite('creneauReserver', { creneauId, dossierId });
  showToast('✓ Rendez-vous confirmé !');
  setTimeout(async () => {
    const d = await sheetsGetById(dossierId);
    if (d) renderClient(d);
  }, 800);
}
