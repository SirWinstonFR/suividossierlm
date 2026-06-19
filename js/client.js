// ============================================================
// client.js — Interface Client
// Connexion par n° de dossier (DOS-001)
// ============================================================

// Écran de saisie du n° de dossier
function showLoginClient() {
  document.getElementById('cli-body').innerHTML = `
    <div style="max-width:400px;margin:60px auto;text-align:center">
      <div style="background:white;border-radius:12px;border:1px solid var(--mid);padding:36px 32px">
        <div style="font-size:36px;margin-bottom:16px">🏠</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Suivi de votre pose</div>
        <div style="font-size:13px;color:var(--mut);margin-bottom:24px">Saisissez votre numéro de dossier<br>pour accéder à votre suivi</div>
        <input id="dos-input" type="text" placeholder="ex: DOS-001"
          style="width:100%;text-align:center;font-size:18px;font-weight:700;letter-spacing:2px;margin-bottom:12px;text-transform:uppercase"
          onkeydown="if(event.key==='Enter')connecterClient()">
        <button class="btn btn-p" style="width:100%;padding:10px" onclick="connecterClient()">
          Accéder à mon suivi →
        </button>
        <div id="cli-err" style="color:#e53935;font-size:13px;margin-top:12px;min-height:18px"></div>
        <div style="font-size:11px;color:#bbb;margin-top:20px">Votre numéro de dossier vous a été communiqué par votre conseiller Leroy Merlin.</div>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('dos-input')?.focus(), 100);
}

async function connecterClient() {
  const input = document.getElementById('dos-input');
  const val = input?.value.trim().toUpperCase();
  if (!val) return;

  document.getElementById('cli-err').textContent = '';
  input.disabled = true;

  try {
    // Chercher par ID de dossier
    const d = await sheetsGetById(val);
    if (!d) {
      document.getElementById('cli-err').textContent = 'Numéro de dossier introuvable. Vérifiez avec votre conseiller.';
      input.disabled = false;
      return;
    }
    // Persister pour les rechargements
    sessionStorage.setItem('cli_dossier_id', val);
    sessionStorage.removeItem('cli_token'); // on n'utilise plus le token
    renderClient(d);
  } catch(e) {
    document.getElementById('cli-err').textContent = 'Erreur de connexion : ' + e.message;
    input.disabled = false;
  }
}

async function initClient(token) {
  // Si on arrive via token dans l'URL (lien partagé)
  // On essaie de trouver le dossier par token, puis on bascule en mode ID
  const savedId = sessionStorage.getItem('cli_dossier_id');

  if (savedId) {
    // Rechargement de page — on recharge le dossier directement
    try {
      const d = await sheetsGetById(savedId);
      if (d) { renderClient(d); return; }
    } catch(e) {}
  }

  if (token) {
    // Arrivée via lien conseiller — on affiche la page avec l'ID pré-rempli
    try {
      const d = await sheetsGetByToken(token);
      if (d) {
        sessionStorage.setItem('cli_dossier_id', d.id);
        renderClient(d);
        return;
      }
    } catch(e) {}
  }

  // Sinon : écran de saisie du n° de dossier
  showLoginClient();
}

function renderClient(d) {
  const e   = parseInt(d.etape)||1;
  const pct = Math.round(e / STEPS.length * 100);
  const prenom  = (d.nom||'Client').split(' ')[0];
  const cons    = d.conseiller||'—';
  const ini     = cons.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'LM';
  const hasPrixEvo = d.prix_est && d.prix_final && d.prix_est !== d.prix_final;

  // Timeline PC (droite → gauche)
  const tlPC = [...STEPS].reverse().map((s,ri) => {
    const i=STEPS.length-1-ri, n=i+1;
    const st = n<e?'cdone':n===e?'ccur':'cpend';
    const ic = n<e?'done' :n===e?'cur' :'pend';
    return `<div class="cst ${st}" style="animation-delay:${ri*.06}s">
      <div class="cico ${ic}">${ic==='done'?'✓':s.i}</div>
      <div class="clbl ${ic}">${s.l}${n===e?'<br><span class="cbadge">En cours</span>':''}</div>
      ${d['date'+n]?`<div class="cdt">${d['date'+n]}</div>`:''}
    </div>`;
  }).join('');

  // Timeline Mobile (bas → haut)
  const tlMob = [...STEPS].reverse().map((s,ri) => {
    const i=STEPS.length-1-ri, n=i+1;
    const st = n<e?'mdone':n===e?'mcur':'mpend';
    const ic = n<e?'done' :n===e?'cur' :'pend';
    return `<div class="mst ${st}" style="animation-delay:${ri*.06}s">
      <div class="mln"></div>
      <div class="mico ${ic}">${ic==='done'?'✓':s.i}</div>
      <div class="mct">
        <div class="mtt ${ic==='pend'?'pend':''}">${s.l}${n===e?'<span class="cbadge" style="margin-left:6px">En cours</span>':''}</div>
        ${d['date'+n]?`<div class="mdt">${d['date'+n]}</div>`:''}
      </div>
    </div>`;
  }).join('');

  // Description de l'étape en cours
  const stepDesc = STEPS[e-1]?.desc || '';

  // Bloc devis PDF (étape 4 — posté par LM)
  const devisBloc = e >= 4 && d.devis_url ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:12px">📋 Votre devis</div>
      <div style="font-size:13px;color:#333;margin-bottom:12px">Votre conseiller a mis votre devis à disposition. Consultez-le avant de signer.</div>
      <a href="${d.devis_url}" target="_blank" class="btn btn-p" style="display:block;text-align:center;text-decoration:none;margin-bottom:0">
        📄 Consulter mon devis PDF
      </a>
    </div>` : '';

  // Bloc signature bon de commande (étape 5)
  const signBloc = e >= 5 ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:12px">✍️ Bon de commande</div>
      ${d.signe==='true'
        ? `<div class="ss signed">✅ Bon de commande signé le ${d.sig_date}</div>`
        : `<div class="ss unsigned">⏳ Votre signature est attendue${d.prix_final?' pour <strong>'+parseInt(d.prix_final).toLocaleString('fr-FR')+' €</strong>':''}</div>
          <div style="font-size:13px;color:#555;margin:12px 0 4px">Chargez votre bon de commande PDF pour le signer :</div>
          <div class="upload-zone" onclick="document.getElementById('fpdf').click()">
            <input type="file" id="fpdf" accept="application/pdf" style="display:none" onchange="onPdfSelected(this.files[0])">
            <div style="font-size:28px;margin-bottom:8px">📄</div>
            <div style="font-size:13px;font-weight:600;color:#444">Charger le bon de commande</div>
            <div style="font-size:11px;color:#888;margin-top:4px">Le fichier reste sur votre appareil</div>
          </div>
          <div id="pdf-viewer-zone" style="display:none">
            <div style="background:#525659;border-radius:6px;overflow:hidden;margin:12px 0">
              <div style="background:#3d4043;padding:7px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px">
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
                📅 ${new Date().toLocaleDateString('fr-FR')} — En signant vous confirmez avoir lu et accepté le bon de commande.
              </div>
              <button class="btn btn-p" id="btn-valider" onclick="validerSignature('${d.id}')" disabled style="width:100%">
                ✅ Valider et télécharger le bon de commande signé
              </button>
            </div>
          </div>`
      }
    </div>` : '';

  // Bloc livraison (étape 7)
  const livraisonBloc = e >= 7 && d.transporteur ? `
    <div class="sc">
      <div class="ict" style="margin-bottom:10px">🚚 Livraison</div>
      <div style="display:flex;align-items:center;gap:12px;background:#f5f5f5;border-radius:8px;padding:12px 16px">
        <div style="font-size:28px">🚛</div>
        <div>
          <div style="font-size:12px;color:var(--mut);font-weight:600;text-transform:uppercase;letter-spacing:.5px">Transporteur</div>
          <div style="font-size:16px;font-weight:700;margin-top:2px">${d.transporteur}</div>
        </div>
      </div>
    </div>` : '';

  document.getElementById('cli-body').innerHTML = `
    <div class="wc">
      <div class="wb">
        <div class="wt">Bonjour ${prenom} 👋</div>
        <div class="ws">Suivi de votre projet · Dossier ${d.id}</div>
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

        ${stepDesc?`<div style="background:var(--gx);border-left:3px solid var(--g);border-radius:0 6px 6px 0;padding:10px 14px;font-size:13px;color:var(--gd);font-weight:600;margin-bottom:18px">
          ${STEPS[e-1].i} ${stepDesc}
        </div>`:''}

        <div class="stl">Étapes de votre projet</div>
        <div class="only-pc"><div class="ctl-pc">${tlPC}</div></div>
        <div class="only-mob"><div class="ctl-mob">${tlMob}</div></div>

        ${devisBloc}
        ${signBloc}
        ${livraisonBloc}

        <div class="stl" style="margin-top:20px">Votre interlocuteur</div>
        <div class="cc">
          <div class="cav">${ini}</div>
          <div>
            <div style="font-weight:700;font-size:14px">${cons}</div>
            <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:1px">Conseiller pose Leroy Merlin</div>
            ${d.tel_conseiller?`<div style="font-size:13px;color:var(--g);font-weight:600;margin-top:4px">📞 ${d.tel_conseiller}</div>`:''}
          </div>
        </div>

        <div style="text-align:center;margin-top:20px">
          <button onclick="sessionStorage.removeItem('cli_dossier_id');showLoginClient()"
            style="background:none;border:none;font-size:12px;color:#bbb;cursor:pointer;text-decoration:underline">
            Changer de dossier
          </button>
        </div>

      </div>
    </div>`;
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
        <div style="font-weight:700;font-size:15px;color:var(--gd)">Bon de commande signé et téléchargé !</div>
        <div style="font-size:13px;color:var(--gd);margin-top:4px">Signé le ${result.dateStr}</div>
      </div>`;
  } catch(err) {
    btn.textContent='✅ Valider'; btn.disabled=false;
    showToast('Erreur : ' + err.message);
  }
}
