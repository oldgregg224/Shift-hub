// Shift Hub v40: "Who can cover?" shift-finder logic (pure functions, no DOM; unit-tested in tests/cover.test.js).
// Inputs are Sheet rows: Crew, Skills, DaysOff, WeekHours, Availability, SchoolCal. Read-only, suggestions only.
// Florida minor rules follow Florida Statutes 450.081 (http://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0400-0499/0450/Sections/0450.081.html).
(function(root){
const DAY=864e5;
const nk=s=>String(s||"").trim().toLowerCase().replace(/\./g,"").replace(/\s+/g," ");
const yes=v=>/^(y|yes|true|1|x)$/i.test(String(v||"").trim());
const isData=r=>!/^(header|example|note)$/i.test(String(r.row_type||"").trim());
const dOf=s=>String(s||"").slice(0,10);
const wday=d=>new Date(d+"T12:00:00Z").getUTCDay(); // 0 Sun .. 6 Sat
const addD=(d,n)=>new Date(Date.parse(d+"T12:00:00Z")+n*DAY).toISOString().slice(0,10);
const h1=n=>String(Math.round(n*10)/10);
const fmt=m=>{m=((m%1440)+1440)%1440;const h=Math.floor(m/60),mi=m%60;return (h%12||12)+(mi?":"+String(mi).padStart(2,"0"):"")+(h<12?" AM":" PM")};
// "18+", "16-17", "14-15" (any dash) -> band; anything else -> "" (unknown, never assumed adult).
function band(c){const b=String(c.age_band||"").replace(/[–—]/g,"-").replace(/\s/g,"");if(/^18\+?$|^adult$/i.test(b))return "18+";if(/^16-17$/.test(b))return "16-17";if(/^(14-15|1[45])$/.test(b))return "14-15";return ""}
// School calendar. SchoolCal rows (date + school_day/type) win; otherwise assume OCPS school year
// (Aug 10 - May 31) with school Mon-Fri (so Sun-Thu nights are school nights).
function schoolCal(rows){const m={};(rows||[]).filter(isData).forEach(r=>{const d=dOf(r.date);if(!d)return;
  const v=r.school_day!=null&&r.school_day!==""?r.school_day:(r.is_school_day!=null?r.is_school_day:r.type);
  m[d]=yes(v)||/^(school|school_day|student_day|in_session)$/i.test(String(v||"").trim())});
 const has=Object.keys(m).length>0;
 const inYear=d=>{const md=d.slice(5);return md>="08-10"||md<="05-31"};
 return{has,school:d=>has&&d in m?m[d]:(inYear(d)&&wday(d)>=1&&wday(d)<=5),inSession:d=>{if(has){for(let i=0;i<7;i++){if(m[addD(d,i-wday(d))])return true}return false}return inYear(d)}}}
// Minor rules for one shift. sh={date,start,end} (minutes after midnight; end<=start = overnight). wk = scheduled hours this week.
// Returns {no:[reasons that exclude], warn:[cautions], cap}. Exemptions/waivers (graduates, hardship, home school) are the manager's call.
function minorCheck(b,sh,cal,wk){const no=[],warn=[];const len=((sh.end<=sh.start?sh.end+1440:sh.end)-sh.start)/60,end=sh.end<=sh.start?sh.end+1440:sh.end;
 const schoolNext=cal.school(addD(sh.date,1)),schoolToday=cal.school(sh.date),inSess=cal.inSession(sh.date),sun=wday(sh.date)===0;
 const SCH=[420,870]; // assumed school hours 7:00 AM - 2:30 PM on school days
 if(b==="14-15"){const cap=inSess?15:40;
  if(sh.start<420)no.push("age 14–15: before 7 AM");
  if(schoolNext&&end>1140)no.push("age 14–15: past 7 PM on a school night");
  else if(!schoolNext&&end>1260)no.push("age 14–15: past 9 PM");
  if(schoolToday&&schoolNext&&len>3)no.push("age 14–15: over 3 hrs on a school day");
  if(!inSess&&len>8)no.push("age 14–15: over 8 hrs in a day");
  if(schoolToday&&sh.start<SCH[1]&&end>SCH[0])no.push("age 14–15: during school hours");
  if(wk+len>cap)no.push("age 14–15: would hit "+h1(wk+len)+" of "+cap+" hrs this week");
  if(len>4)warn.push("needs a 30-min meal break within 4 hrs");
  if(!schoolNext&&inSess&&end>1140)warn.push("federal rule: 7 PM latest Sept–May (check)");
  return{no,warn,cap}}
 if(b==="16-17"){const cap=inSess?30:40;
  if(schoolNext&&sh.start<390)no.push("age 16–17: before 6:30 AM on a school day");
  if(schoolNext&&end>1380)no.push("age 16–17: past 11 PM on a school night");
  if(schoolNext&&!sun&&len>8)no.push("age 16–17: over 8 hrs before a school day");
  if(schoolToday&&sh.start<SCH[1]&&end>SCH[0])no.push("age 16–17: during school hours");
  if(wk+len>cap)no.push("age 16–17: would hit "+h1(wk+len)+" of "+cap+" hrs (minor school-week cap"+")");
  if(len>=8)warn.push("needs a 30-min meal break within 4 hrs");
  return{no,warn,cap}}
 return{no,warn,cap:40}}
const isMaintShift=w=>/maint/i.test(w.value||"");
const isMgr=r=>/manager/i.test(r||"");
// Main ranking. inp={crew,skills,daysOff,weekHours,avail,schoolCal,shift:{date,start,end,type:"station"|"role",value}}
function rank(inp){const sh=inp.shift,cal=schoolCal(inp.schoolCal);const len=((sh.end<=sh.start?sh.end+1440:sh.end)-sh.start)/60;
 const sk={},vf={};(inp.skills||[]).filter(isData).forEach(r=>{const k=nk(r.name),st=String(r.station||"").trim().toUpperCase();if(!k||!st)return;const l=parseInt(r.level,10);(sk[k]=sk[k]||{})[st]=isNaN(l)?null:l;(vf[k]=vf[k]||{})[st]=!/^n/i.test(String(r.skills_verified||"").trim())});
 const off={};(inp.daysOff||[]).filter(isData).forEach(r=>{if(dOf(r.date)!==sh.date)return;const k=nk(r.name),t=String(r.type||"").toLowerCase();if(!k)return;
  if(/approved/.test(t)||yes(r.time_off_approved))off[k]="approved";else if((/pending/.test(t)||yes(r.time_off_pending))&&off[k]!=="approved")off[k]="pending"});
 const ws=addD(sh.date,-wday(sh.date)); // Sunday week start (WeekHours week_start is a Sunday)
 const wh={};(inp.weekHours||[]).filter(isData).forEach(r=>{const w=dOf(r.week_start);if(w&&!(w<=sh.date&&sh.date<addD(w,7)))return;const v=parseFloat(r.scheduled_hours);if(!isNaN(v))wh[nk(r.name)]=v});
 const av={};(inp.avail||[]).filter(isData).forEach(r=>{(av[nk(r.name)]=av[nk(r.name)]||[]).push(r)});const hasAv=Object.keys(av).length>0;
 const st=String(sh.value||"").trim(),isSt=sh.type==="station",STU=st.toUpperCase(),maint=isMaintShift(sh);
 const ok=[],no=[],seen=new Set();
 (inp.crew||[]).filter(isData).forEach(c=>{const k=nk(c.name);if(!k||seen.has(k))return;seen.add(k);
  const why=[],warn=[],b=band(c),isM=yes(c.maintenance);
  // Maintenance rule: only maintenance people cover maintenance shifts (and they stay on maintenance).
  if(maint&&!isM)why.push("not maintenance");if(!maint&&isM)why.push("maintenance only covers maintenance shifts");
  let lvl=null,ver=true;
  if(isSt){lvl=sk[k]&&STU in sk[k]?sk[k][STU]:null;ver=vf[k]&&STU in vf[k]?vf[k][STU]:true;if(!maint&&(lvl===null||!(lvl>=1)))why.push("no "+st.toLowerCase()+" skill level")}
  else if(nk(c.role)!==nk(st))why.push("different role");
  if(isSt&&!maint&&isMgr(c.role))why.push("manager");
  if(off[k]==="approved")why.push("approved time off "+sh.date);if(off[k]==="pending")warn.push("pending time off");
  const known=k in wh,wk=known?wh[k]:0;if(!known)warn.push("week hours not in Sheet");
  let cap=40;if(b==="16-17"||b==="14-15"){const m=minorCheck(b,sh,cal,wk);why.push(...m.no);warn.push(...m.warn);cap=m.cap}
  else if(!b)warn.push("age unknown — check");
  if(cap===40&&wk+len>40)why.push("would hit "+h1(wk+len)+" of 40 hrs (OT)");
  const left=Math.round((cap-wk)*10)/10;
  const o={name:String(c.name).trim().split(/\s+/).slice(0,2).join(" "),role:c.role||"",band:b,minor:yes(c.minor),phone:String(c.phone||"").trim(),lvl,verified:ver,wk,known,cap,left,after:Math.round((cap-wk-len)*10)/10,
   avail:hasAv?(av[k]||[]):null,why,warn};(why.length?no:ok).push(o)});
 // Rank: verified skills first, then higher station level, then fewer cautions, then most hours left, then name.
 ok.sort((a,b)=>(b.verified-a.verified)||((b.lvl||0)-(a.lvl||0))||(a.warn.length-b.warn.length)||(b.after-a.after)||a.name.localeCompare(b.name));
 no.sort((a,b)=>a.name.localeCompare(b.name));
 return{ok,no,len,schoolNight:cal.school(addD(sh.date,1)),calKnown:cal.has,hasAv}}
const telOf=p=>{const d=String(p||"").replace(/[^\d+]/g,"");if(!d)return null;const t=d.startsWith("+")?d:(d.length===10?"+1"+d:d);const n=t.replace(/^\+1/,"");return{href:"tel:"+t,label:n.length===10?n.slice(0,3)+"-"+n.slice(3,6)+"-"+n.slice(6):p}};
const api={rank,minorCheck,schoolCal,band,telOf,fmt,addD,wday};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ShiftFinder=api;
})(typeof window!=="undefined"?window:globalThis);
