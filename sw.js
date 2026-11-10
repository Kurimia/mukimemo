/* オフラインでも開けるようにするキャッシュ。ファイルを更新したら VERSION を上げる */
const VERSION = 'v56';
const FILES = [
  './', 'index.html', 'styles.css', 'data.js', 'icons.js', 'lines.js', 'lines-robot.js', 'store.js', 'app.js', 'manifest.webmanifest',
  'assets/char/v2/meal1-confused.webp', 'assets/char/v2/meal1-grin.webp', 'assets/char/v2/meal1-kyun.webp', 'assets/char/v2/meal1-kyunkyun.webp', 'assets/char/v2/meal1-laugh.webp', 'assets/char/v2/meal1-normal.webp', 'assets/char/v2/meal1-normal2.webp', 'assets/char/v2/meal1-smile.webp', 'assets/char/v2/meal1-surprise.webp', 'assets/char/v2/meal2-kyunkyun.webp', 'assets/char/v2/meal2-normal.webp', 'assets/char/v2/meal2-smile.webp', 'assets/char/v2/meal2-surprise.webp', 'assets/char/v2/trainer1-grin.webp', 'assets/char/v2/trainer1-grin2.webp', 'assets/char/v2/trainer1-kyun.webp', 'assets/char/v2/trainer1-kyunkyun.webp', 'assets/char/v2/trainer1-laugh.webp', 'assets/char/v2/trainer1-love.webp', 'assets/char/v2/trainer1-normal.webp', 'assets/char/v2/trainer1-normal2.webp', 'assets/char/v2/trainer1-surprise.webp', 'assets/char/v2/trainer2-grin.webp', 'assets/char/v2/trainer2-laugh.webp', 'assets/char/v2/trainer2-normal.webp', 'assets/char/v2/trainer2-surprise.webp',
  'assets/parts/chest.png', 'assets/parts/shoulder.png', 'assets/parts/back.png', 'assets/parts/legs.png', 'assets/parts/arm.png', 'assets/parts/abs.png',
  'assets/icons/icon-180.png', 'assets/icons/gear.png', 'assets/title/bg.webp', 'assets/title/chars.webp', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 最新を優先し、つながらないときはキャッシュを使う
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
