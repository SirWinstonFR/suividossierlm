const STEPS_C = [
  { label: 'Démarche lancée',      icon: '🚀' },
  { label: 'Rendez-vous planifié', icon: '📅' },
  { label: 'Retour technicien',    icon: '📐' },
  { label: 'Devis final envoyé',   icon: '📋' },
  { label: 'Commande confirmée',   icon: '✅' },
  { label: 'Pose effectuée',       icon: '🏠' },
];

function getToken() {
  // Méthode 1 : ?token=xxxx
  const params = new URLSearchParams(location.search);
  if (params.get('token')) return params.get('token');
  // Méthode 2 : /client/xxxx
  const parts = location.pathname.split('/').filter(p => p.length > 0);
  const idx = parts.indexOf('client');
  if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
  // Méthode 3 : dernier segment de l'URL
  const last = parts[parts.length - 1];
  if (last && last !== 'client' && last !== 'client.html') return last;
  return null;
}

async function initClient() {
  const token = getToken();

  showClientLoading('Chargement de votre dossier...');

  if (!token) {
    showClientError('Lien invalide', 'Ce lien de suivi est incorrect.<br>Contactez votre conseiller pour obtenir votre lien personnel.');
    return;
  }

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_NAME)}?key=${CONFIG.API_KEY}`;
    const r = await fetch(url);

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      showClientError(
        'Erreur ' + r.status,
        (err?.error?.message || 'Connexion impossible') +
        '<br><br>Vérifiez que le Google Sheet est partagé en accès public.'
      );
      return;
    }

    const data = await r.json();
    if (!data.values || data.values.length < 2) {
      showClientError('Données manquantes', 'Le tableau est vide. Importez le CSV dans votre Google Sheet.');
      return;
    }

    const [headers, ...rows] = data.values;
    const dossiers = rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || '');
      return obj;
    });

    const d = dossiers.find(x => x.token === token);
    if (!d) {
      showClientError(
        'Dossier introuvable',
        `Token reçu : <code>${token}</code><br><br>Aucun dossier ne correspond.<br>Contactez votre conseiller.`
      );
      return;
    }

    renderClient(d);

  } catch(e) {
    showClientError('Erreur réseau', e.message + '<br><br>Vérifiez votre connexion et réessayez.');
  }
}

function showClientLoading(msg) {
  document.getElementById('client-body').innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:#aaa">
      <div style="font-size:40px;margin-bottom:16px">⏳</div>
      <div style="font-size:14px">${msg}</div>
    </div>`;
}

function showClientError(titre, detail) {
  document.getElementById('client-body').innerHTML = `
    <div style="text-align:center;padding:40px 20px;max-width:480px;margin:0 auto">
      <div style="font-size:48px;margin-bottom:16px">⚠️</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:10px">${titre}</div>
      <div style="font-size:13px;color:#666;line-height:1.7">${detail}</div>
      <button onclick="location.reload()" style="margin-top:20px;padding:9px 20px;background:#78BE20;color:white;border:none;border-radius:5px;font-size:13px;font-weight:700;cursor:pointer">↻ Réessayer</button>
    </div>`;
}

