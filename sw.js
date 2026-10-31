const C="shifthub-v27",SAMPLES=["brief","labor","events","speed","smg","roster","comments","coverage"].map(t=>"data/sample/"+t+".json"),
A=["./","index.html","styles.css","config.js","js/icons.js","icon.svg","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png","js/data.js","js/floor.js","js/app.js","manifest.json",...SAMPLES];
// Install fresh copies (bypass HTTP cache) and take over right away.
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A.map(u=>new Request(u,{cache:"reload"})))))});
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("shifthub-")&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const put=(q,r)=>{if(r&&r.ok){const cl=r.clone();caches.open(C).then(c=>c.put(q,cl))}return r};
// Network with a deadline: a slow/hung network falls back to cache after ms instead of hanging the page.
function netFirst(q,ms){const net=fetch(q.url,{cache:"no-cache",credentials:"same-origin"}).then(r=>put(q,r));
 const fromCache=()=>caches.match(q,{ignoreSearch:true}).then(m=>m||(q.mode==="navigate"?caches.match("index.html"):undefined));
 return new Promise(res=>{let done=false;const fin=r=>{if(!done&&r){done=true;res(r)}};
  const t=setTimeout(()=>fromCache().then(fin),ms);
  net.then(r=>{clearTimeout(t);fin(r)},()=>{clearTimeout(t);fromCache().then(m=>fin(m||Response.error()))});
  net.catch(()=>{});setTimeout(()=>net.then(fin,()=>fin(Response.error())),ms+1)})}
self.addEventListener("fetch",e=>{const q=e.request,u=new URL(q.url);if(q.method!=="GET"||u.origin!==location.origin||u.pathname.endsWith("/version.json"))return;
 // Bundled sample data: cache-first (ignore ?query), refresh in the background.
 if(u.pathname.includes("/data/sample/")){e.respondWith(caches.match(q,{ignoreSearch:true}).then(m=>{const net=fetch(q.url,{cache:"no-cache"}).then(r=>put(q,r));if(m){net.catch(()=>{});return m}return net}));return}
 // App shell: network-first (no-cache revalidation), cache after 4s or when offline.
 e.respondWith(netFirst(q,4000))});
