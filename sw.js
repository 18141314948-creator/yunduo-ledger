'use strict';
const PREFIX = new URL('./', self.location.href).pathname;
const CACHE_PREFIX = 'dream-ledger-' + PREFIX + '-shell-';
const CACHE = CACHE_PREFIX + 'v4';
const FILES = ['', 'index.html','style.css','core.js','storage.js','app.js','extras.js','manifest.webmanifest','icon-192.png','icon-512.png'].map(file => PREFIX + file);
self.addEventListener('install',event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate',event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch',event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!FILES.includes(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(hit => hit || fetch(event.request)));
});
