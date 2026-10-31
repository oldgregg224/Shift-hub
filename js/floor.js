// Pluggable floor-tools storage: list(kind), add(kind,row), update(kind,id,patch).
(function(){
const LocalAdapter={name:"This phone only",_k:k=>"shifthub_floor_"+k,
 async list(k){return JSON.parse(localStorage.getItem(this._k(k))||"[]")},
 async add(k,row){const a=await this.list(k);row.id=Date.now()+""+Math.random().toString(36).slice(2,6);row.ts=new Date().toISOString();a.push(row);localStorage.setItem(this._k(k),JSON.stringify(a));return row},
 async update(k,id,p){const a=await this.list(k);const i=a.findIndex(x=>x.id==id);if(i>=0){Object.assign(a[i],p);localStorage.setItem(this._k(k),JSON.stringify(a))}},
 async remove(k,id){const a=await this.list(k);localStorage.setItem(this._k(k),JSON.stringify(a.filter(x=>x.id!=id)))}};
const AppsScriptAdapter={name:"Shared (Google Sheet)",
 async list(k){return (await ShiftData.api({action:"list",kind:k})).rows},
 async add(k,row){return (await ShiftData.api({action:"add",kind:k},row)).row},
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
 if(m[2]==="00"&&m[3]==="00")return m[1];const d=new Date(v);return isNaN(d)?m[1]:d.toLocaleDateString("en-CA")};
const norm=r=>{if(r&&"date" in r)r.date=normDate(r.date);return r};
function shared(W){const MEMO={},FL={},RECENT={},DAY=864e5,SK=k=>"shifthub_shared_"+k;
 // Last good shared list per kind (persisted) so offline/unreachable still shows shared notes, plus local pending ones.
 const saveShared=(k,v)=>{MEMO[k]={v,t:Date.now()};try{localStorage.setItem(SK(k),JSON.stringify(v))}catch(e){}};
 const savedShared=k=>{if(MEMO[k])return MEMO[k].v;try{return JSON.parse(localStorage.getItem(SK(k))||"[]")}catch(e){return[]}};
 const emit=k=>{try{window.dispatchEvent(new CustomEvent("shifthub:floorsync",{detail:{kind:k}}))}catch(e){}};
 // Rows the server accepted in the last 2 min stay merged in until a server list contains them (avoids flicker
 // when a list fetch that started before the save lands after it).
 const withRecent=(k,rows)=>{const r=RECENT[k]||[],ids=new Set(rows.map(x=>String(x.id)));RECENT[k]=r.filter(x=>!ids.has(String(x.id))&&Date.now()-x._at<12e4);
  return rows.concat(RECENT[k].map(x=>{const y=Object.assign({},x);delete y._at;return y}))};
 const pend=async k=>(await LocalAdapter.list(k)).filter(x=>Date.now()-Date.parse(x.ts||0)<=DAY).map(x=>Object.assign({},x,{_pending:1}));
 const flush=async k=>{if(FL[k]||OLD.has(k)||k==="positions"||navigator.onLine===false)return;FL[k]=1;let n=0;
  try{for(const x of await LocalAdapter.list(k)){if(Date.now()-Date.parse(x.ts||0)>DAY)continue;
   const row=Object.assign({},x);delete row.id;delete row.ts;delete row._pending;
   try{const got=norm(await W.add(k,row));if(OLD.has(k))break;(RECENT[k]=RECENT[k]||[]).push(Object.assign({},got,{_at:Date.now()}));
    if(MEMO[k])MEMO[k].v.push(got);await LocalAdapter.remove(k,x.id);n++;emit(k)}catch(e){break}}}finally{FL[k]=0}return n};
 const flushAll=()=>{if(!ShiftData.Key.get())return;Object.keys(localStorage).filter(x=>x.startsWith("shifthub_floor_")).map(x=>x.slice(15)).forEach(k=>{if(k!=="positions")flush(k)})};
 window.addEventListener("online",flushAll);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")flushAll()});
 return {name:W.name,place:r=>W.place(r),flush,
  async list(k){if(k==="positions")return W.list(k);const m=MEMO[k];
   if(m&&Date.now()-m.t<20000)return withRecent(k,m.v).concat(await pend(k));
   let rows;if(navigator.onLine===false)rows=savedShared(k);
   else{rows=(await W.list(k)).map(norm);if(OLD.has(k))return rows;
    if(SLOW.has(k))rows=savedShared(k); // unreachable: guard returned this phone's list; show the saved shared one instead
    else saveShared(k,rows)}
   const p=await pend(k);if(p.length&&!SLOW.has(k))flush(k);return withRecent(k,rows).concat(p)},
  // Save = accept on this phone first (pending), then send in the background. Never fails unless the key is bad.
  async add(k,r){if(k==="positions"||OLD.has(k))return W.add(k,r);
   const x=await LocalAdapter.add(k,Object.assign({},r));flush(k);return Object.assign({},x,{_pending:1})},
  async update(k,i,p){const v=await W.update(k,i,p);const m=MEMO[k];if(m){const x=m.v.find(y=>y.id==i);if(x)Object.assign(x,p)}return v},
  async remove(k,i){if(String(i).length&&(await LocalAdapter.list(k)).some(x=>x.id==i)&&!OLD.has(k)){await LocalAdapter.remove(k,i);return {ok:true}}
   const v=await W.remove(k,i);if(MEMO[k])saveShared(k,MEMO[k].v.filter(y=>y.id!=i));if(RECENT[k])RECENT[k]=RECENT[k].filter(y=>y.id!=i);return v}}}
const WL=wrap(LocalAdapter),WA=shared(wrap(guard(AppsScriptAdapter)));
window.FloorCompat={normDate,needsUpdate:k=>OLD.has(k),slow:k=>SLOW.has(k)};
// Shared mode also when offline/unreachable but a key is set and was not rejected, so saved shared lists + pending show.
Object.defineProperty(window,"Floor",{get:()=>ShiftData.live()||(ShiftData.hasUrl()&&ShiftData.Key.get()&&ShiftData.status.bad!=="key"&&(navigator.onLine===false||ShiftData.status.bad==="net"))?WA:WL});
window.FloorPos={key:posKey,id:posId,dedupe};
})();
