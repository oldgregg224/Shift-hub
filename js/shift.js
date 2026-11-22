// Shift Hub v43: current-shift selection for Shift Goals / Shift Grades.
// The store is open 24 hours in America/New_York. Shifts are 6a-2p, 2p-10p, and 10p-6a.
// The 10p-6a row is dated the night it starts, so 1 AM on the next calendar day is still that row.
// Windows come from the start/end columns when those parse; otherwise from the shift name.
// Pure (no DOM). Unit-tested in tests/hub.test.js.
(function(root){
const SHIFTS=[
 {id:"6a-2p",label:"6 AM – 2 PM",start:6*60,end:14*60},
 {id:"2p-10p",label:"2 PM – 10 PM",start:14*60,end:22*60},
 {id:"10p-6a",label:"10 PM – 6 AM",start:22*60,end:6*60}];
const BY={};SHIFTS.forEach(s=>BY[s.id]=s);
const ORDER={"6a-2p":0,"2p-10p":1,"10p-6a":2};
// Live columns are rewritten about hourly (6 AM–midnight, plus 2 AM and 4 AM): longest gap is 2h.
// Goals rows are rewritten around 6:35 AM, 2:35 PM and 10:35 PM: an 8h gap, same slack as Roster (8.5h).
const LIVE_STALE_MS=2.25*36e5,GOAL_STALE_MS=8.5*36e5;
const nk=k=>String(k).toLowerCase().replace(/%/g,"pct").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
function fld(x,al){if(!x)return "";const aliases=Array.isArray(al)?al:[al],m={};for(const k in x)if(Object.prototype.hasOwnProperty.call(x,k))m[nk(k)]=x[k];
 for(const a of aliases){const v=m[nk(a)];if(v!=null&&String(v).trim()!=="")return v}return ""}
function num(v){if(v==null||String(v).trim()==="")return NaN;const x=parseFloat(String(v).replace(/[^0-9.\-]/g,""));return x}
function isBlank(v){v=String(v==null?"":v).trim();return !v||/^[—–-]$/.test(v)||/^n\/?a$/i.test(v)}
function isData(r){return !!r&&!/^(header|example|note)$/i.test(String(r.row_type||"").trim())}
function isoD(v){v=String(v==null?"":v).trim();let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
 m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m)return(m[3].length===2?"20"+m[3]:m[3])+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0");return ""}
function dayNum(ymd){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd||"");if(!m)return NaN;return Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5)}
function addDays(ymd,n){const d=dayNum(ymd);if(isNaN(d))return "";return new Date((d+n)*864e5).toISOString().slice(0,10)}
function tmin(v){let x=String(v==null?"":v).trim().toLowerCase().replace(/\s+/g,"").replace(/\./g,"");if(!x)return NaN;if(x==="noon")return 720;if(x==="midnight")return 0;
 const m=x.match(/^(\d{1,4})(?::(\d{2}))?(?::\d{2})?(a|p|am|pm)?$/);if(!m)return NaN;let d=m[1],h,mi;
 if(m[2]!==undefined){h=+d;mi=+m[2]}else if(d.length<=2){h=+d;mi=0}else{h=+d.slice(0,-2);mi=+d.slice(-2)}
 const ap=m[3]?m[3][0]:"";if(ap){if(h<1||h>12)return NaN;if(h===12)h=0;if(ap==="p")h+=12}return h>23||mi>59?NaN:h*60+mi}
function normShift(v){const t=String(v==null?"":v).toLowerCase().replace(/\s|:00|m\b/g,"").replace(/[–—]+/g,"-").replace(/\bto\b/g,"-");
 if(t.startsWith("10p")||t.startsWith("22-")||t==="10p-6a")return "10p-6a";
 if(t.startsWith("6a")||t.startsWith("06-"))return "6a-2p";
 if(t.startsWith("2p")||t.startsWith("14-"))return "2p-10p";
 const a=tmin(String(v||"").split(/\s*(?:-|–|—|\bto\b)\s*/)[0]);
 if(a===360)return "6a-2p";if(a===840)return "2p-10p";if(a===1320)return "10p-6a";return ""}
