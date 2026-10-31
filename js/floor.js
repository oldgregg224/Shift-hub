// Pluggable floor-tools storage: list(kind), add(kind,row), update(kind,id,patch).
(function(){
const LocalAdapter={name:"This phone only",_k:k=>"shifthub_floor_"+k,
 async list(k){return JSON.parse(localStorage.getItem(this._k(k))||"[]")},
 async add(k,row){const a=await this.list(k);row.id=Date.now()+""+Math.random().toString(36).slice(2,6);row.ts=new Date().toISOString();a.push(row);localStorage.setItem(this._k(k),JSON.stringify(a));return row},
 async update(k,id,p){const a=await this.list(k);const i=a.findIndex(x=>x.id==id);if(i>=0){Object.assign(a[i],p);localStorage.setItem(this._k(k),JSON.stringify(a))}}};
const AppsScriptAdapter={name:"Shared (Google Sheet)",
 async list(k){return (await ShiftData.api({action:"list",kind:k})).rows},
 async add(k,row){return (await ShiftData.api({action:"add",kind:k},row)).row},
 async update(k,id,p){return ShiftData.api({action:"update",kind:k,id},p)}};
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
function wrap(A){return {name:A.name,add:(k,r)=>k==="positions"?A.place(r):A.add(k,r),update:(k,i,p)=>A.update(k,i,p),place:r=>A.place(r),
 async list(k){const rows=await A.list(k);if(k!=="positions")return rows;const d=dedupe(rows);
  if(A===LocalAdapter&&d.length!==rows.length)localStorage.setItem(A._k(k),JSON.stringify(d));return d}}}
const WL=wrap(LocalAdapter),WA=wrap(AppsScriptAdapter);
Object.defineProperty(window,"Floor",{get:()=>ShiftData.live()?WA:WL});
window.FloorPos={key:posKey,id:posId,dedupe};
})();
