// =============================================
// SERVICE WORKER — Plaza de la Música Stock
// =============================================

const CACHE_NAME = "plaza-stock-v17";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/productos.js",
  "./js/firebase.js",
  "./js/pdf.js",
  "./js/excel.js",
  "./js/app.js",
  "./manifest.json",
  "./img/icon.png",
  "./img/logo-plaza.png",
  "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"
];

// Instalar y cachear assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS.map(url => new Request(url, { mode: "no-cors" })));
    })
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Estrategia: Cache first para assets, Network first para Firebase
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Firebase: siempre red
  if (url.hostname.includes("firebase") || url.hostname.includes("google")) {
    event.respondWith(
      fetch(event.request).catch(() => new Response("", { status: 503 }))
    );
    return;
  }

  // Assets locales: cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
