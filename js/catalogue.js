// ============================================================
// catalogue.js — Gestion du catalogue produits (admin)
// Structure : gamme > sous_gamme > fabricant > modele (+ plus/moins/fiche)
// ============================================================

let _catalogue = [];

const GAMMES_BASE = ['Fenêtre', 'Porte-fenêtre', "Porte d'entrée", 'Porte de garage', 'Velux'];

async function loadCatalogue() {
  try { _catalogue = await catalogueGetAll(); }
  catch(e) { _catalogue = []; }
}

function catalogueGammes() {
  const fromData = [...new Set(_catalogue.map(c => c.gamme).filter(Boolean))];
  return [...new Set([...GAMMES_BASE, ...fromData])];
}
function catalogueSousGammes(gamme) {
  return [...new Set(_catalogue.filter(c => c.gamme===gamme && c.sous_gamme).map(c => c.sous_gamme))];
}
function catalogueFabricants(gamme, sousGamme) {
  return [...new Set(_catalogue
    .filter(c => c.gamme===gamme && (!sousGamme || c.sous_gamme===sousGamme) && c.fabricant)
    .map(c => c.fabricant))];
}
function catalogueModeles(gamme, sousGamme, fabricant) {
  return _catalogue.filter(c =>
    c.gamme===gamme &&
    (!sousGamme || c.sous_gamme===sousGamme) &&
    (!fabricant || c.fabricant===fabricant) &&
    c.modele
  );
}
function catalogueEntry(gamme, sousGamme, fabricant, modele) {
  return _catalogue.find(c => c.gamme===gamme && c.sous_gamme===sousGamme && c.fabricant===fabricant && c.modele===modele);
}

// === RENDU VUE ADMIN — ONGLET CATALOGUE ===
function renderCatalogueView() {
  const gammes = catalogueGammes();
  document.getElementById('catalogueCont').innerHTML = `
    <div class="page" style="max-width:900px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div>
          <div style="font-size:22px;font-weight:700">Catalogue produits</div>
          <div style="font-size:13px;color:var(--mut);margin-top:4px">Gammes, sous-gammes, fabricants et modèles disponibles à la création de dossier.</div>
        </div>
        <button class="btn btn-p btn-sm" onclick="showCatalogueForm()">${icon('plus',14)} Ajouter une entrée</button>
      </div>

      <div id="catalogueFormZone" style="display:none;margin-bottom:20px"></div>

      <div id="catalogueList"></div>
    </div>`;
  renderCatalogueList();
}