function etParts(now){const d=now instanceof Date?now:new Date(now);if(isNaN(d))return null;
 const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d);
 const g=k=>{const v=(p.find(x=>x.type===k)||{}).value;return v==null||v===""?NaN:+v};let hour=g("hour");if(hour===24)hour=0;
 const minute=g("minute"),year=g("year"),month=g("month"),day=g("day");
 if([hour,minute,year,month,day].some(isNaN))return null;
 return {ymd:year+"-"+String(month).padStart(2,"0")+"-"+String(day).padStart(2,"0"),hour,minute,minutes:hour*60+minute}}
function nowAbs(now){const p=etParts(now);if(!p)return NaN;return dayNum(p.ymd)*1440+p.minutes}
// Clock in America/New_York -> the shift that is on now. Before 6 AM, the date is yesterday (the night 10p-6a started).
function currentShift(now){const p=etParts(now);if(!p)return null;const m=p.minutes;let shift,date=p.ymd;
 if(m>=360&&m<840)shift="6a-2p";else if(m>=840&&m<1320)shift="2p-10p";else{shift="10p-6a";if(m<360)date=addDays(p.ymd,-1)}
 return {date,shift,label:BY[shift].label,ymd:p.ymd,minutes:m}}
function nextShift(now){const c=currentShift(now);if(!c)return null;
 if(c.shift==="6a-2p")return {date:c.date,shift:"2p-10p",label:BY["2p-10p"].label};
 if(c.shift==="2p-10p")return {date:c.date,shift:"10p-6a",label:BY["10p-6a"].label};
 return {date:addDays(c.date,1),shift:"6a-2p",label:BY["6a-2p"].label}}
// [start, end) in absolute minutes. end<=start means the shift ends the next calendar day. Date is the start night/day.
function rowWindow(row){const date=isoD(fld(row,["date","business_date","day"]));if(!date)return null;
 const named=normShift(fld(row,["shift","daypart"]));
 let start=tmin(fld(row,["start","start_time","shift_start"])),end=tmin(fld(row,["end","end_time","shift_end"]));
 const fromColumns=!isNaN(start)&&!isNaN(end),def=BY[named];
 if(!fromColumns){if(!def)return null;start=def.start;end=def.end}
 const overnight=end<=start,base=dayNum(date);if(isNaN(base))return null;
 const shift=def?named:(start===360?"6a-2p":start===840?"2p-10p":start===1320?"10p-6a":named);
 return {date,shift,start,end,a:base*1440+start,b:base*1440+end+(overnight?1440:0),fromColumns}}
function pickCurrent(rows,now){const data=(rows||[]).filter(isData),abs=nowAbs(now);if(isNaN(abs))return null;
 const hits=data.map(r=>({r,w:rowWindow(r)})).filter(x=>x.w&&abs>=x.w.a&&abs<x.w.b);
 if(hits.length){const cur=currentShift(now);const named=hits.filter(x=>x.w.shift===cur.shift&&x.w.date===cur.date);const pool=named.length?named:hits;return pool[pool.length-1].r}
 const cur=currentShift(now);if(!cur)return null;
 const loose=data.filter(r=>{if(isoD(fld(r,["date","business_date","day"]))!==cur.date||normShift(fld(r,["shift","daypart"]))!==cur.shift)return false;
  const w=rowWindow(r);return !w||!w.fromColumns});
 return loose.length?loose[loose.length-1]:null}
