/* FixPro service worker — permite abrir o app sem rede.
 *
 * Estratégias:
 *  - /_next/static/*  : cache-first (arquivos com hash, imutáveis)
 *  - navegação (HTML)  : network-first com timeout, caindo para o cache
 *  - ícones/manifest   : stale-while-revalidate
 *  - todo o resto (Supabase, RSC, APIs, outras origens): vai direto à rede, nunca é cacheado
 *
 * As páginas são renderizadas no cliente (sem dados de usuário no HTML),
 * por isso é seguro guardar o HTML delas em cache.
 * Ao alterar este arquivo, incremente VERSION.
 */
const VERSION = 'v1';
const STATIC_CACHE = `fixpro-static-${VERSION}`;
const PAGE_CACHE = `fixpro-pages-${VERSION}`;
const ASSET_CACHE = `fixpro-assets-${VERSION}`;
const KNOWN_CACHES = [STATIC_CACHE, PAGE_CACHE, ASSET_CACHE];

const SHELL_PAGES = ['/', '/login'];
const SHELL_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGE_CACHE);
      const assets = await caches.open(ASSET_CACHE);

      // Falha em um item não deve impedir a instalação.
      await Promise.allSettled([
        ...SHELL_PAGES.map((url) => pages.add(url)),
        ...SHELL_ASSETS.map((url) => assets.add(url)),
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('fixpro-') && !KNOWN_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function handleNavigation(request) {
  const cache = await caches.open(PAGE_CACHE);
  const pageUrl = new URL(request.url).pathname;

  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);

    // Respostas redirecionadas não podem ser reutilizadas em navegações.
    if (response.ok && !response.redirected) {
      void cache.put(pageUrl, response.clone());
    }

    return response;
  } catch {
    const cached = (await cache.match(pageUrl)) || (await cache.match('/'));

    if (cached) {
      return cached;
    }

    return new Response('Sem conexão e esta página ainda não foi salva para uso offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function handleStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    void cache.put(request, response.clone());
  }

  return response;
}

async function handleAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    void refresh;
    return cached;
  }

  return (await refresh) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Requisições internas do Next (RSC / dados) e a API ficam sempre na rede.
  if (
    request.headers.has('RSC') ||
    url.searchParams.has('_rsc') ||
    url.pathname.startsWith('/_next/data') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStatic(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(handleAsset(request));
  }
});
