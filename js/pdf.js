// ============================================================
// pdf.js — Lecteur PDF + Signature canvas + Export PDF signé
// ============================================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let _pdfDoc = null, _pdfPage = 1, _pdfTotal = 1, _pdfScale = 1.3;
let _pdfBytes = null, _pdfFileName = 'devis.pdf';
let _sigCanvas = null, _sigCtx = null, _sigDrawing = false, _sigDone = false, _pdfScrolled = false;

async function pdfLoad(file) {
  _pdfFileName = file.name;
  const ab = await file.arrayBuffer();
  _pdfBytes = new Uint8Array(ab);
  const task = pdfjsLib.getDocument({ data: _pdfBytes.slice() });
  _pdfDoc = await task.promise;
  _pdfTotal = _pdfDoc.numPages;
  _pdfPage = 1;
  _pdfScrolled = _pdfTotal === 1;
  await pdfRender(_pdfPage);
  pdfUpdateUI();
}

async function pdfRender(n) {
  if (!_pdfDoc) return;
  const page = await _pdfDoc.getPage(n);
  const vp = page.getViewport({ scale: _pdfScale });
  const canvas = document.getElementById('pdf-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = vp.width;
  canvas.height = vp.height;
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
}

function pdfUpdateUI() {
  const info = document.getElementById('pdf-page-info');
  if (info) info.textContent = `Page ${_pdfPage} / ${_pdfTotal}`;
  const zoom = document.getElementById('pdf-zoom-label');
  if (zoom) zoom.textContent = Math.round(_pdfScale * 100) + '%';
  pdfCheckScroll();
}

function pdfCheckScroll() {
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

async function pdfPrev() {
  if (_pdfPage > 1) { _pdfPage--; await pdfRender(_pdfPage); pdfUpdateUI(); }
}
async function pdfNext() {
  if (_pdfPage < _pdfTotal) {
    _pdfPage++;
    await pdfRender(_pdfPage);
    if (_pdfPage === _pdfTotal) { _pdfScrolled = true; }
    pdfUpdateUI();
  }
}
async function pdfZoom(d) {
  _pdfScale = Math.min(Math.max(_pdfScale + d, 0.5), 3);
  await pdfRender(_pdfPage);
  pdfUpdateUI();
}

function pdfOnScroll() {
  if (_pdfScrolled) return;
  const w = document.getElementById('pdf-canvas-wrap');
  if (w && w.scrollTop + w.clientHeight >= w.scrollHeight - 10 && _pdfPage === _pdfTotal) {
    _pdfScrolled = true;
    pdfUpdateUI();
  }
}

// --- SIGNATURE ---
function sigInit() {
  _sigCanvas = document.getElementById('sig-canvas');
  _sigCtx = _sigCanvas.getContext('2d');
  const wrap = document.getElementById('sig-wrap');
  const w = (wrap?.clientWidth || 500) * 2;
  _sigCanvas.width = w;
  _sigCanvas.height = 260;
  _sigCanvas.style.height = '130px';
  _sigCtx.strokeStyle = '#1a1a1a';
  _sigCtx.lineWidth = 3;
  _sigCtx.lineCap = 'round';
  _sigCtx.lineJoin = 'round';
  _sigDone = false;

  const xy = (e) => {
    const r = _sigCanvas.getBoundingClientRect();
    const sx = _sigCanvas.width / r.width, sy = _sigCanvas.height / r.height;
    if (e.touches) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
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
  if (_sigDone) return;
  _sigDone = true;
  const ph = document.getElementById('sig-placeholder');
  if (ph) ph.style.display = 'none';
  const btn = document.getElementById('btn-valider');
  if (btn) btn.disabled = false;
}

function sigClear() {
  if (!_sigCtx || !_sigCanvas) return;
  _sigCtx.clearRect(0, 0, _sigCanvas.width, _sigCanvas.height);
  _sigDone = false;
  const ph = document.getElementById('sig-placeholder');
  if (ph) ph.style.display = 'block';
  const btn = document.getElementById('btn-valider');
  if (btn) btn.disabled = true;
}

// --- GÉNÉRATION PDF SIGNÉ ---
async function pdfGenSigned() {
  if (!_sigDone) { showToast('Merci de tracer votre signature.'); return null; }
  const sigDataUrl = _sigCanvas.toDataURL('image/png');
  const sigResp = await fetch(sigDataUrl);
  const sigAB = await (await sigResp.blob()).arrayBuffer();

  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const doc = await PDFDocument.load(_pdfBytes.buffer.slice(0));
  const pages = doc.getPages();
  const last = pages[pages.length - 1];
  const { width, height } = last.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const img  = await doc.embedPng(sigAB);

  const bw = 230, bh = 85, bx = width - bw - 24, by = 20;
  last.drawRectangle({ x: bx - 8, y: by - 8, width: bw + 16, height: bh + 16, borderColor: rgb(.47,.75,.13), borderWidth: 1, color: rgb(.97,1,.95) });
  last.drawLine({ start: { x: bx-8, y: by+bh+8 }, end: { x: bx+bw+8, y: by+bh+8 }, thickness: .5, color: rgb(.47,.75,.13) });
  last.drawText('Lu et approuvé — Signature électronique', { x: bx-6, y: by+bh+12, size: 7, font, color: rgb(.35,.57,.09) });

  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR') + ' ' + String(now.getHours()).padStart(2,'0') + 'h' + String(now.getMinutes()).padStart(2,'0');
  last.drawText('Signé le : ' + dateStr, { x: bx, y: by + 10, size: 8, font, color: rgb(.3,.3,.3) });
  last.drawText('Document : ' + _pdfFileName, { x: bx, y: by + 2, size: 7, font, color: rgb(.5,.5,.5) });

  const dims = img.scaleToFit(bw, bh - 20);
  last.drawImage(img, { x: bx + (bw - dims.width) / 2, y: by + 18, width: dims.width, height: dims.height });

  const out = await doc.save();
  return { bytes: out, dateStr, fileName: _pdfFileName.replace(/\.pdf$/i, '') + '_signé.pdf' };
}
