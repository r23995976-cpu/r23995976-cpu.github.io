const CACHE = "dipalo-v2-kwala-ha-20260703";
const ASSETS = ["./", "./index.html", "./styles/base.css", "./styles/controls.css", "./styles/board.css", "./styles/dialog-responsive.css", "./app.js", "./js/drawing-board.js", "./js/questions.js", "./manifest.webmanifest", "./assets/icon.svg", "./model/model.json", "./model/group1-shard1of1.bin"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
