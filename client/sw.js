self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("secureclip").then(cache => cache.addAll(["/", "/index.html", "/app.js"]))
  );
});
