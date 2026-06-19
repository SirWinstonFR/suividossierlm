// ============================================================
// client.js — Interface Client (token depuis URL)
// ============================================================
const STEPS_C = [
  { l:'Démarche lancée',       i:'🚀' },
  { l:'Rendez-vous planifié',  i:'📅' },
  { l:'Retour technicien',     i:'📐' },
  { l:'Devis final envoyé',    i:'📋' },
  { l:'Commande confirmée',    i:'✅' },
  { l:'Pose effectuée',        i:'🏠' },
];

async function initClient() {
  const parts = location.pathname.split('/').filter(Boolean);
  const idx   = parts.indexOf('client');
  const token = idx !== -1 ? parts[idx+1] : null;

  if (!token) {
    cliError('Lien invalide', 'Ce lien de suivi est incorrect.<br>Contactez votre conseiller.');
    return;
  }

  try {
    const d = await sheetsGetByToken(token);
    if (!d) {
      cliError('Dossier introuvable', `Token : <code>${token}</code><br>Contactez votre conseiller.`);
      return;
    }
    renderClient(d);
  } catch(e) {
    cliError('Erreur de connexion', e.message + '<br><button onclick="location.reload()" style="margin-top:12px;padding:8px 18px;background:var(--g);color:white;border:none;border-radius:5px;font-size:13px;font-weight:700;cursor:pointer">↻ Réessayer</button>');
  }
}

function cliError(titre, detail) {
  document.getElementById('cli-body').innerHTML = `
    <div style="text-align:center;padding:60px 20px;max-width:480px;margin:0 auto">
      <div style="font-size:48px;margin-bottom:16px">⚠️</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:10px">${titre}</div>
      <div style="font-size:13px;color:var(--mut);line-height:1.7">${detail}</div>
    </div>`;
}

