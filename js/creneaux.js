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
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">Générer des créneaux</div>
      <div style="font-size:12px;color:var(--mut);margin-bottom:14px">Créneaux de 30 min, avec 15 min de pause entre chaque, jusqu'à l'heure de fin.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        <div class="fg"><label>Date</label><input id="cr-date" type="date" onchange="previewCreneaux()"></div>
        <div class="fg"><label>Heure début</label><input id="cr-debut" type="time" value="09:00" onchange="previewCreneaux()"></div>
        <div class="fg"><label>Heure fin</label><input id="cr-fin" type="time" value="18:00" onchange="previewCreneaux()"></div>
      </div>
      <div id="creneau-preview" style="margin-top:14px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-d btn-sm" onclick="document.getElementById('creneauFormZone').style.display='none'">Annuler</button>
        <button class="btn btn-p btn-sm" onclick="saveCreneauxBatch()">${icon('check',13)} Générer les créneaux</button>
      </div>
    </div>`;
  previewCreneaux();
}

// Calcule la liste des créneaux de 30min + 15min de pause entre une heure de début et de fin
function computeCreneauxSlots(debut, fin) {
  const slots = [];
  const [hD,mD] = debut.split(':').map(Number);
  const [hF,mF] = fin.split(':').map(Number);
  let cursor = hD*60 + mD;
  const limite = hF*60 + mF;
  while (cursor + 30 <= limite) {
    const start = cursor;
    const end = cursor + 30;
    slots.push({
      debut: `${String(Math.floor(start/60)).padStart(2,'0')}:${String(start%60).padStart(2,'0')}`,
      fin:   `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`
    });
    cursor = end + 15; // pause de 15 min
  }
  return slots;
}

function previewCreneaux() {
  const debut = document.getElementById('cr-debut')?.value;
  const fin = document.getElementById('cr-fin')?.value;
  const el = document.getElementById('creneau-preview');
  if (!el || !debut || !fin) return;
  const slots = computeCreneauxSlots(debut, fin);
  if (!slots.length) { el.innerHTML = `<div style="font-size:12px;color:#c0392b">Plage trop courte pour générer un créneau.</div>`; return; }
  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-bottom:7px">${slots.length} créneau${slots.length>1?'x':''} seront créés</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${slots.map(s => `<span style="background:var(--gx);color:var(--gd);font-size:11px;font-weight:600;padding:4px 9px;border-radius:12px">${s.debut}–${s.fin}</span>`).join('')}
    </div>`;
}

async function saveCreneauxBatch() {
  const date = document.getElementById('cr-date').value;
  const debut = document.getElementById('cr-debut').value;
  const fin = document.getElementById('cr-fin').value;
  if (!date || !debut || !fin) { showToast('Tous les champs sont requis'); return; }

  const slots = computeCreneauxSlots(debut, fin);
  if (!slots.length) { showToast('Plage trop courte pour générer un créneau'); return; }

  const [a,m,j] = date.split('-');
  const dateFr = `${j}/${m}/${a}`;

  const btn = document.querySelector('#creneauFormZone .btn-p');
  if (btn) { btn.disabled = true; btn.innerHTML = icon('loader',13) + ' Génération...'; }

  await sheetsWrite('creneauAddBatch', {
    date: dateFr,
    slots: slots.map(s => ({ heure_debut: s.debut, heure_fin: s.fin }))
  });

  // L'écriture Apps Script (no-cors) n'est pas garantie terminée immédiatement après l'appel ;
  // on laisse un court délai avant de relire le Sheet pour être sûr de récupérer les nouveaux créneaux.
  await new Promise(r => setTimeout(r, 1200));
  await loadCreneaux();
  document.getElementById('creneauFormZone').style.display = 'none';
  renderCreneauxList();
  showToast(`✓ ${slots.length} créneau${slots.length>1?'x':''} créé${slots.length>1?'s':''}`);
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

// === RDV À REPORTER SUR L'AGENDA PRO ===
function rdvAReporter() {
  return _creneaux.filter(c => c.statut === 'pris' && c.report_pro !== 'oui')
    .sort((a,b) => (toSortableDate(a.date)+a.heure_debut).localeCompare(toSortableDate(b.date)+b.heure_debut));
}

function renderRdvBadge() {
  const n = rdvAReporter().length;
  const el = document.getElementById('rdv-badge');
  if (!el) return;
  el.style.display = n > 0 ? 'flex' : 'none';
  el.textContent = n;
}

async function openRdvAReporterView() {
  document.getElementById('vListe').style.display = 'none';
  document.getElementById('vDetail').style.display = 'none';
  document.getElementById('vCatalogue').style.display = 'none';
  document.getElementById('vCreneaux').style.display = 'none';
  document.getElementById('vRdvReporter').style.display = 'block';
  await loadCreneaux();
  renderRdvAReporterView();
}
function closeRdvAReporterView() {
  document.getElementById('vRdvReporter').style.display = 'none';
  document.getElementById('vListe').style.display = 'block';
  renderRdvBadge();
}

function renderRdvAReporterView() {
  const liste = rdvAReporter();
  document.getElementById('rdvReporterCont').innerHTML = `
    <div class="page" style="max-width:700px">
      <div style="margin-bottom:20px">
        <div style="font-size:22px;font-weight:700">RDV à reporter sur votre agenda pro</div>
        <div style="font-size:13px;color:var(--mut);margin-top:4px">Ces rendez-vous ont été pris par des clients et ajoutés à votre agenda perso. Reportez-les manuellement sur le pro, puis marquez-les comme traités.</div>
      </div>
      ${!liste.length
        ? `<div style="color:var(--mut2);padding:40px 0;text-align:center">${icon('check',22)}<div style="margin-top:8px">Aucun RDV en attente de report — tout est à jour.</div></div>`
        : liste.map(c => `
          <div class="rdv-report-item">
            <div class="rdv-report-ic">${icon('calendar',18)}</div>
            <div class="rdv-report-body">
              <div class="rdv-report-date">${c.date} · ${c.heure_debut} — ${c.heure_fin}</div>
              <div class="rdv-report-client">${c.nom_client||'Client'} · Dossier ${c.dossier_id}</div>
            </div>
            <button class="btn btn-p btn-sm" onclick="marquerReporte('${c.id}')">${icon('check',13)} Reporté</button>
          </div>`).join('')
      }
    </div>`;
}

async function marquerReporte(creneauId) {
  await sheetsWrite('creneauMarquerReporte', { id: creneauId });
  const c = _creneaux.find(x => x.id === creneauId);
  if (c) c.report_pro = 'oui';
  renderRdvAReporterView();
  renderRdvBadge();
  showToast('✓ Marqué comme reporté');
}
