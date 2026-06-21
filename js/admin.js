// ============================================================
// admin.js — Interface Admin v3 (icônes SVG inline)
// ============================================================

let _dossiers = [], _curId = null;

function doLogin() {
  if (document.getElementById('lpwd').value === CFG.ADMIN_PWD) {
    sessionStorage.setItem('lm_auth','ok');
    showView('vAdmin');
    loadAll();
  } else {
    document.getElementById('lerr').textContent = 'Mot de passe incorrect.';
  }
}
function doLogout() { sessionStorage.removeItem('lm_auth'); showView('vLogin'); }

async function loadAll() {
  document.getElementById('lbar').style.display = 'block';
  try { _dossiers = await sheetsGetAll(); }
  catch(e) { showToast('Erreur : ' + e.message); _dossiers = []; }
  await loadCatalogue();
  await loadCreneaux();
  populateGammeSelect();
  document.getElementById('lbar').style.display = 'none';
  renderListe();
}

function renderListe(f) {
  let list = _dossiers;
  if (f==='cours') list = _dossiers.filter(d => parseInt(d.etape) < STEPS.length);
  if (f==='fin')   list = _dossiers.filter(d => parseInt(d.etape) === STEPS.length);
  const cont = document.getElementById('listeDos');
  if (!list.length) { cont.innerHTML='<div style="color:#aaa;padding:20px 0">Aucun dossier.</div>'; return; }
  cont.innerHTML = list.map(d => {
    const e = parseInt(d.etape)||1, s = STEPS[e-1];
    const prix = d.prix_final ? parseInt(d.prix_final).toLocaleString('fr-FR')+' €' : '—';
    const signé = d.signe==='true' ? `<span style="color:var(--g);font-size:11px;margin-left:8px">${icon('check',12)} Signé</span>` : '';
    return `<div class="dos-card" onclick="openDetail('${d.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700">${d.nom}${signé}</div>
        <div style="font-size:12px;color:var(--mut);margin-top:2px">N° ${d.id} · ${d.gamme||'—'} · ${d.conseiller||'—'}</div>
      </div>
      <span class="sp sp${Math.min(e,6)}">${icon(s.ic,12)} ${s.l}</span>
      <div style="font-size:15px;font-weight:700;color:var(--gd);white-space:nowrap">${prix}</div>
      <div onclick="event.stopPropagation()">
        <button class="btn btn-p btn-sm" onclick="copyLien('${d.token}')">${icon('link',14)} Lien</button>
      </div>
    </div>`;
  }).join('');
}

function filterTab(f,btn) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('formNew').style.display='none';
  renderListe(f);
}
function showTab(t) {
  document.getElementById('formNew').style.display = t==='new'?'block':'none';
  if (t==='new') populateGammeSelect();
  if (t!=='new') renderListe();
}

async function checkDosId() {
  const id = document.getElementById('fid').value.trim();
  const msgEl = document.getElementById('fid-msg');
  if (!id) { msgEl.textContent=''; return; }
  const available = await checkIdAvailable(id);
  msgEl.textContent = available ? '✓ Numéro disponible' : '✗ Ce numéro existe déjà';
  msgEl.style.color = available ? 'var(--gd)' : '#e53935';
}

// CRÉER — formulaire simplifié, sans éco-PTZ (réservé à plus tard, modifiable depuis le détail)
async function creerDos() {
  const id  = document.getElementById('fid').value.trim();
  const nom = document.getElementById('fnom').value.trim();
  if (!id)  { showToast('Numéro de dossier requis.'); return; }
  if (!nom) { showToast('Nom requis.'); return; }

  const available = await checkIdAvailable(id);
  if (!available) { showToast('Ce numéro de dossier existe déjà.'); return; }

  const token = genToken();
  const row = {
    id, nom,
    gamme:          getSelectedGammeLabel(),
    modele:         getSelectedModeleLabel(),
    artisan:        document.getElementById('fart').value||'',
    etape:          '1',
    prix_est:       document.getElementById('fest').value||'',
    prix_final:     document.getElementById('fpfin').value||'',
    token,
    email:          document.getElementById('feml').value||'',
    tel:            document.getElementById('ftel').value||'',
    conseiller:     document.getElementById('fcon').value||'',
    tel_conseiller: document.getElementById('ftlc').value||'',
    notes:          document.getElementById('fnot').value||'',
    transporteur:   '',
    promo:          document.getElementById('fpromo').value||'',
    ecoptz_url:     '',
    plu_concerne:   'false',
    plu_adresse:    '',
    drive_url:      '',
    fiche_url:      document.getElementById('ffiche-link')?.value || '',
    delai_fab_semaines: '',
    message_client: '',
    equipe: '', prix_produit: '', prix_pose: '',
    date1: new Date().toLocaleDateString('fr-FR'),
    date2:'',date3:'',date4:'',date5:'',date6:'',date7:'',date8:'',
    signe:'false', sig_date:'', sig_data:'', signe_pose:'false',
    predevis_url:'', devis_url:'', commande_url:'', commande_signee_url:'', pose_signee_url:'',
  };
  await sheetsWrite('append', { row });
  _dossiers.unshift(row);
  showToast('✓ Dossier '+id+' créé !');
  showTab('list');

  // Création automatique du dossier Drive dédié, en arrière-plan
  createDriveFolderFor(id, nom);
}

