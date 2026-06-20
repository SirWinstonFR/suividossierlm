// ============================================================
// client.js — Interface Client v3
// Timeline en JS/HTML pur (pas de SVG), icônes inline, design épuré
// ============================================================

function showLoginClient() {
  document.getElementById('cli-body').innerHTML = `
    <div class="login-client-wrap">
      <div class="login-client-card">
        <div class="login-client-icon">${icon('home',32)}</div>
        <div class="login-client-title">Suivi de votre pose</div>
        <div class="login-client-sub">Saisissez votre numéro de devis<br>pour accéder à votre suivi</div>
        <input id="dos-input" type="text" placeholder="ex: 360150" class="login-client-input"
          onkeydown="if(event.key==='Enter')connecterClient()">
        <button class="btn btn-p" style="width:100%;padding:11px" onclick="connecterClient()">
          Accéder à mon suivi ${icon('arrowright')}
        </button>
        <div id="cli-err" class="login-client-err"></div>
        <div class="login-client-hint">Votre numéro vous a été communiqué par votre conseiller Leroy Merlin.</div>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('dos-input')?.focus(), 100);
}

async function connecterClient() {
  const input = document.getElementById('dos-input');
  const val = input?.value.trim();
  if (!val) return;
  document.getElementById('cli-err').textContent = '';
  input.disabled = true;
  try {
    const d = await sheetsGetById(val);
    if (!d) {
      document.getElementById('cli-err').textContent = 'Numéro introuvable. Vérifiez avec votre conseiller.';
      input.disabled = false;
      return;
    }
    sessionStorage.setItem('cli_dossier_id', val);
    renderClient(d);
  } catch(e) {
    document.getElementById('cli-err').textContent = 'Erreur de connexion : ' + e.message;
    input.disabled = false;
  }
}

async function initClient(token) {
  const savedId = sessionStorage.getItem('cli_dossier_id');
  if (savedId) {
    try { const d = await sheetsGetById(savedId); if (d) { renderClient(d); return; } }
    catch(e) {}
  }
  if (token) {
    try {
      const d = await sheetsGetByToken(token);
      if (d) { sessionStorage.setItem('cli_dossier_id', d.id); renderClient(d); return; }
    } catch(e) {}
  }
  showLoginClient();
}

function renderClient(d) {
  const e   = parseInt(d.etape)||1;
  const pct = Math.round(e / STEPS.length * 100);
  const prenom  = (d.nom||'Client').split(' ')[0];
  const cons    = d.conseiller||'—';
  const ini     = cons.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'LM';
  const hasPrixEvo = d.prix_est && d.prix_final && d.prix_est !== d.prix_final;
  const stepDesc = STEPS[e-1]?.desc || '';

  // === TIMELINE — grille JS pure, animée : pulse + progression segment par segment ===
  const half = Math.ceil(STEPS.length/2);
  const row1 = STEPS.slice(0, half);
  const row2 = STEPS.slice(half).reverse();

  function buildNode(s, n, delayIdx) {
    const st = n<e ? 'done' : n===e ? 'cur' : 'pend';
    return `<div class="tnode" style="--d:${delayIdx*70}ms">
      <div class="tdot ${st}">${st==='done' ? icon('check',16) : icon(s.ic,16)}</div>
      <div class="tlbl ${st}">${s.l}</div>
      ${n===e?'<div class="tbadge">En cours</div>':''}
    </div>`;
  }

  const row1Html = row1.map((s,i) => buildNode(s, i+1, i)).join('');
  const row2Html = row2.map((s,i) => buildNode(s, STEPS.length-i, half+i)).join('');

  // Calcul du pourcentage de remplissage de chaque segment de ligne
  // Ligne 1 : segments entre les 4 premiers points (3 segments)
  const seg1Count = row1.length - 1;
  let row1Fill = 0;
  if (e > 1) row1Fill = Math.min((e - 1) / seg1Count, 1) * 100;
  if (e > half) row1Fill = 100;

  // Connecteur vertical (coude) : rempli si on a dépassé la ligne 1 entière
  const connectFill = e > half ? 100 : 0;

  // Ligne 2 : segments entre les 4 derniers points (3 segments), remplissage de droite à gauche
  const seg2Count = row2.length - 1;
  let row2Fill = 0;
  if (e > half) row2Fill = Math.min((e - half) / seg2Count, 1) * 100;

  const timelineHtml = `
    <div class="timeline-v3">
      <div class="trow">
        <div class="trow-track"><div class="trow-fill" style="width:${row1Fill}%"></div></div>
        ${row1Html}
      </div>
      <div class="tconnect">
        <div class="tconnect-track"><div class="tconnect-fill" style="height:${connectFill}%"></div></div>
      </div>
      <div class="trow trow-rev">
        <div class="trow-track"><div class="trow-fill trow-fill-rev" style="width:${row2Fill}%"></div></div>
        ${row2Html}
      </div>
    </div>`;

  // === PASTILLES DOCUMENTS ===
  const docPills = DOCS.map(doc => {
    let active = false, url = null;
    if (doc.key === 'sig_commande') { active = d.signe==='true'; url = null; }
    else { active = !!d[doc.key] && e >= doc.minStep; url = d[doc.key]; }
    return `<div class="dpill ${active?'active':'todo'}" ${url?`onclick="openLink('${url}')"`:''}>
      ${icon(doc.ic,18)}
      <span>${doc.l}</span>
      ${active?`<span class="dpill-check">${icon('check',12)}</span>`:''}
    </div>`;
  }).join('');

  // === BLOC PROJET ENRICHI ===
  const projetRows = [];
  if (d.artisan) projetRows.push(['Artisan', d.artisan]);
  if (d.modele)  projetRows.push(['Modèle', d.modele]);
  if (d.date2)   projetRows.push(['RDV planifié', d.date2]);
  if (d.date3)   projetRows.push(['Retour technicien', d.date3]);
  if (d.date4)   projetRows.push(['Devis envoyé', d.date4]);

  const projetBloc = projetRows.length ? `
    <div class="sc">
      <div class="ict">Détails de votre projet</div>
      ${projetRows.map(([l,v]) => `<div class="ir"><span class="ir-l">${l}</span><span class="ir-v">${v}</span></div>`).join('')}
    </div>` : '';

  // === PROMO + ECO-PTZ ===
  const avantagesBloc = (d.promo || d.ecoptz_url) ? `
    <div class="sc">
      <div class="ict">Vos avantages</div>
      ${d.promo ? `<div class="promo-box">
        ${icon('discount',22)}
        <div><div class="promo-title">Promotion éligible</div>
        <div class="promo-sub">${d.promo}</div></div>
      </div>` : ''}
      ${d.ecoptz_url ? `<div class="ecoptz-row" style="margin-top:${d.promo?'10px':'0'}">
        <div class="ecoptz-info">
          ${icon('bank',20)}
          <div class="ecoptz-label">Éco-PTZ disponible</div>
        </div>
        <button class="btn btn-p btn-sm" onclick="openLink('${d.ecoptz_url}')">Faire ma demande</button>
      </div>` : ''}
    </div>` : '';

  // === PLU / Adresse + mini-carte ===
  const pluBloc = d.plu_concerne === 'true' ? `
    <div class="sc">
      <div class="ict">Démarche administrative</div>
      <div class="alert-box">
        ${icon('alert',18)}
        <div>
          <div class="alert-title">Votre projet est soumis à déclaration (PLU)</div>
          <div class="alert-sub">Une démarche administrative préalable est nécessaire avant le début des travaux. Votre conseiller vous accompagne dans cette étape.</div>
        </div>
      </div>
      ${d.plu_adresse ? `<div id="plu-map" class="plu-map"></div>
      <div class="plu-addr">${icon('pin',13)} ${d.plu_adresse}</div>` : ''}
    </div>` : '';

  // === DEVIS PDF ===
  const devisBloc = e >= 4 && d.devis_url ? `
    <div class="sc">
      <div class="ict">Votre devis</div>
      <div class="devis-text">Consultez votre devis avant de signer le bon de commande.</div>
      <button class="btn btn-p" style="width:100%" onclick="openLink('${d.devis_url}')">
        ${icon('filetext')} Consulter mon devis PDF
      </button>
    </div>` : '';

  // === SIGNATURE — bon de commande (chargé automatiquement, posté par le conseiller) ===
  const dejaSigne = d.signe === 'true';
  const commandeDispo = !!d.commande_url;
  const signBloc = (e === 5 || dejaSigne) ? `
    <div class="sc">
      <div class="ict">Bon de commande</div>
      ${dejaSigne
        ? `<div class="ss signed">${icon('check',18)} Bon de commande signé le ${d.sig_date}</div>`
        : !commandeDispo
        ? `<div class="ss unsigned">${icon('clock',18)} Votre conseiller prépare votre bon de commande, il sera disponible ici très prochainement.</div>`
        : `<div class="ss unsigned">${icon('clock',18)} Signature attendue${d.prix_final?' pour <strong>'+parseInt(d.prix_final).toLocaleString('fr-FR')+' €</strong>':''}</div>
          <div class="upload-intro">Votre conseiller a préparé votre bon de commande :</div>
          <div id="pdf-viewer-zone" style="display:none">
            <div class="pdf-frame">
              <div class="pdf-toolbar">
                <div class="pdf-tools">
                  <button class="pdf-btn" onclick="pdfPrev()">${icon('chevronleft',15)}</button>
                  <span id="pdf-page-info" class="pdf-info">1/1</span>
                  <button class="pdf-btn" onclick="pdfNext()">${icon('chevronright',15)}</button>
                </div>
                <div class="pdf-tools">
                  <button class="pdf-btn" onclick="pdfZoom(-0.2)">${icon('zoomout',15)}</button>
                  <span id="pdf-zoom-label" class="pdf-info">140%</span>
                  <button class="pdf-btn" onclick="pdfZoom(.2)">${icon('zoomin',15)}</button>
                </div>
              </div>
              <div id="pdf-canvas-wrap" onscroll="pdfOnScroll()" class="pdf-canvas-wrap">
                <canvas id="pdf-canvas"></canvas>
              </div>
            </div>
            <div id="pdf-scroll-hint" class="scroll-hint">
              ${icon('arrowright',14)} Parcourez tout le document pour pouvoir signer
            </div>
            <div style="text-align:right;margin-bottom:14px">
              <button class="btn btn-p" id="btn-go-sign" onclick="showSignZone()" disabled>J'ai lu — Signer ${icon('arrowright',15)}</button>
            </div>
            <div id="sign-zone" style="display:none">
              <div class="sig-toolbar">
                <span class="sig-label">Tracez votre signature</span>
                <button class="btn-sig-clear" onclick="sigClear()">${icon('eraser',14)} Effacer</button>
              </div>
              <div id="sig-wrap" class="sig-wrap-pro">
                <canvas id="sig-canvas"></canvas>
                <div id="sig-placeholder" class="sig-placeholder-pro">${icon('signature',24)}<br>Tracez votre signature ici</div>
                <div class="sig-line"></div>
              </div>
              <div class="sig-meta">
                ${icon('calendar',14)} ${new Date().toLocaleDateString('fr-FR')} — Cette signature sera également utilisée pour vos prochains documents (pose).
              </div>
              <button class="btn btn-p" id="btn-valider" onclick="validerSignature('${d.id}')" disabled style="width:100%">
                ${icon('check')} Valider et télécharger le document signé
              </button>
            </div>
          </div>
          <div id="pdf-loading" class="upload-zone" style="cursor:default">
            ${icon('loader',26)}
            <div class="upload-title">Chargement de votre document...</div>
          </div>`
      }
    </div>` : '';

  // === DOCUMENT DE POSE ===
  const poseDejaSigne = d.signe_pose === 'true';
  const poseDocBloc = (e === 7 || (poseDejaSigne && e >= 7)) && d.sig_data ? `
    <div class="sc">
      <div class="ict">Document de pose</div>
      ${poseDejaSigne
        ? `<div class="ss signed">${icon('check',18)} Document de pose signé automatiquement</div>`
        : `<div class="devis-text">Votre signature enregistrée sera appliquée automatiquement à ce document, et transmise à votre conseiller.</div>
           <div class="upload-zone" onclick="document.getElementById('fpdf-pose').click()">
             <input type="file" id="fpdf-pose" accept="application/pdf" style="display:none" onchange="onPdfPoseSelected(this.files[0],'${d.id}')">
             ${icon('upload',26)}
             <div class="upload-title">Charger le document de pose</div>
           </div>`
      }
    </div>` : '';

  // === LIVRAISON ===
  const livraisonBloc = e >= 7 && d.transporteur ? `
    <div class="sc">
      <div class="ict">Livraison</div>
      <div class="livraison-box">
        ${icon('truck',24)}
        <div>
          <div class="livraison-label">Transporteur</div>
          <div class="livraison-val">${d.transporteur}</div>
        </div>
      </div>
    </div>` : '';

  document.getElementById('cli-body').innerHTML = `
    <div class="wc">
      <div class="wb">
        <div class="wt">Bonjour ${prenom}</div>
        <div class="ws">Suivi de votre projet · N° ${d.id}</div>
      </div>
      <div class="wbd">

        <div class="cig">
          <div class="cib"><div class="cibl">Gamme</div><div class="cibv" style="font-size:13px">${d.gamme||'—'}</div></div>
          <div class="cib"><div class="cibl">Avancement</div><div class="cibv">${pct}%</div></div>
          ${d.prix_final?`<div class="cib"><div class="cibl">Prix final</div><div class="cibv cibv-green">${parseInt(d.prix_final).toLocaleString('fr-FR')} €</div></div>`:''}
          ${d.prix_est&&!d.prix_final?`<div class="cib"><div class="cibl">Estimatif</div><div class="cibv">${parseInt(d.prix_est).toLocaleString('fr-FR')} €</div></div>`:''}
        </div>

        ${hasPrixEvo?`<div style="margin-bottom:18px">
          <div class="stl">Évolution du prix</div>
          <div class="prix-evo">
            <div class="prix-evo-row"><span class="ir-l">Estimatif initial</span><span class="ir-v">${parseInt(d.prix_est).toLocaleString('fr-FR')} €</span></div>
            <div class="prix-evo-row"><span class="ir-l">Prix final</span><span class="prix-evo-final">${parseInt(d.prix_final).toLocaleString('fr-FR')} €</span></div>
          </div></div>`:''}

        ${stepDesc?`<div class="step-banner">${icon(STEPS[e-1].ic,16)} ${stepDesc}</div>`:''}

        <div class="stl">Étapes de votre projet</div>
        ${timelineHtml}

        <div class="stl" style="margin-top:22px">Vos documents</div>
        <div class="doc-pills">${docPills}</div>

        ${projetBloc}
        ${avantagesBloc}
        ${pluBloc}
        ${devisBloc}
        ${signBloc}
        ${poseDocBloc}
        ${livraisonBloc}

        <div class="stl" style="margin-top:22px">Votre interlocuteur</div>
        <div class="cc">
          <div class="cav">${ini}</div>
          <div>
            <div class="cc-name">${cons}</div>
            <div class="cc-role">Conseiller pose Leroy Merlin</div>
            ${d.tel_conseiller?`<div class="cc-tel">${icon('phone',14)} ${d.tel_conseiller}</div>`:''}
          </div>
        </div>

        <div style="text-align:center;margin-top:22px">
          <button onclick="sessionStorage.removeItem('cli_dossier_id');showLoginClient()" class="btn-link-small">
            Changer de dossier
          </button>
        </div>

      </div>
    </div>`;

  if (d.plu_concerne === 'true' && d.plu_adresse) {
    loadMiniMap(d.plu_adresse);
  }

  // Charge automatiquement le bon de commande si l'étape le requiert
  if (e === 5 && !dejaSigne && commandeDispo) {
    autoLoadCommandePdf(d.commande_url);
  }
}

function openLink(url) { window.open(url, '_blank'); }

async function loadMiniMap(adresse) {
  const el = document.getElementById('plu-map');
  if (!el) return;
  const q = encodeURIComponent(adresse);
  el.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0"
    src="https://www.google.com/maps?q=${q}&output=embed"></iframe>`;
}

