// ============================================================
// admin.js — Interface Admin
// ============================================================
const STEPS = [
  { l:'Démarche lancée',       i:'🚀' },
  { l:'Rendez-vous planifié',  i:'📅' },
  { l:'Retour technicien',     i:'📐' },
  { l:'Devis final envoyé',    i:'📋' },
  { l:'Commande confirmée',    i:'✅' },
  { l:'Pose effectuée',        i:'🏠' },
];

let _dossiers = [], _curId = null;

// AUTH
function doLogin() {
  if (document.getElementById('lpwd').value === CFG.ADMIN_PWD) {
    sessionStorage.setItem('lm_auth','ok');
    showView('admin');
    loadAll();
  } else {
    document.getElementById('lerr').textContent = 'Mot de passe incorrect.';
  }
}
function doLogout() { sessionStorage.removeItem('lm_auth'); showView('login'); }

// CHARGEMENT
async function loadAll() {
  loading(true);
  try { _dossiers = await sheetsGetAll(); }
  catch(e) { showToast('Erreur connexion Sheets : ' + e.message); _dossiers = []; }
  loading(false);
  renderListe();
}

function loading(v) {
  const el = document.getElementById('lbar');
  if (el) el.style.display = v ? 'block' : 'none';
}

// LISTE
function renderListe(f) {
  let list = _dossiers;
  if (f==='cours') list = _dossiers.filter(d => parseInt(d.etape) < 6);
  if (f==='fin')   list = _dossiers.filter(d => parseInt(d.etape) === 6);
  const cont = document.getElementById('listeDos');
  if (!cont) return;
  if (!list.length) { cont.innerHTML = '<div style="color:#aaa;padding:20px 0;font-size:14px">Aucun dossier.</div>'; return; }
  cont.innerHTML = list.map(d => {
    const e = parseInt(d.etape)||1, s = STEPS[e-1];
    const prix = d.prix_final ? parseInt(d.prix_final).toLocaleString('fr-FR')+' €' : '—';
    return `<div class="dos-card" onclick="openDetail('${d.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700">${d.nom}${d.signe==='true'?'<span style="color:var(--g);font-size:11px;margin-left:8px;font-weight:700">✓ Signé</span>':''}</div>
        <div style="font-size:12px;color:var(--mut);margin-top:2px">${d.id} · ${d.gamme||'—'} · ${d.conseiller||'—'}</div>
      </div>
      <span class="sp sp${e}">${s.l}</span>
      <div style="font-size:15px;font-weight:700;color:var(--gd);white-space:nowrap">${prix}</div>
      <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
        <button class="btn btn-p btn-sm" onclick="copyLien('${d.token}')">🔗 Lien</button>
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
  if(t!=='new') renderListe();
}

// CRÉER
async function creerDos() {
  const nom = document.getElementById('fnom').value.trim();
  if (!nom) { showToast('Nom requis.'); return; }
  const id = await nextId(), token = genToken();
  const row = {
    id, nom,
    gamme:          document.getElementById('fgam').value||'',
    etape:          '1',
    prix_est:       document.getElementById('fest').value||'',
    prix_final:     document.getElementById('fpfin').value||'',
    token, email:   document.getElementById('feml').value||'',
    tel:            document.getElementById('ftel').value||'',
    conseiller:     document.getElementById('fcon').value||'',
    tel_conseiller: document.getElementById('ftlc').value||'',
    notes:          document.getElementById('fnot').value||'',
    date1: new Date().toLocaleDateString('fr-FR'),
    date2:'',date3:'',date4:'',date5:'',date6:'',
    signe:'false', sig_date:''
  };
  await sheetsWrite('append', { row });
  _dossiers.unshift(row);
  showToast('✓ Dossier '+id+' créé !');
  showTab('list');
}

// DÉTAIL
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
  const d = _dossiers.find(x=>x.id===_curId); if(!d) return;
  const e = parseInt(d.etape)||1, pct = Math.round(e/6*100);
  const lien = location.origin + '/client/' + d.token;

  const tl = STEPS.map((s,i) => {
    const n=i+1, st=n<e?'done':n===e?'current':'pending';
    return `<div class="tli ${n<e?'done':''}">
      <div class="tll"></div>
      <div class="tld ${st}">${st==='done'?'✓':n}</div>
      <div class="tlc">
        <div style="font-size:13px;font-weight:700">${s.i} ${s.l}</div>
        ${d['date'+n]?`<div style="font-size:11px;color:var(--mut);margin-top:2px">${d['date'+n]}</div>`:''}
      </div>
    </div>`;
  }).join('');

  const sbts = STEPS.map((s,i) =>
    `<button class="step-btn ${e===i+1?'sel':''}" onclick="setEtape(${i+1})">${s.i} ${s.l}</button>`
  ).join('');

  document.getElementById('detailCont').innerHTML = `
    <div style="background:white;border-radius:8px;border:1px solid var(--mid);padding:20px 24px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div>
        <div style="font-size:20px;font-weight:700">${d.nom}${d.signe==='true'?'<span style="background:var(--g);color:white;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px">✓ Signé</span>':''}</div>
        <div style="font-size:13px;color:var(--mut);margin-top:4px">${d.id} · ${d.gamme||'—'}</div>
        <div style="font-size:13px;color:var(--mut);margin-top:4px">📞 ${d.tel||'—'} &nbsp;·&nbsp; ✉️ ${d.email||'—'}</div>
        <div style="height:6px;background:var(--mid);border-radius:3px;overflow:hidden;width:260px;margin:10px 0 4px">
          <div style="height:100%;background:var(--g);border-radius:3px;width:${pct}%"></div>
        </div>
        <div style="font-size:12px;color:var(--mut)">Étape ${e}/6 — ${pct}%</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:var(--mut)">Prix final</div>
        <div style="font-size:22px;font-weight:800;color:var(--gd)">${d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':'—'}</div>
        <div style="font-size:12px;margin-top:6px;color:${d.signe==='true'?'var(--gd)':'#e65100'}">${d.signe==='true'?'✓ Signé le '+d.sig_date:'⏳ En attente de signature'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 320px;gap:16px">
      <div>
        <div class="ic"><div class="ict">Avancement</div><div class="atl">${tl}</div></div>
      </div>
      <div>
        <div class="ic"><div class="ict">Changer l'étape</div><div class="step-sel">${sbts}</div></div>
        <div class="ic">
          <div class="ict">Informations</div>
          <div class="ir"><span style="color:var(--mut)">Conseiller</span><span style="font-weight:600">${d.conseiller||'—'}</span></div>
          <div class="ir"><span style="color:var(--mut)">Tél.</span><span style="font-weight:600">${d.tel_conseiller||'—'}</span></div>
          <div class="ir"><span style="color:var(--mut)">Gamme</span><span style="font-weight:600">${d.gamme||'—'}</span></div>
          <div class="ir"><span style="color:var(--mut)">Estimatif</span><span style="font-weight:600">${d.prix_est?parseInt(d.prix_est).toLocaleString('fr-FR')+' €':'—'}</span></div>
          <div class="ir"><span style="color:var(--mut)">Prix final</span><span style="font-weight:600;color:var(--gd)">${d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':'—'}</span></div>
          ${d.notes?`<div style="margin-top:8px;font-size:12px;background:#f5f5f5;padding:8px 10px;border-radius:4px">📝 ${d.notes}</div>`:''}
        </div>
        <div class="ic">
          <div class="ict">Lien client</div>
          <div style="font-family:monospace;font-size:11px;color:var(--gd);background:var(--gx);border:1px dashed var(--g);padding:10px;border-radius:6px;word-break:break-all;margin-bottom:8px">${lien}</div>
          <button class="btn btn-p" style="width:100%" onclick="copyLien('${d.token}')">📋 Copier le lien client</button>
        </div>
      </div>
    </div>`;
}

async function setEtape(n) {
  const d = _dossiers.find(x=>x.id===_curId); if(!d) return;
  d.etape = String(n);
  if (!d['date'+n]) d['date'+n] = new Date().toLocaleDateString('fr-FR');
  await sheetsWrite('update', { id:_curId, fields:{ etape:d.etape, ['date'+n]:d['date'+n] } });
  renderDetail();
  showToast('✓ ' + STEPS[n-1].l);
}

function copyLien(token) {
  const lien = location.origin + '/client/' + token;
  navigator.clipboard.writeText(lien).then(() => showToast('✓ Lien copié !'));
}
