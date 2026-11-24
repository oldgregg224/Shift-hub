const SHEET_ID='1l38D2P-4PChIBz9gwbMJbe416WYJdaMKucXFQlQQzKY';
function ss_(){return SpreadsheetApp.openById(SHEET_ID);}
/** Shift Hub backend. Lives in the standalone Shift Hub Apps Script project (opens the Sheet by id). After pasting: Deploy > Manage deployments > edit > New version.
 * Key lives in Project Settings > Script properties: SHIFTHUB_KEY. Never put the key in this file.
 * GET  ?key=K&tab=<any name in TABS below, e.g. Brief|Speed|ShiftGoals|ShiftGrades|Callouts|Tasks> -> {rows:[{header:value,...}]}
 * GET  ?key=K&action=list&kind=positions|breaks|checklist|fixes|handoff -> {rows}
 * GET  ?key=K&action=list&kind=inventory|waste|equipment|crewnotes -> {rows}
 * POST ?key=K&action=add|update|upsert&kind=..(&id=..), body JSON (text/plain) -> Floor_<kind> tabs.
 * POST ?key=K&action=delete&kind=..&id=..  -> removes that row.
 * POST ?key=K&action=task_add|task_done|task_undo|task_delete, body JSON -> Tasks tab only.
 * GET  ?action=ping (no key) -> {ok:true,version} to check which Code.gs is deployed.
 * Tools kinds are stored one field per column (lowercase headers) so other bots can read them. */
const TABS=['Brief','Labor','Events','Speed','SMG','Roster','Comments','Meta','Coverage','Crew','Skills','Availability','DaysOff','WeekHours','SchoolCal','OutOfStock','PreRush','OTRisk','ShiftGoals','ShiftGrades','Callouts','Tasks'];
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
const VERSION='v30';
function doGet(e){try{if(e.parameter.action==='ping')return out_({ok:true,version:VERSION});auth_(e);
  if(e.parameter.tab){if(TABS.indexOf(e.parameter.tab)<0)throw new Error('bad tab');
    if(e.parameter.tab==='Tasks'){const lock=LockService.getScriptLock();lock.waitLock(10000);try{tasksSheet_()}finally{lock.releaseLock()}}
    return out_({rows:tabRows_(e.parameter.tab)}); }
  if(e.parameter.action==='list')return out_({rows:floorRows_(floor_(kind_(e)),e.parameter.kind)});
  throw new Error('bad request');}catch(err){return out_({error:err.message});}}
