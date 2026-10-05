/*
 * Service Worker — Sistema de Gestão de Manutenção Predial
 *
 * Estratégias de cache:
 *  - App shell pré-cacheado na instalação, resolvido a partir do escopo real do SW
 *    (funciona tanto na raiz do domínio quanto publicado em subpasta).
 *  - Navegação: rede primeiro, com fallback para o shell em cache quando offline.
 *  - Arquivos estáticos do próprio app: stale-while-revalidate, ou seja, responde
 *    rápido pelo cache e atualiza em segundo plano.
 *  - API, requisições por faixa (Range) e origens externas: nunca interceptadas.
 */

const CACHE_PREFIX = "gestao-predial-";
const CACHE_VERSION = "v4";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const SCOPE_URL = new URL(self.registration.scope);
const API_PATH = "/api/";

const APP_SHELL = [
  "./",
  "./index.html",
  "./js/api-client.js",
  "./js/auth.js",
  "./js/auth-ui.js",
  "./js/supabaseClient.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png"
];

const OFFLINE_FALLBACK = resolveInScope("./index.html");

function resolveInScope(path) {
  return new URL(path, SCOPE_URL).toString();
}

self.addEventListener("install", event => {
  event.waitUntil(precacheAppShell());
});

self.addEventListener("activate", event => {
  event.waitUntil(activateServiceWorker());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (!shouldHandle(request)) return;

  if (request.mode === "navigate") {
    event.respondWith(respondToNavigation(event, request));
    return;
  }

  event.respondWith(respondWithCachedAsset(request));
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const requests = APP_SHELL.map(path => new Request(resolveInScope(path), { cache: "reload" }));

  // allSettled: um recurso ausente não pode abortar a instalação dos demais.
  const results = await Promise.allSettled(requests.map(request => cache.add(request)));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(`[sw] Não foi possível pré-cachear ${APP_SHELL[index]}:`, result.reason);
    }
  });

  await self.skipWaiting();
}

async function activateServiceWorker() {
  await removeOutdatedCaches();
  await enableNavigationPreload();
  await self.clients.claim();
}

async function removeOutdatedCaches() {
  const keys = await caches.keys();
  const outdated = keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
  await Promise.all(outdated.map(key => caches.delete(key)));
}

async function enableNavigationPreload() {
  if (!self.registration.navigationPreload) return;
  await self.registration.navigationPreload.enable();
}

function shouldHandle(request) {
  if (request.method !== "GET") return false;
  if (request.headers.has("range")) return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith(API_PATH)) return false;

  return true;
}

async function respondToNavigation(event, request) {
  const networkResponse = await fetchNavigation(event, request);

  // Resposta boa da rede sempre vence; sem rede (ou com erro), o shell em cache
  // mantém a aplicação utilizável no campo.
  if (networkResponse && networkResponse.ok) {
    refreshOfflineFallback(networkResponse);
    return networkResponse;
  }

  const cached = await caches.match(request) || await caches.match(OFFLINE_FALLBACK);
  if (cached) {
    console.warn("[sw] Servindo navegação a partir do cache:", request.url);
    return cached;
  }

  return networkResponse || Response.error();
}

async function fetchNavigation(event, request) {
  try {
    const preloaded = await event.preloadResponse;
    return preloaded || await fetch(request);
  } catch (error) {
    console.warn("[sw] Navegação sem rede:", request.url, error.message);
    return null;
  }
}

function refreshOfflineFallback(response) {
  const copy = response.clone();
  caches.open(CACHE_NAME)
    .then(cache => cache.put(OFFLINE_FALLBACK, copy))
    .catch(error => console.warn("[sw] Falha ao atualizar o shell offline:", error));
}

async function respondWithCachedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    revalidateAsset(request, cache);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

function revalidateAsset(request, cache) {
  fetch(request)
    .then(response => {
      if (response.ok) return cache.put(request, response.clone());
      return undefined;
    })
    .catch(error => console.warn(`[sw] Falha ao revalidar ${request.url}:`, error));
}
