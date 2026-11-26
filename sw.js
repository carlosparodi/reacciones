// Guarda la app en el teléfono para que abra sin internet.
// Al cambiar cualquier archivo, sube el número de VERSION para que los teléfonos tomen la nueva.
const VERSION = 'reacciones-v2';
const LETRAS = 'reacciones-letras';
const ARCHIVOS = ['./', 'index.html', 'app.js', 'estilos.css', 'manifest.webmanifest',
  'iconos/icono-180.png', 'iconos/icono-192.png', 'iconos/icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== LETRAS).map(k => caches.delete(k))))
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
  if (url.origin !== location.origin) return;
  // Primero intenta internet (para recibir cambios); si no hay, usa la copia guardada
  e.respondWith(fetch(e.request).then(r => {
    const copia = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
