// Shift Hub v43: task validation, repeat-rule math, and overdue ordering.
// Repeating tasks spawn on the server when one is completed (see Code.gs). This file is the same rules
// for the phone (reject a bad form before it is queued) and for tests. No DOM. No network.
// Crew assignees are stored as first name + last initial. The manager column on goals/grades is NOT run through this.
(function(root){
const SC=root.ShiftCal;
if(!SC)throw new Error("js/shift.js must load before js/tasks.js");
const ACTIONS=["task_add","task_done","task_undo","task_delete"];
const DAYNAME=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAYMAP={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6};
function clean(v,max){v=String(v==null?"":v).replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim();if(v.length>max)v=v.slice(0,max).trim();return v}
// "Maria Lopez" -> "Maria L". A single token is kept. Already-short names ("Ana R") stay as written.
function titleWord(w){w=String(w||"");if(!w)return "";return w.length===1?w.toUpperCase():w[0].toUpperCase()+w.slice(1).toLowerCase()}
function personName(v){v=clean(v,40);if(!v)return "";const p=v.split(" ").filter(Boolean);if(p.length===1)return titleWord(p[0]);
 const last=p[p.length-1].replace(/[^A-Za-z]/g,"");const ini=last?last[0].toUpperCase():"";const first=titleWord(p[0]);return (ini?first+" "+ini:first).slice(0,40)}
function peopleNames(lists){const set=new Set();(lists||[]).forEach(list=>{(list||[]).forEach(v=>{const n=personName(v);if(n)set.add(n)})});
 const all=[...set],full=all.filter(n=>/\s/.test(n));
 return all.filter(n=>{if(/\s/.test(n))return true;const hits=full.filter(f=>f.toLowerCase().startsWith(n.toLowerCase()+" "));return hits.length!==1}).sort((a,b)=>a.localeCompare(b))}
function parseRepeat(s){s=clean(s,48);if(!s||/^none$/i.test(s))return {kind:"none",text:"none"};
 if(/^daily$/i.test(s))return {kind:"daily",text:"daily"};
 const m=/^weekly\s*:\s*(.+)$/i.exec(s);if(!m)return {error:"Repeat must be none, daily, or weekly:Mon,Wed"};
 const days=[];for(const part of m[1].split(/[^A-Za-z]+/).filter(Boolean)){const k=part.slice(0,3).toLowerCase();if(!(k in DAYMAP))return {error:"Weekly days must be Mon through Sun"};if(days.indexOf(DAYMAP[k])<0)days.push(DAYMAP[k])}
 if(!days.length)return {error:"Weekly repeat needs at least one day"};days.sort((a,b)=>a-b);
 return {kind:"weekly",days,text:"weekly:"+days.map(d=>DAYNAME[d]).join(",")}}
function wday(ymd){return new Date(ymd+"T12:00:00Z").getUTCDay()}
// Next due date strictly after `due`. Weekly wraps within 7 days (Mon -> next Mon is +7).
function nextDue(due,repeat){const rule=typeof repeat==="string"||repeat==null?parseRepeat(repeat||"none"):repeat;if(!rule||rule.error||rule.kind==="none")return "";
 if(!/^\d{4}-\d{2}-\d{2}$/.test(due||""))return "";if(rule.kind==="daily")return SC.addDays(due,1);
 for(let i=1;i<=7;i++){const d=SC.addDays(due,i);if(rule.days.indexOf(wday(d))>=0)return d}return ""}
function realDate(due){if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return false;const [y,m,d]=due.split("-").map(Number),dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d}
function validId(id){id=clean(id,80);return id&&/^[A-Za-z0-9._:-]{1,80}$/.test(id)?id:""}
function validateAdd(body){body=body||{};const title=clean(body.title,80);if(!title)return {ok:false,error:"Title is required"};
 const note=clean(body.note,280);const assignee=personName(body.assignee);if(!assignee)return {ok:false,error:"Assignee is required"};
 const station=clean(body.station,40);const dueRaw=clean(body.due_date,10);let due="";
 if(dueRaw){if(!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)||!realDate(dueRaw))return {ok:false,error:"Due date must be YYYY-MM-DD"};due=dueRaw}
 const shiftRaw=clean(body.due_shift,16);let shift="";
 if(shiftRaw){shift=SC.normShift(shiftRaw);if(!SC.BY[shift])return {ok:false,error:"Shift must be 6a-2p, 2p-10p, or 10p-6a"}}
 const rep=parseRepeat(body.repeat==null||body.repeat===""?"none":body.repeat);if(rep.error)return {ok:false,error:rep.error};
 if(rep.kind!=="none"&&!due)return {ok:false,error:"A repeating task needs a due date"};
 const created_by=personName(body.created_by);
 return {ok:true,row:{title,note,assignee,station,due_date:due,due_shift:shift,repeat:rep.text,status:"open",created_by}}}
function validateDone(body){body=body||{};const id=validId(body.id);if(!id)return {ok:false,error:"Task id is missing"};
 const done_by=personName(body.done_by);if(!done_by)return {ok:false,error:"done_by is required"};return {ok:true,id,done_by}}
function validateUndo(body){const id=validId(body&&body.id);return id?{ok:true,id}:{ok:false,error:"Task id is missing"}}
function validateDelete(body){return validateUndo(body)}
function nextInstance(task){const due=nextDue(task.due_date,task.repeat);if(!due)return null;const rep=parseRepeat(task.repeat||"none");
 return {title:task.title,note:task.note||"",assignee:task.assignee,station:task.station||"",due_date:due,due_shift:task.due_shift||"",repeat:rep.text||"none",status:"open",created_by:task.created_by||"",done_by:"",done_at:""}}
function sameOpen(rows,next){return (rows||[]).some(r=>String(r.status||"").toLowerCase()!=="done"&&r.title===next.title&&r.assignee===next.assignee&&SC.isoD(r.due_date)===next.due_date&&(SC.normShift(r.due_shift)||"")===(next.due_shift||"")&&String(r.repeat||"none")===String(next.repeat||"none"))}
// Overdue once the due shift has ended (10p-6a ends at 6 AM the next calendar day). A date with no shift is overdue the next calendar day.
function isOverdue(task,now){if(!task||String(task.status||"").toLowerCase()==="done")return false;const date=SC.isoD(task.due_date);const shift=SC.normShift(task.due_shift);
 if(date&&SC.BY[shift]){const w=SC.rowWindow({date,shift});return !!w&&SC.nowAbs(now)>=w.b}
 const p=SC.etParts(now);return !!(date&&p&&p.ymd>date)}
function sortOpen(tasks,now){return (tasks||[]).slice().sort((a,b)=>{const oa=isOverdue(a,now)?0:1,ob=isOverdue(b,now)?0:1;if(oa!==ob)return oa-ob;
  const da=SC.isoD(a.due_date)||"9999-99-99",db=SC.isoD(b.due_date)||"9999-99-99";if(da!==db)return da<db?-1:1;
  const sa=SC.ORDER[SC.normShift(a.due_shift)];const sb=SC.ORDER[SC.normShift(b.due_shift)];
  if((sa==null?9:sa)!==(sb==null?9:sb))return (sa==null?9:sa)-(sb==null?9:sb);return String(a.title||"").localeCompare(String(b.title||""))})}
const api={ACTIONS,clean,personName,peopleNames,parseRepeat,nextDue,nextInstance,sameOpen,validateAdd,validateDone,validateUndo,validateDelete,validId,isOverdue,sortOpen,wday};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.TaskLib=api;
})(typeof window!=="undefined"?window:globalThis);
