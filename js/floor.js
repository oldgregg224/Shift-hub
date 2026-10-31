// Pluggable floor-tools storage: list(kind), add(kind,row), update(kind,id,patch).
(function(){
const LocalAdapter={name:"This phone only",_k:k=>"shifthub_floor_"+k,
 async list(k){return JSON.parse(localStorage.getItem(this._k(k))||"[]")},
 async add(k,row){const a=await this.list(k);row.id=Date.now()+""+Math.random().toString(36).slice(2,6);row.ts=new Date().toISOString();a.push(row);localStorage.setItem(this._k(k),JSON.stringify(a));return row},
 async update(k,id,p){const a=await this.list(k);const i=a.findIndex(x=>x.id==id);if(i>=0){Object.assign(a[i],p);localStorage.setItem(this._k(k),JSON.stringify(a))}},
 async remove(k,id){const a=await this.list(k);localStorage.setItem(this._k(k),JSON.stringify(a.filter(x=>x.id!=id)))}};
const txt=r=>r&&typeof r.time==="string"&&/^\d{1,2}:\d\d$/.test(r.time)?Object.assign({},r,{time:"'"+r.time}):r;
const AppsScriptAdapter={name:"Shared (Google Sheet)",
 async list(k){return (await ShiftData.api({action:"list",kind:k})).rows},
 async add(k,row){return (await ShiftData.api({action:"add",kind:k},txt(row))).row},
 async update(k,id,p){return ShiftData.api({action:"update",kind:k,id},p)},
 async remove(k,id){try{return await ShiftData.api({action:"delete",kind:k,id},{})}
  catch(e){if(/bad action/i.test(e.message))throw new Error("delete needs the latest Shift Hub Apps Script");throw e}}};
// Positions: one row per person per shift (date+shift+name). Stable id = that key; latest ts wins.
const posKey=r=>[r.date||"",r.shift||"",String(r.name||"").trim().toLowerCase()].join("|");
const posId=r=>"pos|"+posKey(r);
function dedupe(rows){const m=new Map();(rows||[]).forEach((r,i)=>{const k=posKey(r),o=m.get(k);
 if(!o||String(r.ts||"")>=String(o.r.ts||""))m.set(k,{r,i})});return [...m.values()].sort((a,b)=>a.i-b.i).map(x=>x.r)}
LocalAdapter.place=async function(row){const k=this._k("positions"),a=JSON.parse(localStorage.getItem(k)||"[]");
 row=Object.assign({},row,{id:posId(row),ts:new Date().toISOString()});
 const b=a.filter(x=>posKey(x)!==posKey(row));b.push(row);localStorage.setItem(k,JSON.stringify(b));return row};
AppsScriptAdapter.place=async function(row){const id=posId(row);
 try{return (await ShiftData.api({action:"upsert",kind:"positions",id},row)).row}
 catch(e){if(/bad action/i.test(e.message))return this.add("positions",row);throw e}}; // older Code.gs: append; list() still keeps latest
function wrap(A){return {name:A.name,add:(k,r)=>k==="positions"?A.place(r):A.add(k,r),update:(k,i,p)=>A.update(k,i,p),remove:(k,i)=>A.remove(k,i),place:r=>A.place(r),
 async list(k){const rows=await A.list(k);if(k!=="positions")return rows;const d=dedupe(rows);
  if(A===LocalAdapter&&d.length!==rows.length)localStorage.setItem(A._k(k),JSON.stringify(d));return d}}}
// Older deployed Code.gs only knows positions/breaks/checklist/fixes/handoff and answers "bad kind" for the Tools kinds.
// Then those kinds use this phone's storage and the app shows "Tools need the Apps Script update".
const OLD=new Set();const isBadKind=e=>/bad kind/i.test(e&&e.message||"");
const TOOLK=new Set(["inventory","waste","equipment","crewnotes"]),SLOW=new Set();
// Tools reads never hang the screen: after 15s (or any non-key error) they fall back to this phone's copy.
const within=(p,ms)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j(new Error("timed out")),ms))]);
function guard(A){const g=(k,fn,loc,read)=>OLD.has(k)?loc():(read&&TOOLK.has(k)?within(fn(),15000):fn()).then(v=>{SLOW.delete(k);return v},e=>{if(isBadKind(e)){OLD.add(k);return loc()}
  if(read&&TOOLK.has(k)&&!/bad key/i.test(e.message||"")){SLOW.add(k);return loc()}throw e});
 return {name:A.name,list:k=>g(k,()=>A.list(k),()=>LocalAdapter.list(k),1),add:(k,r)=>g(k,()=>A.add(k,r),()=>LocalAdapter.add(k,r)),
  update:(k,i,p)=>g(k,()=>A.update(k,i,p),()=>LocalAdapter.update(k,i,p)),
  remove:(k,i)=>OLD.has(k)?LocalAdapter.remove(k,i):A.remove(k,i),place:r=>A.place(r)}}
