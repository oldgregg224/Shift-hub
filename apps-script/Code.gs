/** Shift Hub floor-tools backend. Paste into the "Shift Hub Data" sheet: Extensions > Apps Script.
 * Set the shared key in Project Settings > Script properties: SHIFTHUB_KEY = <your key>. Never put the key in this file.
 * Rows live in tabs Floor_positions, Floor_breaks, Floor_checklist, Floor_fixes, Floor_handoff (created on first use). */
const KINDS = ['positions','breaks','checklist','fixes','handoff'];
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function check_(e){const k=PropertiesService.getScriptProperties().getProperty('SHIFTHUB_KEY');
  if(!k||e.parameter.key!==k) throw new Error('bad key');
  const kind=e.parameter.kind; if(KINDS.indexOf(kind)<0) throw new Error('bad kind'); return kind;}
function sheet_(kind){const ss=SpreadsheetApp.getActive();let s=ss.getSheetByName('Floor_'+kind);
  if(!s){s=ss.insertSheet('Floor_'+kind);s.appendRow(['id','ts','json']);} return s;}
function rows_(s){const v=s.getDataRange().getValues();v.shift();
  return v.map(r=>Object.assign(JSON.parse(r[2]||'{}'),{id:String(r[0]),ts:r[1]}));}
function doGet(e){try{const kind=check_(e);return out_({rows:rows_(sheet_(kind))});}catch(err){return out_({error:err.message});}}
function doPost(e){try{const kind=check_(e),s=sheet_(kind),body=JSON.parse(e.postData.contents||'{}');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{if(e.parameter.action==='add'){const id=Utilities.getUuid(),ts=new Date().toISOString();
      delete body.id;delete body.ts;s.appendRow([id,ts,JSON.stringify(body)]);return out_({row:Object.assign(body,{id,ts})});}
    if(e.parameter.action==='update'){const v=s.getDataRange().getValues();
      for(let i=1;i<v.length;i++){if(String(v[i][0])===e.parameter.id){const o=Object.assign(JSON.parse(v[i][2]||'{}'),body);
        delete o.id;delete o.ts;s.getRange(i+1,3).setValue(JSON.stringify(o));return out_({ok:true});}}
      return out_({error:'not found'});}
    return out_({error:'bad action'});}finally{lock.releaseLock();}
}catch(err){return out_({error:err.message});}}
