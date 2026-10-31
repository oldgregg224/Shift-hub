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
const WL=wrap(LocalAdapter),WA=wrap(guard(AppsScriptAdapter));
window.FloorCompat={needsUpdate:k=>OLD.has(k),slow:k=>SLOW.has(k)};
Object.defineProperty(window,"Floor",{get:()=>ShiftData.live()?WA:WL});
window.FloorPos={key:posKey,id:posId,dedupe};
})();
