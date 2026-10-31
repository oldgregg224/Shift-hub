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
Object.defineProperty(window,"Floor",{get:()=>ShiftData.live()?AppsScriptAdapter:LocalAdapter});
})();
