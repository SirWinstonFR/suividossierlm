// ============================================================
// client.js — Interface Client v2
// ============================================================

function showLoginClient() {
  document.getElementById('cli-body').innerHTML = `
    <div style="max-width:400px;margin:60px auto;text-align:center">
      <div style="background:white;border-radius:12px;border:1px solid var(--mid);padding:36px 32px">
        <div style="font-size:36px;margin-bottom:16px;color:var(--g)"><i class="ti ti-home-2"></i></div>
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Suivi de votre pose</div>
        <div style="font-size:13px;color:var(--mut);margin-bottom:24px">Saisissez votre numéro de devis<br>pour accéder à votre suivi</div>
        <input id="dos-input" type="text" placeholder="ex: 360150"
          style="width:100%;text-align:center;font-size:18px;font-weight:700;letter-spacing:2px;margin-bottom:12px"
          onkeydown="if(event.key==='Enter')connecterClient()">
        <button class="btn btn-p" style="width:100%;padding:10px" onclick="connecterClient()">
          Accéder à mon suivi <i class="ti ti-arrow-right"></i>
        </button>
        <div id="cli-err" style="color:#e53935;font-size:13px;margin-top:12px;min-height:18px"></div>
        <div style="font-size:11px;color:#bbb;margin-top:20px">Votre numéro vous a été communiqué par votre conseiller Leroy Merlin.</div>
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

  // === TIMELINE SERPENTIN PRO — SVG avec chemin courbe ===
  const half = Math.ceil(STEPS.length/2);
  const row1 = STEPS.slice(0, half);
  const row2 = STEPS.slice(half).reverse();
  const n = half;

  // Calcul des positions (coordonnées sur grille 0-680, padding latéral)
  const padX = 50, usableW = 680 - padX*2;
  const stepW = usableW / (n - 1);
  const y1 = 36, y2 = 130;
  const r = 20;

  function dotsRow(stepsArr, yPos, isRow1) {
    return stepsArr.map((s, i) => {
      const realIdx = isRow1 ? i : (STEPS.length - 1 - i);
      const num = realIdx + 1;
      const cx = padX + i*stepW;
      const st = num<e?'done':num===e?'cur':'pend';
      let fill = st==='done' ? 'var(--g)' : st==='cur' ? 'white' : '#f0f0f0';
      let stroke = st==='done' ? 'var(--g)' : st==='cur' ? 'var(--g)' : '#d8d8d8';
      let strokeW = st==='cur' ? 3 : 1.5;
      return { cx, cy:yPos, num, st, s, fill, stroke, strokeW };
    });
  }

  const d1 = dotsRow(row1, y1, true);
  const d2 = dotsRow(row2, y2, false);

  // Chemin de connexion : ligne 1 (gauche->droite), coude à droite, ligne 2 (droite->gauche)
  const lastX1 = d1[d1.length-1].cx, firstX2 = d2[0].cx;
  const pathSegments = [
    `M ${d1[0].cx} ${y1}`,
    ...d1.slice(1).map(p => `L ${p.cx} ${y1}`),
    `Q ${lastX1+30} ${y1} ${lastX1+30} ${(y1+y2)/2}`,
    `Q ${lastX1+30} ${y2} ${firstX2} ${y2}`,
    ...d2.slice(1).map(p => `L ${p.cx} ${y2}`),
  ].join(' ');

  // Progression : combien de segments sont "done" pour colorer le path en vert jusque-là
  const totalDots = STEPS.length;
  const progressRatio = Math.min((e-1) / (totalDots-1), 1);

  const dotsSvg = [...d1, ...d2].map(p => `
    <g>
      <circle cx="${p.cx}" cy="${p.cy}" r="${r}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.strokeW}"/>
      ${p.st==='done'
        ? `<path d="M ${p.cx-7} ${p.cy} l 4 4 l 9 -9" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<text x="${p.cx}" y="${p.cy}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="${p.st==='cur'?'var(--gd)':'#bbb'}">${p.num}</text>`
      }
      ${p.st==='cur' ? `<circle cx="${p.cx}" cy="${p.cy}" r="${r+6}" fill="none" stroke="var(--g)" stroke-width="1.5" opacity="0.4"><animate attributeName="r" values="${r+4};${r+10};${r+4}" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/></circle>` : ''}
    </g>`).join('');

  const labelsSvg = [...d1, ...d2].map(p => {
    const words = p.s.l.split(' ');
    const line1 = words.slice(0, Math.ceil(words.length/2)).join(' ');
    const line2 = words.slice(Math.ceil(words.length/2)).join(' ');
    const ly = p.cy < 80 ? p.cy - r - 10 : p.cy + r + 16;
    const color = p.st==='done' ? 'var(--gd)' : p.st==='cur' ? 'var(--blk)' : '#bbb';
    const weight = p.st==='cur' ? '700' : '600';
    return `
      <text x="${p.cx}" y="${ly}" text-anchor="middle" font-size="10" font-weight="${weight}" fill="${color}">
        <tspan x="${p.cx}" dy="0">${line1}</tspan>
        ${line2?`<tspan x="${p.cx}" dy="12">${line2}</tspan>`:''}
      </text>
      ${p.st==='cur'?`<rect x="${p.cx-26}" y="${p.cy < 80 ? p.cy - r - 38 : p.cy + r + 40}" width="52" height="14" rx="7" fill="var(--g)"/><text x="${p.cx}" y="${p.cy < 80 ? p.cy - r - 31 : p.cy + r + 47}" text-anchor="middle" dominant-baseline="central" font-size="8" font-weight="700" fill="white">EN COURS</text>`:''}
    `;
  }).join('');

  const timelineHtml = `
    <div class="serpent-pro">
      <svg width="100%" viewBox="0 0 680 175" style="overflow:visible">
        <path d="${pathSegments}" fill="none" stroke="#e0e0e0" stroke-width="3" stroke-linecap="round"/>
        <path d="${pathSegments}" fill="none" stroke="var(--g)" stroke-width="3" stroke-linecap="round"
          stroke-dasharray="2000" stroke-dashoffset="${2000 - 2000*progressRatio}" style="transition:stroke-dashoffset .6s ease"/>
        ${dotsSvg}
        ${labelsSvg}
      </svg>
    </div>`;

  // === PASTILLES DOCUMENTS ===
  const docPills = DOCS.map(doc => {
    let active = false, url = null;
    if (doc.key === 'sig_commande') { active = d.signe==='true'; url = null; }
    else { active = !!d[doc.key] && e >= doc.minStep; url = d[doc.key]; }
    return `<div class="dpill ${active?'active':'todo'}" ${url?`onclick="openLink('${url}')"`:''}>
      <i class="ti ${doc.i}"></i>
      <span>${doc.l}</span>
      ${active?'<i class="ti ti-check dpill-check"></i>':''}
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
      <div class="ict" style="margin-bottom:10px">Détails de votre projet</div>
      ${projetRows.map(([l,v]) => `<div class="ir"><span style="color:var(--mut)">${l}</span><span style="font-weight:600;text-align:right;max-width:60%">${v}</span></div>`).join('')}
    </div>` : '';

  // === PROMO + ECO-PTZ ===
  const avantagesBloc = (d.promo || d.ecoptz_url) ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:10px">Vos avantages</div>
      ${d.promo ? `<div class="promo-box">
        <i class="ti ti-discount-2" style="font-size:22px;color:var(--gd)"></i>
        <div><div style="font-size:13px;font-weight:700;color:var(--gd)">Promotion éligible</div>
        <div style="font-size:12px;color:#3a5a0a;margin-top:2px">${d.promo}</div></div>
      </div>` : ''}
      ${d.ecoptz_url ? `<div style="margin-top:${d.promo?'10px':'0'};display:flex;align-items:center;justify-content:space-between;gap:10px;background:#f5f5f5;border-radius:8px;padding:10px 14px">
        <div style="display:flex;align-items:center;gap:10px">
          <i class="ti ti-building-bank" style="font-size:20px;color:var(--mut)"></i>
          <div style="font-size:13px;font-weight:600">Éco-PTZ disponible</div>
        </div>
        <button class="btn btn-p btn-sm" onclick="openLink('${d.ecoptz_url}')">Faire ma demande</button>
      </div>` : ''}
    </div>` : '';

  // === PLU / Adresse + mini-carte ===
  const pluBloc = d.plu_concerne === 'true' ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:10px">Démarche administrative</div>
      <div class="alert-box">
        <i class="ti ti-alert-triangle" style="font-size:18px;flex-shrink:0;margin-top:1px"></i>
        <div>
          <div style="font-weight:700;font-size:13px">Votre projet est soumis à déclaration (PLU)</div>
          <div style="font-size:12px;margin-top:3px;opacity:.85">Une démarche administrative préalable est nécessaire avant le début des travaux. Votre conseiller vous accompagne dans cette étape.</div>
        </div>
      </div>
      ${d.plu_adresse ? `<div id="plu-map" style="margin-top:10px;height:160px;border-radius:8px;overflow:hidden;border:1px solid var(--mid)"></div>
      <div style="font-size:12px;color:var(--mut);margin-top:6px"><i class="ti ti-map-pin"></i> ${d.plu_adresse}</div>` : ''}
    </div>` : '';

  // === DEVIS PDF ===
  const devisBloc = e >= 4 && d.devis_url ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:10px">Votre devis</div>
      <div style="font-size:13px;color:#333;margin-bottom:12px">Consultez votre devis avant de signer le bon de commande.</div>
      <button class="btn btn-p" style="width:100%" onclick="openLink('${d.devis_url}')">
        <i class="ti ti-file-text"></i> Consulter mon devis PDF
      </button>
    </div>` : '';

  // === SIGNATURE — bon de commande ===
  // Affiché uniquement à l'étape 5 (en attente) OU si déjà signé (rappel à toutes les étapes suivantes)
  const dejaSigne = d.signe === 'true';
  const signBloc = (e === 5 || dejaSigne) ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:10px">Bon de commande</div>
      ${dejaSigne
        ? `<div class="ss signed"><i class="ti ti-circle-check" style="font-size:18px"></i> Bon de commande signé le ${d.sig_date}</div>`
        : `<div class="ss unsigned"><i class="ti ti-clock" style="font-size:18px"></i> Signature attendue${d.prix_final?' pour <strong>'+parseInt(d.prix_final).toLocaleString('fr-FR')+' €</strong>':''}</div>
          <div style="font-size:13px;color:#555;margin:12px 0 4px">Chargez votre bon de commande PDF :</div>
          <div class="upload-zone" onclick="document.getElementById('fpdf').click()">
            <input type="file" id="fpdf" accept="application/pdf" style="display:none" onchange="onPdfSelected(this.files[0])">
            <i class="ti ti-file-upload" style="font-size:28px;color:var(--g);margin-bottom:8px;display:block"></i>
            <div style="font-size:13px;font-weight:600;color:#444">Charger le bon de commande</div>
            <div style="font-size:11px;color:#888;margin-top:4px">Le fichier reste sur votre appareil</div>
          </div>
          <div id="pdf-viewer-zone" style="display:none">
            <div class="pdf-frame">
              <div class="pdf-toolbar">
                <div style="display:flex;gap:6px;align-items:center">
                  <button class="pdf-btn" onclick="pdfPrev()"><i class="ti ti-chevron-left"></i></button>
                  <span id="pdf-page-info" style="color:#ddd;font-size:12px;min-width:40px;text-align:center">1/1</span>
                  <button class="pdf-btn" onclick="pdfNext()"><i class="ti ti-chevron-right"></i></button>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <button class="pdf-btn" onclick="pdfZoom(-0.2)"><i class="ti ti-zoom-out"></i></button>
                  <span id="pdf-zoom-label" style="color:#ddd;font-size:12px;min-width:38px;text-align:center">140%</span>
                  <button class="pdf-btn" onclick="pdfZoom(.2)"><i class="ti ti-zoom-in"></i></button>
                </div>
              </div>
              <div id="pdf-canvas-wrap" onscroll="pdfOnScroll()" class="pdf-canvas-wrap">
                <canvas id="pdf-canvas"></canvas>
              </div>
            </div>
            <div id="pdf-scroll-hint" class="scroll-hint">
              <i class="ti ti-arrow-down"></i> Parcourez tout le document pour pouvoir signer
            </div>
            <div style="text-align:right;margin-bottom:14px">
              <button class="btn btn-p" id="btn-go-sign" onclick="showSignZone()" disabled>J'ai lu — Signer <i class="ti ti-arrow-right"></i></button>
            </div>
            <div id="sign-zone" style="display:none">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;align-items:center">
                <span style="font-size:13px;color:var(--mut);font-weight:600">Tracez votre signature</span>
                <button class="btn-sig-clear" onclick="sigClear()"><i class="ti ti-eraser"></i> Effacer</button>
              </div>
              <div id="sig-wrap" class="sig-wrap-pro">
                <canvas id="sig-canvas"></canvas>
                <div id="sig-placeholder" class="sig-placeholder-pro"><i class="ti ti-signature" style="font-size:24px;display:block;margin-bottom:6px;opacity:.4"></i>Tracez votre signature ici</div>
                <div class="sig-line"></div>
              </div>
              <div style="background:#f9f9f9;border-radius:6px;padding:10px 14px;font-size:12px;color:var(--mut);margin-bottom:14px;display:flex;align-items:center;gap:8px">
                <i class="ti ti-calendar"></i> ${new Date().toLocaleDateString('fr-FR')} — Cette signature sera également utilisée pour vos prochains documents (pose).
              </div>
              <button class="btn btn-p" id="btn-valider" onclick="validerSignature('${d.id}')" disabled style="width:100%">
                <i class="ti ti-circle-check"></i> Valider et télécharger le document signé
              </button>
            </div>
          </div>`
      }
    </div>` : '';

  // === DOCUMENT DE POSE — signature réutilisée automatiquement ===
  const poseDejaSigne = d.signe_pose === 'true';
  const poseDocBloc = (e === 7 || (poseDejaSigne && e >= 7)) && d.sig_data ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:10px">Document de pose</div>
      ${poseDejaSigne
        ? `<div class="ss signed"><i class="ti ti-circle-check" style="font-size:18px"></i> Document de pose signé automatiquement</div>`
        : `<div style="font-size:13px;color:#555;margin-bottom:12px">Votre signature enregistrée sera appliquée automatiquement à ce document, et le PDF signé sera transmis à votre conseiller.</div>
           <div class="upload-zone" onclick="document.getElementById('fpdf-pose').click()">
             <input type="file" id="fpdf-pose" accept="application/pdf" style="display:none" onchange="onPdfPoseSelected(this.files[0],'${d.id}')">
             <i class="ti ti-file-upload" style="font-size:28px;color:var(--g);margin-bottom:8px;display:block"></i>
             <div style="font-size:13px;font-weight:600;color:#444">Charger le document de pose</div>
           </div>`
      }
    </div>` : '';

  // === LIVRAISON ===
  const livraisonBloc = e >= 7 && d.transporteur ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:10px">Livraison</div>
      <div style="display:flex;align-items:center;gap:12px;background:#f5f5f5;border-radius:8px;padding:12px 16px">
        <i class="ti ti-truck-delivery" style="font-size:26px;color:var(--gd)"></i>
        <div>
          <div style="font-size:11px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Transporteur</div>
          <div style="font-size:16px;font-weight:700;margin-top:2px">${d.transporteur}</div>
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
          ${d.prix_final?`<div class="cib"><div class="cibl">Prix final</div><div class="cibv" style="color:var(--gd)">${parseInt(d.prix_final).toLocaleString('fr-FR')} €</div></div>`:''}
          ${d.prix_est&&!d.prix_final?`<div class="cib"><div class="cibl">Estimatif</div><div class="cibv">${parseInt(d.prix_est).toLocaleString('fr-FR')} €</div></div>`:''}
        </div>

        ${hasPrixEvo?`<div style="margin-bottom:16px">
          <div class="stl">Évolution du prix</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--mut)">Estimatif initial</span><span style="font-weight:700">${parseInt(d.prix_est).toLocaleString('fr-FR')} €</span></div>
            <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--mut)">Prix final</span><span style="font-weight:800;color:var(--gd);font-size:15px">${parseInt(d.prix_final).toLocaleString('fr-FR')} €</span></div>
          </div></div>`:''}

        ${stepDesc?`<div class="step-banner"><i class="ti ${STEPS[e-1].i}"></i> ${stepDesc}</div>`:''}

        <div class="stl">Étapes de votre projet</div>
        ${timelineHtml}

        <div class="stl" style="margin-top:20px">Vos documents</div>
        <div class="doc-pills">${docPills}</div>

        ${projetBloc}
        ${avantagesBloc}
        ${pluBloc}
        ${devisBloc}
        ${signBloc}
        ${poseDocBloc}
        ${livraisonBloc}

        <div class="stl" style="margin-top:20px">Votre interlocuteur</div>
        <div class="cc">
          <div class="cav">${ini}</div>
          <div>
            <div style="font-weight:700;font-size:14px">${cons}</div>
            <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:1px">Conseiller pose Leroy Merlin</div>
            ${d.tel_conseiller?`<div style="font-size:13px;color:var(--g);font-weight:600;margin-top:4px"><i class="ti ti-phone"></i> ${d.tel_conseiller}</div>`:''}
          </div>
        </div>

        <div style="text-align:center;margin-top:20px">
          <button onclick="sessionStorage.removeItem('cli_dossier_id');showLoginClient()" class="btn-link-small">
            Changer de dossier
          </button>
        </div>

      </div>
    </div>`;

  // Charger la mini-carte si adresse PLU présente
  if (d.plu_concerne === 'true' && d.plu_adresse) {
    loadMiniMap(d.plu_adresse);
  }
}

function openLink(url) {
  window.open(url, '_blank');
}

async function loadMiniMap(adresse) {
  const el = document.getElementById('plu-map');
  if (!el) return;
  const q = encodeURIComponent(adresse);
  el.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0"
    src="https://www.google.com/maps?q=${q}&output=embed"></iframe>`;
}