// v21: shared lists are memoized for 20s (late repaints reuse them instead of refetching) and entries saved on this
// phone while the shared Sheet was unreachable are kept, shown as pending, and re-sent once the shared list loads.
const normDate=v=>{v=v==null?"":String(v);const m=v.match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d)/);if(!m)return v;
 if(m[2]==="00"&&m[3]==="00")return m[1];const d=new Date(v);return isNaN(d)?m[1]:d.toLocaleDateString("en-CA",{timeZone:"America/New_York"})};
const NYT=new Intl.DateTimeFormat("en-GB",{timeZone:"America/New_York",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
// Sheets time-only cells arrive as 1899-12-30T..Z; any ISO value in a "time" field is shown as HH:mm (New York).
const fmtTime=v=>{v=v==null?"":String(v);if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(v))return v;const d=new Date(v);return isNaN(d)?v:NYT.format(d)};
// Sheets time-only cells come back as 1899-12-30T..Z shifted by the spreadsheet's (unknown) 1899 offset. Read the wall time
// under the plausible offsets (UTC, New York 1899/EST/EDT) and keep the one closest to when the row was saved (ts, New York).
const hm=m=>String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const t1899=(v,ts)=>{const d=new Date(v);if(isNaN(d))return v;const u=d.getUTCHours()*60+d.getUTCMinutes()+(d.getUTCSeconds()>=30?1:0);
 const c=[u,u-296,u-300,u-240].map(m=>((m%1440)+1440)%1440);const t=ts&&!isNaN(new Date(ts))?NYT.format(new Date(ts)).split(":").map(Number):null;
 if(!t)return hm(c[0]);const tm=t[0]*60+t[1],dist=m=>{const x=Math.abs(m-tm)%1440;return Math.min(x,1440-x)};return hm(c.reduce((a,b)=>dist(b)<dist(a)?b:a))};
const norm=r=>{if(!r||typeof r!=="object")return r;for(const k in r){let v=r[k];if(typeof v!=="string")continue;
  if(k==="date")r[k]=normDate(v);
  else if(/^1899-12-3[01]T/.test(v))r[k]=t1899(v,r.ts);
  else if(k==="time"){v=v.replace(/^'/,"");r[k]=/^\d{4}-\d\d-\d\dT/.test(v)?fmtTime(v):v}}return r};
const TK=k=>"shifthub_tomb_"+k;
const tombs=k=>{try{const t=JSON.parse(localStorage.getItem(TK(k))||"{}"),now=Date.now();for(const i in t)if(now-t[i]>36e5)delete t[i];return t}catch(e){return{}}};
const tomb=(k,id)=>{try{const t=tombs(k);t[id]=Date.now();localStorage.setItem(TK(k),JSON.stringify(t))}catch(e){}};
const untomb=(k,rows)=>{const t=tombs(k);return Object.keys(t).length?rows.filter(x=>!(String(x.id) in t)):rows};
const dropCache=(k,id)=>{for(const key of ["shifthub_flc_"+k,"shifthub_shared_"+k])try{const a=JSON.parse(localStorage.getItem(key)||"null");if(Array.isArray(a))localStorage.setItem(key,JSON.stringify(a.filter(x=>String(x.id)!==String(id))))}catch(e){}};
function shared(W){const MEMO={},FL={},RECENT={},DAY=864e5,SK=k=>"shifthub_shared_"+k;
 // Last good shared list per kind (persisted) so offline/unreachable still shows shared notes, plus local pending ones.
 const saveShared=(k,v)=>{MEMO[k]={v,t:Date.now()};try{localStorage.setItem(SK(k),JSON.stringify(v))}catch(e){}};
 const savedShared=k=>{if(MEMO[k])return MEMO[k].v;try{return JSON.parse(localStorage.getItem(SK(k))||"[]").map(norm)}catch(e){return[]}};
 const emit=k=>{try{window.dispatchEvent(new CustomEvent("shifthub:floorsync",{detail:{kind:k}}))}catch(e){}};
 // Rows the server accepted in the last 2 min stay merged in until a server list contains them (avoids flicker
 // when a list fetch that started before the save lands after it).
 const withRecent=(k,rows)=>{const r=RECENT[k]||[],ids=new Set(rows.map(x=>String(x.id)));RECENT[k]=r.filter(x=>!ids.has(String(x.id))&&Date.now()-x._at<12e4);
  return rows.concat(RECENT[k].map(x=>{const y=Object.assign({},x);delete y._at;return y}))};
 const pend=async k=>(await LocalAdapter.list(k)).filter(x=>Date.now()-Date.parse(x.ts||0)<=DAY).map(x=>Object.assign({},x,{_pending:1}));
 const flush=async k=>{if(FL[k]||OLD.has(k)||k==="positions"||navigator.onLine===false)return;FL[k]=1;let n=0;
  try{for(const x of await LocalAdapter.list(k)){if(Date.now()-Date.parse(x.ts||0)>DAY)continue;
   const row=Object.assign({},x);delete row.id;delete row.ts;delete row._pending;
   try{const got=norm(await W.add(k,row));if(OLD.has(k)){if(got&&got.id)await LocalAdapter.remove(k,got.id);break}(RECENT[k]=RECENT[k]||[]).push(Object.assign({},got,{_at:Date.now()}));
    if(MEMO[k])MEMO[k].v.push(got);await LocalAdapter.remove(k,x.id);n++;emit(k)}catch(e){break}}}finally{FL[k]=0}return n};
 let FA=0;const flushAll=()=>{if(!ShiftData.Key.get()||Date.now()-FA<3000)return;FA=Date.now();Object.keys(localStorage).filter(x=>x.startsWith("shifthub_floor_")).map(x=>x.slice(15)).forEach(k=>{if(k!=="positions")flush(k)})};
 window.addEventListener("online",()=>{FA=0;flushAll();setTimeout(()=>{FA=0;flushAll()},3000)});window.FloorSync=flushAll;
 // DevTools/OS may not fire "online": retry every 15s while anything is pending.
 setInterval(()=>{if(navigator.onLine!==false&&Object.keys(localStorage).some(x=>x.startsWith("shifthub_floor_")&&x!=="shifthub_floor_positions"&&localStorage.getItem(x)!=="[]"))flushAll()},15000);
 window.addEventListener("shifthub:data",()=>flushAll());document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")flushAll()});
 return {name:W.name,place:r=>W.place(r),flush,
  async list(k){if(k==="positions")return W.list(k);const m=MEMO[k];
   if(m&&Date.now()-m.t<20000)return untomb(k,withRecent(k,m.v).concat(await pend(k)));
   let rows;if(navigator.onLine===false)rows=savedShared(k);
   else{rows=(await W.list(k)).map(norm);if(OLD.has(k))return rows;
    if(SLOW.has(k))rows=savedShared(k); // unreachable: guard returned this phone's list; show the saved shared one instead
    else saveShared(k,rows)}
   const p=await pend(k);if(p.length&&!SLOW.has(k))flush(k);return untomb(k,withRecent(k,rows).concat(p))},
  // Save = accept on this phone first (pending), then send in the background. Never fails unless the key is bad.
  async add(k,r){if(k==="positions"||OLD.has(k))return W.add(k,r);
   const x=await LocalAdapter.add(k,Object.assign({},r));flush(k);return Object.assign({},x,{_pending:1})},
  async update(k,i,p){const v=await W.update(k,i,p);const m=MEMO[k];if(m){const x=m.v.find(y=>y.id==i);if(x)Object.assign(x,p)}return v},
  async remove(k,i){tomb(k,i);dropCache(k,i);if(MEMO[k])MEMO[k].v=MEMO[k].v.filter(y=>y.id!=i);if(String(i).length&&(await LocalAdapter.list(k)).some(x=>x.id==i)&&!OLD.has(k)){await LocalAdapter.remove(k,i);return {ok:true}}
   const v=await W.remove(k,i);if(MEMO[k])saveShared(k,MEMO[k].v.filter(y=>y.id!=i));if(RECENT[k])RECENT[k]=RECENT[k].filter(y=>y.id!=i);return v}}}
const WL=wrap(LocalAdapter),WA=shared(wrap(guard(AppsScriptAdapter)));
window.FloorCompat={t1899,normDate,fmtTime,norm,untomb,needsUpdate:k=>OLD.has(k),slow:k=>SLOW.has(k)};
// Shared mode whenever a key is set and was not rejected (also before the first live load, offline or unreachable) and was not rejected, so saved shared lists + pending show.
Object.defineProperty(window,"Floor",{get:()=>ShiftData.live()||(ShiftData.hasUrl()&&ShiftData.Key.get()&&ShiftData.status.bad!=="key")?WA:WL});
window.FloorPos={key:posKey,id:posId,dedupe};
})();