async function createDriveFolderFor(id, nom) {
  await sheetsWrite('createFolder', { id, nom });
  // Le dossier Drive est créé côté serveur ; on relit le Sheet après un délai
  // pour récupérer l'URL et la refléter localement (utile si on rouvre la fiche)
  setTimeout(async () => {
    try {
      const fresh = await sheetsGetById(id);
      const d = _dossiers.find(x => x.id === id);
      if (fresh && d) d.drive_url = fresh.drive_url;
    } catch(e) { /* silencieux */ }
  }, 2500);
}

async function openCatalogueView() {
  document.getElementById('vListe').style.display = 'none';
  document.getElementById('vDetail').style.display = 'none';
  document.getElementById('vCatalogue').style.display = 'block';
  await loadCatalogue();
  renderCatalogueView();
}
function closeCatalogueView() {
  document.getElementById('vCatalogue').style.display = 'none';
  document.getElementById('vListe').style.display = 'block';
}

function openDetail(id) {
  _curId = id;
  document.getElementById('vListe').style.display = 'none';
  document.getElementById('vDetail').style.display = 'block';
  renderDetail();
}
function goListe() {
  document.getElementById('vDetail').style.display = 'none';
  document.getElementById('vListe').style.display = 'block';
}

function renderDetail() {
  const d = _dossiers.find(x=>x.id===_curId); if (!d) return;
  const e = parseInt(d.etape)||1, pct = Math.round(e/STEPS.length*100);
  const lien = location.origin + CFG.BASE_PATH + '/client/' + d.token;

  const tl = STEPS.map((s,i) => {
    const n=i+1, st=n<e?'done':n===e?'current':'pending';
    return `<div class="tli ${n<e?'done':''}">
      <div class="tll"></div>
      <div class="tld ${st}">${st==='done'?icon('check',12):n}</div>
      <div class="tlc">
        <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">${icon(s.ic,14)}${s.l}</div>
        ${d['date'+n]?`<div style="font-size:11px;color:var(--mut);margin-top:2px">${d['date'+n]}</div>`:''}
      </div>
    </div>`;
  }).join('');

  const sbts = STEPS.map((s,i) =>
    `<button class="step-btn ${e===i+1?'sel':''}" onclick="setEtape(${i+1})">${icon(s.ic,14)} ${s.l}</button>`
  ).join('');

  document.getElementById('detailCont').innerHTML = `
    <div style="background:white;border-radius:8px;border:1px solid var(--mid);padding:20px 24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div>
        <div style="font-size:20px;font-weight:700">${d.nom}${d.signe==='true'?`<span style="background:var(--g);color:white;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px">${icon('check',11)} Signé</span>`:''}</div>
        <div style="font-size:13px;color:var(--mut);margin-top:4px">N° ${d.id} · ${d.gamme||'—'}</div>
        <div style="font-size:13px;color:var(--mut);margin-top:4px">${icon('phone',13)} ${d.tel||'—'} &nbsp;·&nbsp; ${icon('mail',13)} ${d.email||'—'}</div>
        <div style="height:6px;background:var(--mid);border-radius:3px;overflow:hidden;width:260px;margin:10px 0 4px">
          <div style="height:100%;background:var(--g);border-radius:3px;width:${pct}%"></div>
        </div>
        <div style="font-size:12px;color:var(--mut)">Étape ${e}/${STEPS.length} — ${pct}%</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--mut)">Prix final</div>
        <div style="font-size:22px;font-weight:800;color:var(--gd)">${d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':'—'}</div>
        <div style="font-size:12px;margin-top:6px;color:${d.signe==='true'?'var(--gd)':'#e65100'}">${d.signe==='true'?icon('check',12)+' Signé le '+d.sig_date:icon('clock',12)+' En attente de signature'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start">

      <div>
        <div class="ic"><div class="ict">Changer l'étape</div><div class="step-sel">${sbts}</div></div>
        <div class="ic">
          <div class="ict">Avancement</div>
          <div class="atl">${tl}</div>
        </div>
      </div>

      <div>
        <div class="dtab-bar">
          <button class="dtab active" onclick="switchDetailTab(event,'tab-suivi')">${icon('calendar',13)} Suivi</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-docs')">${icon('filetext',13)} Documents</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-projet')">${icon('ruler',13)} Projet</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-avantages')">${icon('discount',13)} Avantages</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-contact')">${icon('link',13)} Contact & lien</button>
        </div>

        <div id="tab-suivi" class="dtab-panel">
          ${renderDateFields(d)}
          ${renderMessageBloc(d)}
        </div>

        <div id="tab-docs" class="dtab-panel" style="display:none">
          ${renderDocsBloc(d)}
          ${renderDriveBloc(d)}
        </div>

        <div id="tab-projet" class="dtab-panel" style="display:none">
          ${renderTechBloc(d)}
          ${renderTarifBloc(d)}
          ${renderDelaiBloc(d)}
          ${renderTranspBloc(d)}
        </div>

        <div id="tab-avantages" class="dtab-panel" style="display:none">
          ${renderAvantagesBloc(d)}
          ${renderPluBloc(d)}
        </div>

        <div id="tab-contact" class="dtab-panel" style="display:none">
          <div class="ic">
            <div class="ict">Informations</div>
            <div class="ir"><span style="color:var(--mut)">Conseiller</span><span style="font-weight:600">${d.conseiller||'—'}</span></div>
            <div class="ir"><span style="color:var(--mut)">Tél.</span><span style="font-weight:600">${d.tel_conseiller||'—'}</span></div>
            <div class="ir"><span style="color:var(--mut)">Gamme</span><span style="font-weight:600">${d.gamme||'—'}</span></div>
            <div class="ir"><span style="color:var(--mut)">Estimatif</span><span style="font-weight:600">${d.prix_est?parseInt(d.prix_est).toLocaleString('fr-FR')+' €':'—'}</span></div>
            <div class="ir"><span style="color:var(--mut)">Prix final</span><span style="font-weight:600;color:var(--gd)">${d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':'—'}</span></div>
            ${d.notes?`<div style="margin-top:8px;font-size:12px;background:#f5f5f5;padding:8px 10px;border-radius:4px">${d.notes}</div>`:''}
          </div>
          <div class="ic">
            <div class="ict">Lien client</div>
            <div style="font-family:monospace;font-size:11px;color:var(--gd);background:var(--gx);border:1px dashed var(--g);padding:10px;border-radius:6px;word-break:break-all;margin-bottom:8px">${lien}</div>
            <button class="btn btn-p" style="width:100%;margin-bottom:8px" onclick="copyLien('${d.token}')">${icon('copy',14)} Copier le lien client</button>
            <button class="btn btn-o" style="width:100%;border-color:var(--mid);color:var(--mut)" onclick="sendStatusEmail('${d.id}')" ${!d.email?'disabled title="Aucun email renseigné"':''}>${icon('mail',14)} Préparer l'email de suivi</button>
            ${d.email?`<div style="font-size:11px;color:var(--mut);margin-top:6px">Ouvre votre logiciel mail avec le message pré-rempli.</div>`:''}
            ${!d.email?`<div style="font-size:11px;color:var(--mut);margin-top:6px">Renseignez l'email du client pour activer l'envoi.</div>`:''}
          </div>
          <div class="ic">
            <div class="ict">Équipe en charge du projet</div>
            <div style="font-size:11px;color:var(--mut);margin-bottom:8px">Un membre par ligne, format : <code>Nom | Rôle</code></div>
            <textarea id="equipe-input" placeholder="Marc Dubois | Technicien poseur&#10;Sophie Leclerc | Conseillère commerciale" style="min-height:80px">${d.equipe||''}</textarea>
            <button class="btn btn-p btn-sm" style="width:100%;margin-top:8px" onclick="saveEquipe('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
            <div style="font-size:11px;color:var(--mut);margin-top:8px">Affiché sous le conseiller principal, côté client.</div>
          </div>
        </div>

      </div>
    </div>`;
}