function doPost(e){try{auth_(e);const act=String(e.parameter.action||'');
  if(TaskLib.ACTIONS.indexOf(act)>=0){const body=JSON.parse((e.postData&&e.postData.contents)||'{}');
    const lock=LockService.getScriptLock();lock.waitLock(10000);try{return taskPost_(act,body)}finally{lock.releaseLock()}}
  const kind=kind_(e),s=floor_(kind),body=JSON.parse((e.postData&&e.postData.contents)||'{}');
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
// Tasks tab only. Keep this block in sync with js/tasks.js (tests eval it and compare).
/*TASKLIB_BEGIN*/
var TaskLib=(function(){
const ACTIONS=['task_add','task_done','task_undo','task_delete'];
const DAYNAME=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAYMAP={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
const BY={'6a-2p':1,'2p-10p':1,'10p-6a':1};
function clean(v,max){v=String(v==null?'':v).replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();if(v.length>max)v=v.slice(0,max).trim();return v}
function personName(v){v=clean(v,40);if(!v)return '';const p=v.split(' ').filter(Boolean);if(p.length===1)return p[0];
 const last=p[p.length-1].replace(/[^A-Za-z]/g,'');const ini=last?last[0].toUpperCase():'';return (ini?p[0]+' '+ini:p[0]).slice(0,40)}
function dayNum(ymd){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd||'');if(!m)return NaN;return Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5)}
function addDays(ymd,n){const d=dayNum(ymd);if(isNaN(d))return '';return new Date((d+n)*864e5).toISOString().slice(0,10)}
function isoD(v){v=String(v==null?'':v).trim();const m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);return m?m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0'):''}
function tmin(v){let x=String(v==null?'':v).trim().toLowerCase().replace(/\s+/g,'').replace(/\./g,'');if(!x)return NaN;if(x==='noon')return 720;if(x==='midnight')return 0;
 const m=x.match(/^(\d{1,4})(?::(\d{2}))?(?::\d{2})?(a|p|am|pm)?$/);if(!m)return NaN;let d=m[1],h,mi;
 if(m[2]!==undefined){h=+d;mi=+m[2]}else if(d.length<=2){h=+d;mi=0}else{h=+d.slice(0,-2);mi=+d.slice(-2)}
 const ap=m[3]?m[3][0]:'';if(ap){if(h<1||h>12)return NaN;if(h===12)h=0;if(ap==='p')h+=12}return h>23||mi>59?NaN:h*60+mi}
function normShift(v){const t=String(v==null?'':v).toLowerCase().replace(/\s|:00|m\b/g,'').replace(/[–—]+/g,'-').replace(/\bto\b/g,'-');
 if(t.startsWith('10p')||t.startsWith('22-')||t==='10p-6a')return '10p-6a';
 if(t.startsWith('6a')||t.startsWith('06-'))return '6a-2p';
 if(t.startsWith('2p')||t.startsWith('14-'))return '2p-10p';
 const a=tmin(String(v||'').split(/\s*(?:-|–|—|\bto\b)\s*/)[0]);
 if(a===360)return '6a-2p';if(a===840)return '2p-10p';if(a===1320)return '10p-6a';return ''}
function parseRepeat(s){s=clean(s,48);if(!s||/^none$/i.test(s))return {kind:'none',text:'none'};
 if(/^daily$/i.test(s))return {kind:'daily',text:'daily'};
 const m=/^weekly\s*:\s*(.+)$/i.exec(s);if(!m)return {error:'Repeat must be none, daily, or weekly:Mon,Wed'};
 const days=[];const parts=m[1].split(/[^A-Za-z]+/).filter(Boolean);
 for(let i=0;i<parts.length;i++){const k=parts[i].slice(0,3).toLowerCase();if(!(k in DAYMAP))return {error:'Weekly days must be Mon through Sun'};if(days.indexOf(DAYMAP[k])<0)days.push(DAYMAP[k])}
 if(!days.length)return {error:'Weekly repeat needs at least one day'};days.sort(function(a,b){return a-b});
 return {kind:'weekly',days:days,text:'weekly:'+days.map(function(d){return DAYNAME[d]}).join(',')}}
function wday(ymd){return new Date(ymd+'T12:00:00Z').getUTCDay()}
function nextDue(due,repeat){const rule=typeof repeat==='string'||repeat==null?parseRepeat(repeat||'none'):repeat;if(!rule||rule.error||rule.kind==='none')return '';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due||''))return '';if(rule.kind==='daily')return addDays(due,1);
 for(let i=1;i<=7;i++){const d=addDays(due,i);if(rule.days.indexOf(wday(d))>=0)return d}return ''}
function realDate(due){if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return false;const p=due.split('-').map(Number),dt=new Date(Date.UTC(p[0],p[1]-1,p[2]));
 return dt.getUTCFullYear()===p[0]&&dt.getUTCMonth()===p[1]-1&&dt.getUTCDate()===p[2]}
function validId(id){id=clean(id,80);return id&&/^[A-Za-z0-9._:-]{1,80}$/.test(id)?id:''}
function validateAdd(body){body=body||{};const title=clean(body.title,80);if(!title)return {ok:false,error:'Title is required'};
 const note=clean(body.note,280);const assignee=personName(body.assignee);if(!assignee)return {ok:false,error:'Assignee is required'};
 const station=clean(body.station,40);const dueRaw=clean(body.due_date,10);let due='';
 if(dueRaw){if(!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)||!realDate(dueRaw))return {ok:false,error:'Due date must be YYYY-MM-DD'};due=dueRaw}
 const shiftRaw=clean(body.due_shift,16);let shift='';
 if(shiftRaw){shift=normShift(shiftRaw);if(!BY[shift])return {ok:false,error:'Shift must be 6a-2p, 2p-10p, or 10p-6a'}}
 const rep=parseRepeat(body.repeat==null||body.repeat===''?'none':body.repeat);if(rep.error)return {ok:false,error:rep.error};
 if(rep.kind!=='none'&&!due)return {ok:false,error:'A repeating task needs a due date'};
 const created_by=personName(body.created_by);
 return {ok:true,row:{title:title,note:note,assignee:assignee,station:station,due_date:due,due_shift:shift,repeat:rep.text,status:'open',created_by:created_by}}}
function validateDone(body){body=body||{};const id=validId(body.id);if(!id)return {ok:false,error:'Task id is missing'};
 const done_by=personName(body.done_by);if(!done_by)return {ok:false,error:'done_by is required'};return {ok:true,id:id,done_by:done_by}}
function validateUndo(body){const id=validId(body&&body.id);return id?{ok:true,id:id}:{ok:false,error:'Task id is missing'}}
function validateDelete(body){return validateUndo(body)}
function nextInstance(task){const due=nextDue(task.due_date,task.repeat);if(!due)return null;const rep=parseRepeat(task.repeat||'none');
 return {title:task.title,note:task.note||'',assignee:task.assignee,station:task.station||'',due_date:due,due_shift:task.due_shift||'',repeat:rep.text||'none',status:'open',created_by:task.created_by||'',done_by:'',done_at:''}}
function sameOpen(rows,next){return (rows||[]).some(function(r){return String(r.status||'').toLowerCase()!=='done'&&r.title===next.title&&r.assignee===next.assignee&&isoD(r.due_date)===next.due_date&&(normShift(r.due_shift)||'')===(next.due_shift||'')&&String(r.repeat||'none')===String(next.repeat||'none')})}
return {ACTIONS:ACTIONS,clean:clean,personName:personName,parseRepeat:parseRepeat,nextDue:nextDue,nextInstance:nextInstance,sameOpen:sameOpen,validateAdd:validateAdd,validateDone:validateDone,validateUndo:validateUndo,validateDelete:validateDelete};
})();
/*TASKLIB_END*/
const TASK_HEADERS=['id','title','note','assignee','station','due_date','due_shift','repeat','status','created_by','created_at','done_by','done_at','last_updated'];
function tasksSheet_(){const ss=ss_();let s=ss.getSheetByName('Tasks');
 if(!s){s=ss.insertSheet('Tasks');s.getRange(1,1,1,TASK_HEADERS.length).setValues([TASK_HEADERS]);s.setFrozenRows(1)}return s}
