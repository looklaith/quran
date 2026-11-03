const CACHE = 'mushafi-v25';
const TAJWEED = 'mushafi-tajweed';          // pages already opened with tajweed, kept across updates
const FONTS = [
  'Amiri-400-arabic', 'Amiri-400-latin-ext', 'Amiri-400-latin',
  'Amiri-700-arabic', 'Amiri-700-latin-ext', 'Amiri-700-latin',
  'AmiriQuran-400-arabic', 'AmiriQuran-400-latin', 'UthmanicHafs1Ver18'
].map(f => '/fonts/' + f + '.woff2');
// Everything needed to read the whole Quran with tafsir, with no internet.
const SHELL = ['/', '/index.html', '/app.js', '/manifest.json', '/icon-192.png', '/icon-512.png', '/privacy.html',
  '/fonts/fonts.css', ...FONTS, '/data/quran.json', '/data/lines.json', '/data/ar.muyassar.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TAJWEED).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Save only good answers, so an error page is never stored and shown later.
const save = (name, req, res) => { if (res.ok) { const copy = res.clone(); caches.open(name).then(c => c.put(req, copy)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tajweed colours: from the internet when possible, otherwise the last saved copy of that page.
  if (url.origin === 'https://api.quran.com') {
    e.respondWith(fetch(req).then(res => save(TAJWEED, req, res))
      .catch(() => caches.match(req, { cacheName: TAJWEED }).then(r => r || Response.error())));
    return;
  }
  // Audio and other sites go straight to the network. So does the assistant (/api/).
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  // Quran data and fonts never change within a version: saved copy first (instant, works offline).
  if (url.pathname.startsWith('/data/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => save(CACHE, req, res))));
    return;
  }
  // App files: newest from the internet, saved copy when offline.
  e.respondWith(
    fetch(req)
      .then(res => save(CACHE, req, res))
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('/index.html')))
  );
});