function renderClient(d) {
  const e    = parseInt(d.etape)||1;
  const pct  = Math.round(e/6*100);
  const prenom = (d.nom||'Client').split(' ')[0];
  const cons   = d.conseiller||'—';
  const ini    = cons.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'LM';
  const hasPrixEvo = d.prix_est && d.prix_final && d.prix_est !== d.prix_final;

  // Timeline PC — droite à gauche
  const tlPC = [...STEPS_C].reverse().map((s,ri) => {
    const i=5-ri, n=i+1;
    const st = n<e?'cdone':n===e?'ccur':'cpend';
    const ic = n<e?'done' :n===e?'cur' :'pend';
    return `<div class="cst ${st}" style="animation-delay:${ri*.08}s">
      <div class="cico ${ic}">${ic==='done'?'✓':s.i}</div>
      <div class="clbl ${ic}">${s.l}${n===e?'<br><span class="cbadge">En cours</span>':''}</div>
      ${d['date'+n]?`<div class="cdt">${d['date'+n]}</div>`:''}
    </div>`;
  }).join('');

  // Timeline Mobile — bas vers haut
  const tlMob = [...STEPS_C].reverse().map((s,ri) => {
    const i=5-ri, n=i+1;
    const st = n<e?'mdone':n===e?'mcur':'mpend';
    const ic = n<e?'done' :n===e?'cur' :'pend';
    return `<div class="mst ${st}" style="animation-delay:${ri*.08}s">
      <div class="mln"></div>
      <div class="mico ${ic}">${ic==='done'?'✓':s.i}</div>
      <div class="mct">
        <div class="mtt ${ic==='pend'?'pend':''}">${s.l}${n===e?'<span class="cbadge" style="margin-left:6px">En cours</span>':''}</div>
        ${d['date'+n]?`<div class="mdt">${d['date'+n]}</div>`:''}
      </div>
    </div>`;
  }).join('');

  // Bloc signature
  const signBloc = e >= 4 ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:12px">Signature du devis</div>
      ${d.signe==='true'
        ? `<div class="ss signed">✅ Devis signé électroniquement le ${d.sig_date}</div>`
        : `<div class="ss unsigned">⏳ Votre signature est attendue${d.prix_final?' pour le devis de <strong>'+parseInt(d.prix_final).toLocaleString('fr-FR')+' €</strong>':''}</div>
          <div class="upload-zone" onclick="document.getElementById('fpdf').click()">
            <input type="file" id="fpdf" accept="application/pdf" style="display:none" onchange="onPdfSelected(this.files[0])">
            <div style="font-size:28px;margin-bottom:8px">📄</div>
            <div style="font-size:13px;font-weight:600;color:#444">Charger le devis PDF</div>
            <div style="font-size:11px;color:#888;margin-top:4px">Le fichier reste sur votre appareil</div>
          </div>
          <div id="pdf-viewer-zone" style="display:none">
            <div style="background:#525659;border-radius:6px;overflow:hidden;margin:12px 0">
              <div style="background:#3d4043;padding:7px 12px;display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;gap:6px;align-items:center">
                  <button onclick="pdfPrev()" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">‹</button>
                  <span id="pdf-page-info" style="color:#ccc;font-size:12px">1/1</span>
                  <button onclick="pdfNext()" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">›</button>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                  <button onclick="pdfZoom(-0.2)" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">−</button>
                  <span id="pdf-zoom-label" style="color:#ccc;font-size:12px;min-width:36px;text-align:center">130%</span>
                  <button onclick="pdfZoom(.2)" style="background:#555;color:white;border:none;border-radius:3px;padding:3px 10px;cursor:pointer">+</button>
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
              <button class="btn btn-p" id="btn-go-sign" onclick="showSignZone()" disabled>J'ai lu — Signer →</button>
            </div>
            <div id="sign-zone" style="display:none">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:12px;color:var(--mut)">Tracez votre signature</span>
                <button onclick="sigClear()" style="padding:5px 12px;border-radius:4px;border:1.5px solid var(--mid);background:white;font-size:12px;cursor:pointer">✏ Effacer</button>
              </div>
              <div id="sig-wrap" style="border:2px dashed var(--mid);border-radius:6px;overflow:hidden;position:relative;background:white;cursor:crosshair;margin-bottom:10px">
                <canvas id="sig-canvas" style="display:block;width:100%;height:130px;touch-action:none"></canvas>
                <div id="sig-placeholder" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:13px;color:#ccc;text-align:center;pointer-events:none;line-height:1.6">✍️<br>Tracez votre signature ici</div>
              </div>
              <div style="background:#f9f9f9;border-radius:6px;padding:9px 12px;font-size:12px;color:var(--mut);margin-bottom:12px">
                📅 ${new Date().toLocaleDateString('fr-FR')} — En signant vous confirmez avoir lu et accepté le devis.
              </div>
              <button class="btn btn-p" id="btn-valider" onclick="validerSignature('${d.id}')" disabled style="width:100%">✅ Valider et télécharger le PDF signé</button>
            </div>
          </div>`
      }
    </div>` : '';

  document.getElementById('cli-body').innerHTML = `
    <div class="wc">
      <div class="wb"><div class="wt">Bonjour ${prenom} 👋</div><div class="ws">Suivi de votre projet · Dossier ${d.id}</div></div>
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
        <div class="stl">Étapes de votre projet</div>
        <div class="only-pc"><div class="ctl-pc">${tlPC}</div></div>
        <div class="only-mob"><div class="ctl-mob">${tlMob}</div></div>
        ${signBloc}
        <div class="stl" style="margin-top:20px">Votre interlocuteur</div>
        <div class="cc">
          <div class="cav">${ini}</div>
          <div>
            <div style="font-weight:700;font-size:14px">${cons}</div>
            <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:1px">Conseiller pose Leroy Merlin</div>
            ${d.tel_conseiller?`<div style="font-size:13px;color:var(--g);font-weight:600;margin-top:4px">📞 ${d.tel_conseiller}</div>`:''}
          </div>
        </div>
      </div>
    </div>`;
}

function onPdfSelected(file) {
  if(!file) return;
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
  btn.textContent='Génération...'; btn.disabled=true;
  try {
    const result = await pdfGenSigned();
    if (!result) { btn.textContent='✅ Valider'; btn.disabled=false; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
    a.download = result.fileName; a.click();
    await sheetsWrite('update',{id:dosId,fields:{signe:'true',sig_date:result.dateStr}});
    document.getElementById('sign-zone').innerHTML=`
      <div style="background:var(--gl);border:1px solid var(--g);border-radius:8px;padding:16px 20px;text-align:center">
        <div style="font-size:28px;margin-bottom:8px">✅</div>
        <div style="font-weight:700;font-size:15px;color:var(--gd)">Devis signé et téléchargé !</div>
        <div style="font-size:13px;color:var(--gd);margin-top:4px">Signé le ${result.dateStr}</div>
      </div>`;
  } catch(err) {
    btn.textContent='✅ Valider'; btn.disabled=false;
    showToast('Erreur : ' + err.message);
  }
}
