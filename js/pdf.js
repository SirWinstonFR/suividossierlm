// ============================================================
// pdf.js — Lecteur PDF + Signature canvas (look pro) + Export
// ============================================================
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let _pdfDoc=null,_pdfPage=1,_pdfTotal=1,_pdfScale=1.4,_pdfBytes=null,_pdfName='document.pdf',_pdfScrolled=false;
let _sigCanvas=null,_sigCtx=null,_sigDrawing=false,_sigDone=false,_sigDataUrl=null;

async function pdfLoad(file) {
  _pdfName = file.name;
  const ab = await file.arrayBuffer();
  _pdfBytes = new Uint8Array(ab);
  _pdfDoc = await pdfjsLib.getDocument({ data: _pdfBytes.slice() }).promise;
  _pdfTotal = _pdfDoc.numPages;
  _pdfPage = 1;
  _pdfScrolled = _pdfTotal === 1;
  await pdfRender(_pdfPage);
  pdfUpdateUI();
}

// Charge un PDF depuis Drive en passant par Apps Script (contourne le blocage CORS de Drive)
async function pdfLoadFromUrl(url, fileName) {
  const apiUrl = `${CFG.SCRIPT_URL}?action=getFile&url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error('Erreur serveur (statut ' + res.status + ')');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Document introuvable ou non accessible');

  const byteChars = atob(data.base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const file = new File([blob], fileName || data.fileName || 'document.pdf', { type: 'application/pdf' });
  await pdfLoad(file);
}

async function pdfRender(n) {
  const page = await _pdfDoc.getPage(n);
  // Rendu haute résolution pour un meilleur rendu (moins "aplati")
  const outputScale = window.devicePixelRatio || 1.5;
  const vp = page.getViewport({ scale: _pdfScale });
  const cv = document.getElementById('pdf-canvas');
  cv.width  = Math.floor(vp.width * outputScale);
  cv.height = Math.floor(vp.height * outputScale);
  cv.style.width  = Math.floor(vp.width) + 'px';
  cv.style.height = Math.floor(vp.height) + 'px';
  const ctx = cv.getContext('2d');
  const transform = outputScale !== 1 ? [outputScale,0,0,outputScale,0,0] : null;
  await page.render({ canvasContext: ctx, viewport: vp, transform }).promise;
}

function pdfUpdateUI() {
  const i = document.getElementById('pdf-page-info');
  if (i) i.textContent = _pdfPage + ' / ' + _pdfTotal;
  const z = document.getElementById('pdf-zoom-label');
  if (z) z.textContent = Math.round(_pdfScale * 100) + '%';
  const hint = document.getElementById('pdf-scroll-hint');
  const btn  = document.getElementById('btn-go-sign');
  if (_pdfScrolled) {
    if (hint) hint.style.display = 'none';
    if (btn)  btn.disabled = false;
  } else {
    if (hint) hint.style.display = 'flex';
    if (btn)  btn.disabled = true;
  }
}

async function pdfPrev() { if (_pdfPage > 1) { _pdfPage--; await pdfRender(_pdfPage); pdfUpdateUI(); } }
async function pdfNext() {
  if (_pdfPage < _pdfTotal) { _pdfPage++; await pdfRender(_pdfPage); }
  if (_pdfPage === _pdfTotal) _pdfScrolled = true;
  pdfUpdateUI();
}
async function pdfZoom(d) {
  _pdfScale = Math.min(Math.max(_pdfScale + d, 0.6), 3);
  await pdfRender(_pdfPage);
  pdfUpdateUI();
}
function pdfOnScroll() {
  if (_pdfScrolled) return;
  const w = document.getElementById('pdf-canvas-wrap');
  if (w && w.scrollTop + w.clientHeight >= w.scrollHeight - 10 && _pdfPage === _pdfTotal) {
    _pdfScrolled = true; pdfUpdateUI();
  }
}

// === SIGNATURE — version pro ===
function sigInit() {
  _sigCanvas = document.getElementById('sig-canvas');
  _sigCtx = _sigCanvas.getContext('2d');
  const wrap = document.getElementById('sig-wrap');
  const dpr = window.devicePixelRatio || 2;
  const w = wrap?.clientWidth || 560;
  const h = 170;
  _sigCanvas.width  = w * dpr;
  _sigCanvas.height = h * dpr;
  _sigCanvas.style.width  = w + 'px';
  _sigCanvas.style.height = h + 'px';
  _sigCtx.scale(dpr, dpr);
  _sigCtx.strokeStyle = '#1a1a1a';
  _sigCtx.lineWidth = 2.4;
  _sigCtx.lineCap = 'round';
  _sigCtx.lineJoin = 'round';
  _sigDone = false;

  const xy = e => {
    const r = _sigCanvas.getBoundingClientRect();
    if (e.touches) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  _sigCanvas.onmousedown  = e => { _sigDrawing = true; const p = xy(e); _sigCtx.beginPath(); _sigCtx.moveTo(p.x, p.y); };
  _sigCanvas.onmousemove  = e => { if (!_sigDrawing) return; const p = xy(e); _sigCtx.lineTo(p.x, p.y); _sigCtx.stroke(); sigMark(); };
  _sigCanvas.onmouseup    = () => _sigDrawing = false;
  _sigCanvas.onmouseleave = () => _sigDrawing = false;
  _sigCanvas.ontouchstart = e => { e.preventDefault(); _sigDrawing = true; const p = xy(e); _sigCtx.beginPath(); _sigCtx.moveTo(p.x, p.y); };
  _sigCanvas.ontouchmove  = e => { e.preventDefault(); if (!_sigDrawing) return; const p = xy(e); _sigCtx.lineTo(p.x, p.y); _sigCtx.stroke(); sigMark(); };
  _sigCanvas.ontouchend   = () => _sigDrawing = false;
}

function sigMark() {
  if (_sigDone) return; _sigDone = true;
  const ph = document.getElementById('sig-placeholder');
  if (ph) ph.style.display = 'none';
  const btn = document.getElementById('btn-valider');
  if (btn) btn.disabled = false;
}

function sigClear() {
  if (_sigCtx && _sigCanvas) {
    const dpr = window.devicePixelRatio || 2;
    _sigCtx.clearRect(0, 0, _sigCanvas.width/dpr, _sigCanvas.height/dpr);
  }
  _sigDone = false;
  const ph = document.getElementById('sig-placeholder');
  if (ph) ph.style.display = 'block';
  const btn = document.getElementById('btn-valider');
  if (btn) btn.disabled = true;
}

// Stocke la signature de façon persistante pour réutilisation
function sigGetDataUrl() {
  return _sigCanvas.toDataURL('image/png');
}

async function pdfGenSigned(sigDataUrlOverride) {
  const sigDataUrl = sigDataUrlOverride || (_sigDone ? sigGetDataUrl() : null);
  if (!sigDataUrl) { showToast('Merci de tracer votre signature.'); return null; }

  const sigAB = await (await (await fetch(sigDataUrl)).blob()).arrayBuffer();
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const doc  = await PDFDocument.load(_pdfBytes.buffer.slice(0));
  const last = doc.getPages()[doc.getPages().length - 1];
  const { width } = last.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const img  = await doc.embedPng(sigAB);

  const bw=240, bh=95, bx=width-bw-24, by=22;
  last.drawRectangle({ x:bx-8, y:by-8, width:bw+16, height:bh+16, borderColor:rgb(.47,.75,.13), borderWidth:1, color:rgb(.97,1,.95) });
  last.drawLine({ start:{x:bx-8,y:by+bh+8}, end:{x:bx+bw+8,y:by+bh+8}, thickness:.5, color:rgb(.47,.75,.13) });
  last.drawText('Signature électronique', { x:bx-6, y:by+bh+12, size:8, font:fontBold, color:rgb(.21,.43,.05) });

  const now = new Date();
  const ds  = now.toLocaleDateString('fr-FR') + ' ' + String(now.getHours()).padStart(2,'0') + 'h' + String(now.getMinutes()).padStart(2,'0');
  last.drawText('Signé le : ' + ds, { x:bx, y:by+12, size:8, font, color:rgb(.3,.3,.3) });
  const dims = img.scaleToFit(bw-10, bh-28);
  last.drawImage(img, { x:bx+(bw-dims.width)/2, y:by+22, width:dims.width, height:dims.height });

  return { bytes: await doc.save(), dateStr: ds, fileName: _pdfName.replace(/\.pdf$/i,'') + '_signé.pdf' };
}
