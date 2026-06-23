// ============================================================
// admin.js — Interface Admin complète
// ============================================================

let _dossiers = [], _savDossiers = [], _curId = null, _curType = 'pose';

function hideAllAdminViews() {
  ['vListe','vDetail','vCatalogue','vCreneaux','vRdvReporter','vConseillers','vDashboard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

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
  lbar.start();
  try { _dossiers = await sheetsGetAll(); } catch(e) { showToastError('Erreur : ' + e.message); _dossiers = []; }
  try { _savDossiers = await savGetAll(); } catch(e) { _savDossiers = []; }
  await loadCatalogue();
  await loadCreneaux();
  populateGammeSelect();
  renderRdvBadge();
  lbar.done();
  renderListe();
}

function renderListe(f) {
  let list = [
    ..._dossiers.map(d => ({...d, _type:'pose'})),
    ..._savDossiers.map(d => ({...d, _type:'sav'})),
  ];
  if (f==='pose')  list = list.filter(d => d._type==='pose');
  if (f==='sav')   list = list.filter(d => d._type==='sav');
  if (f==='cours') list = list.filter(d => { const s = d._type==='sav'?STEPS_SAV:STEPS_POSE; return parseInt(d.etape)<s.length; });
  if (f==='fin')   list = list.filter(d => { const s = d._type==='sav'?STEPS_SAV:STEPS_POSE; return parseInt(d.etape)===s.length; });
  const cont = document.getElementById('listeDos');
  if (!list.length) { cont.innerHTML='<div style="color:#aaa;padding:20px 0">Aucun dossier.</div>'; return; }
  cont.innerHTML = list.map(d => {
    const steps = d._type==='sav'?STEPS_SAV:STEPS_POSE;
    const e=parseInt(d.etape)||1, s=steps[e-1];
    const prix = d.prix_final ? parseInt(d.prix_final).toLocaleString('fr-FR')+' €' : '—';
    const signé = d.signe==='true' ? `<span style="color:var(--g);font-size:11px;margin-left:8px">${icon('check',12)} Signé</span>` : '';
    const typeTag = d._type==='sav' ? `<span class="type-tag type-tag-sav">SAV</span>` : `<span class="type-tag type-tag-pose">Pose</span>`;
    return `<div class="dos-card" onclick="openDetail('${d.id}','${d._type}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px">${typeTag}${d.nom}${signé}</div>
        <div style="font-size:12px;color:var(--mut);margin-top:4px">N° ${d.id} · ${d._type==='sav'?(d.produit_concerne||'—'):(d.gamme||'—')} · ${d.conseiller||'—'}</div>
      </div>
      <span class="sp sp${Math.min(e,6)}">${icon(s.ic,12)} ${s.l}</span>
      ${d._type==='pose'?`<div style="font-size:15px;font-weight:700;color:var(--gd);white-space:nowrap">${prix}</div>`:'<div style="width:1px"></div>'}
      <div onclick="event.stopPropagation()">
        <button class="btn btn-p btn-sm" onclick="copyLien('${d.token}','${d._type}')">${icon('link',14)} Lien</button>
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
  if (t==='new') { populateGammeSelect(); switchNewType('pose'); }
  if (t!=='new') renderListe();
}
function switchNewType(type) {
  _curType = type;
  document.getElementById('newTypePose').classList.toggle('active', type==='pose');
  document.getElementById('newTypeSav').classList.toggle('active', type==='sav');
  document.getElementById('formNewPose').style.display = type==='pose'?'block':'none';
  document.getElementById('formNewSav').style.display = type==='sav'?'block':'none';
}

async function checkDosId() {
  const id=document.getElementById('fid').value.trim(), msgEl=document.getElementById('fid-msg');
  if (!id) { msgEl.textContent=''; return; }
  const ok = await checkIdAvailable(id);
  msgEl.textContent = ok?'✓ Numéro disponible':'✗ Ce numéro existe déjà';
  msgEl.style.color = ok?'var(--gd)':'#e53935';
}
async function checkSavId() {
  const id=document.getElementById('sid').value.trim(), msgEl=document.getElementById('sid-msg');
  if (!id) { msgEl.textContent=''; return; }
  const ok = await checkIdAvailable(id);
  msgEl.textContent = ok?'✓ Numéro disponible':'✗ Ce numéro existe déjà';
  msgEl.style.color = ok?'var(--gd)':'#e53935';
}

async function creerDosPose() {
  const id=document.getElementById('fid').value.trim(), nom=document.getElementById('fnom').value.trim();
  if (!id) { showToastError('Numéro de dossier requis.'); return; }
  if (!nom) { showToastError('Nom requis.'); return; }
  if (!await checkIdAvailable(id)) { showToastError('Ce numéro existe déjà.'); return; }
  const token=genToken();
  const row={
    id,nom,gamme:getSelectedGammeLabel(),modele:getSelectedModeleLabel(),
    artisan:document.getElementById('fart').value||'',etape:'1',
    prix_est:document.getElementById('fest').value||'',prix_final:document.getElementById('fpfin').value||'',
    token,email:document.getElementById('feml').value||'',tel:document.getElementById('ftel').value||'',
    conseiller:document.getElementById('fcon').value||'',tel_conseiller:document.getElementById('ftlc').value||'',
    notes:document.getElementById('fnot').value||'',transporteur:'',promo:document.getElementById('fpromo').value||'',
    ecoptz_url:'',plu_concerne:'false',plu_adresse:'',drive_url:'',
    fiche_url:document.getElementById('ffiche-link')?.value||'',delai_fab_semaines:'',message_client:'',
    equipe:'',prix_produit:'',prix_pose:'',plu_statut:'',plu_doc_url:'',financement_ptz:'',financement_conseil:'',
    date1:new Date().toLocaleDateString('fr-FR'),date2:'',date3:'',date4:'',date5:'',date6:'',date7:'',date8:'',
    signe:'false',sig_date:'',sig_data:'',signe_pose:'false',
    predevis_url:'',devis_url:'',commande_url:'',commande_signee_url:'',pose_signee_url:'',
  };
  await sheetsWrite('append',{row,sheetType:'pose'});
  _dossiers.unshift(row);
  showToastOk('✓ Dossier Pose '+id+' créé !');
  showTab('list');
  createDriveFolderFor(id,nom);
}

async function creerDosSav() {
  const id=document.getElementById('sid').value.trim(), nom=document.getElementById('snom').value.trim();
  if (!id) { showToastError('Numéro de dossier requis.'); return; }
  if (!nom) { showToastError('Nom requis.'); return; }
  if (!await checkIdAvailable(id)) { showToastError('Ce numéro existe déjà.'); return; }
  const token=genToken();
  const row={
    id,nom,motif_sav:document.getElementById('smotif').value||'',
    produit_concerne:document.getElementById('sproduit').value||'',etape:'1',token,
    email:document.getElementById('seml').value||'',tel:document.getElementById('stel').value||'',
    conseiller:document.getElementById('scon').value||'',tel_conseiller:document.getElementById('stlc').value||'',
    notes:document.getElementById('snot').value||'',message_client:'',
    date1:new Date().toLocaleDateString('fr-FR'),date2:'',date3:'',date4:'',date5:'',date6:'',
  };
  await sheetsWrite('append',{row,sheetType:'sav'});
  _savDossiers.unshift(row);
  showToastOk('✓ Dossier SAV '+id+' créé !');
  showTab('list');
}

async function createDriveFolderFor(id,nom) {
  await sheetsWrite('createFolder',{id,nom});
  setTimeout(async()=>{
    try { const f=await sheetsGetById(id); const d=_dossiers.find(x=>x.id===id); if(f&&d) d.drive_url=f.drive_url; }
    catch(e){}
  },2500);
}

function openDetail(id,type) {
  _curId=id; _curType=type||'pose';
  hideAllAdminViews();
  document.getElementById('vDetail').style.display='block';
  if (_curType==='sav') renderDetailSav(); else renderDetail();
}
function goListe() { hideAllAdminViews(); document.getElementById('vListe').style.display='block'; }

function renderDetail() {
  const d=_dossiers.find(x=>x.id===_curId); if(!d) return;
  const e=parseInt(d.etape)||1, pct=Math.round(e/STEPS_POSE.length*100);
  const lien=location.origin+CFG.BASE_PATH+'/client/'+d.token;
  const tl=STEPS_POSE.map((s,i)=>{
    const n=i+1,st=n<e?'done':n===e?'current':'pending';
    return `<div class="tli ${n<e?'done':''}"><div class="tll"></div><div class="tld ${st}">${st==='done'?icon('check',12):n}</div><div class="tlc"><div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">${icon(s.ic,14)}${s.l}</div>${d['date'+n]?`<div style="font-size:11px;color:var(--mut);margin-top:2px">${d['date'+n]}</div>`:''}</div></div>`;
  }).join('');
  const sbts=STEPS_POSE.map((s,i)=>`<button class="step-btn ${e===i+1?'sel':''}" onclick="saveWithFeedback(event, ()=>setEtape(${i+1}))">${icon(s.ic,14)} ${s.l}</button>`).join('');
  document.getElementById('detailCont').innerHTML=`
    <div style="background:white;border-radius:8px;border:1px solid var(--mid);padding:20px 24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div>
        <div style="font-size:20px;font-weight:700">${d.nom}${d.signe==='true'?`<span style="background:var(--g);color:white;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px">${icon('check',11)} Signé</span>`:''}</div>
        <div style="font-size:13px;color:var(--mut);margin-top:4px">N° ${d.id} · ${d.gamme||'—'}</div>
        <div style="font-size:13px;color:var(--mut);margin-top:4px">${icon('phone',13)} ${d.tel||'—'} &nbsp;·&nbsp; ${icon('mail',13)} ${d.email||'—'}</div>
        <div style="height:6px;background:var(--mid);border-radius:3px;overflow:hidden;width:260px;margin:10px 0 4px"><div style="height:100%;background:var(--g);border-radius:3px;width:${pct}%"></div></div>
        <div style="font-size:12px;color:var(--mut)">Étape ${e}/${STEPS_POSE.length} — ${pct}%</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--mut)">Prix final</div>
        <div style="font-size:22px;font-weight:800;color:var(--gd)">${d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':'—'}</div>
        <div style="font-size:12px;margin-top:6px;color:${d.signe==='true'?'var(--gd)':'#e65100'}">${d.signe==='true'?icon('check',12)+' Signé le '+d.sig_date:icon('clock',12)+' En attente'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start">
      <div>
        <div class="ic"><div class="ict">Changer l'étape</div><div class="step-sel">${sbts}</div></div>
        <div class="ic"><div class="ict">Avancement</div><div class="atl">${tl}</div></div>
      </div>
      <div>
        <div class="dtab-bar">
          <button class="dtab active" onclick="switchDetailTab(event,'tab-suivi')">${icon('calendar',13)} Suivi</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-docs')">${icon('filetext',13)} Documents</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-projet')">${icon('ruler',13)} Projet</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-avantages')">${icon('discount',13)} Avantages</button>
          <button class="dtab" onclick="switchDetailTab(event,'tab-contact')">${icon('link',13)} Contact & lien</button>
        </div>
        <div id="tab-suivi" class="dtab-panel">${renderDateFields(d)}${renderMessageBloc(d)}</div>
        <div id="tab-docs" class="dtab-panel" style="display:none">${renderDocsBloc(d)}${renderDriveBloc(d)}</div>
        <div id="tab-projet" class="dtab-panel" style="display:none">${renderTechBloc(d)}${renderTarifBloc(d)}${renderDelaiBloc(d)}${renderTranspBloc(d)}</div>
        <div id="tab-avantages" class="dtab-panel" style="display:none">${renderAvantagesBloc(d)}${renderPluBloc(d)}${renderFinancementBloc(d)}</div>
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
            <button class="btn btn-p" style="width:100%;margin-bottom:8px" onclick="copyLien('${d.token}','pose')">${icon('copy',14)} Copier le lien</button>
            <button class="btn btn-o" style="width:100%;border-color:var(--mid);color:var(--mut)" onclick="sendStatusEmail('${d.id}')" ${!d.email?'disabled':''}>${icon('mail',14)} Préparer l'email de suivi</button>
            ${d.email?`<div style="font-size:11px;color:var(--mut);margin-top:6px">Ouvre Gmail dans un nouvel onglet.</div>`:''}
          </div>
          <div class="ic">
            <div class="ict">Équipe en charge du projet</div>
            <div style="font-size:11px;color:var(--mut);margin-bottom:8px">Un membre par ligne : <code>Nom | Rôle</code></div>
            <textarea id="equipe-input" placeholder="Marc Dubois | Technicien poseur" style="min-height:80px">${d.equipe||''}</textarea>
            <button class="btn btn-p btn-sm" style="width:100%;margin-top:8px" onclick="saveWithFeedback(event, ()=>saveEquipe('${d.id}'), '✓ Équipe mise à jour')">${icon('deviceFloppy',14)} Enregistrer</button>
          </div>
        </div>
      </div>
    </div>`;
  if (d.plu_adresse) setTimeout(()=>loadAdminMap(d.plu_adresse), 50);
}

// ============ BLOCS AUXILIAIRES ============
function renderDateFields(d) { return `<div class="ic"><div class="ict">Dates clés</div><div class="fg" style="margin-bottom:8px"><label>RDV planifié</label><input id="date-2" type="date" value="${toISO(d.date2)}"></div><div class="fg" style="margin-bottom:8px"><label>Retour technicien</label><input id="date-3" type="date" value="${toISO(d.date3)}"></div><div class="fg" style="margin-bottom:8px"><label>Devis envoyé</label><input id="date-4" type="date" value="${toISO(d.date4)}"></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveDates('${d.id}'),'✓ Dates enregistrées')">${icon('deviceFloppy',14)} Enregistrer les dates</button></div>`; }
function renderMessageBloc(d) { return `<div class="ic"><div class="ict">Message pour le client</div><div class="fg" style="margin-bottom:8px"><textarea id="message-client" placeholder="Ex: Votre commande avance bien." style="min-height:70px">${d.message_client||''}</textarea></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveMessageClient('${d.id}'),'✓ Message enregistré')">${icon('deviceFloppy',14)} Enregistrer</button><div style="font-size:11px;color:var(--mut);margin-top:8px">S'affiche sur la page de suivi du client.</div></div>`; }
function renderDocsBloc(d) { return `<div class="ic"><div class="ict">Documents à transmettre</div><div class="fg" style="margin-bottom:8px"><label>Lien pré-devis (Drive)</label><input id="predevis-url" type="url" placeholder="https://drive.google.com/..." value="${d.predevis_url||''}"></div><div class="fg" style="margin-bottom:8px"><label>Lien devis final (Drive)</label><input id="devis-url" type="url" placeholder="https://drive.google.com/..." value="${d.devis_url||''}"></div><div class="fg" style="margin-bottom:8px"><label>Bon de commande à signer (Drive)</label><input id="commande-url" type="url" placeholder="https://drive.google.com/file/d/.../view" value="${d.commande_url||''}"></div><div style="font-size:11px;color:var(--mut);margin:-4px 0 8px">${icon('alert',11)} Partager en "Lecture pour toute personne disposant du lien"</div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveDocs('${d.id}'),'✓ Documents enregistrés')">${icon('deviceFloppy',14)} Enregistrer les liens</button>${d.sig_data?`<div style="margin-top:10px;background:var(--gl);border-radius:6px;padding:8px 10px;font-size:11px;color:var(--gd);display:flex;align-items:center;gap:6px">${icon('signature',14)} Signature client enregistrée</div>`:''}</div>`; }
function renderDriveBloc(d) { return `<div class="ic"><div class="ict">Espace Drive client</div>${d.drive_url?`<div class="drive-locked" onclick="window.open('${d.drive_url}','_blank')">${icon('link',15)}<span class="drive-locked-text">${d.drive_url}</span></div><div style="font-size:11px;color:var(--mut);margin-top:8px">${icon('check',11)} Dossier créé automatiquement</div>`:`<div class="drive-locked drive-locked-pending">${icon('loader',15)}<span class="drive-locked-text">Création en cours...</span></div>`}<div style="font-size:11px;color:var(--mut);margin-top:8px">Les documents signés sont automatiquement déposés ici.</div></div>`; }
function renderTechBloc(d) { return `<div class="ic"><div class="ict">Détails techniques</div><div class="fg" style="margin-bottom:8px"><label>Artisan / Poseur</label><input id="tech-artisan" value="${d.artisan||''}"></div><div class="fg" style="margin-bottom:8px"><label>Modèle détaillé</label><textarea id="tech-modele" style="min-height:50px">${d.modele||''}</textarea></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveTech('${d.id}'),'✓ Détails enregistrés')">${icon('deviceFloppy',14)} Enregistrer</button></div>`; }
function renderTarifBloc(d) { const t=(parseInt(d.prix_produit)||0)+(parseInt(d.prix_pose)||0); return `<div class="ic"><div class="ict">Détail tarifaire</div><div class="fg" style="margin-bottom:8px"><label>Prix produit (€)</label><input id="prix-produit" type="number" min="0" placeholder="ex: 2200" value="${d.prix_produit||''}"></div><div class="fg" style="margin-bottom:8px"><label>Prix pose (€)</label><input id="prix-pose" type="number" min="0" placeholder="ex: 600" value="${d.prix_pose||''}"></div>${t>0?`<div style="font-size:12px;color:var(--gd);background:var(--gl);border-radius:6px;padding:8px 10px;margin-bottom:8px">Total : ${t.toLocaleString('fr-FR')} €</div>`:''}<button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveTarif('${d.id}'),'✓ Tarif enregistré')">${icon('deviceFloppy',14)} Enregistrer</button></div>`; }
function renderDelaiBloc(d) { return `<div class="ic"><div class="ict">Délai de fabrication</div><div class="fg" style="margin-bottom:8px"><label>Durée (semaines)</label><input id="delai-semaines" type="number" min="0" placeholder="ex: 6" value="${d.delai_fab_semaines||''}"></div>${d.date6&&d.delai_fab_semaines?`<div style="font-size:12px;color:var(--gd);background:var(--gl);border-radius:6px;padding:8px 10px;margin-bottom:8px">${icon('calendar',13)} Livraison estimée : ${computeDateEstimee(d.date6,d.delai_fab_semaines)}</div>`:''}<button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveDelai('${d.id}'),'✓ Délai enregistré')">${icon('deviceFloppy',14)} Enregistrer</button><div style="font-size:11px;color:var(--mut);margin-top:8px">Calculé depuis la date de confirmation.</div></div>`; }
function renderTranspBloc(d) { return `<div class="ic"><div class="ict">Livraison</div><div class="fg" style="margin-bottom:8px"><label>Transporteur</label><input id="transp-input" placeholder="ex: Chronopost" value="${d.transporteur||''}"></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveTransporteur('${d.id}'),'✓ Transporteur enregistré')">${icon('deviceFloppy',14)} Enregistrer</button></div>`; }
function renderAvantagesBloc(d) { return `<div class="ic"><div class="ict">Avantages client</div><div class="fg" style="margin-bottom:8px"><label>Promo éligible</label><input id="adm-promo" placeholder="ex: -10% pose" value="${d.promo||''}"></div><div class="fg" style="margin-bottom:8px"><label>Lien éco-PTZ</label><input id="adm-ecoptz" type="url" placeholder="https://..." value="${d.ecoptz_url||''}"></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveAvantages('${d.id}'),'✓ Avantages enregistrés')">${icon('deviceFloppy',14)} Enregistrer</button></div>`; }
function renderPluBloc(d) { return `<div class="ic"><div class="ict">Démarche administrative (PLU)</div><label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px"><input type="checkbox" id="plu-check" ${d.plu_concerne==='true'?'checked':''} style="width:16px;height:16px"> Projet soumis à déclaration / PLU</label><div class="fg" style="margin-bottom:8px;position:relative"><label>Adresse du projet</label><input id="plu-adresse" placeholder="12 rue de la Paix, 75002 Paris" value="${d.plu_adresse||''}" autocomplete="off" oninput="adresseAutocomplete(this)" onblur="setTimeout(()=>closeAdresseSuggestions(),200)"><div id="adresse-suggestions" class="addr-suggestions" style="display:none"></div></div>${d.plu_adresse?`<div id="admin-map" class="plu-map" style="margin-bottom:8px"></div>`:''}<div class="fg" style="margin-bottom:8px"><label>Statut du dossier d'urbanisme</label><select id="plu-statut" style="padding:10px 12px;border:1.5px solid var(--mid);border-radius:7px;font-size:14px"><option value="" ${!d.plu_statut?'selected':''}>— Non renseigné —</option><option value="en_attente" ${d.plu_statut==='en_attente'?'selected':''}>En attente de dépôt</option><option value="depose" ${d.plu_statut==='depose'?'selected':''}>Déposé en mairie</option><option value="valide" ${d.plu_statut==='valide'?'selected':''}>Validé</option></select></div><div class="fg" style="margin-bottom:8px"><label>Lien du document déposé (Drive)</label><input id="plu-doc-url" type="url" placeholder="https://drive.google.com/..." value="${d.plu_doc_url||''}"></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>savePlu('${d.id}'),'✓ PLU enregistré')">${icon('deviceFloppy',14)} Enregistrer</button></div>`; }
function renderFinancementBloc(d) { return `<div class="ic"><div class="ict">Financement</div><label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px"><input type="checkbox" id="ptz-check" ${d.financement_ptz==='true'?'checked':''} style="width:16px;height:16px"> Le client envisage un financement éco-PTZ</label><div class="fg" style="margin-bottom:8px"><label>Conseil de paiement</label><textarea id="financement-conseil" placeholder="Ex: Pour ce montant, nous recommandons un virement..." style="min-height:70px">${d.financement_conseil||''}</textarea></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveFinancement('${d.id}'),'✓ Financement enregistré')">${icon('deviceFloppy',14)} Enregistrer</button></div>`; }

// ============ UTILITAIRES DATES ============
function toISO(dateStr) { if(!dateStr) return ''; const [j,m,a]=dateStr.split('/'); if(!j||!m||!a) return ''; return `${a}-${m.padStart(2,'0')}-${j.padStart(2,'0')}`; }
function fromISO(iso) { if(!iso) return ''; const [a,m,j]=iso.split('-'); return `${j}/${m}/${a}`; }
function computeDateEstimee(dateConf,semaines) { const [j,m,a]=dateConf.split('/'); if(!j||!m||!a) return '—'; const d=new Date(parseInt(a),parseInt(m)-1,parseInt(j)); d.setDate(d.getDate()+parseInt(semaines)*7); return d.toLocaleDateString('fr-FR'); }

// ============ FONCTIONS DE SAUVEGARDE ============
async function setEtape(n) {
  const list=_curType==='sav'?_savDossiers:_dossiers, steps=_curType==='sav'?STEPS_SAV:STEPS_POSE;
  const d=list.find(x=>x.id===_curId); if(!d) return;
  d.etape=String(n); if(!d['date'+n]) d['date'+n]=new Date().toLocaleDateString('fr-FR');
  await sheetsWrite('update',{id:_curId,fields:{etape:d.etape,['date'+n]:d['date'+n]},sheetType:_curType});
  if(_curType==='sav') renderDetailSav(); else renderDetail();
  showToastOk('✓ '+steps[n-1].l);
}
async function saveDates(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const f2=fromISO(document.getElementById('date-2').value),f3=fromISO(document.getElementById('date-3').value),f4=fromISO(document.getElementById('date-4').value); d.date2=f2;d.date3=f3;d.date4=f4; await sheetsWrite('update',{id,fields:{date2:f2,date3:f3,date4:f4}}); renderDetail(); }
async function saveDocs(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const pre=document.getElementById('predevis-url').value.trim(),dev=document.getElementById('devis-url').value.trim(),cmd=document.getElementById('commande-url').value.trim(); d.predevis_url=pre;d.devis_url=dev;d.commande_url=cmd; await sheetsWrite('update',{id,fields:{predevis_url:pre,devis_url:dev,commande_url:cmd}}); renderDetail(); }
async function saveTech(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const art=document.getElementById('tech-artisan').value.trim(),mod=document.getElementById('tech-modele').value.trim(); d.artisan=art;d.modele=mod; await sheetsWrite('update',{id,fields:{artisan:art,modele:mod}}); renderDetail(); }
async function saveTarif(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const prod=document.getElementById('prix-produit').value.trim(),pose=document.getElementById('prix-pose').value.trim(); d.prix_produit=prod;d.prix_pose=pose; await sheetsWrite('update',{id,fields:{prix_produit:prod,prix_pose:pose}}); renderDetail(); }
async function saveDelai(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const val=document.getElementById('delai-semaines').value.trim(); d.delai_fab_semaines=val; await sheetsWrite('update',{id,fields:{delai_fab_semaines:val}}); renderDetail(); }
async function saveAvantages(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const promo=document.getElementById('adm-promo').value.trim(),eco=document.getElementById('adm-ecoptz').value.trim(); d.promo=promo;d.ecoptz_url=eco; await sheetsWrite('update',{id,fields:{promo,ecoptz_url:eco}}); renderDetail(); }
async function savePlu(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const checked=document.getElementById('plu-check').checked,adresse=document.getElementById('plu-adresse').value.trim(),statut=document.getElementById('plu-statut').value,docUrl=document.getElementById('plu-doc-url').value.trim(); d.plu_concerne=String(checked);d.plu_adresse=adresse;d.plu_statut=statut;d.plu_doc_url=docUrl; await sheetsWrite('update',{id,fields:{plu_concerne:String(checked),plu_adresse:adresse,plu_statut:statut,plu_doc_url:docUrl}}); renderDetail(); }
async function saveFinancement(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const ptz=document.getElementById('ptz-check').checked,conseil=document.getElementById('financement-conseil').value.trim(); d.financement_ptz=String(ptz);d.financement_conseil=conseil; await sheetsWrite('update',{id,fields:{financement_ptz:String(ptz),financement_conseil:conseil}}); renderDetail(); }
async function saveTransporteur(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const val=document.getElementById('transp-input').value.trim(); d.transporteur=val; await sheetsWrite('update',{id,fields:{transporteur:val}}); renderDetail(); }
async function saveEquipe(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const val=document.getElementById('equipe-input').value.trim(); d.equipe=val; await sheetsWrite('update',{id,fields:{equipe:val}}); renderDetail(); }
async function saveMessageClient(id) { const d=_dossiers.find(x=>x.id===id); if(!d) return; const val=document.getElementById('message-client').value.trim(); d.message_client=val; await sheetsWrite('update',{id,fields:{message_client:val}}); renderDetail(); }

// ============ EMAIL & LIEN ============
function sendStatusEmail(id) {
  const d=_dossiers.find(x=>x.id===id); if(!d||!d.email) { showToastError('Aucun email renseigné'); return; }
  const e=parseInt(d.etape)||1, etapeLabel=STEPS_POSE[e-1]?.l||'', lienSuivi=location.origin+CFG.BASE_PATH+'/client/'+d.token, prenom=(d.nom||'').split(' ')[0];
  const sujet=`Suivi de votre projet Leroy Merlin — ${etapeLabel}`;
  let corps=`Bonjour ${prenom},\n\nVotre projet vient de passer à l'étape : ${etapeLabel}.\n\n`;
  if(d.message_client) corps+=d.message_client+'\n\n';
  corps+=`Suivez votre projet ici :\n${lienSuivi}\n\nCordialement,\n${d.conseiller||'Votre conseiller Leroy Merlin'}`;
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(d.email)}&su=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`, '_blank');
}
function copyLien(token, type) { const path=type==='sav'?'/sav/':'/client/'; navigator.clipboard.writeText(location.origin+CFG.BASE_PATH+path+token).then(()=>showToastOk('✓ Lien copié !')); }

// ============ CATALOGUE & GAMMES ============
async function openCatalogueView() { hideAllAdminViews(); document.getElementById('vCatalogue').style.display='block'; await loadCatalogue(); renderCatalogueView(); }
function closeCatalogueView() { hideAllAdminViews(); document.getElementById('vListe').style.display='block'; }

// ============ ONGLETS DÉTAIL ============
function switchDetailTab(evt, tabId) {
  document.querySelectorAll('.dtab-panel').forEach(p=>p.style.display='none');
  document.querySelectorAll('.dtab').forEach(b=>b.classList.remove('active'));
  document.getElementById(tabId).style.display='block';
  evt.currentTarget.classList.add('active');
  if (tabId==='tab-avantages') {
    const d=_dossiers.find(x=>x.id===_curId);
    if (d&&d.plu_adresse) setTimeout(()=>loadAdminMap(d.plu_adresse),50);
  }
}

// ============ CARTE ADMIN ============
async function loadAdminMap(adresse) {
  const el=document.getElementById('admin-map'); if(!el) return;
  try {
    el.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--mut);font-size:12px;gap:8px">${icon('loader',16)} Chargement...</div>`;
    const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=json&limit=1`,{headers:{'Accept-Language':'fr','User-Agent':'SuiviPoseLM/1.0'}});
    const data=await res.json();
    if(!data.length){el.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--mut2);font-size:12px">${icon('pin',14)} Adresse introuvable</div>`;return;}
    const{lat,lon}=data[0];
    el.innerHTML=`<iframe width="100%" height="100%" frameborder="0" style="border:0;border-radius:9px" src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lon)-.005},${parseFloat(lat)-.003},${parseFloat(lon)+.005},${parseFloat(lat)+.003}&layer=mapnik&marker=${lat},${lon}" allowfullscreen></iframe>`;
  } catch(e){el.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--mut2);font-size:12px">${icon('alert',14)} Impossible de charger la carte</div>`;}
}