function pickNamed(rows,date,shift){const data=(rows||[]).filter(isData).filter(r=>isoD(fld(r,["date","business_date","day"]))===date&&normShift(fld(r,["shift","daypart"]))===shift);return data.length?data[data.length-1]:null}
function pickNext(rows,now){const n=nextShift(now);return n?pickNamed(rows,n.date,n.shift):null}
const LIVE_KEYS=["sales_so_far","proj_so_far","hours_so_far","need_so_far","hours_left","oepe_worst_sec","kvs_worst_sec","r2p_worst_sec","on_track"];
function liveBlank(row){return LIVE_KEYS.every(k=>isBlank(fld(row,k)))}
function nOrNull(v){const x=num(v);return isNaN(x)?null:x}
function txt(row,keys){const v=String(fld(row,keys)||"").trim();return isBlank(v)?"":v}
function salesStatus(actual,target){if(actual==null||target==null)return "neutral";const p=target?(actual-target)/target*100:0;return p>=0?"good":p>=-5?"warn":"bad"}
function lowerStatus(actual,target){if(actual==null||target==null)return "neutral";const d=actual-target;return d<=0?"good":d<=1?"warn":"bad"}
function secStatus(actual,target){if(actual==null||target==null)return "neutral";const d=actual-target;return d<=0?"good":d<=10?"warn":"bad"}
function trackTone(text){const s=String(text||"").trim();if(!s)return "neutral";return /^on track\b/i.test(s)?"good":"warn"}
function viewGoal(row){if(!row)return null;const shift=normShift(fld(row,["shift","daypart"]))||"";const manager=txt(row,["manager","manager_name"]);
 return {date:isoD(fld(row,["date","business_date","day"])),shift,label:BY[shift]?BY[shift].label:String(fld(row,["shift"])||""),
  manager,managerLabel:manager||"Manager not listed",
  salesProj:nOrNull(fld(row,["sales_proj","sales_projection","projected_sales"])),
  salesSoFar:nOrNull(fld(row,["sales_so_far","sales_actual"])),
  projSoFar:nOrNull(fld(row,["proj_so_far","projected_so_far","sales_proj_so_far"])),
  laborPctTarget:nOrNull(fld(row,["labor_pct_target","labor_target_pct","target_labor_pct"])),
  mtdLaborPct:nOrNull(fld(row,["mtd_labor_pct","mtd_labor"])),
  hoursCap:nOrNull(fld(row,["hours_cap","cap_hours"])),
  hoursSoFar:nOrNull(fld(row,["hours_so_far","hours_actual"])),
  needSoFar:nOrNull(fld(row,["need_so_far","hours_need_so_far","needed_so_far"])),
  hoursLeft:nOrNull(fld(row,["hours_left","hours_remaining"])),
  oepeTarget:nOrNull(fld(row,["oepe_target_sec","oepe_target"])),oepeWorst:nOrNull(fld(row,["oepe_worst_sec","oepe_worst"])),
  kvsTarget:nOrNull(fld(row,["kvs_target_sec","kvs_target"])),kvsWorst:nOrNull(fld(row,["kvs_worst_sec","kvs_worst"])),
  r2pTarget:nOrNull(fld(row,["r2p_target_sec","r2p_target"])),r2pWorst:nOrNull(fld(row,["r2p_worst_sec","r2p_worst"])),
  guestFocus:txt(row,["guest_focus"]),speedFocus:txt(row,["speed_focus"]),notes:txt(row,["notes","note"]),
  onTrack:txt(row,["on_track","ontrack"]),lastUpdated:txt(row,["last_updated","updated"]),liveUpdated:txt(row,["live_updated"]),
  live:!liveBlank(row)}}
function goalState(rows,now){const cur=pickCurrent(rows,now),next=cur?null:pickNext(rows,now),shift=currentShift(now);
 return {shift,cur:viewGoal(cur),next:viewGoal(next)}}