function renderCatalogueList() {
  const gammes = catalogueGammes();
  const cont = document.getElementById('catalogueList');
  if (!_catalogue.length) {
    cont.innerHTML = '<div style="color:var(--mut2);padding:30px 0;text-align:center">Aucune entrée de catalogue pour le moment.</div>';
    return;
  }
  cont.innerHTML = gammes.map(gamme => {
    const items = _catalogue.filter(c => c.gamme === gamme);
    if (!items.length) return '';
    const bySousGamme = {};
    items.forEach(it => {
      const key = it.sous_gamme || '—';
      if (!bySousGamme[key]) bySousGamme[key] = [];
      bySousGamme[key].push(it);
    });
    return `
      <div class="ic" style="margin-bottom:14px">
        <div class="ict" style="font-size:13px;color:var(--blk)">${gamme}</div>
        ${Object.entries(bySousGamme).map(([sg, list]) => `
          <div style="margin-bottom:10px">
            ${sg !== '—' ? `<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;margin:8px 0 6px">${sg}</div>` : ''}
            ${list.filter(it => it.fabricant || it.modele).map(it => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;background:#f7f7f4;border-radius:7px;margin-bottom:6px">
                <div style="min-width:0">
                  <div style="font-size:13px;font-weight:600">${it.fabricant||''} ${it.modele?'— '+it.modele:''}</div>
                  ${it.fiche_url?`<div style="font-size:11px;color:var(--gd);margin-top:2px">${icon('filetext',11)} Fiche technique liée</div>`:''}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                  <button class="btn btn-o btn-sm" style="border-color:var(--mid);color:var(--mut)" onclick="editCatalogueItem('${it.id}')">${icon('deviceFloppy',12)}</button>
                  <button class="btn btn-o btn-sm" style="border-color:#f0c0c0;color:#c0392b" onclick="deleteCatalogueItem('${it.id}')">${icon('x',12)}</button>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>`;
  }).join('');
}

function showCatalogueForm(existingId) {
  const editing = existingId ? _catalogue.find(c => c.id === existingId) : null;
  const gammes = GAMMES_BASE;

  document.getElementById('catalogueFormZone').style.display = 'block';
  document.getElementById('catalogueFormZone').innerHTML = `
    <div class="form-card">
      <div style="font-size:14px;font-weight:700;margin-bottom:14px">${editing?'Modifier':'Nouvelle'} entrée catalogue</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="fg">
          <label>Gamme</label>
          <select id="cat-gamme" style="padding:10px 12px;border:1.5px solid var(--mid);border-radius:7px;font-size:14px">
            ${gammes.map(g => `<option ${editing&&editing.gamme===g?'selected':''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>Sous-gamme (optionnel)</label><input id="cat-sousgamme" placeholder="ex: PVC, Alu, Hybride" value="${editing?.sous_gamme||''}"></div>
        <div class="fg"><label>Fabricant</label><input id="cat-fabricant" placeholder="ex: K-Line" value="${editing?.fabricant||''}"></div>
        <div class="fg"><label>Modèle</label><input id="cat-modele" placeholder="ex: Confort 70" value="${editing?.modele||''}"></div>
        <div class="fg" style="grid-column:1/-1"><label>Points forts (+)</label><textarea id="cat-plus" placeholder="Un avantage par ligne" style="min-height:60px">${editing?.plus||''}</textarea></div>
        <div class="fg" style="grid-column:1/-1"><label>Points faibles (-)</label><textarea id="cat-moins" placeholder="Un point d'attention par ligne" style="min-height:60px">${editing?.moins||''}</textarea></div>
        <div class="fg" style="grid-column:1/-1"><label>Lien fiche technique (Drive)</label><input id="cat-fiche" type="url" placeholder="https://drive.google.com/..." value="${editing?.fiche_url||''}"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-d btn-sm" onclick="document.getElementById('catalogueFormZone').style.display='none'">Annuler</button>
        <button class="btn btn-p btn-sm" onclick="saveCatalogueItem(${editing?`'${editing.id}'`:'null'})">${icon('check',13)} Enregistrer</button>
      </div>
    </div>`;
}

function editCatalogueItem(id) { showCatalogueForm(id); }

async function saveCatalogueItem(id) {
  const item = {
    gamme:      document.getElementById('cat-gamme').value,
    sous_gamme: document.getElementById('cat-sousgamme').value.trim(),
    fabricant:  document.getElementById('cat-fabricant').value.trim(),
    modele:     document.getElementById('cat-modele').value.trim(),
    plus:       document.getElementById('cat-plus').value.trim(),
    moins:      document.getElementById('cat-moins').value.trim(),
    fiche_url:  document.getElementById('cat-fiche').value.trim(),
  };
  if (id) {
    await sheetsWrite('catalogueUpdate', { id, fields: item });
    Object.assign(_catalogue.find(c => c.id === id), item);
  } else {
    await sheetsWrite('catalogueAdd', { item });
    // recharge pour récupérer l'id généré côté serveur
    await loadCatalogue();
  }
  showToast('✓ Catalogue mis à jour');
  document.getElementById('catalogueFormZone').style.display = 'none';
  renderCatalogueList();
}

async function deleteCatalogueItem(id) {
  if (!confirm('Supprimer cette entrée du catalogue ?')) return;
  await sheetsWrite('catalogueDelete', { id });
  _catalogue = _catalogue.filter(c => c.id !== id);
  renderCatalogueList();
  showToast('✓ Entrée supprimée');
}

// === CASCADE FORMULAIRE DE CRÉATION ===
function populateGammeSelect() {
  const sel = document.getElementById('fgam-select');
  if (!sel) return;
  const gammes = catalogueGammes();
  sel.innerHTML = '<option value="">— Choisir —</option>' + gammes.map(g => `<option value="${g}">${g}</option>`).join('');
  ['fsousgamme-wrap','ffabricant-wrap','fmodele-wrap','ffiche-wrap'].forEach(id => document.getElementById(id).style.display='none');
}

function onGammeChange() {
  const gamme = document.getElementById('fgam-select').value;
  ['fsousgamme-wrap','ffabricant-wrap','fmodele-wrap','ffiche-wrap'].forEach(id => document.getElementById(id).style.display='none');
  if (!gamme) return;

  const sousGammes = catalogueSousGammes(gamme);
  if (sousGammes.length) {
    document.getElementById('fsousgamme-wrap').style.display = 'flex';
    const sel = document.getElementById('fsousgamme-select');
    sel.innerHTML = '<option value="">— Choisir —</option>' + sousGammes.map(sg => `<option value="${sg}">${sg}</option>`).join('');
  } else {
    populateFabricants(gamme, '');
  }
}

function onSousGammeChange() {
  const gamme = document.getElementById('fgam-select').value;
  const sousGamme = document.getElementById('fsousgamme-select').value;
  document.getElementById('ffabricant-wrap').style.display = 'none';
  document.getElementById('fmodele-wrap').style.display = 'none';
  document.getElementById('ffiche-wrap').style.display = 'none';
  if (sousGamme === undefined) return;
  populateFabricants(gamme, sousGamme);
}

function populateFabricants(gamme, sousGamme) {
  const fabricants = catalogueFabricants(gamme, sousGamme);
  if (!fabricants.length) return;
  document.getElementById('ffabricant-wrap').style.display = 'flex';
  const sel = document.getElementById('ffabricant-select');
  sel.innerHTML = '<option value="">— Choisir —</option>' + fabricants.map(f => `<option value="${f}">${f}</option>`).join('');
}

function onFabricantChange() {
  const gamme = document.getElementById('fgam-select').value;
  const sousGamme = document.getElementById('fsousgamme-select')?.value || '';
  const fabricant = document.getElementById('ffabricant-select').value;
  document.getElementById('fmodele-wrap').style.display = 'none';
  document.getElementById('ffiche-wrap').style.display = 'none';
  if (!fabricant) return;

  const modeles = catalogueModeles(gamme, sousGamme, fabricant);
  if (!modeles.length) return;
  document.getElementById('fmodele-wrap').style.display = 'flex';
  const sel = document.getElementById('fmodele-select');
  sel.innerHTML = '<option value="">— Choisir —</option>' + modeles.map(m => `<option value="${m.modele}">${m.modele}</option>`).join('');
}

function onModeleChange() {
  const gamme = document.getElementById('fgam-select').value;
  const sousGamme = document.getElementById('fsousgamme-select')?.value || '';
  const fabricant = document.getElementById('ffabricant-select')?.value || '';
  const modele = document.getElementById('fmodele-select').value;
  const ficheWrap = document.getElementById('ffiche-wrap');
  if (!modele) { ficheWrap.style.display = 'none'; return; }

  const entry = catalogueEntry(gamme, sousGamme, fabricant, modele);
  if (!entry) { ficheWrap.style.display = 'none'; return; }

  ficheWrap.style.display = 'block';
  document.getElementById('ffiche-link').value = entry.fiche_url || '';
  const plusMoinsEl = document.getElementById('fplusmoins');
  const plusHtml = entry.plus ? `<div style="color:var(--gd)"><strong>+</strong> ${entry.plus.split('\\n').join(' · ')}</div>` : '';
  const moinsHtml = entry.moins ? `<div style="color:#a05a00;margin-top:3px"><strong>−</strong> ${entry.moins.split('\\n').join(' · ')}</div>` : '';
  plusMoinsEl.innerHTML = plusHtml + moinsHtml;

  const btn = document.querySelector('#ffiche-wrap .btn');
  if (btn) btn.style.display = entry.fiche_url ? 'inline-flex' : 'none';
}

// Construit la chaîne "gamme" finale à enregistrer dans le dossier client
function getSelectedGammeLabel() {
  const gamme = document.getElementById('fgam-select')?.value || '';
  const sousGamme = document.getElementById('fsousgamme-select')?.value || '';
  if (!gamme) return '';
  return sousGamme ? `${gamme} (${sousGamme})` : gamme;
}
function getSelectedModeleLabel() {
  const fabricant = document.getElementById('ffabricant-select')?.value || '';
  const modele = document.getElementById('fmodele-select')?.value || '';
  if (!fabricant && !modele) return '';
  return [fabricant, modele].filter(Boolean).join(' — ');
}
