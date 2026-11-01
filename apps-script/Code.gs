const SHEET_ID='1l38D2P-4PChIBz9gwbMJbe416WYJdaMKucXFQlQQzKY';
function ss_(){return SpreadsheetApp.openById(SHEET_ID);}
/** Shift Hub backend. Paste into the "Shift Hub Data" sheet: Extensions > Apps Script.
 * Key lives in Project Settings > Script properties: SHIFTHUB_KEY. Never put the key in this file.
 * GET  ?key=K&tab=Brief|Labor|Events|Speed|SMG|Roster|Comments|Meta|Coverage   -> {rows:[{header:value,...}]}
 * GET  ?key=K&action=list&kind=positions|breaks|checklist|fixes|handoff -> {rows}
 * GET  ?key=K&action=list&kind=inventory|waste|equipment|crewnotes -> {rows}
 * POST ?key=K&action=add|update|upsert&kind=..(&id=..), body JSON (text/plain) -> Floor_<kind> tabs.
 * POST ?key=K&action=delete&kind=..&id=..  -> removes that row.
 * GET  ?action=ping (no key) -> {ok:true,version} to check which Code.gs is deployed.
 * Tools kinds are stored one field per column (lowercase headers) so other bots can read them. */
const TABS=['Brief','Labor','Events','Speed','SMG','Roster','Comments','Meta','Coverage','Crew','Skills','Availability','DaysOff','WeekHours','SchoolCal'];
const KINDS=['positions','breaks','checklist','fixes','handoff','inventory','waste','equipment','crewnotes'];
const COLS={
  inventory:{sheet:'Floor_Inventory',cols:['item','unit','on_hand','par']},
  waste:{sheet:'Floor_Waste',cols:['date','time','item','qty','reason']},
  equipment:{sheet:'Floor_Equipment',cols:['equipment','issue','reported_by','status','fixer','updated']},
  crewnotes:{sheet:'Floor_CrewNotes',cols:['date','first_name','type','note']}};
function cell_(v){v=v==null?'':v;return typeof v==='string'&&/^[=+\-@]/.test(v)?"'"+v:v;}
function iso_(v){return v instanceof Date?v.toISOString():String(v);}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function auth_(e){const k=PropertiesService.getScriptProperties().getProperty('SHIFTHUB_KEY');
  if(!k||String(e.parameter.key||'')!==k) throw new Error('bad key');}
function kind_(e){const kind=e.parameter.kind;if(KINDS.indexOf(kind)<0)throw new Error('bad kind');return kind;}
function floor_(kind){const ss=ss_(),c=COLS[kind],name=c?c.sheet:'Floor_'+kind;let s=ss.getSheetByName(name);
  if(!s){s=ss.insertSheet(name);s.appendRow(c?['id','ts'].concat(c.cols):['id','ts','json']);s.setFrozenRows(1);}return s;}
function tabRows_(name){const s=ss_().getSheetByName(name);if(!s)return[];
  const v=s.getDataRange().getDisplayValues();const h=v.shift()||[];
  return v.filter(r=>r.some(c=>c!=='')).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o;});}
function floorRows_(s,kind){const tz=ss_().getSpreadsheetTimeZone();const v=s.getDataRange().getValues();const h=v.shift()||[];
  if(COLS[kind])return v.filter(r=>r.some(x=>x!=='')).map(r=>{const o={};h.forEach((k,i)=>o[k]=k==='ts'?iso_(r[i]):(r[i] instanceof Date?(k==='date'?Utilities.formatDate(r[i],tz,'yyyy-MM-dd'):k==='time'?Utilities.formatDate(r[i],tz,'HH:mm'):iso_(r[i])):r[i]));o.id=String(o.id);return o;});
  return v.map(r=>Object.assign(JSON.parse(r[2]||'{}'),{id:String(r[0]),ts:r[1]}));}
const VERSION='v27';
function doGet(e){try{if(e.parameter.action==='ping')return out_({ok:true,version:VERSION});auth_(e);
  if(e.parameter.tab){if(TABS.indexOf(e.parameter.tab)<0)throw new Error('bad tab');return out_({rows:tabRows_(e.parameter.tab)});}
  if(e.parameter.action==='list')return out_({rows:floorRows_(floor_(kind_(e)),e.parameter.kind)});
  throw new Error('bad request');}catch(err){return out_({error:err.message});}}
function doPost(e){try{auth_(e);const kind=kind_(e),s=floor_(kind),body=JSON.parse((e.postData&&e.postData.contents)||'{}');
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{if(e.parameter.action==='add'){const id=Utilities.getUuid(),ts=new Date().toISOString();
      delete body.id;delete body.ts;const c=COLS[kind];
      s.appendRow(c?[id,ts].concat(c.cols.map(k=>cell_(body[k]))):[id,ts,JSON.stringify(body)]);return out_({row:Object.assign(body,{id,ts})});}
    if(e.parameter.action==='upsert'){const id=String(e.parameter.id||'');if(!id)throw new Error('missing id');
      const ts=new Date().toISOString(),c=COLS[kind];delete body.id;delete body.ts;
      const row=c?[id,ts].concat(c.cols.map(k=>cell_(body[k]))):[id,ts,JSON.stringify(body)];
      const v=s.getDataRange().getValues();let hit=0;
      for(let i=v.length-1;i>=1;i--){if(String(v[i][0])===id){if(!hit){s.getRange(i+1,1,1,row.length).setValues([row]);hit=1;}else s.deleteRow(i+1);}}
      if(!hit)s.appendRow(row);return out_({row:Object.assign(body,{id,ts})});}
    if(e.parameter.action==='update'){const v=s.getDataRange().getValues();
      const c=COLS[kind],h=v[0];
      for(let i=1;i<v.length;i++){if(String(v[i][0])===String(e.parameter.id)){
        if(c){c.cols.forEach(k=>{if(k in body){const j=h.indexOf(k);if(j>=0)s.getRange(i+1,j+1).setValue(cell_(body[k]));}});return out_({ok:true});}
        const o=Object.assign(JSON.parse(v[i][2]||'{}'),body);
        delete o.id;delete o.ts;s.getRange(i+1,3).setValue(JSON.stringify(o));return out_({ok:true});}}
      return out_({error:'not found'});}
    if(e.parameter.action==='delete'){const id=String(e.parameter.id||'');if(!id)throw new Error('missing id');
      const v=s.getDataRange().getValues();let n=0;for(let i=v.length-1;i>=1;i--){if(String(v[i][0])===id){s.deleteRow(i+1);n++;}}
      return n?out_({ok:true,deleted:n}):out_({error:'not found'});}
    return out_({error:'bad action'});}finally{lock.releaseLock();}
}catch(err){return out_({error:err.message});}}
