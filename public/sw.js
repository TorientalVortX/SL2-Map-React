/*
  Basic service worker to cache tiles and static assets.
  Strategy:
  - Static assets: pre-cache at install (app shell)
  - Tiles and world maps: cache-first with network fallback; update in background
*/

const APP_CACHE = 'app-shell-v2';
const TILE_CACHE = 'tiles-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/styles.css',
  // Precache commonly used world map images (small sizes helpful for initial view)
  '/World_Map_Optimized_tiny.jpg',
  '/World_Map_Optimized_small.jpg',
  '/World_Map_Optimized_medium.jpg',
  '/World_Map_Optimized_large.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => ![APP_CACHE, TILE_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isTileOrWorldMapRequest(url) {
  try {
    const u = new URL(url);
    return (
      u.pathname.startsWith('/tiles/') ||
      u.pathname.includes('World_Map_Optimized')
    );
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = request.url;

  // Cache-first for tiles and world maps
  if (isTileOrWorldMapRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TILE_CACHE);
        const cached = await cache.match(request);
        if (cached) {
          // Update in background to keep cache fresh
          event.waitUntil(
            fetch(request)
              .then((resp) => {
                if (resp && resp.status === 200) {
                  cache.put(request, resp.clone());
                }
              })
              .catch(() => {})
          );
          return cached;
        }
        try {
          const resp = await fetch(request);
          if (resp && resp.status === 200) {
            cache.put(request, resp.clone());
          }
          return resp;
        } catch (e) {
          // Optional: return a placeholder image if offline/no cache
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // For other same-origin requests: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200 && request.url.startsWith(self.location.origin)) {
            cache.put(request, resp.clone());
          }
          return resp;
        })
        .catch(() => undefined);
      return cached || networkPromise || Response.error();
    })()
  );
});

// Handle messages from client to precache specific tile URLs (with concurrency limit)
// Broadcast helper
async function broadcast(msg) {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(c => c.postMessage(msg));
  } catch {}
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'PRECACHE_TILES' && Array.isArray(data.urls)) {
    const urls = data.urls.slice(0, data.limit || 300); // safety cap
    const concurrency = Math.min(Math.max(data.concurrency || 8, 2), 16);
    event.waitUntil(
      (async () => {
        const cache = await caches.open(TILE_CACHE);
        let idx = 0;
        let completed = 0;
        const total = urls.length;
        await broadcast({ type: 'PRECACHE_START', total });
        const workers = new Array(concurrency).fill(0).map(async () => {
          while (idx < urls.length) {
            const myIndex = idx++;
            const url = urls[myIndex];
            try {
              const req = new Request(url, { mode: 'same-origin' });
              const already = await cache.match(req);
              if (!already) {
                const resp = await fetch(req);
                if (resp && resp.status === 200) {
                  await cache.put(req, resp.clone());
                }
              }
            } catch {}
            completed++;
            if (completed % 25 === 0 || completed === total) {
              await broadcast({ type: 'PRECACHE_PROGRESS', completed, total });
            }
          }
        });
        await Promise.all(workers);
        await broadcast({ type: 'PRECACHE_DONE', total });
      })()
    );
  }
});
