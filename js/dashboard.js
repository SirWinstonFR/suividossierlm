// ============================================================
// dashboard.js — Dashboard Chef de Secteur
// ============================================================

function openDashboard() {
  hideAllAdminViews();
  document.getElementById('vDashboard').style.display = 'block';
  renderDashboard();
}
function closeDashboard() {
  document.getElementById('vDashboard').style.display = 'none';
  document.getElementById('vListe').style.display = 'block';
}

function renderDashboard() {
  const cont = document.getElementById('dashboardCont');
  const now = new Date();
  const moisActuel = now.getMonth();
  const anneeActuelle = now.getFullYear();

  // Sélecteur de période
  const moisLabels = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const savedPeriode = sessionStorage.getItem('dash_periode') || 'mois';
  const savedMois = parseInt(sessionStorage.getItem('dash_mois') || moisActuel);
  const savedAnnee = parseInt(sessionStorage.getItem('dash_annee') || anneeActuelle);

  cont.innerHTML = `
    <div class="page" style="max-width:1100px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:24px;font-weight:700">Dashboard Chef de Secteur</div>
          <div style="font-size:13px;color:var(--mut);margin-top:4px">Vue consolidée de l'activité Suivi Pose</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div class="dash-period-bar">
            <button class="dash-period-btn ${savedPeriode==='30j'?'active':''}" onclick="setPeriode('30j')">30 derniers jours</button>
            <button class="dash-period-btn ${savedPeriode==='mois'?'active':''}" onclick="setPeriode('mois')">Mois civil</button>
          </div>
          ${savedPeriode==='mois' ? `
            <select id="dash-mois-sel" onchange="setMoisAnnee()" style="padding:8px 12px;border:1.5px solid var(--mid);border-radius:7px;font-size:13px">
              ${moisLabels.map((m,i)=>`<option value="${i}" ${i===savedMois?'selected':''}>${m}</option>`).join('')}
            </select>
            <select id="dash-annee-sel" onchange="setMoisAnnee()" style="padding:8px 12px;border:1.5px solid var(--mid);border-radius:7px;font-size:13px">
              ${[anneeActuelle-1,anneeActuelle,anneeActuelle+1].map(y=>`<option value="${y}" ${y===savedAnnee?'selected':''}>${y}</option>`).join('')}
            </select>` : ''}
        </div>
      </div>
      <div id="dash-content"></div>
    </div>`;

  renderDashContent(savedPeriode, savedMois, savedAnnee);
}

function setPeriode(p) {
  sessionStorage.setItem('dash_periode', p);
  renderDashboard();
}
function setMoisAnnee() {
  const m = document.getElementById('dash-mois-sel')?.value;
  const a = document.getElementById('dash-annee-sel')?.value;
  if (m !== null) sessionStorage.setItem('dash_mois', m);
  if (a) sessionStorage.setItem('dash_annee', a);
  renderDashboard();
}

