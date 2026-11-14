// Offline support: the page comes from the network when possible; game files come from the cache first
// and are refreshed from the network in the background.
// The page tells us which files it loaded (see main.ts), so the first visit is enough to play offline.
// One cache across versions: a new worker must not throw away files the page already handed over.
// ponytail: old hashed bundles pile up (~1.5 MB per release); prune by age if that ever matters.
const CACHE = 'shepherd-king-david';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('message', e => {
  if (e.data?.type !== 'cache') return;
  // one file failing (e.g. a font host) must not stop the rest from being cached
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(e.data.urls.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // the page itself: network first, so a new version is picked up as soon as we're online
    if (e.request.mode === 'navigate') {
      try { const res = await fetch(e.request); cache.put(e.request, res.clone()); return res; }
      catch { return (await cache.match(e.request, { ignoreSearch: true })) ?? Response.error(); }
    }
    // ignoreVary: servers often send "Vary: Origin", and module scripts are requested with an Origin header,
    // so a strict match would miss the cached game code and fail offline
    const hit = await cache.match(e.request, { ignoreVary: true });
    const net = fetch(e.request).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    });
    if (hit) { net.catch(() => {}); return hit; } // offline: the cached copy is all we need
    return net;
  })());
});
