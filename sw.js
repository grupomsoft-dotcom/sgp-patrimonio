const cacheName = 'sgp-v3.8';
const assets = ['./', './index.html', './script.js'];
self.addEventListener('fetch', () => {});
self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
