// Deploy checklist:
// 1. Bump APP_VERSION in version.js
// 2. Bump @release below to the same value (changes SW bytes so browsers detect the update)
// @release 1.3.0
const SW_RELEASE = '1.3.0';

importScripts('/version.js?v=' + encodeURIComponent(SW_RELEASE));
if (typeof APP_VERSION === 'undefined' || APP_VERSION !== SW_RELEASE) {
  throw new Error('version.js out of sync with sw.js SW_RELEASE=' + SW_RELEASE);
}

const CACHE_NAME = 'interval-timer-' + SW_RELEASE.replace(/\./g, '-');

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/version.js',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/logo.svg',
  '/icons/icon-padded.svg',
  '/icons/favicon.svg',
  '/icons/favicon.ico',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/screenshots/screenshot-timer.png',
  '/screenshots/screenshot-designer.png',
  '/screenshots/screenshot-designer-templates.png',
  '/screenshots/screenshot-manager.png'
];

const CDN_PATTERNS = [
  /^https:\/\/cdn\.tailwindcss\.com/,
  /^https:\/\/unpkg\.com\/lucide/,
  /^https:\/\/fonts\.googleapis\.com/,
  /^https:\/\/fonts\.gstatic\.com/
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

function isCdnRequest(url) {
  return CDN_PATTERNS.some((pattern) => pattern.test(url.href));
}

function isNetworkFirstRequest(url, request) {
  if (url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate') return true;
  const path = url.pathname;
  return path === '/' || path === '/index.html' || path === '/version.js' || path.endsWith('/');
}

function cacheFirstWithNetworkUpdate(request) {
  return caches.match(request).then((cached) => {
    const networkFetch = fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => cached);
    return cached || networkFetch;
  });
}

function networkFirstWithCacheFallback(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
  }).catch(() => caches.match(request).then((cached) => cached || Response.error()));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (isCdnRequest(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    if (isNetworkFirstRequest(url, event.request)) {
      event.respondWith(networkFirstWithCacheFallback(event.request));
    } else {
      event.respondWith(cacheFirstWithNetworkUpdate(event.request));
    }
  }
});
