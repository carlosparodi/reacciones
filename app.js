// Estudio de Reacciones — versión móvil web (PWA). Se abre con un link y se instala desde
// Safari (iPhone) o Chrome (Android) con "Añadir a pantalla de inicio". No usa App Store.
// Trae las opciones del estudio de escritorio: introducción, pausa en pantalla completa o con el
// video quieto, ponerte arriba o abajo, encuadre, sonido, fondo y recorte del video, fondo detrás
// de ti (recorte de silueta), marca de agua y subtítulos en vivo.
'use strict';
const $ = id => document.getElementById(id);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
const RECO = window.SpeechRecognition || window.webkitSpeechRecognition;   // reconocimiento de voz (subtítulos)

const W = 1080, H = 1920;
const cv = $('lienzo'), ctx = cv.getContext('2d');
const vid = document.createElement('video');
vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.preload = 'auto';
const cam = document.createElement('video');
cam.playsInline = true; cam.setAttribute('playsinline', ''); cam.muted = true; cam.autoplay = true;

/* ---------------- Ajustes (se guardan en el teléfono) ---------------- */
const PRED = {
  intro: true,              // empezar tú en pantalla completa
  pausa: 'completa',        // al pausar: 'completa' (sales tú solo) o 'quieto' (el video se queda)
  arriba: false,            // tú arriba y el video abajo
  facing: 'user', espejo: true,
  split: 0.5,               // alto del video en pantalla dividida (0..1)
  soloEncuadre: 'normal',
  cT: { z: 1, x: 0, y: 0 }, // tu cámara en pantalla dividida
  cF: { z: 1, x: 0, y: 0 }, // tu cámara cuando sales tú solo
  volVideo: 80, volVoz: 100, eco: true, ruido: false,
  vFondo: 'lleno', vTam: 92, vRecX: 0, vRecY: 0,
  fondo: 'ninguno',
  marca: { on: false, tipo: 'texto', texto: '', estilo: 'sombra', pos: 'br', tam: 24, op: 85 },
  subs: { on: false, estilo: 'blanco' },
};
const copia = o => JSON.parse(JSON.stringify(o));
function mezclar(base, extra){
  for (const k in extra){
    if (!(k in base)) continue;
    if (base[k] && typeof base[k] === 'object') mezclar(base[k], extra[k] || {});
    else if (typeof extra[k] === typeof base[k]) base[k] = extra[k];
  }
  return base;
}
let A = copia(PRED);
try { const g = JSON.parse(localStorage.getItem('ajustes-v2') || 'null'); if (g) mezclar(A, g); } catch (e){}
let guardarT;
function guardar(){
  clearTimeout(guardarT);
  guardarT = setTimeout(() => { try { localStorage.setItem('ajustes-v2', JSON.stringify(A)); } catch (e){} }, 250);
}
const leer = k => k.split('.').reduce((o, p) => o && o[p], A);
function poner(k, v){
  const ps = k.split('.'); let o = A;
  while (ps.length > 1) o = o[ps.shift()];
  o[ps[0]] = v; guardar(); alCambiar(k, v);
}

const s = {
  topH: 0, camStream: null, hasVideo: false, ended: false, solo: false,
  vT: { z: 1, x: 0, y: 0 },
  rec: null, recStart: 0, saver: null, audio: null, wake: null, sub: null,
};

