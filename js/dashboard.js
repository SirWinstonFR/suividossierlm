// ============================================================
// dashboard.js — Dashboard Leader
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
          <div style="font-size:24px;font-weight:700">Dashboard Leader</div>
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

  // Filtre par période — Pose uniquement pour tout le dashboard principal
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

  // Pose uniquement
  const poseDossiers = _dossiers; // jamais les SAV
  const posePeriode  = poseDossiers.filter(inPeriod);
  const poseActifs   = poseDossiers.filter(d => parseInt(d.etape||1) < STEPS_POSE.length);
  const poseTermines = poseDossiers.filter(d => parseInt(d.etape||1) >= STEPS_POSE.length);

  // SAV — juste un compteur séparé
  const savActifs   = _savDossiers.filter(d => parseInt(d.etape||1) < STEPS_SAV.length);
  const savTermines = _savDossiers.filter(d => parseInt(d.etape||1) >= STEPS_SAV.length);

  const montantPeriode   = posePeriode.reduce((s,d)=>s+(parseInt(d.prix_final)||parseInt(d.prix_est)||0),0);
  const montantEnCours   = poseActifs.reduce((s,d)=>s+(parseInt(d.prix_final)||parseInt(d.prix_est)||0),0);

  // ─── Stats par étape (Pose active) ───
  const etapeStats = STEPS_POSE.map((s,i) => ({
    label:s.l, ic:s.ic,
    count: poseDossiers.filter(d=>parseInt(d.etape||1)===i+1).length,
    montant: poseDossiers.filter(d=>parseInt(d.etape||1)===i+1).reduce((sum,d)=>sum+(parseInt(d.prix_final)||parseInt(d.prix_est)||0),0)
  }));
  const maxEtape = Math.max(...etapeStats.map(e=>e.count),1);

  // ─── Stats par gamme (Pose globale) ───
  const gammeStats = {};
  poseDossiers.forEach(d => {
    const gamme = (d.gamme||'Autre').split(' (')[0]; // "Fenêtre (PVC)" → "Fenêtre"
    if (!gammeStats[gamme]) gammeStats[gamme] = { count:0, enCours:0, montant:0 };
    gammeStats[gamme].count++;
    if (parseInt(d.etape||1) < STEPS_POSE.length) gammeStats[gamme].enCours++;
    gammeStats[gamme].montant += parseInt(d.prix_final)||parseInt(d.prix_est)||0;
  });
  const gammeEntries = Object.entries(gammeStats).sort((a,b)=>b[1].count-a[1].count);
  const maxGamme = Math.max(...gammeEntries.map(([,s])=>s.count),1);

  // Couleurs par gamme
  const gammeCouleurs = ['#78BE20','#4a9adc','#e67e22','#9b59b6','#e74c3c','#1abc9c','#f39c12'];

  // ─── Stats par conseiller (Pose globale) ───
  const conseillerStats = {};
  poseDossiers.forEach(d => {
    const c = d.conseiller||'Non assigné';
    if (!conseillerStats[c]) conseillerStats[c] = {total:0,enCours:0,termines:0,montant:0};
    conseillerStats[c].total++;
    if (parseInt(d.etape||1)>=STEPS_POSE.length) conseillerStats[c].termines++;
    else conseillerStats[c].enCours++;
    conseillerStats[c].montant += parseInt(d.prix_final)||parseInt(d.prix_est)||0;
  });

  cont.innerHTML = `
    <!-- KPIs Pose -->
    <div class="dash-kpis">
      <div class="dash-kpi">
        <div class="dash-kpi-val">${montantPeriode.toLocaleString('fr-FR')} €</div>
        <div class="dash-kpi-label">Montant Pose (période)</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${posePeriode.length}</div>
        <div class="dash-kpi-label">Poses ouvertes (période)</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${poseTermines.length}</div>
        <div class="dash-kpi-label">Poses terminées (global)</div>
      </div>
      <div class="dash-kpi">
        <div class="dash-kpi-val">${poseActifs.length}</div>
        <div class="dash-kpi-label">Poses en cours</div>
      </div>
      <div class="dash-kpi" style="border-color:#f5dfa3;background:#fef9f0">
        <div class="dash-kpi-val" style="color:#9a5b00">${montantEnCours.toLocaleString('fr-FR')} €</div>
        <div class="dash-kpi-label">Montant en cours (global)</div>
      </div>
    </div>

    <!-- Compteur SAV séparé -->
    <div style="display:flex;gap:10px;margin-bottom:16px">
      <div style="background:#fde4d6;border:1px solid #f5c8b3;border-radius:10px;padding:13px 18px;display:flex;align-items:center;gap:12px">
        ${icon('alert',16)}
        <div>
          <div style="font-size:15px;font-weight:700;color:#b5470a">${savActifs.length} SAV en cours</div>
          <div style="font-size:11px;color:#9a4810;margin-top:1px">${savTermines.length} clôturé${savTermines.length>1?'s':''} au total</div>
        </div>
      </div>
    </div>

    <!-- Graphique par étape -->
    <div class="ic" style="margin-bottom:16px">
      <div class="ict">Répartition par étape — Pose uniquement</div>
      <div class="dash-etapes">
        ${etapeStats.map(e=>`
          <div class="dash-etape-col">
            <div class="dash-etape-bar-wrap">
              <div class="dash-etape-bar" style="height:${e.count?Math.max(e.count/maxEtape*120,6):0}px"></div>
            </div>
            <div class="dash-etape-count">${e.count}</div>
            <div class="dash-etape-label">${icon(e.ic,13)} ${e.label.split(' ').slice(-1)[0]}</div>
            ${e.montant>0?`<div class="dash-etape-montant">${(e.montant/1000).toFixed(0)}k€</div>`:'<div class="dash-etape-montant">—</div>'}
          </div>`).join('')}
      </div>
    </div>

    <!-- Graphique par gamme -->
    <div class="ic" style="margin-bottom:16px">
      <div class="ict">Répartition par gamme de produit</div>
      ${!gammeEntries.length ? '<div style="color:var(--mut2);padding:16px 0;text-align:center">Aucune donnée disponible.</div>' : `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
        ${gammeEntries.map(([gamme,s],i)=>{
          const couleur = gammeCouleurs[i%gammeCouleurs.length];
          const pctBarre = Math.round(s.count/Math.max(poseDossiers.length,1)*100);
          return `<div style="display:flex;align-items:center;gap:14px">
            <div style="width:110px;font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${gamme}">${gamme}</div>
            <div style="flex:1;height:24px;background:#f0f0ec;border-radius:6px;overflow:hidden;position:relative">
              <div style="width:${pctBarre}%;height:100%;background:${couleur};border-radius:6px;transition:width .5s ease;display:flex;align-items:center;padding-left:8px;min-width:24px">
                <span style="font-size:11px;font-weight:700;color:white;white-space:nowrap">${s.count}</span>
              </div>
            </div>
            <div style="text-align:right;min-width:80px">
              <div style="font-size:12px;font-weight:700;color:var(--gd)">${s.montant>0?(s.montant/1000).toFixed(0)+'k €':'—'}</div>
              <div style="font-size:10.5px;color:var(--mut)">${s.enCours} en cours</div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>

    <!-- Par conseiller -->
    <div class="ic" style="margin-bottom:16px">
      <div class="ict">Dossiers Pose par conseiller</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px">
        ${Object.entries(conseillerStats).sort((a,b)=>b[1].total-a[1].total).map(([nom,s])=>{
          const pct=Math.round(s.termines/Math.max(s.total,1)*100);
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

    <!-- Dossiers Pose de la période -->
    <div class="ic">
      <div class="ict">Dossiers Pose de la période</div>
      ${!posePeriode.length ? '<div style="color:var(--mut2);padding:16px 0;text-align:center">Aucun dossier Pose sur cette période.</div>' :
        posePeriode.map(d=>{
          const e=parseInt(d.etape||1),s=STEPS_POSE[e-1];
          const prix=d.prix_final?parseInt(d.prix_final).toLocaleString('fr-FR')+' €':d.prix_est?parseInt(d.prix_est).toLocaleString('fr-FR')+' € est.':'—';
          return `<div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid #f0f0ec">
            <span class="type-tag type-tag-pose">Pose</span>
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
