// service-worker.js - very small offline cache for the prototype
const CACHE_NAME = 'minicity-cache-v1';
const ASSETS = [
'/',
'/index.html',
'/style.css',
'/app.js',
'/manifest.json'
];

self.addEventListener('install', evt => {
evt.waitUntil(
caches.open(CACHE_NAME).then(cache => {
return cache.addAll(ASSETS).catch(()=>{/* ignore errors for dev */});
})
);
self.skipWaiting();
});

self.addEventListener('activate', evt => {
evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', evt => {
evt.respondWith(
caches.match(evt.request).then(res => res || fetch(evt.request).catch(()=>caches.match('/')))
);
});
