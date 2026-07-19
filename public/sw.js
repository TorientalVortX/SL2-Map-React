const CACHE_PREFIX = 'sl2-map-';
const APP_CACHE = `${CACHE_PREFIX}app-shell-v3`;
const META_CACHE = `${CACHE_PREFIX}metadata-v1`;
const FALLBACK_TILE_CACHE = `${CACHE_PREFIX}images-runtime-v3`;
const VERSION_KEY = new URL('/__sl2_tile_cache_version__', self.location.origin).href;
const MAX_PRECACHE_FILES = 3000;

let tileCacheNamePromise;

function cacheNameForVersion(version) {
  return typeof version === 'string' && /^[a-f0-9]{40}$/i.test(version)
    ? `${CACHE_PREFIX}images-${version}`
    : FALLBACK_TILE_CACHE;
}

async function rememberTileVersion(version) {
  const cache = await caches.open(META_CACHE);
  await cache.put(VERSION_KEY, new Response(version, { headers: { 'content-type': 'text/plain' } }));
}

async function resolveTileCacheName(refresh = false) {
  if (!refresh && tileCacheNamePromise) return tileCacheNamePromise;
  tileCacheNamePromise = (async () => {
    try {
      const response = await fetch('/cache-version.json', { cache: 'no-store' });
      if (response.ok) {
        const manifest = await response.json();
        const cacheName = cacheNameForVersion(manifest.version);
        if (cacheName !== FALLBACK_TILE_CACHE) {
          await rememberTileVersion(manifest.version);
          return cacheName;
        }
      }
    } catch {}

    try {
      const metadata = await caches.open(META_CACHE);
      const storedVersion = await metadata.match(VERSION_KEY);
      if (storedVersion) return cacheNameForVersion(await storedVersion.text());
    } catch {}
    return FALLBACK_TILE_CACHE;
  })();
  return tileCacheNamePromise;
}

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    precacheAppShell(),
    resolveTileCacheName(true),
  ]));
  self.skipWaiting();
});

async function precacheAppShell() {
  const cache = await caches.open(APP_CACHE);
  const indexResponse = await fetch('/index.html', { cache: 'no-store' });
  if (!indexResponse.ok) throw new Error(`Unable to cache app shell: HTTP ${indexResponse.status}`);
  await cache.put('/', indexResponse.clone());
  await cache.put('/index.html', indexResponse.clone());
  const html = await indexResponse.text();
  const assetUrls = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g), (match) => match[1]);
  await cache.addAll(['/manifest.webmanifest', ...new Set(assetUrls)]);
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const tileCache = await resolveTileCacheName();
    const currentCaches = new Set([APP_CACHE, META_CACHE, tileCache]);
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && !currentCaches.has(key))
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function isMapImageRequest(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin === self.location.origin && (
      parsed.pathname.startsWith('/tiles/') ||
      /^\/World_Map_Optimized_[^/]+\.(?:jpg|jpeg|png|webp)$/i.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (isMapImageRequest(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(await resolveTileCacheName());
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  if (!request.url.startsWith(self.location.origin)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put('/index.html', response.clone());
        return response;
      } catch {
        return (await cache.match('/index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const cached = await cache.match(request);
    if (cached) {
      event.waitUntil(fetch(request)
        .then((response) => response.ok ? cache.put(request, response.clone()) : undefined)
        .catch(() => undefined));
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});

async function notify(client, message) {
  try {
    client?.postMessage(message);
  } catch {}
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'PRECACHE_TILES' || !Array.isArray(data.urls)) return;

  const urls = data.urls
    .filter((url) => {
      try {
        return isMapImageRequest(new URL(url, self.location.origin).href);
      } catch {
        return false;
      }
    })
    .slice(0, MAX_PRECACHE_FILES);
  const concurrency = Math.min(Math.max(data.concurrency || 4, 2), 6);
  const client = event.source;

  event.waitUntil((async () => {
    const requestedCacheName = cacheNameForVersion(data.version);
    if (requestedCacheName !== FALLBACK_TILE_CACHE) {
      await rememberTileVersion(data.version);
      tileCacheNamePromise = Promise.resolve(requestedCacheName);
    }
    const cache = await caches.open(await resolveTileCacheName());
    let index = 0;
    let completed = 0;
    let failed = 0;
    const total = urls.length;
    await notify(client, { type: 'PRECACHE_START', total });

    const workers = Array.from({ length: concurrency }, async () => {
      while (index < urls.length) {
        const url = urls[index++];
        try {
          const request = new Request(url, { mode: 'same-origin' });
          const cached = await cache.match(request);
          if (!cached) {
            const response = await fetch(request);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await cache.put(request, response.clone());
          }
        } catch {
          failed++;
        }
        completed++;
        if (completed % 10 === 0 || completed === total) {
          await notify(client, { type: 'PRECACHE_PROGRESS', completed, failed, total });
        }
      }
    });

    await Promise.all(workers);
    await notify(client, { type: 'PRECACHE_DONE', completed, failed, total });
  })());
});