/* ---------------- Utilidades ---------------- */
let toastT;
function toast(msg, ms = 2600){
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms);
}
const fmt = sec => { sec = Math.max(0, sec | 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
function mostrar(id){ ['inicio', 'estudio', 'visor'].forEach(p => $(p).hidden = p !== id); }
const enEstudio = () => !$('estudio').hidden;

// Imagen o video guardado (logo, fondos): se carga desde un Blob
function medio(blob){
  const m = { el: null, ok: false, url: URL.createObjectURL(blob), video: (blob.type || '').startsWith('video') };
  if (m.video){
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.src = m.url;
    v.onloadeddata = () => { m.ok = true; v.play().catch(() => {}); };
    m.el = v;
  } else { const i = new Image(); i.onload = () => { m.ok = true; }; i.src = m.url; m.el = i; }
  return m;
}
function soltarMedio(m){
  if (!m) return;
  if (m.video){ m.el.pause(); m.el.removeAttribute('src'); m.el.load(); }
  URL.revokeObjectURL(m.url);
}
const tamDe = el => [el.videoWidth || el.naturalWidth || el.width || 0, el.videoHeight || el.naturalHeight || el.height || 0];
const extras = { logo: null, fondoVideo: null, fondoCam: null };

/* ---------------- Cámara y audio ---------------- */
async function abrirCamara(){
  pararCamara();
  const pedir = c => navigator.mediaDevices.getUserMedia(c);
  // 4:3 usa todo el sensor (como la cámara del teléfono en modo foto). Pedir 9:16 recorta los lados y se ve como con zoom.
  // resizeMode 'none': que el navegador no recorte la imagen para ajustarla al tamaño pedido.
  const video = { facingMode: A.facing, width: { ideal: 1920 }, height: { ideal: 1440 }, frameRate: { ideal: 30 }, resizeMode: 'none' };
  const audio = { echoCancellation: A.eco, noiseSuppression: A.ruido, autoGainControl: true };
  let st;
  try { st = await pedir({ video, audio }); }
  catch (e){
    try { st = await pedir({ video }); toast('No se pudo usar el micrófono. Revisa los permisos del navegador.'); }
    catch (e2){ $('aviso').textContent = 'Permite la cámara y el micrófono para usar el estudio. En iPhone: Ajustes › Safari › Cámara y Micrófono › Permitir.'; throw e2; }
  }
  if (!enEstudio()){ st.getTracks().forEach(t => t.stop()); return; }
  s.camStream = st; cam.srcObject = st;
  try { await cam.play(); } catch (e){}
  conectarMic();
  actualizar();
}
function pararCamara(){
  if (s.camStream) s.camStream.getTracks().forEach(t => t.stop());
  s.camStream = null;
}
function audioBase(){
  if (s.audio) return s.audio;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const dest = ac.createMediaStreamDestination();
  const vidGain = ac.createGain();
  vidGain.connect(dest); vidGain.connect(ac.destination);   // el video suena por el parlante y queda en la grabación
  ac.createMediaElementSource(vid).connect(vidGain);
  const micGain = ac.createGain(); micGain.connect(dest);
  const medidor = ac.createAnalyser(); medidor.fftSize = 512; micGain.connect(medidor);
  s.audio = { ac, dest, vidGain, micGain, medidor, datos: new Uint8Array(512), micSrc: null };
  aplicarVolumen();
  return s.audio;
}
function aplicarVolumen(){
  if (!s.audio) return;
  s.audio.vidGain.gain.value = A.volVideo / 100;
  s.audio.micGain.gain.value = A.volVoz / 100;
}
function conectarMic(){
  const a = audioBase();
  if (a.micSrc){ try { a.micSrc.disconnect(); } catch (e){} a.micSrc = null; }
  if (s.camStream && s.camStream.getAudioTracks().length){
    a.micSrc = a.ac.createMediaStreamSource(new MediaStream(s.camStream.getAudioTracks()));
    a.micSrc.connect(a.micGain);
  }
}
async function despertarAudio(){ const a = audioBase(); if (a.ac.state === 'suspended') await a.ac.resume().catch(() => {}); }

// La pantalla no se apaga mientras estás en el estudio
async function pantallaEncendida(si){
  try {
    if (si && 'wakeLock' in navigator && !s.wake){ s.wake = await navigator.wakeLock.request('screen'); s.wake.onrelease = () => { s.wake = null; }; }
    else if (!si && s.wake){ await s.wake.release(); s.wake = null; }
  } catch (e){}
}

/* ---------------- Recorte de tu silueta (para poner un fondo detrás de ti) ---------------- */
// Modelo de MediaPipe: se descarga la primera vez que eliges un fondo y luego queda guardado.
const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const SEG_MODELO = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const seg = { estado: 'off', obj: null, mask: null, mctx: null, img: null, prev: null,
  persona: document.createElement('canvas'), pctx: null, ultimoT: -1, ultimo: 0, hay: false };
seg.pctx = seg.persona.getContext('2d');
seg.chica = document.createElement('canvas'); seg.cctx = seg.chica.getContext('2d', { willReadFrequently: false });
function segAviso(txt, error){
  const e = $('segEstado'); e.hidden = !txt; e.textContent = txt || ''; e.classList.toggle('err', !!error);
}
async function asegurarSeg(){
  if (seg.estado === 'cargando' || seg.estado === 'listo') return;
  seg.estado = 'cargando'; segAviso('Preparando el recorte de tu silueta…');
  try {
    const mp = await import(MP + '/vision_bundle.mjs');
    const archivos = await mp.FilesetResolver.forVisionTasks(MP + '/wasm');
    const op = d => ({ baseOptions: { modelAssetPath: SEG_MODELO, delegate: d }, runningMode: 'VIDEO', outputCategoryMask: false, outputConfidenceMasks: true });
    try { seg.obj = await mp.ImageSegmenter.createFromOptions(archivos, op('GPU')); }
    catch (e){ seg.obj = await mp.ImageSegmenter.createFromOptions(archivos, op('CPU')); }
    seg.estado = 'listo'; segAviso('');
  } catch (e){
    seg.estado = 'error';
    segAviso('No se pudo preparar el recorte. Revisa tu internet y vuelve a elegir el fondo.', true);
  }
}
function actualizarPersona(){
  if (seg.estado !== 'listo' || !cam.videoWidth) return false;
  const ahora = performance.now();
  if (ahora - seg.ultimo < 60 || cam.currentTime === seg.ultimoT) return seg.hay;   // unas 18 veces por segundo
  seg.ultimoT = cam.currentTime; seg.ultimo = ahora;
  const cw = cam.videoWidth, ch = cam.videoHeight;
  // Se analiza una copia pequeña de la cámara: mucho más liviano para el celular
  const k = Math.min(1, 384 / Math.max(cw, ch)), ew = Math.round(cw * k), eh = Math.round(ch * k);
  if (seg.chica.width !== ew || seg.chica.height !== eh){ seg.chica.width = ew; seg.chica.height = eh; }
  seg.cctx.drawImage(cam, 0, 0, ew, eh);
  try {
    seg.obj.segmentForVideo(seg.chica, ahora, res => {
      const ms = res.confidenceMasks; if (!ms || !ms.length) return;
      const m = ms[0], mw = m.width, mh = m.height, d = m.getAsFloat32Array();
      const fondoPrimero = ms.length > 1;
      if (!seg.mask || seg.mask.width !== mw || seg.mask.height !== mh){
        seg.mask = document.createElement('canvas'); seg.mask.width = mw; seg.mask.height = mh;
        seg.mctx = seg.mask.getContext('2d'); seg.img = seg.mctx.createImageData(mw, mh); seg.prev = new Float32Array(mw * mh);
      }
      const px = seg.img.data, prev = seg.prev;
      for (let i = 0, j = 3; i < d.length; i++, j += 4){
        let v = fondoPrimero ? 1 - d[i] : d[i];
        v = prev[i] * 0.35 + v * 0.65; prev[i] = v;           // suaviza el parpadeo del borde
        v = (v - 0.3) / 0.45; px[j] = v <= 0 ? 0 : v >= 1 ? 255 : v * 255;
      }
      seg.mctx.putImageData(seg.img, 0, 0);
      if (seg.persona.width !== cw || seg.persona.height !== ch){ seg.persona.width = cw; seg.persona.height = ch; }
      const p = seg.pctx;
      p.globalCompositeOperation = 'copy'; p.drawImage(cam, 0, 0, cw, ch);
      p.globalCompositeOperation = 'destination-in'; p.imageSmoothingEnabled = true; p.drawImage(seg.mask, 0, 0, cw, ch);
      p.globalCompositeOperation = 'source-over';
      seg.hay = true;
    });
  } catch (e){ /* un cuadro que falla no detiene nada */ }
  return seg.hay;
}

/* ---------------- Dibujo ---------------- */
// Dibuja src (recortado a sx,sy,sw,sh) dentro del rectángulo. 'llenar' recorta para llenar; 'entero' lo deja completo.
function encuadre(src, sx, sy, sw, sh, rx, ry, rw, rh, t, espejo, modo, escala = 1){
  if (!sw || !sh || rw <= 0 || rh <= 0) return;
  const base = modo === 'entero' ? Math.min(rw / sw, rh / sh) : Math.max(rw / sw, rh / sh);
  const k = base * t.z * escala, dw = sw * k, dh = sh * k;
  const mx = Math.abs(dw - rw) / 2, my = Math.abs(dh - rh) / 2;
  t.x = limitar(t.x, -mx, mx); t.y = limitar(t.y, -my, my);
  const dx = rx + (rw - dw) / 2 + t.x, dy = ry + (rh - dh) / 2 + t.y;
  ctx.save();
  ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
  if (espejo){ ctx.translate(rx * 2 + rw, 0); ctx.scale(-1, 1); }
  ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}
function cubrir(el, rx, ry, rw, rh){
  const [w, h] = tamDe(el); if (!w || !h) return;
  encuadre(el, 0, 0, w, h, rx, ry, rw, rh, { z: 1, x: 0, y: 0 }, false, 'llenar');
}
// Desenfoque que funciona en cualquier navegador: se achica mucho la imagen y se vuelve a estirar
const borr = document.createElement('canvas'), bctx = borr.getContext('2d');
function borroso(src, sx, sy, sw, sh, rx, ry, rw, rh, espejo, oscurecer = 0.3){
  if (!sw || !sh) return;
  const tw = Math.max(6, Math.round(rw / 28)), th = Math.max(6, Math.round(rh / 28));
  if (borr.width !== tw || borr.height !== th){ borr.width = tw; borr.height = th; }
  const k = Math.max(tw / sw, th / sh);
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(src, sx, sy, sw, sh, (tw - sw * k) / 2, (th - sh * k) / 2, sw * k, sh * k);
  ctx.save();
  ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
  if (espejo){ ctx.translate(rx * 2 + rw, 0); ctx.scale(-1, 1); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(borr, rx, ry, rw, rh);
  ctx.restore();
  if (oscurecer){ ctx.fillStyle = `rgba(0,0,0,${oscurecer})`; ctx.fillRect(rx, ry, rw, rh); }
}
// Fondos listos (degradados)
const DEGRADADOS = { grafito: ['#3a3733', '#0d0d0e'], dorado: ['#8a6c34', '#1a1408'], noche: ['#2c4170', '#07090f'] };
const degCache = {};
function degradado(nombre){
  if (degCache[nombre]) return degCache[nombre];
  const c = document.createElement('canvas'); c.width = 540; c.height = 960;
  const g = c.getContext('2d'), [a, b] = DEGRADADOS[nombre];
  const r = g.createRadialGradient(270, 330, 20, 270, 420, 820);
  r.addColorStop(0, a); r.addColorStop(1, b);
  g.fillStyle = r; g.fillRect(0, 0, 540, 960);
  return degCache[nombre] = c;
}

function dibujarVideo(x, y, w, h){
  const vw = vid.videoWidth, vh = vid.videoHeight; if (!vw) return;
  const rx = A.vRecX / 100, ry = A.vRecY / 100;
  const sx = vw * rx, sw = vw * (1 - 2 * rx), sy = vh * ry, sh = vh * (1 - 2 * ry);
  if (A.vFondo === 'lleno'){ encuadre(vid, sx, sy, sw, sh, x, y, w, h, s.vT, false, 'llenar'); return; }
  if (A.vFondo === 'desenfocado') borroso(vid, sx, sy, sw, sh, x, y, w, h, false, 0.25);
  else if (A.vFondo === 'imagen' && extras.fondoVideo && extras.fondoVideo.ok) cubrir(extras.fondoVideo.el, x, y, w, h);
  else { ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); }
  encuadre(vid, sx, sy, sw, sh, x, y, w, h, s.vT, false, 'entero', A.vTam / 100);
}
function fondoCam(x, y, w, h){
  const f = A.fondo;
  if (f === 'desenfocado') borroso(cam, 0, 0, cam.videoWidth, cam.videoHeight, x, y, w, h, A.espejo, 0.1);
  else if (DEGRADADOS[f]) cubrir(degradado(f), x, y, w, h);
  else if (f === 'galeria' && extras.fondoCam && extras.fondoCam.ok) cubrir(extras.fondoCam.el, x, y, w, h);
  else { ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); }
}
function dibujarCam(x, y, w, h, t){
  const cw = cam.videoWidth, ch = cam.videoHeight; if (!cw) return;
  // Se puede alejar hasta verte completo; lo que sobra se rellena con tu misma imagen desenfocada
  const zMin = Math.min(w / cw, h / ch) / Math.max(w / cw, h / ch);
  if (t.z < zMin) t.z = zMin;
  const conFondo = A.fondo !== 'ninguno' && actualizarPersona();
  if (!conFondo && t.z < 0.999) borroso(cam, 0, 0, cw, ch, x, y, w, h, A.espejo, 0.2);
  if (conFondo){
    fondoCam(x, y, w, h);
    encuadre(seg.persona, 0, 0, cw, ch, x, y, w, h, t, A.espejo, 'llenar');
  } else {
    encuadre(cam, 0, 0, cw, ch, x, y, w, h, t, A.espejo, 'llenar');
  }
}
// Mientras el video aparece o se va, tu encuadre pasa suave del de "tú solo" al de pantalla dividida
const camTmp = { z: 1, x: 0, y: 0 };
function camT(th){
  const f = A.split > 0 ? th / (A.split * H) : 0;
  if (f <= 0.001) return A.cF;
  if (f >= 0.999) return A.cT;
  camTmp.z = A.cF.z + (A.cT.z - A.cF.z) * f;
  camTmp.x = A.cF.x + (A.cT.x - A.cF.x) * f;
  camTmp.y = A.cF.y + (A.cT.y - A.cF.y) * f;
  return camTmp;
}
function altoMeta(){
  if (!s.hasVideo || s.ended) return 0;
  if (!vid.paused) return A.split * H;
  return s.solo ? 0 : A.split * H;
}

/* Marca de agua */
function dibujarMarca(){
  const m = A.marca; if (!m.on) return;
  const pad = 56;
  let w, h, dibuja;
  if (m.tipo === 'logo'){
    const l = extras.logo; if (!l || !l.ok) return;
    const [iw, ih] = tamDe(l.el); if (!iw) return;
    w = W * m.tam / 100; h = w * ih / iw;
    dibuja = (x, y) => ctx.drawImage(l.el, x, y, w, h);
  } else {
    const txt = (m.texto || '').trim(); if (!txt) return;
    const fs = Math.round(18 + m.tam * 2);
    ctx.font = `800 ${fs}px Manrope, system-ui, sans-serif`;
    const tw = ctx.measureText(txt).width, cx = m.estilo === 'caja' ? fs * 0.5 : 0, cy = m.estilo === 'caja' ? fs * 0.3 : 0;
    w = tw + cx * 2; h = fs * 1.25 + cy * 2;
    dibuja = (x, y) => {
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const ty = y + h / 2;
      if (m.estilo === 'caja'){ ctx.fillStyle = 'rgba(0,0,0,.6)'; redondeado(x, y, w, h, fs * 0.3); ctx.fill(); }
      if (m.estilo === 'contorno'){ ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#000'; ctx.strokeText(txt, x + cx, ty); }
      if (m.estilo === 'sombra'){ ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = fs * 0.25; ctx.shadowOffsetY = fs * 0.06; }
      ctx.fillStyle = '#fff'; ctx.fillText(txt, x + cx, ty);
    };
  }
  const p = m.pos;
  const x = p.endsWith('l') ? pad : p.endsWith('r') ? W - pad - w : (W - w) / 2;
  const y = p.startsWith('t') ? pad + 40 : p.startsWith('b') ? H - pad - h - 40 : (H - h) / 2;
  ctx.save(); ctx.globalAlpha = m.op / 100; dibuja(x, y); ctx.restore();
}
function redondeado(x, y, w, h, r){
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* Subtítulos en vivo */
function dibujarSubs(camY, camH){
  if (!s.sub || Date.now() > s.sub.hasta) return;
  const fs = 62, maxW = W - 150;
  ctx.save();
  ctx.font = `800 ${fs}px Manrope, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const palabras = s.sub.texto.split(/\s+/), lineas = [];
  let l = '';
  for (const p of palabras){
    const prueba = l ? l + ' ' + p : p;
    if (ctx.measureText(prueba).width > maxW && l){ lineas.push(l); l = p; } else l = prueba;
  }
  if (l) lineas.push(l);
  const ver = lineas.slice(-2), lh = fs * 1.18;
  const base = camY + camH * 0.8 - (ver.length - 1) * lh / 2;
  const est = A.subs.estilo;
  ver.forEach((t, i) => {
    const y = base + i * lh;
    if (est === 'caja'){
      const tw = ctx.measureText(t).width + 40;
      ctx.fillStyle = 'rgba(0,0,0,.72)'; redondeado(W / 2 - tw / 2, y - lh / 2, tw, lh, 14); ctx.fill();
    } else { ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = '#000'; ctx.strokeText(t, W / 2, y); }
    ctx.fillStyle = est === 'amarillo' ? '#ffd83a' : '#fff'; ctx.fillText(t, W / 2, y);
  });
  ctx.restore();
}

let arrastrandoBarra = false, ultimoSeg = -1;
function dibujar(){
  const meta = altoMeta();
  s.topH += (meta - s.topH) * 0.22;
  if (Math.abs(meta - s.topH) < 1) s.topH = meta;
  const th = Math.round(s.topH);
  const vy = A.arriba ? H - th : 0, cy = A.arriba ? 0 : th, ch = H - th;

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (th > 0 && s.hasVideo) dibujarVideo(0, vy, W, th);
  if (cam.readyState >= 2) dibujarCam(0, cy, W, ch, camT(th));
  if (th > 4 && th < H - 4){ ctx.fillStyle = '#ffffff'; ctx.fillRect(0, (A.arriba ? H - th : th) - 2, W, 4); }
  dibujarSubs(cy, ch);
  dibujarMarca();

  if (s.rec) $('tiempo').textContent = fmt((Date.now() - s.recStart) / 1000);
  if (s.hasVideo && vid.duration){
    if (!arrastrandoBarra) $('barra').value = Math.round(vid.currentTime / vid.duration * 1000);
    const sg = vid.currentTime | 0;
    if (sg !== ultimoSeg){ ultimoSeg = sg; $('tAct').textContent = fmt(vid.currentTime); $('tDur').textContent = fmt(vid.duration); }
  }
  medirMic();
  requestAnimationFrame(dibujar);
}
function medirMic(){
  if (!s.audio || $('hoja').hidden || tabActual !== 'sonido') return;
  const a = s.audio; a.medidor.getByteTimeDomainData(a.datos);
  let pico = 0; for (const v of a.datos) pico = Math.max(pico, Math.abs(v - 128));
  const n = Math.min(1, pico / 110), m = $('medidor');
  m.style.width = (n * 100) + '%';
  m.style.background = n > 0.92 ? '#ff5c5c' : n > 0.7 ? '#e9cb5a' : '#5fd38d';
}

/* ---------------- Gestos: mover, zoom y línea del medio ---------------- */
const dedos = new Map();
let gesto = null, ultimoToque = 0;
function aLienzo(e){
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
function zonaEn(p){
  const th = s.topH;
  if (th <= 20) return 'cam';
  const linea = A.arriba ? H - th : th;
  if (Math.abs(p.y - linea) < 70) return 'linea';
  return (A.arriba ? p.y > H - th : p.y < th) ? 'video' : 'cam';
}
const camActual = () => s.topH > 20 ? A.cT : A.cF;
function iniciarGesto(){
  const pts = [...dedos.values()];
  const zona = gesto ? gesto.zona : zonaEn(pts[0]);
  const t = zona === 'video' ? s.vT : camActual();
  gesto = { zona, t, z0: t.z, x0: t.x, y0: t.y, c0: centro(pts), d0: dist(pts) };
}
const centro = p => p.length > 1 ? { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 } : p[0];
const dist = p => p.length > 1 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0;

cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  dedos.set(e.pointerId, aLienzo(e));
  if (dedos.size === 1){
    gesto = null;
    const ahora = Date.now();
    if (ahora - ultimoToque < 300){
      const z = zonaEn(aLienzo(e));
      if (z === 'video') s.vT = { z: 1, x: 0, y: 0 };
      if (z === 'cam'){ if (s.topH > 20) A.cT = { z: 1, x: 0, y: 0 }; else A.cF = { z: zoomSolo(A.soloEncuadre), x: 0, y: 0 }; }
      if (z === 'linea') A.split = 0.5;
      guardar(); pintarControles();
    }
    ultimoToque = ahora;
  }
  iniciarGesto();
});
cv.addEventListener('pointermove', e => {
  if (!dedos.has(e.pointerId) || !gesto) return;
  dedos.set(e.pointerId, aLienzo(e));
  const pts = [...dedos.values()], c = centro(pts);
  if (gesto.zona === 'linea'){
    A.split = limitar(A.arriba ? 1 - c.y / H : c.y / H, 0.2, 0.8); s.topH = A.split * H; return;
  }
  const t = gesto.t, esVideo = t === s.vT;
  const zMin = esVideo ? (A.vFondo === 'lleno' ? 1 : 0.5) : 0.3;
  if (pts.length > 1 && gesto.d0) t.z = limitar(gesto.z0 * dist(pts) / gesto.d0, zMin, esVideo ? 5 : 6);
  const espejo = !esVideo && A.espejo ? -1 : 1;
  t.x = gesto.x0 + (c.x - gesto.c0.x) * espejo; t.y = gesto.y0 + (c.y - gesto.c0.y);
});
const soltar = e => {
  dedos.delete(e.pointerId);
  if (dedos.size) iniciarGesto(); else { gesto = null; guardar(); pintarControles(); }
};
cv.addEventListener('pointerup', soltar);
cv.addEventListener('pointercancel', soltar);

/* ---------------- Video que comentas ---------------- */
$('archivo').onchange = e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (vid.src) URL.revokeObjectURL(vid.src);
  vid.src = URL.createObjectURL(f);
  s.hasVideo = true; s.ended = false; s.solo = false; s.vT = { z: 1, x: 0, y: 0 };
  audioBase();
  vid.onloadedmetadata = () => { vid.currentTime = 0.01; };
  actualizar();
  toast('Video listo. Toca ▶ para reproducirlo.');
};
vid.onended = () => { s.ended = true; actualizar(); };
vid.onplay = vid.onpause = () => actualizar();

function quitarVideo(){
  vid.pause();
  if (vid.src) URL.revokeObjectURL(vid.src);
  vid.removeAttribute('src'); vid.load();
  s.hasVideo = false; s.ended = false; s.solo = false;
  actualizar();
}
$('quitar').onclick = () => {
  if (s.rec){ toast('Termina la grabación para quitar el video.'); return; }
  quitarVideo(); toast('Video quitado. Toca Video para elegir otro.');
};

async function alternarVideo(){
  if (!s.hasVideo) return;
  await despertarAudio();
  if (vid.paused || vid.ended){
    if (vid.ended || s.ended){ vid.currentTime = 0; s.ended = false; }
    s.solo = false;
    try { await vid.play(); } catch (e){ toast('No se pudo reproducir este video.'); }
  } else {
    vid.pause();
    s.solo = A.pausa === 'completa';
  }
  actualizar();
}
$('play').onclick = alternarVideo;
$('solo').onclick = () => {
  if (!s.hasVideo || !vid.paused || s.ended) return;
  s.solo = !s.solo; actualizar();
};

const barra = $('barra');
barra.addEventListener('pointerdown', () => { arrastrandoBarra = true; });
['pointerup', 'pointercancel', 'change'].forEach(ev => barra.addEventListener(ev, () => { arrastrandoBarra = false; }));
barra.oninput = () => {
  if (!vid.duration) return;
  vid.currentTime = barra.value / 1000 * vid.duration;
  if (s.ended){ s.ended = false; actualizar(); }
};

function actualizar(){
  const sonando = s.hasVideo && !vid.paused && !vid.ended;
  $('playIco').setAttribute('href', sonando ? '#i-pausa' : s.ended ? '#i-repetir' : '#i-play');
  $('playTxt').textContent = sonando ? 'Pausar' : (s.ended ? 'Repetir' : 'Reproducir');
  $('play').disabled = !s.hasVideo;
  $('filaVideo').hidden = !s.hasVideo;
  const enPausa = s.hasVideo && !sonando && !s.ended;
  $('solo').disabled = !enPausa;
  $('solo').classList.toggle('on', enPausa && s.solo);
  $('soloIco').setAttribute('href', enPausa && s.solo ? '#i-dividir' : '#i-solo');
  $('solo').setAttribute('aria-label', enPausa && s.solo ? 'Ver el video' : 'Salir yo solo');

  let aviso = '';
  if (!s.camStream && enEstudio() && !cam.srcObject) aviso = 'Abriendo la cámara…';
  else if (!s.hasVideo && !s.rec) aviso = 'Toca Video para elegir de tu galería el video que vas a comentar.';
  if (!$('aviso').textContent.startsWith('Permite')) $('aviso').textContent = aviso;

  // Etiqueta: así sabes qué está pasando sin leer instrucciones
  let et = '';
  if (s.hasVideo && !s.rec && !sonando) et = 'Vista previa';
  if (s.rec && s.hasVideo && !sonando && !s.ended && s.solo) et = vid.currentTime < 0.2 ? 'Introducción' : 'Opinando';
  if (s.rec && s.ended) et = 'Tu conclusión';
  $('etiqueta').textContent = et; $('etiqueta').hidden = !et;

  // Riel
  $('rEspejo').classList.toggle('on', A.espejo);
  $('rLugarIco').setAttribute('href', A.arriba ? '#i-arriba' : '#i-abajo');
  $('rLugarTxt').textContent = A.arriba ? 'Yo arriba' : 'Yo abajo';
  $('rIntro').classList.toggle('on', A.intro); $('rIntro').classList.toggle('off', !A.intro);
  $('rFondo').classList.toggle('on', A.fondo !== 'ninguno');

  let pista = 'Mueve y haz zoom con los dedos. Arrastra la línea blanca para cambiar el tamaño. Doble toque restablece.';
  if (s.rec && s.hasVideo){
    pista = sonando ? 'Toca ▶ para pausar y opinar.' : s.ended ? 'Cierra con tu conclusión y toca el botón rojo para terminar.' : 'Toca ▶ para que aparezca el video.';
  } else if (s.rec) pista = 'Grabando. Toca el botón rojo para terminar.';
  $('pista').textContent = pista;
}

/* ---------------- Grabación ---------------- */
function elegirFormato(){
  const op = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
              'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return op.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
async function empezar(){
  if (!window.MediaRecorder){ toast('Este teléfono no permite grabar desde el navegador. Actualiza a iOS 15 o más nuevo.'); return; }
  if (!s.camStream){ toast('Primero permite la cámara.'); try { await abrirCamara(); } catch (e){} if (!s.camStream) return; }
  await despertarAudio();
  const a = audioBase();
  const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...a.dest.stream.getAudioTracks()]);
  const mime = elegirFormato();
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 }); }
  catch (e){ rec = new MediaRecorder(stream); }
  const tipo = rec.mimeType || mime || 'video/mp4';
  s.saver = await Almacen.nueva(tipo.includes('webm') ? 'webm' : 'mp4', tipo);
  const saver = s.saver;
  rec.ondataavailable = ev => { if (ev.data && ev.data.size) saver.agregar(ev.data); };
  rec.onstop = async () => {
    const r = await saver.terminar().catch(() => false);
    toast(r ? 'Grabación guardada ✔ Está en Tus grabaciones.' : 'No se pudo guardar la grabación.');
    cargarLista();
  };
  rec.start(1000);
  s.rec = rec; s.recStart = Date.now();
  if (s.hasVideo){
    if (s.ended){ vid.currentTime = 0; s.ended = false; }
    if (A.intro){ vid.pause(); s.solo = true; }           // empiezas tú en pantalla completa
    else { s.solo = false; vid.play().catch(() => {}); }  // sin introducción: el video arranca de una vez
  }
  $('grabar').classList.add('on'); $('grabar').setAttribute('aria-label', 'Terminar grabación');
  $('rec').hidden = false; $('estudio').classList.add('grabando');
  actualizar();
}
function detener(){
  if (!s.rec) return;
  s.rec.stop(); s.rec = null; vid.pause(); s.solo = false;
  $('grabar').classList.remove('on'); $('grabar').setAttribute('aria-label', 'Grabar');
  $('rec').hidden = true; $('estudio').classList.remove('grabando');
  actualizar();
}
$('grabar').onclick = () => s.rec ? detener() : empezar();

/* ---------------- Almacenamiento en el teléfono (IndexedDB) ---------------- */
// Pide que el navegador no borre las grabaciones para liberar espacio
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
let urls = [];
const db = new Promise((ok, mal) => {
  const r = indexedDB.open('estudio-movil', 2);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains('tomas')) d.createObjectStore('tomas', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('archivos')) d.createObjectStore('archivos');
  };
  r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
});
const tx = async (almacen, modo, fn) => { const d = await db; return new Promise((ok, mal) => {
  const t = d.transaction(almacen, modo), q = fn(t.objectStore(almacen));
  t.oncomplete = () => ok(q && q.result); t.onerror = () => mal(t.error);
}); };
const Archivos = {
  leer: k => tx('archivos', 'readonly', st => st.get(k)),
  poner: (k, blob) => tx('archivos', 'readwrite', st => st.put(blob, k)),
};
const Almacen = {
  async nueva(ext, tipo){
    const partes = [];
    return {
      agregar(b){ partes.push(b); },
      async terminar(){
        const fecha = Date.now();
        await tx('tomas', 'readwrite', st => st.put({ id: `reaccion-${fecha}.${ext}`, fecha, blob: new Blob(partes, { type: tipo }) }));
        return true;
      },
    };
  },
  async listar(){
    const todas = (await tx('tomas', 'readonly', st => st.getAll())) || [];
    urls.forEach(u => URL.revokeObjectURL(u));
    const r = todas.map(t => ({ ...t, src: URL.createObjectURL(t.blob) })).sort((a, b) => b.fecha - a.fecha);
    urls = r.map(t => t.src);
    return r;
  },
  async compartir(t){
    const f = new File([t.blob], t.id, { type: t.blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: 'Mi reacción' });
    const a = document.createElement('a'); a.href = t.src; a.download = t.id; a.click();
  },
  async borrar(t){ await tx('tomas', 'readwrite', st => st.delete(t.id)); },
};

/* ---------------- Inicio: lista de grabaciones ---------------- */
let tomas = [], actual = null;
async function cargarLista(){
  try { tomas = await Almacen.listar(); } catch (e){ tomas = []; }
  const ul = $('lista'); ul.innerHTML = '';
  $('vacio').hidden = tomas.length > 0;
  for (const t of tomas){
    const li = document.createElement('li');
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'metadata'; v.src = t.src + '#t=0.1';
    const info = document.createElement('div'); info.className = 'info';
    info.textContent = t.fecha ? new Date(t.fecha).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : t.id;
    li.append(v, info); li.onclick = () => abrirVisor(t);
    ul.append(li);
  }
}
function abrirVisor(t){
  actual = t;
  $('visorTitulo').textContent = 'Tu reacción';
  $('visorVideo').src = t.src;
  mostrar('visor');
}
$('cerrarVisor').onclick = () => { $('visorVideo').pause(); mostrar('inicio'); };
$('compartir').onclick = async () => {
  try { await Almacen.compartir(actual); } catch (e){ if (e && e.name !== 'AbortError') toast('No se pudo compartir.'); }
};
$('borrar').onclick = async () => {
  if (!actual || !confirm('¿Borrar esta grabación? No se puede deshacer.')) return;
  $('visorVideo').pause(); await Almacen.borrar(actual); actual = null;
  await cargarLista(); mostrar('inicio');
};

/* ---------------- Hoja de ajustes ---------------- */
let tabActual = 'grabar';
function abrirHoja(tab){
  const h = $('hoja'); h.hidden = false; $('estudio').classList.add('con-hoja');
  elegirTab(tab || tabActual); pintarControles();
  requestAnimationFrame(() => requestAnimationFrame(() => h.classList.add('abierta')));
}
function cerrarHoja(){
  const h = $('hoja'); h.classList.remove('abierta'); $('estudio').classList.remove('con-hoja');
  $('hoja').querySelector('.hoja-caja').style.transform = '';
  setTimeout(() => { if (!h.classList.contains('abierta')) h.hidden = true; }, 300);
}
function elegirTab(tab){
  tabActual = tab;
  $$('#pestanas button').forEach(b => {
    const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    if (on) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
  $$('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== tab);
  $('hoja').querySelector('.hoja-cuerpo').scrollTop = 0;
}
$$('#pestanas button').forEach(b => b.onclick = () => elegirTab(b.dataset.tab));
$$('[data-cerrar]').forEach(b => b.onclick = cerrarHoja);
// Deslizar hacia abajo para cerrar
(() => {
  const cab = $('hojaCab'), caja = $('hoja').querySelector('.hoja-caja');
  let y0 = null, dy = 0;
  cab.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; caja.style.transition = 'none'; cab.setPointerCapture(e.pointerId); });
  cab.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); caja.style.transform = `translateY(${dy}px)`; });
  const fin = () => { if (y0 === null) return; y0 = null; caja.style.transition = ''; if (dy > 70) cerrarHoja(); else caja.style.transform = ''; };
  cab.addEventListener('pointerup', fin); cab.addEventListener('pointercancel', fin);
})();

const FORMATO = { volVideo: v => v + '%', volVoz: v => v + '%', vTam: v => v + '%', vRecX: v => v + '%', vRecY: v => v + '%', 'marca.tam': v => v, 'marca.op': v => v + '%' };
function pintarControles(){
  $$('[data-a]').forEach(el => {
    const v = leer(el.dataset.a);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'range' || el.type === 'text'){ if (document.activeElement !== el) el.value = v; }
    else if (el.classList.contains('seg')) $$('button', el).forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
  });
  $$('output[data-de]').forEach(o => { const k = o.dataset.de; o.textContent = (FORMATO[k] || (v => v))(leer(k)); });
  // Encuadre
  const esp = Math.round((1 - A.split) * 100); $('espacio').value = esp; $('vEspacio').textContent = esp + '%';
  $('zVid').min = A.vFondo === 'lleno' ? 100 : 50;
  $('zVid').value = Math.round(s.vT.z * 100); $('vZVid').textContent = Math.round(s.vT.z * 100) + '%';
  $('zTxt').textContent = Math.round(camActual().z * 100) + '%';
  const ct = camActual(); $('zCam').value = Math.round(ct.z * 100); $('vZCam').textContent = Math.round(ct.z * 100) + '%';
  // Lo que depende de otras opciones
  $('campoTam').hidden = A.vFondo === 'lleno';
  $('cambiarFondoVideo').hidden = A.vFondo !== 'imagen' || !extras.fondoVideo;
  $('cambiarFondoCam').hidden = A.fondo !== 'galeria' || !extras.fondoCam;
  $('marcaTexto').hidden = A.marca.tipo !== 'texto';
  $('marcaLogo').hidden = A.marca.tipo !== 'logo';
  $('elegirLogo').textContent = extras.logo ? 'Cambiar imagen…' : 'Elegir imagen…';
  const mg = $('miniGaleria');
  if (extras.fondoCam && !extras.fondoCam.video){ mg.style.backgroundImage = `url("${extras.fondoCam.url}")`; mg.textContent = ''; }
  else { mg.style.backgroundImage = ''; mg.textContent = extras.fondoCam ? '🎞' : '＋'; }
  if (!RECO) $('subsNota').textContent = 'Este navegador no tiene reconocimiento de voz. Prueba en Chrome (Android) o en Safari actualizado (iPhone).';
}
const convertir = v => v === 'true' ? true : v === 'false' ? false : v;
$$('[data-a]').forEach(el => {
  const k = el.dataset.a;
  if (el.classList.contains('seg')) $$('button', el).forEach(b => b.onclick = () => { poner(k, convertir(b.dataset.v)); pintarControles(); });
  else if (el.type === 'checkbox') el.onchange = () => { poner(k, el.checked); pintarControles(); };
  else if (el.type === 'range') el.oninput = () => { poner(k, +el.value); pintarControles(); };
  else el.oninput = () => poner(k, el.value);
});
$('espacio').oninput = e => { A.split = 1 - e.target.value / 100; guardar(); pintarControles(); };
$('zVid').oninput = e => { s.vT.z = e.target.value / 100; pintarControles(); };
$('zCam').oninput = e => { camActual().z = e.target.value / 100; guardar(); pintarControles(); };
$('centrarVid').onclick = () => { s.vT = { z: 1, x: 0, y: 0 }; pintarControles(); };
$('centrarCam').onclick = () => { A.cT = { z: 1, x: 0, y: 0 }; A.cF = { z: zoomSolo(A.soloEncuadre), x: 0, y: 0 }; guardar(); pintarControles(); };
$('quitarRecortes').onclick = () => { A.vRecX = 0; A.vRecY = 0; guardar(); pintarControles(); };
$('restablecer').onclick = () => {
  if (!confirm('¿Volver todos los ajustes a como venían? Tus grabaciones no se borran.')) return;
  const facingAntes = A.facing, ecoAntes = A.eco, ruidoAntes = A.ruido;
  A = copia(PRED); s.vT = { z: 1, x: 0, y: 0 }; guardar(); aplicarVolumen();
  if (!A.subs.on) subsParar();
  if (enEstudio() && (facingAntes !== A.facing || ecoAntes !== A.eco || ruidoAntes !== A.ruido)) abrirCamara().catch(() => {});
  pintarControles(); actualizar(); toast('Ajustes restablecidos.');
};

// Zoom de tu cámara cuando sales tú solo
const zoomSolo = k => k === 'cerca' ? 1.6 : 1;

// Botones − y + sobre la imagen: acercan o alejan tu cámara
function zoomCam(f){
  const t = camActual(); t.z = limitar(Math.round(t.z * f * 100) / 100, 0.3, 6);
  if (Math.abs(t.z - 1) < 0.04) t.z = 1;
  guardar(); pintarControles();
}
$('zMenos').onclick = () => zoomCam(1 / 1.15);
$('zMas').onclick = () => zoomCam(1.15);

function alCambiar(k, v){
  switch (k){
    case 'facing':
      A.espejo = v === 'user';
      if (enEstudio()) abrirCamara().catch(() => {});
      break;
    case 'eco': case 'ruido':
      if (enEstudio()){ abrirCamara().catch(() => {}); toast(s.rec ? 'Cambiado. La cámara se reinicia un momento.' : 'Cambiado.'); }
      break;
    case 'volVideo': case 'volVoz': aplicarVolumen(); break;
    case 'soloEncuadre': A.cF = { z: zoomSolo(v), x: 0, y: 0 }; if (s.topH > 20) toast('Lo verás cuando salgas tú solo.'); break;
    case 'vFondo':
      if (v === 'lleno') s.vT.z = Math.max(1, s.vT.z);
      if (v === 'imagen' && !extras.fondoVideo) $('fondoVideoArchivo').click();
      break;
    case 'fondo':
      if (v !== 'ninguno') asegurarSeg();
      if (v === 'galeria' && !extras.fondoCam) $('fondoCamArchivo').click();
      break;
    case 'marca.tipo': if (v === 'logo' && !extras.logo) $('logoArchivo').click(); break;
    case 'marca.on': if (v && A.marca.tipo === 'texto' && !A.marca.texto.trim()) setTimeout(() => $$('[data-a="marca.texto"]')[0].focus(), 50); break;
    case 'subs.on':
      if (v && !RECO){ A.subs.on = false; guardar(); toast('Este celular no tiene reconocimiento de voz en el navegador.'); }
      else if (v && enEstudio()) subsIniciar();
      else if (!v) subsParar();
      break;
  }
  actualizar();
}

// Archivos elegidos de la galería: se guardan para la próxima vez
function elegirArchivo(input, clave, alListo){
  input.onchange = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    soltarMedio(extras[clave]); extras[clave] = medio(f);
    try { await Archivos.poner(clave, f); } catch (er){}
    alListo(); pintarControles();
  };
}
elegirArchivo($('fondoVideoArchivo'), 'fondoVideo', () => { A.vFondo = 'imagen'; guardar(); });
elegirArchivo($('fondoCamArchivo'), 'fondoCam', () => { A.fondo = 'galeria'; guardar(); asegurarSeg(); actualizar(); });
elegirArchivo($('logoArchivo'), 'logo', () => { A.marca.tipo = 'logo'; A.marca.on = true; guardar(); });
$('cambiarFondoVideo').onclick = () => $('fondoVideoArchivo').click();
$('cambiarFondoCam').onclick = () => $('fondoCamArchivo').click();
$('elegirLogo').onclick = () => $('logoArchivo').click();
(async () => {
  for (const k of ['logo', 'fondoVideo', 'fondoCam']){
    try { const b = await Archivos.leer(k); if (b) extras[k] = medio(b); } catch (e){}
  }
  pintarControles();
})();

/* ---------------- Subtítulos en vivo ---------------- */
let reco = null, recoActivo = false;
function subsIniciar(){
  if (!RECO || reco) return;
  recoActivo = true;
  const r = new RECO();
  const idioma = navigator.language || 'es-ES';
  r.lang = idioma.toLowerCase().startsWith('es') ? idioma : 'es-ES';
  r.continuous = true; r.interimResults = true;
  r.onresult = e => {
    const res = e.results[e.results.length - 1], txt = (res[0].transcript || '').trim();
    if (txt) s.sub = { texto: txt.split(/\s+/).slice(-14).join(' '), hasta: Date.now() + (res.isFinal ? 2200 : 3000) };
  };
  r.onerror = e => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){
      recoActivo = false; toast('El celular no dio permiso para reconocer la voz.');
    }
  };
  r.onend = () => { reco = null; if (recoActivo && enEstudio() && A.subs.on) setTimeout(() => { if (recoActivo) subsIniciar(); }, 300); };
  reco = r;
  try { r.start(); } catch (e){ reco = null; }
}
function subsParar(){
  recoActivo = false;
  if (reco){ try { reco.stop(); } catch (e){} reco = null; }
  s.sub = null;
}

/* ---------------- Riel de herramientas ---------------- */
$('rGirar').onclick = () => { poner('facing', A.facing === 'user' ? 'environment' : 'user'); };
$('rEspejo').onclick = () => { poner('espejo', !A.espejo); toast(A.espejo ? 'Espejo activado' : 'Espejo desactivado', 1400); };
$('rLugar').onclick = () => { poner('arriba', !A.arriba); toast(A.arriba ? 'Tú arriba, el video abajo' : 'Tú abajo, el video arriba', 1600); };
$('rIntro').onclick = () => {
  poner('intro', !A.intro);
  toast(A.intro ? 'Con introducción: al grabar sales tú primero en pantalla completa.' : 'Sin introducción: el video empieza apenas grabas.', 2800);
};
$('rFondo').onclick = () => abrirHoja('fondo');
$('rAjustes').onclick = () => abrirHoja(tabActual === 'fondo' ? 'grabar' : tabActual);

/* ---------------- Tamaño del lienzo (9:16 en cualquier pantalla) ---------------- */
function ajustarMarco(){
  const e = $('escenario'), cs = getComputedStyle(e);
  const aw = e.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const ah = e.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let w = aw, h = w * 16 / 9;
  if (h > ah){ h = ah; w = h * 9 / 16; }
  $('marco').style.width = Math.max(0, Math.floor(w)) + 'px';
  $('marco').style.height = Math.max(0, Math.floor(h)) + 'px';
}
if (window.ResizeObserver) new ResizeObserver(ajustarMarco).observe($('escenario'));
window.addEventListener('resize', ajustarMarco);

/* ---------------- Navegación ---------------- */
$('nueva').onclick = async () => {
  mostrar('estudio'); ajustarMarco(); actualizar();
  pantallaEncendida(true);
  for (const k of ['fondoVideo', 'fondoCam']) if (extras[k] && extras[k].video) extras[k].el.play().catch(() => {});
  if (A.fondo !== 'ninguno') asegurarSeg();
  try { await abrirCamara(); } catch (e){}
  if (A.subs.on) subsIniciar();
};
$('volver').onclick = () => {
  if (s.rec && !confirm('Estás grabando. ¿Detener y guardar?')) return;
  detener(); vid.pause(); pararCamara(); cam.srcObject = null; subsParar(); cerrarHoja(); pantallaEncendida(false);
  mostrar('inicio');
};

// Si la app pasa a segundo plano mientras graba, se detiene y guarda para no perder la toma
document.addEventListener('visibilitychange', () => {
  if (document.hidden && s.rec) detener();
  if (!document.hidden && enEstudio()) pantallaEncendida(true);
});

/* ---------------- Instalar en la pantalla de inicio ---------------- */
const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esSafari = esIOS && !/CriOS|FxiOS|EdgiOS|GSA|FBAN|FBAV|Instagram|WhatsApp/.test(navigator.userAgent);
let avisoAndroid = null;
function mostrarInstalar(){
  let cerrado = false; try { cerrado = !!localStorage.getItem('instalar-cerrado'); } catch (e){}
  if (instalada || cerrado) return;
  const caja = $('instalar'), txt = $('instalarTxt'), btn = $('instalarBtn');
  if (esIOS && esSafari){
    txt.innerHTML = 'Instálala como app: toca <b>Compartir</b> <span class="ico-compartir">⬆︎</span> abajo y luego <b>Añadir a pantalla de inicio</b>.';
  } else if (esIOS){
    txt.innerHTML = 'Para instalarla, abre este link en <b>Safari</b>: toca <b>⋯</b> y elige <b>Abrir en Safari</b> (o copia el link y pégalo en Safari).';
  } else if (avisoAndroid){
    txt.innerHTML = 'Instálala en tu teléfono para usarla como una app.'; btn.hidden = false;
  } else return;
  caja.hidden = false;
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); avisoAndroid = e; mostrarInstalar(); });
$('instalarBtn').onclick = async () => {
  if (!avisoAndroid) return;
  avisoAndroid.prompt(); await avisoAndroid.userChoice.catch(() => {}); avisoAndroid = null; $('instalar').hidden = true;
};
$('instalarCerrar').onclick = () => { $('instalar').hidden = true; try { localStorage.setItem('instalar-cerrado', '1'); } catch (e){} };
mostrarInstalar();

// Funciona sin internet una vez abierta
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

pintarControles();
actualizar();
requestAnimationFrame(dibujar);
cargarLista();
