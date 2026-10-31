// Pluggable floor-tools storage. Both adapters: list(kind) -> [rows], add(kind,row), update(kind,id,patch).
(function(){
const LocalAdapter={name:"This phone only",
 _k:k=>"shifthub_floor_"+k,
 async list(k){return JSON.parse(localStorage.getItem(this._k(k))||"[]")},
 async add(k,row){const a=await this.list(k);row.id=Date.now()+""+Math.random().toString(36).slice(2,6);row.ts=new Date().toISOString();a.push(row);localStorage.setItem(this._k(k),JSON.stringify(a));return row},
 async update(k,id,p){const a=await this.list(k);const i=a.findIndex(x=>x.id==id);if(i>=0){Object.assign(a[i],p);localStorage.setItem(this._k(k),JSON.stringify(a))}}};
// Stub for the shared Apps Script web app (apps-script/Code.gs). Not active until config.floorAdapter="appsscript" and appsScriptUrl set.
const AppsScriptAdapter={name:"Shared (Google Sheet)",
 key(){return localStorage.getItem("shifthub_key")||""},
 async _call(params,body){const u=new URL(window.SHIFTHUB_CONFIG.appsScriptUrl);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));u.searchParams.set("key",this.key());
  const r=await fetch(u,body?{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(body)}:{});
  const j=await r.json();if(j.error)throw new Error(j.error);return j},
 async list(k){return (await this._call({action:"list",kind:k})).rows},
 async add(k,row){return (await this._call({action:"add",kind:k},row)).row},
 async update(k,id,p){return this._call({action:"update",kind:k,id},p)}};
const c=window.SHIFTHUB_CONFIG;
window.Floor=(c.floorAdapter==="appsscript"&&c.appsScriptUrl)?AppsScriptAdapter:LocalAdapter;
})();
