// ============================================================
// sav.js — Interface Client SAV (version allégée)
// Pas de signature, pas de créneaux, pas de Drive : juste le suivi d'étapes
// ============================================================

async function initSav(token) {
  if (typeof loadCatalogue === 'function') await loadCatalogue();
  const savedId = sessionStorage.getItem('sav_dossier_id');
  if (savedId) {
    try { const d = await savGetById(savedId); if (d) { renderSavClient(d); return; } }
    catch(e) {}
  }
  if (token) {
    try {
      const d = await savGetByToken(token);
      if (d) { sessionStorage.setItem('sav_dossier_id', d.id); renderSavClient(d); return; }
    } catch(e) {}
  }
  showLoginSav();
}

function showLoginSav() {
  document.getElementById('cli-body').innerHTML = `
    <div class="login-client-wrap">
      <div class="login-client-card">
        <div class="login-client-icon">${icon('alert',32)}</div>
        <div class="login-client-title">Suivi de votre SAV</div>
        <div class="login-client-sub">Saisissez votre numéro de dossier<br>pour accéder à votre suivi</div>
        <input id="sav-input" type="text" placeholder="ex: SAV-360150" class="login-client-input"
          onkeydown="if(event.key==='Enter')connecterSav()">
        <button class="btn btn-p" style="width:100%;padding:11px" onclick="connecterSav()">
          Accéder à mon suivi ${icon('arrowright')}
        </button>
        <div id="sav-err" class="login-client-err"></div>
        <div class="login-client-hint">Votre numéro vous a été communiqué par votre conseiller Leroy Merlin.</div>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('sav-input')?.focus(), 100);
}

async function connecterSav() {
  const input = document.getElementById('sav-input');
  const val = input?.value.trim();
  if (!val) return;
  document.getElementById('sav-err').textContent = '';
  input.disabled = true;
  try {
    const d = await savGetById(val);
    if (!d) {
      document.getElementById('sav-err').textContent = 'Numéro introuvable. Vérifiez avec votre conseiller.';
      input.disabled = false;
      return;
    }
    sessionStorage.setItem('sav_dossier_id', val);
    renderSavClient(d);
  } catch(e) {
    document.getElementById('sav-err').textContent = 'Erreur de connexion : ' + e.message;
    input.disabled = false;
  }
}

function renderSavClient(d) {
  const e = parseInt(d.etape)||1;
  const pct = Math.round(e / STEPS_SAV.length * 100);
  const prenom = (d.nom||'Client').split(' ')[0];
  const cons = d.conseiller||'—';
  const ini = cons.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'LM';
  const stepDesc = STEPS_SAV[e-1]?.desc || '';

  const half = Math.ceil(STEPS_SAV.length/2);
  const row1 = STEPS_SAV.slice(0, half);
  const row2 = STEPS_SAV.slice(half).reverse();

  function buildNode(s, n, delayIdx) {
    const st = n<e ? 'done' : n===e ? 'cur' : 'pend';
    return `<div class="tnode" style="--d:${delayIdx*70}ms">
      <div class="tdot ${st}">${st==='done' ? icon('check',16) : icon(s.ic,16)}</div>
      <div class="tlbl ${st}">${s.l}</div>
      ${n===e?'<div class="tbadge">En cours</div>':''}
    </div>`;
  }

  const row1Html = row1.map((s,i) => buildNode(s, i+1, i)).join('');
  const row2Html = row2.map((s,i) => buildNode(s, STEPS_SAV.length-i, half+i)).join('');

  const seg1Count = Math.max(row1.length - 1, 1);
  let row1Fill = 0;
  if (e > 1) row1Fill = Math.min((e - 1) / seg1Count, 1) * 100;
  if (e > half) row1Fill = 100;

  const connectFill = e > half ? 100 : 0;

  const seg2Count = Math.max(row2.length - 1, 1);
  let row2Fill = 0;
  if (e > half) row2Fill = Math.min((e - half) / seg2Count, 1) * 100;

  const timelineHtml = row2.length ? `
    <div class="timeline-v3">
      <div class="trow">
        <div class="trow-track"><div class="trow-fill" style="width:${row1Fill}%"></div></div>
        ${row1Html}
      </div>
      <div class="tconnect-wrap">
        <div class="tconnect">
          <div class="tconnect-track"></div>
          <div class="tconnect-fill" style="height:${connectFill}%"></div>
        </div>
      </div>
      <div class="trow trow-rev">
        <div class="trow-track"><div class="trow-fill trow-fill-rev" style="width:${row2Fill}%"></div></div>
        ${row2Html}
      </div>
    </div>` : `
    <div class="timeline-v3">
      <div class="trow">
        <div class="trow-track"><div class="trow-fill" style="width:${Math.min((e-1)/(STEPS_SAV.length-1)*100,100)}%"></div></div>
        ${STEPS_SAV.map((s,i)=>buildNode(s,i+1,i)).join('')}
      </div>
    </div>`;

  document.getElementById('cli-body').innerHTML = `
    <div class="wc">
      <div class="wb">
        <div class="wt">Bonjour ${prenom}</div>
        <div class="ws">Suivi de votre SAV · N° ${d.id}</div>
      </div>
      <div class="wbd">

        <div class="cig">
          <div class="cib"><div class="cibl">Produit concerné</div><div class="cibv" style="font-size:13px">${d.produit_concerne||'—'}</div></div>
          <div class="cib"><div class="cibl">Avancement</div><div class="cibv">${pct}%</div></div>
        </div>

        ${stepDesc?`<div class="step-banner">${icon(STEPS_SAV[e-1].ic,16)} ${stepDesc}</div>`:''}

        ${d.message_client ? `<div class="conseiller-msg">
          <div class="conseiller-msg-ic">${ini}</div>
          <div class="conseiller-msg-body">
            <div class="conseiller-msg-from">${cons} vous écrit</div>
            <div class="conseiller-msg-text">${d.message_client}</div>
          </div>
        </div>` : ''}

        <div class="stl">Étapes de votre SAV</div>
        ${timelineHtml}

        ${d.motif_sav ? `<div class="sc">
          <div class="ict">Motif de votre demande</div>
          <div class="devis-text">${d.motif_sav}</div>
        </div>` : ''}

        <div class="stl" style="margin-top:22px">Votre interlocuteur</div>
        <div class="cc">
          <div class="cav">${ini}</div>
          <div>
            <div class="cc-name">${cons}</div>
            <div class="cc-role">Conseiller en charge de votre SAV</div>
            ${d.tel_conseiller?`<div class="cc-tel">${icon('phone',14)} ${d.tel_conseiller}</div>`:''}
          </div>
        </div>

        <div style="text-align:center;margin-top:22px">
          <button onclick="sessionStorage.removeItem('sav_dossier_id');showLoginSav()" class="btn-link-small">
            Changer de dossier
          </button>
        </div>

      </div>
    </div>`;
}
