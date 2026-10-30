const CACHE = "cahier-v2";
const SHELL = ["./", "index.html", "app.css", "i18n.js", "config.js", "codes.js", "sync.js", "core.js", "caisse.js", "gestion.js", "plus.js", "app.js", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("cahier-") && k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
// Cache d'abord (ouverture immédiate, même avec un réseau faible), puis mise à jour en arrière-plan
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
