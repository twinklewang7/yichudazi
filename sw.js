// Service Worker - 衣橱搭子
var CACHE_NAME = "wardrobe-v11";

// 静态资源缓存：兜底列表（安装时不强求全部成功）
var CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/garments/white-dot-frill-top.png",
  "./assets/garments/white-vneck-tee.png",
  "./assets/garments/denim-paint-splat.png",
  "./assets/garments/denim-asym-button.jpg",
  "./assets/garments/denim-fade-wash.jpg",
  "./assets/garments/yellow-sneakers.jpg",
  "./assets/garments/silver-mary-jane.jpg",
  "./assets/garments/beige-pointed-sandal.jpg"
];

var API_HOST = "api.open-meteo.com";

// 安装时逐个缓存，单个失败不影响其他
self.addEventListener("install", function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // 用 Promise.all 但每个 add 单独处理失败
      return Promise.all(CORE_ASSETS.map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn("[SW] skip cache (fail):", url);
        });
      }));
    })
  );
});

// 激活时清理旧版本缓存
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// fetch 处理
self.addEventListener("fetch", function(e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  // 天气 API：网络优先，失败回退缓存
  if (url.hostname === API_HOST) {
    e.respondWith(
      fetch(req).then(function(res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, copy); });
        return res;
      }).catch(function() { return caches.match(req); })
    );
    return;
  }

  // 只处理同源 GET 请求（图片、HTML、JS、CSS）
  if (url.origin !== self.location.origin) return;

  // 网络优先（避免 SW 拿旧缓存返回错误图片）：拿到响应后写入缓存
  e.respondWith(
    fetch(req).then(function(res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(req, copy); });
      }
      return res;
    }).catch(function() {
      // 网络失败时回退到缓存
      return caches.match(req).then(function(cached) {
        if (cached) return cached;
        // 兜底：导航请求返回 index.html（SPA 离线）
        if (req.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
