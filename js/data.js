// Reads each tab from the Apps Script web app (GET ?key=..&tab=..), else bundled sample JSON.
(function(){
const Key={get:()=>localStorage.getItem("shifthub_key")||"",set:k=>localStorage.setItem("shifthub_key",k||"")};
const url=()=>(window.SHIFTHUB_CONFIG||{}).appsScriptUrl||"";
const live=()=>!!(url()&&Key.get());
async function api(params,body){const u=new URL(url());
 Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));u.searchParams.set("key",Key.get());
 // GET follows Apps Script's redirect; POST uses text/plain to avoid a CORS preflight.
 const r=await fetch(u,body?{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body),redirect:"follow"}:{redirect:"follow",cache:"no-store"});
 const j=await r.json();if(j.error)throw new Error(j.error);return j}
async function load(tab){
 if(live()){try{return{rows:(await api({tab})).rows,live:true}}catch(e){console.warn("live load failed",e)}}
 if(tab==="Meta")return{rows:[],live:false};
 const r=await fetch("data/sample/"+tab.toLowerCase()+".json");return{rows:await r.json(),live:false}}
window.ShiftData={load,api,live,Key,hasUrl:()=>!!url()};
})();
