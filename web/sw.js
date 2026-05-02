const SHELL_VERSION = 'bookvoice-shell-v3-mobile';
const SHELL_ASSETS = [
  '/bookvoice.webmanifest',
  '/icons/bookvoice-180.png',
  '/icons/bookvoice-192.png',
  '/icons/bookvoice-512.png',
];

// Paths that MUST always come from network (no cache).
// mobile.html + mobile.js + mobile.css change frequently — never cache.
// HTML pages (`/`, `/b/*`, `/m/*`, `/library/*`) must be fresh for auth/state.
function isNetworkOnly(url) {
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/media')) return true;
  if (url.pathname === '/mobile.js' || url.pathname === '/mobile.css' || url.pathname === '/mobile.html') return true;
  if (url.pathname === '/customer.js' || url.pathname === '/customer.css' || url.pathname === '/customer.html') return true;
  if (url.pathname === '/' || url.pathname === '/b' || url.pathname.startsWith('/b/') ||
      url.pathname.startsWith('/m/') || url.pathname.startsWith('/library')) return true;
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_VERSION).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  if (isNetworkOnly(url)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((c) => c || new Response('', { status: 503 })))
    );
    return;
  }

  // Cache-first with background update for static assets (icons, fonts, manifest)
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