function renderDashContent(periode, mois, annee) {
  const cont = document.getElementById('dash-content');
  const now = new Date();
  const allDossiers = [..._dossiers, ..._savDossiers];

  // Filtre par période
  function inPeriod(d) {
    const dateStr = d.date1;
    if (!dateStr) return false;
    const [j,m,a] = dateStr.split('/');
    if (!j||!m||!a) return false;
    const date = new Date(parseInt(a), parseInt(m)-1, parseInt(j));
    if (periode === '30j') {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate()-30);
      return date >= cutoff;
    }
    return date.getMonth() === mois && date.getFullYear() === annee;
  }

  const dossiersPeriode = allDossiers.filter(inPeriod);
  const dossiersActifs = allDossiers.filter(d => parseInt(d.etape||1) < (d._type==='sav'?STEPS_SAV.length:STEPS_POSE.length));

  // Montant total de la période
  const montantPeriode = dossiersPeriode.reduce((sum,d) => sum + (parseInt(d.prix_final)||parseInt(d.prix_est)||0), 0);
  // Nombre de poses terminées (étape 8) dans la période
  const posesTerminees = dossiersPeriode.filter(d => d._type!=='sav' && parseInt(d.etape)===8).length;
  const savTermines = dossiersPeriode.filter(d => d._type==='sav' && parseInt(d.etape)===6).length;

  // Par conseiller — tous dossiers confondus (pas seulement la période)
  const conseillerStats = {};
  allDossiers.forEach(d => {
    const c = d.conseiller || 'Non assigné';
    if (!conseillerStats[c]) conseillerStats[c] = { total:0, enCours:0, termines:0, montant:0 };
    conseillerStats[c].total++;
    const steps = d._type==='sav'?STEPS_SAV:STEPS_POSE;
    if (parseInt(d.etape||1) >= steps.length) conseillerStats[c].termines++;
    else conseillerStats[c].enCours++;
    conseillerStats[c].montant += parseInt(d.prix_final)||parseInt(d.prix_est)||0;
  });

  // Par étape (Pose uniquement)
  const etapeStats = STEPS_POSE.map((s,i) => ({
    label: s.l, ic: s.ic,
    count: _dossiers.filter(d => parseInt(d.etape||1) === i+1).length,
    montant: _dossiers.filter(d => parseInt(d.etape||1) === i+1).reduce((sum,d)=>sum+(parseInt(d.prix_final)||parseInt(d.prix_est)||0),0)
  }));

  // Graphique mini-barres des étapes
  const maxEtapeCount = Math.max(...etapeStats.map(e=>e.count), 1);

  cont.innerHTML = `
    <!-- KPIs -->
    <div class="dash-kpis">
      <div class="dash-kpi">
        <div class="dash-kpi-val">${montantPeriode.toLocaleString('fr-FR')} €</div>
        <div class="dash-kpi-label">Montant sur la période</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${dossiersPeriode.length}</div>
        <div class="dash-kpi-label">Dossiers ouverts</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${posesTerminees}</div>
        <div class="dash-kpi-label">Poses terminées</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${savTermines}</div>
        <div class="dash-kpi-label">SAV clôturés</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${dossiersActifs.length}</div>
        <div class="dash-kpi-label">Dossiers en cours (tous)</div>
      </div>
    </div>

    <!-- Graphique étapes -->
    <div class="ic" style="margin-bottom:16px">
      <div class="ict">Répartition par étape (dossiers Pose actifs)</div>
      <div class="dash-etapes">
        ${etapeStats.map(e => `
          <div class="dash-etape-col">
            <div class="dash-etape-bar-wrap">
              <div class="dash-etape-bar" style="height:${e.count?Math.max(e.count/maxEtapeCount*120,6):0}px"></div>
            </div>
            <div class="dash-etape-count">${e.count}</div>
            <div class="dash-etape-label">${icon(e.ic,13)} ${e.label.split(' ').slice(-1)[0]}</div>
            ${e.montant>0?`<div class="dash-etape-montant">${(e.montant/1000).toFixed(0)}k€</div>`:''}
          </div>`).join('')}
      </div>
    </div>

    <!-- Par conseiller -->
    <div class="ic" style="margin-bottom:16px">
      <div class="ict">Dossiers par conseiller (global)</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
        ${Object.entries(conseillerStats).sort((a,b)=>b[1].total-a[1].total).map(([nom,s]) => {
          const pct = Math.round(s.termines/Math.max(s.total,1)*100);
          return `<div class="dash-conseiller">
            <div class="dash-conseiller-av">${nom.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:13px;font-weight:700">${nom}</span>
                <span style="font-size:12px;color:var(--mut)">${s.total} dossier${s.total>1?'s':''} · ${s.montant.toLocaleString('fr-FR')} €</span>
              </div>
              <div style="display:flex;gap:4px;align-items:center">
                <div style="flex:1;height:6px;background:var(--mid);border-radius:3px;overflow:hidden">
                  <div style="width:${pct}%;height:100%;background:var(--g);border-radius:3px"></div>
                </div>
                <span style="font-size:11px;color:var(--mut);white-space:nowrap">${s.termines} terminé${s.termines>1?'s':''} · ${s.enCours} en cours</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Dossiers de la période -->
    <div class="ic">
      <div class="ict">Dossiers de la période</div>
      ${!dossiersPeriode.length ? '<div style="color:var(--mut2);padding:16px 0;text-align:center">Aucun dossier sur cette période.</div>' :
        dossiersPeriode.map(d => {
          const steps = d._type==='sav'?STEPS_SAV:STEPS_POSE;
          const e=parseInt(d.etape||1), s=steps[e-1];
          const prix = d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+'&nbsp;€':d.prix_est?parseInt(d.prix_est).toLocaleString('fr-FR')+'&nbsp;€ est.':'—';
          const typeTag = d._type==='sav'?`<span class="type-tag type-tag-sav">SAV</span>`:`<span class="type-tag type-tag-pose">Pose</span>`;
          return `<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid #f0f0ec">
            ${typeTag}
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700">${d.nom}</div>
              <div style="font-size:11px;color:var(--mut)">N° ${d.id} · ${d.conseiller||'—'} · ${d.date1||''}</div>
            </div>
            <span class="sp sp${Math.min(e,6)}" style="white-space:nowrap">${icon(s.ic,11)} ${s.l}</span>
            <div style="font-size:13px;font-weight:700;color:var(--gd);white-space:nowrap">${prix}</div>
          </div>`;
        }).join('')}
    </div>`;
}