// ============ AUTOCOMPLÉTION ADRESSE ============
let _adresseTimer=null;
async function adresseAutocomplete(input) {
  const q=input.value.trim(), sug=document.getElementById('adresse-suggestions'); if(!sug) return;
  clearTimeout(_adresseTimer); if(q.length<4){sug.style.display='none';return;}
  _adresseTimer=setTimeout(async()=>{
    try {
      const res=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=fr`,{headers:{'Accept-Language':'fr','User-Agent':'SuiviPoseLM/1.0'}});
      const data=await res.json(); if(!data.length){sug.style.display='none';return;}
      sug.innerHTML=data.map(r=>`<div class="addr-item" onclick="selectAdresse('${(r.display_name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'")}'">${icon('pin',13)}<span>${r.display_name||''}</span></div>`).join('');
      sug.style.display='block';
    } catch(e){sug.style.display='none';}
  },350);
}
function selectAdresse(adresse) { const i=document.getElementById('plu-adresse'); if(i){i.value=adresse;} closeAdresseSuggestions(); loadAdminMap(adresse); }
function closeAdresseSuggestions() { const s=document.getElementById('adresse-suggestions'); if(s) s.style.display='none'; }

// ============ FICHE SAV ============
function renderDetailSav() {
  const d=_savDossiers.find(x=>x.id===_curId); if(!d) return;
  const e=parseInt(d.etape)||1, pct=Math.round(e/STEPS_SAV.length*100);
  const lien=location.origin+CFG.BASE_PATH+'/sav/'+d.token;
  const tl=STEPS_SAV.map((s,i)=>{const n=i+1,st=n<e?'done':n===e?'current':'pending';return `<div class="tli ${n<e?'done':''}"><div class="tll"></div><div class="tld ${st}">${st==='done'?icon('check',12):n}</div><div class="tlc"><div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">${icon(s.ic,14)}${s.l}</div>${d['date'+n]?`<div style="font-size:11px;color:var(--mut);margin-top:2px">${d['date'+n]}</div>`:''}</div></div>`;}).join('');
  const sbts=STEPS_SAV.map((s,i)=>`<button class="step-btn ${e===i+1?'sel':''}" onclick="saveWithFeedback(event,()=>setEtape(${i+1}))">${icon(s.ic,14)} ${s.l}</button>`).join('');
  document.getElementById('detailCont').innerHTML=`
    <div style="background:white;border-radius:8px;border:1px solid var(--mid);padding:20px 24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div><div style="font-size:20px;font-weight:700"><span class="type-tag type-tag-sav" style="margin-right:8px">SAV</span>${d.nom}</div>
      <div style="font-size:13px;color:var(--mut);margin-top:4px">N° ${d.id} · ${d.produit_concerne||'—'}</div>
      <div style="font-size:13px;color:var(--mut);margin-top:4px">${icon('phone',13)} ${d.tel||'—'} &nbsp;·&nbsp; ${icon('mail',13)} ${d.email||'—'}</div>
      <div style="height:6px;background:var(--mid);border-radius:3px;overflow:hidden;width:260px;margin:10px 0 4px"><div style="height:100%;background:var(--g);border-radius:3px;width:${pct}%"></div></div>
      <div style="font-size:12px;color:var(--mut)">Étape ${e}/${STEPS_SAV.length} — ${pct}%</div></div>
      ${d.motif_sav?`<div style="text-align:right;max-width:260px"><div style="font-size:11px;color:var(--mut)">Motif</div><div style="font-size:13px;font-weight:600;margin-top:3px">${d.motif_sav}</div></div>`:''}
    </div>
    <div style="display:grid;grid-template-columns:280px 1fr;gap:16px;align-items:start">
      <div><div class="ic"><div class="ict">Changer l'étape</div><div class="step-sel">${sbts}</div></div><div class="ic"><div class="ict">Avancement</div><div class="atl">${tl}</div></div></div>
      <div>
        <div class="ic"><div class="ict">Détails du SAV</div><div class="fg" style="margin-bottom:8px"><label>Motif du SAV</label><textarea id="sav-motif" style="min-height:60px">${d.motif_sav||''}</textarea></div><div class="fg" style="margin-bottom:8px"><label>Produit concerné</label><input id="sav-produit" value="${d.produit_concerne||''}"></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveSavDetails('${d.id}'),'✓ Détails enregistrés')">${icon('deviceFloppy',14)} Enregistrer</button></div>
        <div class="ic"><div class="ict">Message pour le client</div><textarea id="sav-message" placeholder="Ex: Votre pièce a été commandée." style="min-height:70px">${d.message_client||''}</textarea><button class="btn btn-p btn-sm" style="width:100%;margin-top:8px" onclick="saveWithFeedback(event,()=>saveSavMessage('${d.id}'),'✓ Message enregistré')">${icon('deviceFloppy',14)} Enregistrer</button></div>
        <div class="ic"><div class="ict">Informations</div><div class="fg" style="margin-bottom:8px"><label>Conseiller</label><input id="sav-conseiller" value="${d.conseiller||''}"></div><div class="fg" style="margin-bottom:8px"><label>Tél. conseiller</label><input id="sav-tel-conseiller" value="${d.tel_conseiller||''}"></div><div class="fg" style="margin-bottom:8px"><label>Email client</label><input id="sav-email" type="email" value="${d.email||''}"></div><div class="fg" style="margin-bottom:8px"><label>Tél. client</label><input id="sav-tel" value="${d.tel||''}"></div><button class="btn btn-p btn-sm" style="width:100%" onclick="saveWithFeedback(event,()=>saveSavContact('${d.id}'),'✓ Contact enregistré')">${icon('deviceFloppy',14)} Enregistrer</button></div>
        <div class="ic"><div class="ict">Lien client</div><div style="font-family:monospace;font-size:11px;color:var(--gd);background:var(--gx);border:1px dashed var(--g);padding:10px;border-radius:6px;word-break:break-all;margin-bottom:8px">${lien}</div><button class="btn btn-p" style="width:100%" onclick="copyLien('${d.token}','sav')">${icon('copy',14)} Copier le lien client</button></div>
      </div>
    </div>`;
}
async function saveSavDetails(id) { const d=_savDossiers.find(x=>x.id===id); if(!d) return; const motif=document.getElementById('sav-motif').value.trim(),produit=document.getElementById('sav-produit').value.trim(); d.motif_sav=motif;d.produit_concerne=produit; await sheetsWrite('update',{id,fields:{motif_sav:motif,produit_concerne:produit},sheetType:'sav'}); renderDetailSav(); }
async function saveSavMessage(id) { const d=_savDossiers.find(x=>x.id===id); if(!d) return; const val=document.getElementById('sav-message').value.trim(); d.message_client=val; await sheetsWrite('update',{id,fields:{message_client:val},sheetType:'sav'}); renderDetailSav(); }
async function saveSavContact(id) { const d=_savDossiers.find(x=>x.id===id); if(!d) return; const conseiller=document.getElementById('sav-conseiller').value.trim(),tel=document.getElementById('sav-tel').value.trim(),email=document.getElementById('sav-email').value.trim(),telC=document.getElementById('sav-tel-conseiller').value.trim(); Object.assign(d,{conseiller,tel,email,tel_conseiller:telC}); await sheetsWrite('update',{id,fields:{conseiller,tel,email,tel_conseiller:telC},sheetType:'sav'}); renderDetailSav(); }

// ============ FEEDBACK GLOBAL ============
async function saveWithFeedback(event, asyncFn, successMsg) {
  const btn=event?.currentTarget||event?.target;
  const restore=btnLoad(btn instanceof HTMLElement?btn:null);
  try { await asyncFn(); restore(); if(successMsg) showToastOk(successMsg); }
  catch(e) { restore(); showToastError('Erreur : '+(e.message||String(e))); }
}
