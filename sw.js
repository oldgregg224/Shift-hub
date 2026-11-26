const C="shifthub-v45",SAMPLES=["brief","labor","events","speed","smg","roster","comments","coverage","crew","skills","daysoff","weekhours","availability","schoolcal","outofstock","prerush","otrisk","shiftgoals","shiftgrades","callouts","tasks"].map(t=>"data/sample/"+t+".json"),
A=["./","index.html","styles.css","config.js","js/icons.js","icon.svg","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/apple-touch-icon.png","js/data.js","js/floor.js","js/cover.js","js/present.js","js/shift.js","js/tasks.js","js/app.js","manifest.json",...SAMPLES];
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
self.addEventListener("fetch",e=>{const q=e.request,u=new URL(q.url);if(q.method!=="GET"||u.origin!==location.origin)return;
 const path=u.pathname;
 // version.json is never served from cache while the network can answer.
 if(path.endsWith("/version.json")){e.respondWith(fetch(path+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r:Promise.reject(r)).catch(()=>caches.match(q).then(m=>m||Response.error())));return}
 // Bundled sample data: cache-first (ignore ?query), refresh in the background.
 if(path.includes("/data/sample/")){e.respondWith(caches.match(q,{ignoreSearch:true}).then(m=>{const net=fetch(q.url,{cache:"no-cache"}).then(r=>put(q,r));if(m){net.catch(()=>{});return m}return net}));return}
 // HTML and JS: network-first so a new deploy replaces a stale shell. Other files wait a little longer.
 const fast=q.mode==="navigate"||path.endsWith("/index.html")||path.endsWith(".js");
 e.respondWith(netFirst(q,fast?1500:4000))});
