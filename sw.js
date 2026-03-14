var CACHE_NAME = 'regi-v7.3';
var OFFLINE_URL = '/';
var ASSETS = ['/', '/index.html', '/icon.png', '/icon-192.png', '/icon-r.svg', '/manifest.json'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  // Never intercept Supabase API calls
  if (e.request.url.includes('/rest/v1/') || e.request.url.includes('/auth/v1/')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // CDN requests (jsPDF etc): network-first, cache the response, never fallback to index.html
  if (e.request.url.includes('cdnjs.cloudflare.com') || e.request.url.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }
  // App assets: network-first with offline fallback
  e.respondWith(
    fetch(e.request).then(function(response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
      }
      return response;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match(OFFLINE_URL);
      });
    })
  );
});
