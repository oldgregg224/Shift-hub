const C="shifthub-v8",A=["./","index.html","styles.css","config.js","js/icons.js","icon.svg","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png","js/data.js","js/floor.js","js/app.js","manifest.json","data/sample/roster.json","data/sample/comments.json"];
// Install fresh copies (bypass HTTP cache) and take over right away.
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A.map(u=>new Request(u,{cache:"reload"})))))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("shifthub-")&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Same-origin: network-first with cache:'no-cache' (revalidates with GitHub Pages), cache only good responses, offline falls back to cache.
// Cross-origin (Apps Script) is left alone.
self.addEventListener("fetch",e=>{const q=e.request;if(q.method!=="GET"||new URL(q.url).origin!==location.origin)return;
 e.respondWith(fetch(q.url,{cache:"no-cache",credentials:"same-origin"}).then(r=>{if(r.ok){const cl=r.clone();caches.open(C).then(c=>c.put(q,cl))}return r})
  .catch(()=>caches.match(q,{ignoreSearch:q.mode==="navigate"}).then(m=>m||caches.match("index.html"))))});
