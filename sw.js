// Guarda la app en el teléfono para que abra sin internet.
// Al cambiar cualquier archivo, sube el número de VERSION para que los teléfonos tomen la nueva.
const VERSION = 'reacciones-v7';
const LETRAS = 'reacciones-letras';
const MODELOS = 'reacciones-modelos';   // recorte de silueta (MediaPipe), se guarda la primera vez
const ARCHIVOS = ['./', 'index.html', 'app.js?v=4', 'estilos.css?v=4', 'manifest.webmanifest',
  'iconos/icono-180.png', 'iconos/icono-192.png', 'iconos/icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== LETRAS && k !== MODELOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Letras de Google Fonts (Manrope, Instrument Serif, IBM Plex Mono): se guardan la primera vez
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.open(LETRAS).then(c => c.match(e.request).then(guardada => guardada ||
      fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'storage.googleapis.com'){
    e.respondWith(caches.open(MODELOS).then(c => c.match(e.request).then(guardada => guardada ||
      fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // Primero intenta internet sin usar copias viejas del navegador (así nunca se mezclan versiones);
  // si no hay internet, usa la copia guardada
  const fresca = e.request.mode === 'navigate' ? new Request(e.request.url, { cache: 'no-cache' }) : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(fresca).then(r => {
    const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
