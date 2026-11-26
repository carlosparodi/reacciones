// Estudio de Reacciones — versión móvil web (PWA). Se abre con un link y se instala desde
// Safari (iPhone) o Chrome (Android) con "Añadir a pantalla de inicio". No usa App Store.
// El video que comentas va arriba y tú abajo. Al pausar apareces en pantalla completa,
// y cuando el video termina también, para cerrar con tu conclusión.
'use strict';
const $ = id => document.getElementById(id);

const W = 1080, H = 1920;
const cv = $('lienzo'), ctx = cv.getContext('2d');
const vid = document.createElement('video');
vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.preload = 'auto';
const cam = document.createElement('video');
cam.playsInline = true; cam.setAttribute('playsinline', ''); cam.muted = true; cam.autoplay = true;

const s = {
  split: 0.5,            // alto del video de arriba (0..1) cuando se reproduce
  topH: 0,               // alto animado actual (en px del lienzo)
  facing: 'user', mirror: true, camStream: null,
  hasVideo: false, ended: false,
  vT: { z: 1, x: 0, y: 0 },   // encuadre del video de arriba
  cT: { z: 1, x: 0, y: 0 },   // encuadre de tu cámara
  rec: null, recStart: 0, saver: null,
  audio: null,
};

/* ---------------- Utilidades ---------------- */
let toastT;
function toast(msg, ms = 2600){
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms);
}
const fmt = sec => { sec = Math.max(0, sec | 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
function mostrar(id){ ['inicio', 'estudio', 'visor'].forEach(p => $(p).hidden = p !== id); }

/* ---------------- Cámara y audio ---------------- */
async function abrirCamara(){
  pararCamara();
  const pedir = c => navigator.mediaDevices.getUserMedia(c);
  const video = { facingMode: s.facing, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30 } };
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  let st;
  try { st = await pedir({ video, audio }); }
  catch (e){
    try { st = await pedir({ video }); toast('No se pudo usar el micrófono. Revisa los permisos del navegador.'); }
    catch (e2){ $('aviso').textContent = 'Permite la cámara y el micrófono para usar el estudio. En iPhone: Ajustes › Safari › Cámara y Micrófono › Permitir.'; throw e2; }
  }
  s.camStream = st; cam.srcObject = st;
  try { await cam.play(); } catch (e){}
  conectarMic();
}
function pararCamara(){
  if (s.camStream) s.camStream.getTracks().forEach(t => t.stop());
  s.camStream = null;
}
function audioBase(){
  if (s.audio) return s.audio;
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const dest = ac.createMediaStreamDestination();
  const vidGain = ac.createGain(); vidGain.gain.value = 0.85;
  vidGain.connect(dest); vidGain.connect(ac.destination);   // el video suena por el parlante y queda en la grabación
  const vidSrc = ac.createMediaElementSource(vid); vidSrc.connect(vidGain);
  s.audio = { ac, dest, micSrc: null };
  return s.audio;
}
function conectarMic(){
  const a = audioBase();
  if (a.micSrc){ try { a.micSrc.disconnect(); } catch (e){} a.micSrc = null; }
  if (s.camStream && s.camStream.getAudioTracks().length){
    a.micSrc = a.ac.createMediaStreamSource(new MediaStream(s.camStream.getAudioTracks()));
    a.micSrc.connect(a.dest);
  }
}

/* ---------------- Dibujo ---------------- */
function encuadre(src, sw, sh, rx, ry, rw, rh, t, espejo){
  if (!sw || !sh) return;
  const k = Math.max(rw / sw, rh / sh) * t.z, dw = sw * k, dh = sh * k;
  const mx = (dw - rw) / 2, my = (dh - rh) / 2;
  t.x = Math.max(-mx, Math.min(mx, t.x)); t.y = Math.max(-my, Math.min(my, t.y));
  const dx = rx + (rw - dw) / 2 + t.x, dy = ry + (rh - dh) / 2 + t.y;
  ctx.save();
  ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
  if (espejo){ ctx.translate(rx * 2 + rw, 0); ctx.scale(-1, 1); }
  ctx.drawImage(src, dx, dy, dw, dh);
  ctx.restore();
}
function enVivo(){ return s.hasVideo && !vid.paused && !vid.ended; }
function dibujar(){
  const meta = enVivo() ? s.split * H : 0;
  s.topH += (meta - s.topH) * 0.22;
  if (Math.abs(meta - s.topH) < 1) s.topH = meta;
  const th = Math.round(s.topH);

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (th > 0 && s.hasVideo) encuadre(vid, vid.videoWidth, vid.videoHeight, 0, 0, W, th, s.vT, false);
  if (cam.readyState >= 2) encuadre(cam, cam.videoWidth, cam.videoHeight, 0, th, W, H - th, s.cT, s.mirror);
  if (th > 4 && th < H - 4){ ctx.fillStyle = '#ffffff'; ctx.fillRect(0, th - 2, W, 4); }

  if (s.rec) $('tiempo').textContent = fmt((Date.now() - s.recStart) / 1000);
  requestAnimationFrame(dibujar);
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
  if (th > 20 && Math.abs(p.y - th) < 70) return 'linea';
  return th > 20 && p.y < th ? 'video' : 'cam';
}
function iniciarGesto(){
  const pts = [...dedos.values()];
  const zona = gesto ? gesto.zona : zonaEn(pts[0]);
  const t = zona === 'video' ? s.vT : s.cT;
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
      if (z === 'cam') s.cT = { z: 1, x: 0, y: 0 };
      if (z === 'linea') s.split = 0.5;
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
    s.split = Math.max(0.2, Math.min(0.8, c.y / H)); s.topH = s.split * H; return;
  }
  const t = gesto.t;
  if (pts.length > 1 && gesto.d0) t.z = Math.max(1, Math.min(5, gesto.z0 * dist(pts) / gesto.d0));
  const espejo = t === s.cT && s.mirror ? -1 : 1;
  t.x = gesto.x0 + (c.x - gesto.c0.x) * espejo; t.y = gesto.y0 + (c.y - gesto.c0.y);
});
const soltar = e => { dedos.delete(e.pointerId); if (dedos.size) iniciarGesto(); else gesto = null; };
cv.addEventListener('pointerup', soltar);
cv.addEventListener('pointercancel', soltar);