async function autoLoadCommandePdf(url) {
  const loadingEl = document.getElementById('pdf-loading');
  const viewerEl  = document.getElementById('pdf-viewer-zone');
  try {
    await pdfLoadFromUrl(url, 'bon_de_commande.pdf');
    if (loadingEl) loadingEl.style.display = 'none';
    if (viewerEl)  viewerEl.style.display = 'block';
  } catch(e) {
    if (loadingEl) loadingEl.innerHTML = `
      <div style="color:#d23c3c">${icon('alert',24)}</div>
      <div class="upload-title" style="color:#d23c3c">Impossible de charger le document</div>
      <div class="upload-sub">${e.message} — contactez votre conseiller</div>`;
  }
}
function showSignZone() {
  document.getElementById('sign-zone').style.display='block';
  document.getElementById('btn-go-sign').style.display='none';
  setTimeout(() => sigInit(), 100);
}

async function validerSignature(dosId) {
  const btn = document.getElementById('btn-valider');
  btn.innerHTML = icon('loader',16) + ' Génération...'; btn.disabled=true;
  try {
    const sigDataUrl = sigGetDataUrl();
    const result = await pdfGenSigned(sigDataUrl);
    if (!result) { btn.innerHTML = icon('check') + ' Valider'; btn.disabled=false; return; }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
    a.download = result.fileName; a.click();

    await sheetsWrite('update',{id:dosId,fields:{signe:'true',sig_date:result.dateStr,sig_data:sigDataUrl}});

    btn.innerHTML = icon('loader',16) + ' Envoi vers votre espace...';
    await sendPdfToDrive(dosId, result.bytes, result.fileName);

    document.getElementById('sign-zone').innerHTML=`
      <div class="success-box">
        ${icon('check',28)}
        <div class="success-title">Document signé et transmis !</div>
        <div class="success-sub">Signé le ${result.dateStr} — une copie a été envoyée à votre conseiller</div>
      </div>`;
  } catch(err) {
    btn.innerHTML = icon('check') + ' Valider'; btn.disabled=false;
    showToast('Erreur : ' + err.message);
  }
}

async function sendPdfToDrive(dosId, pdfBytes, fileName) {
  try {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const base64 = await blobToBase64(blob);
    await sheetsWrite('uploadPdf', { id: dosId, fileName, base64Data: base64 });
  } catch(e) { console.warn('Envoi Drive échoué :', e); }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function onPdfPoseSelected(file, dosId) {
  if (!file) return;
  showToast('Application de votre signature...');
  try {
    await pdfLoad(file);
    const d = await sheetsGetById(dosId);
    const result = await pdfGenSigned(d.sig_data);
    if (!result) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
    a.download = result.fileName; a.click();
    await sheetsWrite('update',{id:dosId,fields:{signe_pose:'true'}});
    showToast('Envoi vers votre espace...');
    await sendPdfToDrive(dosId, result.bytes, result.fileName);
    showToast('✓ Document de pose signé et transmis !');
    renderClient(await sheetsGetById(dosId));
  } catch(e) {
    showToast('Erreur : ' + e.message);
  }
}
