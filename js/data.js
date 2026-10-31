// Tabs: Brief, Labor, Events, Speed, SMG, Roster, Comments, Meta (sample file = data/sample/<tab lowercase>.json).
// Reads each tab from the Apps Script web app (GET ?key=..&tab=..), else bundled sample JSON.
// v12: live GETs run one at a time (Apps Script throttles parallel calls from one user), failures are per tab
// (one slow tab no longer flips every tab to sample), and the last good live rows per tab are kept in memory +
// localStorage and shown (marked Cached) until a retry with backoff succeeds.
(function(){
// Key persistence: localStorage (primary) + cookie backup (1 yr). Never cleared automatically; only "Clear key" removes it.
const KN="shifthub_key";
function ck(){const m=document.cookie.match(/(?:^|; )shifthub_key=([^;]*)/);return m?decodeURIComponent(m[1]):""}
function ls(){try{return localStorage.getItem(KN)||""}catch(e){return ""}}
const Key={get:()=>{let k=ls();if(!k){k=ck();if(k)try{localStorage.setItem(KN,k)}catch(e){}}return k.trim()},
 set:k=>{k=String(k||"").trim();try{k?localStorage.setItem(KN,k):localStorage.removeItem(KN)}catch(e){}
  document.cookie=KN+"="+encodeURIComponent(k)+";path=/;max-age="+(k?31536000:0)+";SameSite=Strict;Secure";
  st.bad="";st.ok=false;st.netAt=0;reset(true)}};
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
const url=()=>(window.SHIFTHUB_CONFIG||{}).appsScriptUrl||"";
// st.bad: "" | "key" (server said bad key, sticks until key changes) | "net" (latest live call failed). st.ok: a live call has succeeded.
const st={bad:"",ok:false,netAt:0,script:""}; // script: "" unknown | "ok" | "broken" (deployed project has no doGet)
const canTry=()=>!!(url()&&Key.get());
const live=()=>canTry()&&st.bad!=="key"&&st.ok;
const TIMEOUT=30000,SAMPLE_TIMEOUT=20000,FRESH_TTL=60000,BACKOFF=[5000,15000,45000,120000];
async function fetchT(u,opt,ms=TIMEOUT){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
 try{return await fetch(u,Object.assign({signal:c.signal},opt))}catch(e){throw new Error(e.name==="AbortError"?"timed out":"offline or unreachable")}finally{clearTimeout(t)}}
// One live GET at a time: parallel calls queue up behind each other instead of racing the timeout.
// Priority: requests for the active screen (focus keys) jump ahead of background/other-screen requests.
const Q=[];let busy=false,focus=new Set();
function pump(){if(busy||!Q.length)return;let i=Q.findIndex(x=>focus.has(x.key));if(i<0)i=0;const it=Q.splice(i,1)[0];busy=true;
 Promise.resolve().then(it.fn).then(it.res,it.rej).finally(()=>{busy=false;pump()})}
function serial(fn,key){return new Promise((res,rej)=>{Q.push({fn,key,res,rej});pump()})}
function setFocus(keys){focus=new Set(keys||[])}
async function api_(params,body){const u=new URL(url());
 Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));u.searchParams.set("key",Key.get());
 // GET follows Apps Script's redirect; POST uses text/plain to avoid a CORS preflight.
 const r=await fetchT(u,body?{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"}:{redirect:"follow",cache:"no-store"});
 // Apps Script answers an HTML error page (not JSON) when the deployed project has no doGet/doPost, e.g. an empty or partial paste.
 const txt=await r.text();let j;try{j=JSON.parse(txt)}catch(e){
  if(/Script function not found/i.test(txt)){st.script="broken";throw new Error("script broken: deployed Apps Script has no "+(body?"doPost":"doGet"))}
  throw new Error("bad response (HTTP "+r.status+", not JSON)")}
 st.script="ok";if(j.error)throw new Error(j.error);return j}
const api=(params,body)=>body?api_(params,body):serial(()=>api_(params),params.kind||params.tab);
// Last good live rows per tab: memory + localStorage (dashboard data only; no key, no guest personal info beyond what the Sheet shows).
const LK=t=>"shifthub_live_"+t,good={},fail={},inflight={},timers={},unsup={};
function getGood(t){if(good[t])return good[t];try{const o=JSON.parse(localStorage.getItem(LK(t))||"null");if(o&&Array.isArray(o.rows))return good[t]=o}catch(e){}return null}
function setGood(t,rows){const o={rows,t:Date.now()};good[t]=o;try{localStorage.setItem(LK(t),JSON.stringify(o))}catch(e){}return o}
function reset(all){for(const k in fail)delete fail[k];for(const k in unsup)delete unsup[k];try{Object.keys(sessionStorage).filter(k=>k.startsWith("shifthub_unsup_")).forEach(k=>sessionStorage.removeItem(k))}catch(_){}for(const k in timers){clearTimeout(timers[k]);delete timers[k]}
 if(all){for(const k in good)delete good[k];try{Object.keys(localStorage).filter(k=>k.startsWith("shifthub_live_")).forEach(k=>localStorage.removeItem(k))}catch(e){}}
 else for(const k in good)good[k].t=0}
const emit=t=>{try{window.dispatchEvent(new CustomEvent("shifthub:data",{detail:{tab:t}}))}catch(e){}};
// Fetch one tab live. On failure: remember it for this tab only and retry in the background with backoff.
function refresh(t){if(inflight[t])return inflight[t];
 const p=api({tab:t}).then(j=>{const g=setGood(t,j.rows||[]);delete fail[t];clearTimeout(timers[t]);delete timers[t];st.ok=true;if(st.bad==="net")st.bad="";return g},
  e=>{console.warn("live load failed",t,e.message);
   if(/bad key/i.test(e.message)){st.bad="key";st.ok=false;throw e}
   // Older deployed Code.gs answers "bad tab" for tabs it does not know (e.g. Roster): the server is reachable, so no retry loop.
   if(/bad tab|bad kind|unknown tab/i.test(e.message)){unsup[t]=e.message;try{sessionStorage.setItem("shifthub_unsup_"+t,e.message)}catch(_){}delete fail[t];clearTimeout(timers[t]);delete timers[t];st.ok=true;if(st.bad==="net")st.bad="";throw e}
   st.bad="net";st.netAt=Date.now();const f=fail[t]=fail[t]||{n:0};f.n++;f.at=Date.now();f.msg=e.message;
   clearTimeout(timers[t]);timers[t]=setTimeout(()=>{delete timers[t];if(canTry()&&st.bad!=="key")refresh(t).then(()=>emit(t),()=>{})},BACKOFF[Math.min(f.n-1,BACKOFF.length-1)]);
   throw e}).finally(()=>{delete inflight[t]});
 return inflight[t]=p}
async function sample(t){if(t==="Meta")return{rows:[],live:false,src:"sample"};
 // Sample files are bundled in the service worker cache (cache-first), so this normally never touches the network.
 const r=await fetchT("data/sample/"+t.toLowerCase()+".json",{},SAMPLE_TIMEOUT);if(!r.ok)throw new Error("couldn't load "+t+" data");return{rows:await r.json(),live:false,src:"sample"}}
// load(tab): fresh live rows -> src "live"; last good live rows (cache) -> src "cached" (refreshes in background); else sample.
async function load(t,o={}){
 if(!canTry()||st.bad==="key")return sample(t);
 if(!unsup[t])try{const m=sessionStorage.getItem("shifthub_unsup_"+t);if(m){unsup[t]=m;const clr=()=>{delete unsup[t];try{sessionStorage.removeItem("shifthub_unsup_"+t)}catch(_){}emit(t)};refresh(t).then(clr,e=>{if(!/bad tab|bad kind|unknown tab/i.test(e.message))clr()})}}catch(_){}
 if(unsup[t])return{rows:[],live:true,src:"unsupported",at:0};
 const g=getGood(t),age=g?Date.now()-g.t:1e15;
 if(g&&!o.fresh&&age<FRESH_TTL&&!fail[t])return{rows:g.rows,live:true,src:"live",at:g.t};
 if(g&&!o.fresh){ // show saved data at once; refresh quietly and tell the app when new rows land
  if(!fail[t]||!timers[t])refresh(t).then(()=>emit(t),()=>emit(t));
  return{rows:g.rows,live:true,src:fail[t]?"cached":"live",at:g.t,refreshing:true}}
 try{const n=await refresh(t);return{rows:n.rows,live:true,src:"live",at:n.t}}
 catch(e){if(unsup[t])return{rows:[],live:true,src:"unsupported",at:0};const g2=getGood(t);if(g2&&st.bad!=="key")return{rows:g2.rows,live:true,src:"cached",at:g2.t};return sample(t)}}
const cached=t=>!!getGood(t);
const failed=t=>fail[t]||null,scriptBroken=()=>st.script==="broken",unsupported=t=>unsup[t]||"";
window.ShiftData={scriptBroken,setFocus,load,reset,cached,failed,unsupported,api,live,Key,status:st,hasUrl:()=>!!url()};
})();