function gradeLetter(v){const m=/[A-Fa-f]/.exec(String(v==null?"":v));return m?m[0].toUpperCase():""}
function gradeTone(letter){return letter==="A"||letter==="B"?"good":letter==="C"?"warn":letter==="D"||letter==="F"?"bad":"neutral"}
function viewGrade(row){if(!row)return null;const shift=normShift(fld(row,["shift","daypart"]))||"";const manager=txt(row,["manager","manager_name"]);const letter=gradeLetter(fld(row,["grade"]));
 return {date:isoD(fld(row,["date","business_date","day"])),shift,label:BY[shift]?BY[shift].label:String(fld(row,["shift"])||""),startMin:BY[shift]?BY[shift].start:-1,
  manager,managerLabel:manager||"Manager not listed",letter,tone:gradeTone(letter),
  goalsHit:txt(row,["goals_hit","goals"]),
  sales:nOrNull(fld(row,["sales","sales_actual"])),salesProj:nOrNull(fld(row,["sales_proj","sales_projection"])),
  laborPct:nOrNull(fld(row,["labor_pct","labor_percent"])),laborPctTarget:nOrNull(fld(row,["labor_pct_target","labor_target_pct"])),
  hours:nOrNull(fld(row,["hours","hours_actual"])),hoursCap:nOrNull(fld(row,["hours_cap","cap_hours"])),
  oepe:nOrNull(fld(row,["oepe_sec","oepe"])),kvs:nOrNull(fld(row,["kvs_sec","kvs"])),r2p:nOrNull(fld(row,["r2p_sec","r2p"])),
  lowSurveys:nOrNull(fld(row,["low_surveys","low_survey"])),
  why:txt(row,["why"]),runBetter:txt(row,["run_better","runbetter"]),
  lastUpdated:txt(row,["last_updated","updated"])}}
// Newest first, dates in the last `days` America/New_York calendar days (inclusive).
function recentGrades(rows,now,days){days=days||7;const end=etParts(now);if(!end)return [];const start=addDays(end.ymd,-(days-1));
 return (rows||[]).filter(isData).map(viewGrade).filter(g=>g&&g.date&&g.date>=start&&g.date<=end.ymd)
  .sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(b.startMin-a.startMin))}
function newestStamp(rows,keys){keys=Array.isArray(keys)?keys:[keys];let best=null;(rows||[]).forEach(r=>{keys.forEach(k=>{const v=txt(r,[k]);if(!v)return;const d=new Date(v);if(isNaN(d))return;if(!best||d>best.d)best={v,d,k}})});return best}
function goalsAreStale(liveStamp,goalStamp,nowMs){if(liveStamp&&liveStamp.d&&!isNaN(liveStamp.d))return nowMs-liveStamp.d>LIVE_STALE_MS;
 if(goalStamp&&goalStamp.d&&!isNaN(goalStamp.d))return nowMs-goalStamp.d>GOAL_STALE_MS;return false}
// Move sample dates so the latest row date lands on `dest` (YYYY-MM-DD). Stamps move by the same number of days.
function shiftStamp(v,delta){const m=/^(\d{4}-\d{2}-\d{2})(.*)$/.exec(String(v||"").trim());if(!m||!delta)return v;return addDays(m[1],delta)+m[2]}
function anchorDates(rows,now,dest){const dates=(rows||[]).map(r=>isoD(fld(r,["date","business_date","day","due_date"]))).filter(Boolean).sort();if(!dates.length)return rows||[];
 const anchor=dates[dates.length-1];dest=dest||(currentShift(now)||{}).date;const delta=dayNum(dest)-dayNum(anchor);if(!delta)return rows;
 return rows.map(r=>{const o={};for(const k in r)o[k]=r[k];const d=isoD(fld(r,["date","business_date","day"]));if(d)o.date=addDays(d,delta);
  const due=isoD(r.due_date);if(due)o.due_date=addDays(due,delta);
  ["last_updated","live_updated","updated","done_at","created_at"].forEach(k=>{if(o[k])o[k]=shiftStamp(o[k],delta)});return o})}
const api={SHIFTS,BY,ORDER,LIVE_STALE_MS,GOAL_STALE_MS,fld,num,isBlank,isData,isoD,dayNum,addDays,tmin,normShift,etParts,nowAbs,currentShift,nextShift,rowWindow,pickCurrent,pickNext,pickNamed,liveBlank,viewGoal,goalState,viewGrade,recentGrades,gradeLetter,gradeTone,salesStatus,lowerStatus,secStatus,trackTone,newestStamp,goalsAreStale,anchorDates,shiftStamp};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.ShiftCal=api;
})(typeof window!=="undefined"?window:globalThis);
