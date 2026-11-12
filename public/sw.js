/*
 * Dukaan Saathi service worker: lets the app open without signal.
 * - Pages: network first, cached copy when offline.
 * - Built assets (/assets/*, hashed names): cache first.
 * - API calls (/api/*) are never cached: the khata itself lives in the phone's storage and syncs later.
 */
const CACHE = 'dukaan-saathi-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

/** Cache the shell plus every built JS/CSS file the page needs, so the very next open works offline. */
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  // The entry script imports further chunks; pick those up too.
  for (const a of assets.filter((x) => x.endsWith('.js'))) {
    try {
      const js = await (await fetch(a)).text();
      for (const m of js.matchAll(/["'(]\.?\/?(assets\/[A-Za-z0-9_.-]+\.(?:js|css))["')]/g)) assets.push(`/${m[1]}`);
    } catch {
      // ignore: the asset will be cached on first use instead
    }
  }
  await cache.addAll([...new Set(assets)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
