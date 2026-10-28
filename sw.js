// Service worker : le site reste utilisable sans réseau sur les appareils récents.
// Réseau d'abord (on a toujours la dernière version en ligne), cache en secours.
// Les envois de scores (script.google.com) ne passent pas par ici.
var CACHE = 'scoreTT-v3';
var FICHIERS = ['./', 'index.html', 'resultats.html', 'config.js', 'manifest.json', 'logo.svg', 'favicon.png',
                'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); })['catch'](function () {}));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches['delete'](k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok) { var copie = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copie); }); }
    return res;
  })['catch'](function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('index.html'); });
  }));
});