/* ---------------- Video que comentas ---------------- */
$('archivo').onchange = e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (vid.src) URL.revokeObjectURL(vid.src);
  vid.src = URL.createObjectURL(f);
  s.hasVideo = true; s.ended = false; s.vT = { z: 1, x: 0, y: 0 };
  audioBase();
  vid.onloadedmetadata = () => { vid.currentTime = 0.01; };
  $('play').disabled = false;
  actualizar();
  toast('Video listo. Toca ▶ para reproducirlo.');
};
vid.onended = () => { s.ended = true; actualizar(); };
vid.onplay = vid.onpause = () => actualizar();

$('play').onclick = async () => {
  if (!s.hasVideo) return;
  const a = audioBase(); if (a.ac.state === 'suspended') await a.ac.resume();
  if (vid.paused || vid.ended){
    if (vid.ended){ vid.currentTime = 0; s.ended = false; }
    try { await vid.play(); } catch (e){ toast('No se pudo reproducir este video.'); }
  } else vid.pause();
};

function actualizar(){
  const sonando = enVivo();
  $('playIco').textContent = sonando ? '❚❚' : '▶';
  $('playTxt').textContent = sonando ? 'Pausar' : (s.ended ? 'Repetir' : 'Reproducir');
  $('aviso').textContent = s.hasVideo || s.rec ? '' : 'Toca 🎞 Video para elegir el video que vas a comentar.';
}

