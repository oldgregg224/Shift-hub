/** Shift Hub backend. Paste into the "Shift Hub Data" sheet: Extensions > Apps Script.
 * Key lives in Project Settings > Script properties: SHIFTHUB_KEY. Never put the key in this file.
 * GET  ?key=K&tab=Brief|Labor|Events|Speed|SMG|Meta   -> {rows:[{header:value,...}]}
 * GET  ?key=K&action=list&kind=positions|breaks|checklist|fixes|handoff -> {rows}
 * POST ?key=K&action=add|update&kind=..(&id=..), body JSON (text/plain) -> Floor_<kind> tabs. */
const TABS=['Brief','Labor','Events','Speed','SMG','Meta'];
const KINDS=['positions','breaks','checklist','fixes','handoff'];
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function auth_(e){const k=PropertiesService.getScriptProperties().getProperty('SHIFTHUB_KEY');
  if(!k||String(e.parameter.key||'')!==k) throw new Error('bad key');}
function kind_(e){const kind=e.parameter.kind;if(KINDS.indexOf(kind)<0)throw new Error('bad kind');return kind;}
function floor_(kind){const ss=SpreadsheetApp.getActive();let s=ss.getSheetByName('Floor_'+kind);
  if(!s){s=ss.insertSheet('Floor_'+kind);s.appendRow(['id','ts','json']);}return s;}
function tabRows_(name){const s=SpreadsheetApp.getActive().getSheetByName(name);if(!s)return[];
  const v=s.getDataRange().getDisplayValues();const h=v.shift()||[];
  return v.filter(r=>r.some(c=>c!=='')).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o;});}
function floorRows_(s){const v=s.getDataRange().getValues();v.shift();
  return v.map(r=>Object.assign(JSON.parse(r[2]||'{}'),{id:String(r[0]),ts:r[1]}));}
function doGet(e){try{auth_(e);
  if(e.parameter.tab){if(TABS.indexOf(e.parameter.tab)<0)throw new Error('bad tab');return out_({rows:tabRows_(e.parameter.tab)});}
  if(e.parameter.action==='list')return out_({rows:floorRows_(floor_(kind_(e)))});
  throw new Error('bad request');}catch(err){return out_({error:err.message});}}
function doPost(e){try{auth_(e);const kind=kind_(e),s=floor_(kind),body=JSON.parse((e.postData&&e.postData.contents)||'{}');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{if(e.parameter.action==='add'){const id=Utilities.getUuid(),ts=new Date().toISOString();
      delete body.id;delete body.ts;s.appendRow([id,ts,JSON.stringify(body)]);return out_({row:Object.assign(body,{id,ts})});}
    if(e.parameter.action==='update'){const v=s.getDataRange().getValues();
      for(let i=1;i<v.length;i++){if(String(v[i][0])===String(e.parameter.id)){const o=Object.assign(JSON.parse(v[i][2]||'{}'),body);
        delete o.id;delete o.ts;s.getRange(i+1,3).setValue(JSON.stringify(o));return out_({ok:true});}}
      return out_({error:'not found'});}
    return out_({error:'bad action'});}finally{lock.releaseLock();}
}catch(err){return out_({error:err.message});}}
