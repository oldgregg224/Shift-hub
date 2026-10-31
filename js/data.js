// Tabs: Brief, Labor, Events, Speed, SMG, Roster, Comments, Meta (sample file = data/sample/<tab lowercase>.json).
// Reads each tab from the Apps Script web app (GET ?key=..&tab=..), else bundled sample JSON.
(function(){
// Key persistence: localStorage (primary) + cookie backup (1 yr). Never cleared automatically; only "Clear key" removes it.
const KN="shifthub_key";
function ck(){const m=document.cookie.match(/(?:^|; )shifthub_key=([^;]*)/);return m?decodeURIComponent(m[1]):""}
function ls(){try{return localStorage.getItem(KN)||""}catch(e){return ""}}
const Key={get:()=>{let k=ls();if(!k){k=ck();if(k)try{localStorage.setItem(KN,k)}catch(e){}}return k.trim()},
 set:k=>{k=String(k||"").trim();try{k?localStorage.setItem(KN,k):localStorage.removeItem(KN)}catch(e){}
  document.cookie=KN+"="+encodeURIComponent(k)+";path=/;max-age="+(k?31536000:0)+";SameSite=Strict;Secure";
  st.bad="";st.ok=false;st.netAt=0;reset()}};
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
// In-memory results + in-flight de-dupe: screens render instantly from memo, and two screens asking for the same tab share one request.
const memo={},inflight={};const LIVE_TTL=30000;
function reset(){for(const k in memo)delete memo[k]}
const url=()=>(window.SHIFTHUB_CONFIG||{}).appsScriptUrl||"";
// st.bad: "" | "key" (server said bad key) | "net" (could not reach it). Reset when the key changes.
const st={bad:"",ok:false,netAt:0};const NET_RETRY=20000;
const canTry=()=>!!(url()&&Key.get());
const live=()=>canTry()&&st.bad!=="key"&&st.ok;
const TIMEOUT=25000,SAMPLE_TIMEOUT=20000;
async function fetchT(u,opt,ms=TIMEOUT){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
 try{return await fetch(u,Object.assign({signal:c.signal},opt))}catch(e){throw new Error(e.name==="AbortError"?"timed out":"offline or unreachable")}finally{clearTimeout(t)}}
async function api(params,body){const u=new URL(url());
 Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));u.searchParams.set("key",Key.get());
 // GET follows Apps Script's redirect; POST uses text/plain to avoid a CORS preflight.
 const r=await fetchT(u,body?{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"}:{redirect:"follow",cache:"no-store"});
 let j;try{j=await r.json()}catch(e){throw new Error("bad response")}if(j.error)throw new Error(j.error);return j}
function load(tab,o={}){const m=memo[tab];
 if(!o.fresh&&m&&(Date.now()-m.t<(m.live?LIVE_TTL:(canTry()&&st.bad!=="key"?NET_RETRY:1e12))))return Promise.resolve(m.v);
 if(inflight[tab])return inflight[tab];
 const p=load_(tab).then(v=>{memo[tab]={v,t:Date.now(),live:v.live};return v}).finally(()=>{delete inflight[tab]});
 return inflight[tab]=p}
const cached=tab=>!!memo[tab];
async function load_(tab){
 // Only a server "bad key" sticks (until the key is changed). Network/timeout errors retry after NET_RETRY ms and never touch the key.
 if(canTry()&&st.bad!=="key"&&!(st.bad==="net"&&Date.now()-st.netAt<NET_RETRY)){
  try{const rows=(await api({tab})).rows;st.ok=true;st.bad="";return{rows,live:true}}
  catch(e){console.warn("live load failed",e.message);if(/bad key/i.test(e.message)){st.bad="key";st.ok=false}else{st.bad="net";st.netAt=Date.now()}}}
 if(tab==="Meta")return{rows:[],live:false};
 // Sample files are bundled in the service worker cache (cache-first), so this normally never touches the network.
 const r=await fetchT("data/sample/"+tab.toLowerCase()+".json",{},SAMPLE_TIMEOUT);if(!r.ok)throw new Error("couldn't load "+tab+" data");return{rows:await r.json(),live:false}}
window.ShiftData={load,reset,cached,api,live,Key,status:st,hasUrl:()=>!!url()};
})();
