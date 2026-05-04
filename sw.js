const CACHE_NAME = 'luminis-v4';
const PRECACHE = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
const CDN_CACHE = ['https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js','https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm'];
const FONT_CACHE = 'luminis-fonts-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled([cache.addAll(PRECACHE),...CDN_CACHE.map(url=>fetch(url,{cache:'no-cache'}).then(r=>r.ok?cache.put(url,r):null).catch(()=>null))])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME&&k!==FONT_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){event.respondWith(cacheFirst(event.request,FONT_CACHE));return;}
  if(url.hostname==='cdnjs.cloudflare.com'){event.respondWith(cacheFirst(event.request,CACHE_NAME));return;}
  if(url.origin===self.location.origin){event.respondWith(networkFirst(event.request));return;}
  event.respondWith(fetch(event.request).catch(()=>new Response('Offline',{status:503})));
});
async function cacheFirst(request,cacheName){const cache=await caches.open(cacheName);const cached=await cache.match(request);if(cached)return cached;try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}catch{return new Response('Offline',{status:503});}}
async function networkFirst(request){const cache=await caches.open(CACHE_NAME);try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}catch{const cached=await cache.match(request);return cached||new Response('Offline',{status:503});}}
