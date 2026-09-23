// BeatSurfer service worker - network-first shell and audio, cache-first images/models.
// Bump VERSION on every deploy so clients pick up the new build.
const VERSION = 'beatsurfer-v8';

const PRECACHE = [
  './',
  './index.html',
  './app.bundle.js',
  './fonts.css',
  './fonts/chakra-petch-500.woff2',
  './fonts/chakra-petch-700.woff2',
  './fonts/barlow-400.woff2',
  './ds.css',
  './icons.svg',
  './css/style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './assets/bg/title.webp',
  './assets/pilots/sm/vael.webp'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const AUDIO_RE = /\.(mp3|wav|flac|m4a|ogg|aac|opus|weba|webm)(\?|$)/i;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept cross-origin (fonts etc.)

  // Audio: network-first (fresh tracks), fall back to cache when offline.
  if (req.destination === 'audio' || AUDIO_RE.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // The shell (page, bundle, css, sw-listed files): network-first with the cache
  // as offline fallback. Cache-first here meant a deploy that forgot to bump
  // VERSION never reached returning players or the Android app.
  const shell = req.mode === 'navigate' || /\/$|\.(html|js|css|webmanifest|svg)$/i.test(url.pathname);
  if (shell) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Heavy assets (webp/png/glb): cache-first.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