/* ---------------- Grabación ---------------- */
function elegirFormato(){
  const op = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
              'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return op.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
async function empezar(){
  if (!window.MediaRecorder){ toast('Este teléfono no permite grabar desde el navegador. Actualiza a iOS 15 o más nuevo.'); return; }
  const a = audioBase(); if (a.ac.state === 'suspended') await a.ac.resume();
  const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...a.dest.stream.getAudioTracks()]);
  const mime = elegirFormato();
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 192_000 }); }
  catch (e){ rec = new MediaRecorder(stream); }
  const tipo = rec.mimeType || mime || 'video/mp4';
  s.saver = await Almacen.nueva(tipo.includes('webm') ? 'webm' : 'mp4', tipo);
  rec.ondataavailable = ev => { if (ev.data && ev.data.size) s.saver.agregar(ev.data); };
  rec.onstop = async () => {
    const r = await s.saver.terminar(); s.saver = null;
    toast(r ? 'Grabación guardada ✔' : 'No se pudo guardar la grabación.');
    cargarLista();
  };
  rec.start(1000);
  s.rec = rec; s.recStart = Date.now();
  if (!vid.paused) vid.pause();          // empiezas en pantalla completa con tu introducción
  $('grabar').classList.add('on'); $('rec').hidden = false; $('estudio').classList.add('grabando');
  $('pista').textContent = 'Toca ▶ para que aparezca el video. Al pausar vuelves a pantalla completa.';
  actualizar();
}
function detener(){
  if (!s.rec) return;
  s.rec.stop(); s.rec = null; vid.pause();
  $('grabar').classList.remove('on'); $('rec').hidden = true; $('estudio').classList.remove('grabando');
  $('pista').textContent = 'Mueve y haz zoom con los dedos. Arrastra la línea del medio para cambiar el tamaño. Doble toque para restablecer.';
  actualizar();
}
$('grabar').onclick = () => s.rec ? detener() : empezar();

/* ---------------- Almacenamiento: las tomas quedan en el teléfono (IndexedDB) ---------------- */
// Pide que el navegador no borre las grabaciones para liberar espacio
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
let urls = [];
const Almacen = (() => {
  const db = new Promise((ok, mal) => {
    const r = indexedDB.open('estudio-movil', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tomas', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
  });
  const tx = async (modo, fn) => { const d = await db; return new Promise((ok, mal) => {
    const t = d.transaction('tomas', modo), q = fn(t.objectStore('tomas'));
    t.oncomplete = () => ok(q && q.result); t.onerror = () => mal(t.error);
  }); };
  return {
    async nueva(ext, tipo){
      const partes = [];
      return {
        agregar(b){ partes.push(b); },
        async terminar(){
          const fecha = Date.now();
          await tx('readwrite', st => st.put({ id: `reaccion-${fecha}.${ext}`, fecha, blob: new Blob(partes, { type: tipo }) }));
          return true;
        },
      };
    },
    async listar(){
      const todas = (await tx('readonly', st => st.getAll())) || [];
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
    async borrar(t){ await tx('readwrite', st => st.delete(t.id)); },
  };
})();

/* ---------------- Inicio: lista de grabaciones ---------------- */
let tomas = [], actual = null;
async function cargarLista(){
  tomas = await Almacen.listar();
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

/* ---------------- Navegación ---------------- */
$('nueva').onclick = async () => {
  mostrar('estudio'); actualizar();
  try { await abrirCamara(); } catch (e){}
};
$('volver').onclick = () => {
  if (s.rec && !confirm('Estás grabando. ¿Detener y guardar?')) return;
  detener(); vid.pause(); pararCamara(); mostrar('inicio');
};
$('girar').onclick = async () => {
  s.facing = s.facing === 'user' ? 'environment' : 'user';
  s.mirror = s.facing === 'user'; $('espejo').classList.toggle('on', s.mirror);
  try { await abrirCamara(); } catch (e){}
};
$('espejo').onclick = () => { s.mirror = !s.mirror; $('espejo').classList.toggle('on', s.mirror); };
$('espejo').classList.toggle('on', s.mirror);

// Si la app pasa a segundo plano mientras graba, se detiene y guarda para no perder la toma
document.addEventListener('visibilitychange', () => { if (document.hidden && s.rec){ detener(); } });

/* ---------------- Instalar en la pantalla de inicio ---------------- */
const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const esSafari = esIOS && !/CriOS|FxiOS|EdgiOS|GSA|FBAN|FBAV|Instagram|WhatsApp/.test(navigator.userAgent);
let avisoAndroid = null;
function mostrarInstalar(){
  if (instalada || localStorage.getItem('instalar-cerrado')) return;
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
$('instalarCerrar').onclick = () => { $('instalar').hidden = true; localStorage.setItem('instalar-cerrado', '1'); };
mostrarInstalar();

// Funciona sin internet una vez abierta
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

requestAnimationFrame(dibujar);
cargarLista();