function renderClient(d) {
  const etape  = parseInt(d.etape) || 1;
  const pct    = Math.round((etape / 6) * 100);
  const prenom = (d.nom || 'Client').split(' ')[0];
  const cons   = d.conseiller || '—';
  const initiales = cons.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || 'LM';
  const hasPrixEvo = d.prix_est && d.prix_final && d.prix_est !== d.prix_final;

  const tlPC = [...STEPS_C].reverse().map((s, ri) => {
    const i = 5 - ri, n = i + 1;
    const st = n < etape ? 'cdone' : n === etape ? 'ccurrent' : 'cpending';
    const ic = n < etape ? 'done'  : n === etape ? 'current'  : 'pending';
    return `
    <div class="cstep ${st}" style="animation-delay:${ri*0.08}s">
      <div class="cicon ${ic}">${ic==='done'?'✓':s.icon}</div>
      <div class="clabel ${ic}">${s.label}${n===etape?'<br><span class="current-badge-h">En cours</span>':''}</div>
      ${d['date'+n]?`<div class="cdate">${d['date'+n]}</div>`:''}
    </div>`;
  }).join('');

  const tlMobile = [...STEPS_C].reverse().map((s, ri) => {
    const i = 5 - ri, n = i + 1;
    const st = n < etape ? 'mdone' : n === etape ? 'mcurrent' : 'mpending';
    const ic = n < etape ? 'done'  : n === etape ? 'current'  : 'pending';
    return `
    <div class="mstep ${st}" style="animation-delay:${ri*0.08}s">
      <div class="mline"></div>
      <div class="micon ${ic}">${ic==='done'?'✓':s.icon}</div>
      <div class="mcontent">
        <div class="mtitle ${ic==='pending'?'pending':''}">
          ${s.label}${n===etape?'<span class="current-badge-h" style="margin-left:6px">En cours</span>':''}
        </div>
        ${d['date'+n]?`<div class="mdate">${d['date'+n]}</div>`:''}
      </div>
    </div>`;
  }).join('');

  const signBloc = etape >= 4 ? `
    <div class="sign-card">
      <div class="info-card-title" style="margin-bottom:12px">Signature du devis</div>
      ${d.signe === 'true'
        ? `<div class="sign-status signed">✅ Devis signé électroniquement le ${d.sig_date}</div>`
        : `<div class="sign-status unsigned">⏳ Votre signature est attendue${d.prix_final?' pour le devis de <strong>'+parseInt(d.prix_final).toLocaleString('fr-FR')+' €</strong>':''}</div>
          <div style="margin:14px 0 4px;font-size:13px;color:#555">Chargez votre devis PDF puis signez :</div>
          <div class="upload-zone" onclick="document.getElementById('file-pdf').click()">
            <input type="file" id="file-pdf" accept="application/pdf" style="display:none" onchange="onPdfSelected(this.files[0])">
            <div style="font-size:28px;margin-bottom:8px">📄</div>
            <div style="font-size:13px;font-weight:600;color:#444">Cliquez pour charger le devis PDF</div>
          </div>
          <div id="pdf-viewer-zone" style="display:none">
            <div style="background:#525659;border-radius:6px;overflow:hidden;margin:12px 0">
              <div style="background:#3d4043;padding:7px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px">
                <div style="display:flex;gap:6px;align-items:center">
                  <button onclick="pdfPrev()" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">‹</button>
                  <span id="pdf-page-info" style="color:#ccc;font-size:12px">Page 1/1</span>
                  <button onclick="pdfNext()" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">›</button>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <button onclick="pdfZoom(-0.2)" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">−</button>
                  <span id="pdf-zoom-label" style="color:#ccc;font-size:12px;min-width:36px;text-align:center">130%</span>
                  <button onclick="pdfZoom(0.2)" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">+</button>
                </div>
              </div>
              <div id="pdf-canvas-wrap" onscroll="pdfOnScroll()" style="max-height:440px;overflow-y:auto;display:flex;justify-content:center;padding:12px">
                <canvas id="pdf-canvas" style="max-width:100%;box-shadow:0 2px 10px rgba(0,0,0,.4)"></canvas>
              </div>
            </div>
            <div id="pdf-scroll-hint" style="display:none;align-items:center;gap:8px;padding:9px 12px;background:#fff8e1;border-radius:6px;font-size:12px;color:#e65100;font-weight:600;margin-bottom:10px">
              ⬇ Parcourez tout le document pour pouvoir signer
            </div>
            <div style="text-align:right;margin-bottom:14px">
              <button class="btn btn-primary" id="btn-go-sign" onclick="showSignZone()" disabled>J'ai lu le devis — Signer →</button>
            </div>
            <div id="sign-zone" style="display:none">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:12px;color:#666">Tracez votre signature</span>
                <button onclick="sigClear()" style="padding:5px 12px;border-radius:4px;border:1.5px solid #e0e0e0;background:white;color:#444;font-size:12px;cursor:pointer">✏ Effacer</button>
              </div>
              <div id="sig-wrap" style="border:2px dashed #e0e0e0;border-radius:6px;overflow:hidden;position:relative;background:white;cursor:crosshair;margin-bottom:10px">
                <canvas id="sig-canvas" style="display:block;width:100%;height:130px;touch-action:none"></canvas>
                <div id="sig-placeholder" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:#ccc;text-align:center;pointer-events:none;line-height:1.6">✍️<br>Tracez votre signature ici</div>
              </div>
              <div style="background:#f9f9f9;border-radius:6px;padding:9px 12px;font-size:12px;color:#666;margin-bottom:12px">
                📅 Date : <strong>${new Date().toLocaleDateString('fr-FR')}</strong>
              </div>
              <button class="btn btn-primary" id="btn-valider" onclick="validerEtTelecharger('${d.id}')" disabled style="width:100%">
                ✅ Valider et télécharger le PDF signé
              </button>
            </div>
          </div>`
      }
    </div>` : '';

  document.getElementById('client-body').innerHTML = `
    <div class="welcome-card">
      <div class="welcome-banner">
        <div class="welcome-title">Bonjour ${prenom} 👋</div>
        <div class="welcome-sub">Suivi de votre projet · Dossier ${d.id}</div>
      </div>
      <div class="welcome-body">
        <div class="client-info-grid">
          <div class="client-info-box"><div class="client-info-box-label">Gamme</div><div class="client-info-box-val" style="font-size:13px">${d.gamme||'—'}</div></div>
          <div class="client-info-box"><div class="client-info-box-label">Avancement</div><div class="client-info-box-val">${pct}%</div></div>
          ${d.prix_final?`<div class="client-info-box"><div class="client-info-box-label">Prix final</div><div class="client-info-box-val" style="color:#5a9118">${parseInt(d.prix_final).toLocaleString('fr-FR')} €</div></div>`:''}
          ${d.prix_est&&!d.prix_final?`<div class="client-info-box"><div class="client-info-box-label">Estimatif</div><div class="client-info-box-val">${parseInt(d.prix_est).toLocaleString('fr-FR')} €</div></div>`:''}
        </div>
        ${hasPrixEvo?`<div style="margin-bottom:16px"><div class="section-title">Évolution du prix</div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#666">Estimatif initial</span><span style="font-weight:700">${parseInt(d.prix_est).toLocaleString('fr-FR')} €</span></div>
            <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:#666">Prix final</span><span style="font-weight:800;color:#5a9118;font-size:15px">${parseInt(d.prix_final).toLocaleString('fr-FR')} €</span></div>
          </div></div>`:''}
        <div class="section-title">Étapes de votre projet</div>
        <div class="only-pc"><div class="client-tl-pc">${tlPC}</div></div>
        <div class="only-mobile"><div class="client-tl-mobile">${tlMobile}</div></div>
        ${signBloc}
        <div class="section-title" style="margin-top:20px">Votre interlocuteur</div>
        <div class="contact-card">
          <div class="contact-avatar">${initiales}</div>
          <div>
            <div class="contact-name">${cons}</div>
            <div class="contact-role">Conseiller pose Leroy Merlin</div>
            ${d.tel_conseiller?`<div class="contact-tel">📞 ${d.tel_conseiller}</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

function onPdfSelected(file) {
  if (!file) return;
  document.querySelector('.upload-zone').style.display = 'none';
  document.getElementById('pdf-viewer-zone').style.display = 'block';
  pdfLoad(file);
}

function showSignZone() {
  document.getElementById('sign-zone').style.display = 'block';
  document.getElementById('btn-go-sign').style.display = 'none';
  setTimeout(() => sigInit(), 100);
}

async function validerEtTelecharger(dossierId) {
  const btn = document.getElementById('btn-valider');
  btn.textContent = 'Génération...'; btn.disabled = true;
  try {
    const result = await pdfGenSigned();
    if (!result) { btn.textContent = '✅ Valider'; btn.disabled = false; return; }
    const blob = new Blob([result.bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = result.fileName; a.click();
    await sheetsUpdate(dossierId, { signe: 'true', sig_date: result.dateStr });
    document.getElementById('sign-zone').innerHTML = `
      <div style="background:#e8f5d0;border:1px solid #78BE20;border-radius:8px;padding:16px 20px;text-align:center">
        <div style="font-size:28px;margin-bottom:8px">✅</div>
        <div style="font-weight:700;font-size:15px;color:#3a7008">Devis signé et téléchargé !</div>
        <div style="font-size:13px;color:#5a9118;margin-top:4px">Signé le ${result.dateStr}</div>
      </div>`;
  } catch(e) {
    btn.textContent = '✅ Valider'; btn.disabled = false;
    alert('Erreur : ' + e.message);
  }
}

window.onload = initClient;