function onPdfSelected(file) {
  if (!file) return;
  document.querySelector('.upload-zone').style.display='none';
  document.getElementById('pdf-viewer-zone').style.display='block';
  pdfLoad(file);
}
function showSignZone() {
  document.getElementById('sign-zone').style.display='block';
  document.getElementById('btn-go-sign').style.display='none';
  setTimeout(() => sigInit(), 100);
}

async function validerSignature(dosId) {
  const btn = document.getElementById('btn-valider');
  btn.innerHTML='<i class="ti ti-loader-2"></i> Génération...'; btn.disabled=true;
  try {
    const sigDataUrl = sigGetDataUrl();
    const result = await pdfGenSigned(sigDataUrl);
    if (!result) { btn.innerHTML='<i class="ti ti-circle-check"></i> Valider'; btn.disabled=false; return; }

    // Téléchargement local pour le client
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
    a.download = result.fileName; a.click();

    // Sauvegarde la signature pour réutilisation future
    await sheetsWrite('update',{id:dosId,fields:{signe:'true',sig_date:result.dateStr,sig_data:sigDataUrl}});

    // Envoi automatique vers le Drive du client
    btn.innerHTML='<i class="ti ti-loader-2"></i> Envoi vers votre espace...';
    await sendPdfToDrive(dosId, result.bytes, result.fileName);

    document.getElementById('sign-zone').innerHTML=`
      <div class="success-box">
        <i class="ti ti-circle-check" style="font-size:28px"></i>
        <div style="font-weight:700;font-size:15px;margin-top:6px">Document signé et transmis !</div>
        <div style="font-size:13px;margin-top:4px;opacity:.85">Signé le ${result.dateStr} — une copie a été envoyée à votre conseiller</div>
      </div>`;
  } catch(err) {
    btn.innerHTML='<i class="ti ti-circle-check"></i> Valider'; btn.disabled=false;
    showToast('Erreur : ' + err.message);
  }
}

// Envoie le PDF signé (en base64) à Apps Script qui le dépose dans le Drive
async function sendPdfToDrive(dosId, pdfBytes, fileName) {
  try {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const base64 = await blobToBase64(blob);
    await sheetsWrite('uploadPdf', { id: dosId, fileName, base64Data: base64 });
  } catch(e) {
    console.warn('Envoi Drive échoué (le téléchargement local a fonctionné) :', e);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Document de pose — réutilise la signature stockée automatiquement
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