function switchDetailTab(evt, tabId) {
  document.querySelectorAll('.dtab-panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).style.display = 'block';
  evt.currentTarget.classList.add('active');
}

function renderDateFields(d) {
  return `
    <div class="ic">
      <div class="ict">Dates clés</div>
      <div class="fg" style="margin-bottom:8px"><label>RDV planifié</label><input id="date-2" type="date" value="${toISO(d.date2)}"></div>
      <div class="fg" style="margin-bottom:8px"><label>Retour technicien</label><input id="date-3" type="date" value="${toISO(d.date3)}"></div>
      <div class="fg" style="margin-bottom:8px"><label>Devis envoyé</label><input id="date-4" type="date" value="${toISO(d.date4)}"></div>
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveDates('${d.id}')">${icon('deviceFloppy',14)} Enregistrer les dates</button>
    </div>`;
}

function renderMessageBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Message pour le client</div>
      <div class="fg" style="margin-bottom:8px">
        <textarea id="message-client" placeholder="Ex: Bonjour, votre commande avance bien, n'hésitez pas à me contacter si besoin." style="min-height:70px">${d.message_client||''}</textarea>
      </div>
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveMessageClient('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
      <div style="font-size:11px;color:var(--mut);margin-top:8px">Ce message s'affiche directement sur la page de suivi du client.</div>
    </div>`;
}

function renderDocsBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Documents à transmettre</div>
      <div class="fg" style="margin-bottom:8px"><label>Lien pré-devis (Drive)</label><input id="predevis-url" type="url" placeholder="https://drive.google.com/..." value="${d.predevis_url||''}"></div>
      <div class="fg" style="margin-bottom:8px"><label>Lien devis final (Drive)</label><input id="devis-url" type="url" placeholder="https://drive.google.com/..." value="${d.devis_url||''}"></div>
      <div class="fg" style="margin-bottom:8px"><label>Bon de commande à signer (Drive)</label><input id="commande-url" type="url" placeholder="https://drive.google.com/file/d/.../view" value="${d.commande_url||''}"></div>
      <div style="font-size:11px;color:var(--mut);margin:-4px 0 8px">${icon('alert',11)} Le fichier Drive doit être partagé en "Lecture pour toute personne disposant du lien"</div>
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveDocs('${d.id}')">${icon('deviceFloppy',14)} Enregistrer les liens</button>
      ${d.sig_data ? `<div style="margin-top:10px;background:var(--gl);border-radius:6px;padding:8px 10px;font-size:11px;color:var(--gd);display:flex;align-items:center;gap:6px">${icon('signature',14)} Signature client enregistrée — réutilisable</div>` : ''}
    </div>`;
}

function renderDriveBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Espace Drive client</div>
      ${d.drive_url
        ? `<div class="drive-locked" onclick="window.open('${d.drive_url}','_blank')">
             ${icon('link',15)}
             <span class="drive-locked-text">${d.drive_url}</span>
           </div>
           <div style="font-size:11px;color:var(--mut);margin-top:8px">${icon('check',11)} Dossier créé automatiquement — non modifiable</div>`
        : `<div class="drive-locked drive-locked-pending">
             ${icon('loader',15)}
             <span class="drive-locked-text">Création du dossier en cours...</span>
           </div>
           <div style="font-size:11px;color:var(--mut);margin-top:8px">Actualisez la page dans quelques secondes</div>`
      }
      <div style="font-size:11px;color:var(--mut);margin-top:8px">Les documents signés par le client sont automatiquement déposés ici.</div>
    </div>`;
}

function renderTarifBloc(d) {
  const total = (parseInt(d.prix_produit)||0) + (parseInt(d.prix_pose)||0);
  return `
    <div class="ic">
      <div class="ict">Détail tarifaire (produit / pose)</div>
      <div class="fg" style="margin-bottom:8px"><label>Prix produit (€)</label><input id="prix-produit" type="number" min="0" placeholder="ex: 2200" value="${d.prix_produit||''}"></div>
      <div class="fg" style="margin-bottom:8px"><label>Prix pose (€)</label><input id="prix-pose" type="number" min="0" placeholder="ex: 600" value="${d.prix_pose||''}"></div>
      ${total>0?`<div style="font-size:12px;color:var(--gd);background:var(--gl);border-radius:6px;padding:8px 10px;margin-bottom:8px">Total : ${total.toLocaleString('fr-FR')} €</div>`:''}
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveTarif('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
      <div style="font-size:11px;color:var(--mut);margin-top:8px">Le détail est affiché côté client, dépliable, sous le prix final.</div>
    </div>`;
}

function renderTechBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Détails techniques</div>
      <div class="fg" style="margin-bottom:8px"><label>Artisan / Poseur</label><input id="tech-artisan" value="${d.artisan||''}"></div>
      <div class="fg" style="margin-bottom:8px"><label>Modèle détaillé</label><textarea id="tech-modele" style="min-height:50px">${d.modele||''}</textarea></div>
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveTech('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
    </div>`;
}

function renderDelaiBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Délai de fabrication</div>
      <div class="fg" style="margin-bottom:8px">
        <label>Durée (en semaines)</label>
        <input id="delai-semaines" type="number" min="0" placeholder="ex: 6" value="${d.delai_fab_semaines||''}">
      </div>
      ${d.date6 && d.delai_fab_semaines ? `<div style="font-size:12px;color:var(--gd);background:var(--gl);border-radius:6px;padding:8px 10px;margin-bottom:8px">${icon('calendar',13)} Livraison estimée : ${computeDateEstimee(d.date6, d.delai_fab_semaines)}</div>` : ''}
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveDelai('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
      <div style="font-size:11px;color:var(--mut);margin-top:8px">Calculé à partir de la date de confirmation de commande.</div>
    </div>`;
}

function renderTranspBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Livraison</div>
      <div class="fg" style="margin-bottom:8px"><label>Transporteur</label><input id="transp-input" placeholder="ex: Chronopost" value="${d.transporteur||''}"></div>
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveTransporteur('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
    </div>`;
}

function renderAvantagesBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Avantages client</div>
      <div class="fg" style="margin-bottom:8px"><label>Promo éligible</label><input id="adm-promo" placeholder="ex: -10% pose" value="${d.promo||''}"></div>
      <div class="fg" style="margin-bottom:8px"><label>Lien éco-PTZ</label><input id="adm-ecoptz" type="url" placeholder="https://... (à ajouter quand disponible)" value="${d.ecoptz_url||''}"></div>
      <button class="btn btn-p btn-sm" style="width:100%" onclick="saveAvantages('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
    </div>`;
}

function renderPluBloc(d) {
  return `
    <div class="ic">
      <div class="ict">Démarche administrative (PLU)</div>
      <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px">
        <input type="checkbox" id="plu-check" ${d.plu_concerne==='true'?'checked':''} style="width:16px;height:16px">
        Projet soumis à déclaration / PLU
      </label>
      <div class="fg" style="margin-bottom:8px"><label>Adresse du projet</label><input id="plu-adresse" placeholder="12 rue de la Paix, 75002 Paris" value="${d.plu_adresse||''}"></div>
      <button class="btn btn-p btn-sm" style="width:100%" onclick="savePlu('${d.id}')">${icon('deviceFloppy',14)} Enregistrer</button>
    </div>`;
}

function toISO(dateStr) {
  if (!dateStr) return '';
  const [j,m,a] = dateStr.split('/');
  if (!j||!m||!a) return '';
  return `${a}-${m.padStart(2,'0')}-${j.padStart(2,'0')}`;
}
function fromISO(iso) {
  if (!iso) return '';
  const [a,m,j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

async function setEtape(n) {
  const d = _dossiers.find(x=>x.id===_curId); if (!d) return;
  d.etape = String(n);
  if (!d['date'+n]) d['date'+n] = new Date().toLocaleDateString('fr-FR');
  await sheetsWrite('update', { id:_curId, fields:{ etape:d.etape, ['date'+n]:d['date'+n] } });
  renderDetail();
  showToast('✓ ' + STEPS[n-1].l);
}

async function saveTarif(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const prod = document.getElementById('prix-produit').value.trim();
  const pose = document.getElementById('prix-pose').value.trim();
  d.prix_produit = prod; d.prix_pose = pose;
  await sheetsWrite('update', { id, fields:{ prix_produit: prod, prix_pose: pose } });
  showToast('✓ Détail tarifaire enregistré');
  renderDetail();
}

async function saveEquipe(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const val = document.getElementById('equipe-input').value.trim();
  d.equipe = val;
  await sheetsWrite('update', { id, fields:{ equipe: val } });
  showToast('✓ Équipe mise à jour');
  renderDetail();
}

async function saveMessageClient(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const val = document.getElementById('message-client').value.trim();
  d.message_client = val;
  await sheetsWrite('update', { id, fields:{ message_client: val } });
  showToast('✓ Message enregistré');
  renderDetail();
}

async function saveDates(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const f2 = fromISO(document.getElementById('date-2').value);
  const f3 = fromISO(document.getElementById('date-3').value);
  const f4 = fromISO(document.getElementById('date-4').value);
  d.date2=f2; d.date3=f3; d.date4=f4;
  await sheetsWrite('update', { id, fields:{ date2:f2, date3:f3, date4:f4 } });
  showToast('✓ Dates enregistrées');
  renderDetail();
}

async function saveDocs(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const pre = document.getElementById('predevis-url').value.trim();
  const dev = document.getElementById('devis-url').value.trim();
  const cmd = document.getElementById('commande-url').value.trim();
  d.predevis_url = pre; d.devis_url = dev; d.commande_url = cmd;
  await sheetsWrite('update', { id, fields:{ predevis_url:pre, devis_url:dev, commande_url:cmd } });
  showToast('✓ Documents enregistrés');
  renderDetail();
}

function computeDateEstimee(dateConfirmation, semaines) {
  const [j,m,a] = dateConfirmation.split('/');
  if (!j||!m||!a) return '—';
  const d = new Date(parseInt(a), parseInt(m)-1, parseInt(j));
  d.setDate(d.getDate() + parseInt(semaines)*7);
  return d.toLocaleDateString('fr-FR');
}

async function saveDelai(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const val = document.getElementById('delai-semaines').value.trim();
  d.delai_fab_semaines = val;
  await sheetsWrite('update', { id, fields:{ delai_fab_semaines: val } });
  showToast('✓ Délai enregistré');
  renderDetail();
}

async function saveTech(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const art = document.getElementById('tech-artisan').value.trim();
  const mod = document.getElementById('tech-modele').value.trim();
  d.artisan = art; d.modele = mod;
  await sheetsWrite('update', { id, fields:{ artisan:art, modele:mod } });
  showToast('✓ Détails techniques enregistrés');
  renderDetail();
}

async function saveAvantages(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const promo = document.getElementById('adm-promo').value.trim();
  const eco = document.getElementById('adm-ecoptz').value.trim();
  d.promo = promo; d.ecoptz_url = eco;
  await sheetsWrite('update', { id, fields:{ promo, ecoptz_url:eco } });
  showToast('✓ Avantages enregistrés');
  renderDetail();
}

async function savePlu(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const checked = document.getElementById('plu-check').checked;
  const adresse = document.getElementById('plu-adresse').value.trim();
  d.plu_concerne = String(checked);
  d.plu_adresse = adresse;
  await sheetsWrite('update', { id, fields:{ plu_concerne:String(checked), plu_adresse:adresse } });
  showToast('✓ Info PLU enregistrée');
  renderDetail();
}

async function saveTransporteur(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  const val = document.getElementById('transp-input').value.trim();
  d.transporteur = val;
  await sheetsWrite('update', { id, fields:{ transporteur: val } });
  showToast('✓ Transporteur enregistré');
  renderDetail();
}

function sendStatusEmail(id) {
  const d = _dossiers.find(x=>x.id===id); if (!d) return;
  if (!d.email) { showToast("Aucun email renseigné pour ce client"); return; }

  const e = parseInt(d.etape)||1;
  const etapeLabel = STEPS[e-1]?.l || '';
  const lienSuivi = location.origin + CFG.BASE_PATH + '/client/' + d.token;
  const prenom = (d.nom||'').split(' ')[0] || '';

  const sujet = `Suivi de votre projet Leroy Merlin — ${etapeLabel}`;
  let corps = `Bonjour ${prenom},\n\n`;
  corps += `Votre projet vient de passer à l'étape : ${etapeLabel}.\n\n`;
  if (d.message_client) corps += `${d.message_client}\n\n`;
  corps += `Vous pouvez suivre l'avancement de votre projet à tout moment ici :\n${lienSuivi}\n\n`;
  corps += `Cordialement,\n${d.conseiller || 'Votre conseiller Leroy Merlin'}`;

  const mailtoUrl = `mailto:${encodeURIComponent(d.email)}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  window.location.href = mailtoUrl;
}

function copyLien(token) {
  const lien = location.origin + CFG.BASE_PATH + '/client/' + token;
  navigator.clipboard.writeText(lien).then(() => showToast('✓ Lien copié !'));
}
