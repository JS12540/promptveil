const scopePrefix = `promptveil:${self.registration.scope}:`;
const cacheName = scopePrefix + /* CACHE_NAME */ null;
const files = /* PRECACHE */ null;
const filesByUrl = new Set(files.map(file => new URL(file, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([...filesByUrl])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(scopePrefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data === 'apply-update') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !filesByUrl.has(request.url)) return;
  event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(request)) ?? fetch(request)));
});
