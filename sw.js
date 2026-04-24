// ══════════════════════════════════════════════════════════════
// LUMINIS — Service Worker (PWA Offline)
// ══════════════════════════════════════════════════════════════
const CACHE_NAME = 'luminis-v2';

// Recursos locais para cachear na instalação
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Recursos externos (CDN) para cachear
const CDN_CACHE = [
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js',
  'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm',
];

// Fontes do Google (cache separado, longa duração)
const FONT_CACHE = 'luminis-fonts-v1';

// ── INSTALL: cacheia recursos essenciais ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // Cache do app
      caches.open(CACHE_NAME).then(cache => {
        return Promise.allSettled([
          cache.addAll(PRECACHE),
          ...CDN_CACHE.map(url =>
            fetch(url, { cache: 'no-cache' })
              .then(r => r.ok ? cache.put(url, r) : null)
              .catch(() => null)
          )
        ]);
      }),
    ]).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: remove caches antigos ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estratégia por tipo de recurso ─────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Fontes Google: Cache First (duração longa)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request, FONT_CACHE));
    return;
  }

  // CDN (sql.js, etc): Cache First
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // App local: Network First com fallback para cache
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Outros: tenta buscar, sem cache
  event.respondWith(fetch(event.request).catch(() => new Response('Offline', { status: 503 })));
});

// ── Cache First: usa cache, tenta rede se não tiver ──────────
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Network First: tenta rede, usa cache se offline ──────────
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

// ── BACKGROUND SYNC: notifica quando volta online ─────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
