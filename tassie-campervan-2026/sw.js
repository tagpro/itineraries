/* Tassie Campervan — offline service worker.
   Everything the page needs is precached, so the whole itinerary works
   in a valley with no signal. Bump VERSION whenever an asset changes. */
const VERSION = 'tassie-v2';
const SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './fonts/outfit.woff2',
  './fonts/playfair.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(SHELL); })
      .catch(function () { /* one bad asset must not block install */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return k === VERSION ? null : caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  // Leave anything off this origin alone — map links, tel: and the like.
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network so edits land, fall back to the cached page.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put('./index.html', copy); });
          return res;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
        })
    );
    return;
  }

  // Assets: cache first, refresh in the background.
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
