// Tabs: Brief, Labor, Events, Speed, SMG, Roster, Meta (sample file = data/sample/<tab lowercase>.json).
// Reads each tab from the Apps Script web app (GET ?key=..&tab=..), else bundled sample JSON.
(function(){
const Key={get:()=>localStorage.getItem("shifthub_key")||"",set:k=>{localStorage.setItem("shifthub_key",k||"");st.bad="";st.ok=false}};
const url=()=>(window.SHIFTHUB_CONFIG||{}).appsScriptUrl||"";
// st.bad: "" | "key" (server said bad key) | "net" (could not reach it). Reset when the key changes.
const st={bad:"",ok:false};
const canTry=()=>!!(url()&&Key.get());
const live=()=>canTry()&&!st.bad;
const TIMEOUT=8000;
async function fetchT(u,opt){const c=new AbortController(),t=setTimeout(()=>c.abort(),TIMEOUT);
 try{return await fetch(u,Object.assign({signal:c.signal},opt))}catch(e){throw new Error(e.name==="AbortError"?"timed out":"offline or unreachable")}finally{clearTimeout(t)}}
async function api(params,body){const u=new URL(url());
 Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));u.searchParams.set("key",Key.get());
 // GET follows Apps Script's redirect; POST uses text/plain to avoid a CORS preflight.
 const r=await fetchT(u,body?{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"}:{redirect:"follow",cache:"no-store"});
 let j;try{j=await r.json()}catch(e){throw new Error("bad response")}if(j.error)throw new Error(j.error);return j}
async function load(tab){
 if(canTry()&&!st.bad){try{const rows=(await api({tab})).rows;st.ok=true;return{rows,live:true}}
  catch(e){console.warn("live load failed",e.message);if(/bad key/i.test(e.message))st.bad="key";else if(!st.ok)st.bad="net"}}
 if(tab==="Meta")return{rows:[],live:false};
 const r=await fetchT("data/sample/"+tab.toLowerCase()+".json");if(!r.ok)throw new Error("couldn't load "+tab+" data");return{rows:await r.json(),live:false}}
window.ShiftData={load,api,live,Key,status:st,hasUrl:()=>!!url()};
})();