function taskHeader_(s){const width=Math.max(s.getLastColumn(),TASK_HEADERS.length);
 let h=s.getRange(1,1,1,width).getDisplayValues()[0].map(function(x){return String(x||'').trim()});
 if(h.every(function(x){return !x})){s.getRange(1,1,1,TASK_HEADERS.length).setValues([TASK_HEADERS]);s.setFrozenRows(1);return TASK_HEADERS.slice()}
 const extra=[];TASK_HEADERS.forEach(function(k){if(h.indexOf(k)<0)extra.push(k)});
 if(extra.length){h=h.concat(extra);s.getRange(1,1,1,h.length).setValues([h])}return h}
function taskTable_(){const s=tasksSheet_();const h=taskHeader_(s);const n=s.getLastRow();if(n<2)return {s:s,h:h,rows:[]};
 const v=s.getRange(2,1,n-1,h.length).getDisplayValues();const rows=[];
 for(let i=0;i<v.length;i++){const o={};h.forEach(function(k,j){if(k)o[k]=v[i][j]==null?'':String(v[i][j])});if(String(o.id||'').trim())rows.push({row:i+2,o:o})}
 return {s:s,h:h,rows:rows}}
function taskWriteRow_(pack,rowIndex,obj){const line=pack.h.map(function(k){return cell_(obj[k]==null?'':obj[k])});
 if(rowIndex)pack.s.getRange(rowIndex,1,1,line.length).setValues([line]);else pack.s.appendRow(line)}
function taskFind_(pack,id){for(let i=0;i<pack.rows.length;i++)if(String(pack.rows[i].o.id)===String(id))return pack.rows[i];return null}
function taskBlank_(row){return {id:row.id,title:row.title,note:row.note,assignee:row.assignee,station:row.station,due_date:row.due_date,due_shift:row.due_shift,repeat:row.repeat,status:row.status,created_by:row.created_by,created_at:row.created_at,done_by:row.done_by,done_at:row.done_at,last_updated:row.last_updated}}
// Writes only the Tasks sheet: add, mark done (and spawn the next repeat), reopen, or delete.
function taskPost_(act,body){if(TaskLib.ACTIONS.indexOf(act)<0)throw new Error('bad action');
 const pack=taskTable_();const now=new Date().toISOString();
 if(act==='task_add'){const v=TaskLib.validateAdd(body||{});if(!v.ok)throw new Error(v.error);
  const row=taskBlank_({id:Utilities.getUuid(),title:v.row.title,note:v.row.note,assignee:v.row.assignee,station:v.row.station,due_date:v.row.due_date,due_shift:v.row.due_shift,repeat:v.row.repeat,status:'open',created_by:v.row.created_by,created_at:now,done_by:'',done_at:'',last_updated:now});
  taskWriteRow_(pack,0,row);return out_({row:row})}
 if(act==='task_done'){const v=TaskLib.validateDone(body||{});if(!v.ok)throw new Error(v.error);
  const hit=taskFind_(pack,v.id);if(!hit)throw new Error('not found');
  const row=taskBlank_(Object.assign({},hit.o,{status:'done',done_by:v.done_by,done_at:now,last_updated:now}));
  taskWriteRow_(pack,hit.row,row);let next=null;const spawned=TaskLib.nextInstance(row);
  if(spawned&&!TaskLib.sameOpen(pack.rows.map(function(x){return x.o}),spawned)){
   next=taskBlank_({id:Utilities.getUuid(),title:spawned.title,note:spawned.note,assignee:spawned.assignee,station:spawned.station,due_date:spawned.due_date,due_shift:spawned.due_shift,repeat:spawned.repeat,status:'open',created_by:spawned.created_by,created_at:now,done_by:'',done_at:'',last_updated:now});
   taskWriteRow_(pack,0,next)}
  return out_({row:row,next:next})}
 if(act==='task_undo'){const v=TaskLib.validateUndo(body||{});if(!v.ok)throw new Error(v.error);
  const hit=taskFind_(pack,v.id);if(!hit)throw new Error('not found');
  const row=taskBlank_(Object.assign({},hit.o,{status:'open',done_by:'',done_at:'',last_updated:now}));
  taskWriteRow_(pack,hit.row,row);return out_({row:row})}
 if(act==='task_delete'){const v=TaskLib.validateDelete(body||{});if(!v.ok)throw new Error(v.error);
  const hit=taskFind_(pack,v.id);if(!hit)throw new Error('not found');
  pack.s.deleteRow(hit.row);return out_({ok:true,deleted:v.id})}
 throw new Error('bad action')}
