// Shift Hub v42: pure display helpers (no DOM). Speed day pick, pre-rush times, SMG comment blurbs.
// Unit-tested in tests/speed.test.js and tests/prerush.test.js.
(function(root){
const pad=n=>String(n).padStart(2,"0");
function isoDate(s){s=String(s||"").trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
 if(m)return m[1]+"-"+pad(m[2])+"-"+pad(m[3]);
 m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
 if(m){let y=m[3];if(y.length===2)y="20"+y;return y+"-"+pad(m[1])+"-"+pad(m[2])}
 return s.slice(0,10)}
function clockMinutes(v){const s=String(v??"").trim();
 const m=/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([ap]m?)?\b/i.exec(s);if(!m)return null;
 let h=+m[1],mi=+(m[2]||0);const ap=(m[3]||"").toLowerCase();
 if(ap){if(h<1||h>12||mi>59)return null;h=h%12+(ap[0]==="p"?12:0)}
 else if(h>23||mi>59)return null;return h*60+mi}
function formatClock(v,short){const min=clockMinutes(v);if(min==null)return null;
 const h=Math.floor(min/60),mi=min%60,ap=h>=12?(short?"p":" PM"):(short?"a":" AM"),hh=h%12||12;
 return short?(mi?hh+":"+pad(mi)+ap:hh+ap):hh+":"+pad(mi)+ap}
const nk=k=>String(k).toLowerCase().replace(/%/g,"pct").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
function fld(x,al){if(!x)return "";const m={};for(const k in x)m[nk(k)]=x[k];
 for(const a of al){const v=m[a];if(v!=null&&String(v).trim()!==""&&String(v).trim()!=="—")return v}return ""}
const num=v=>{const x=parseFloat(String(v??"").replace(/[^0-9.\-]/g,""));return isNaN(x)?NaN:x};
const OE=["oepe_sec","oepe","oepe_seconds","avg_oepe_sec","oepe_avg_sec"];
const TT=["total_time_sec","total_sec","total_time","avg_total_sec"];
const hasTimes=x=>!isNaN(num(fld(x,OE)))||!isNaN(num(fld(x,TT)));
function hourOf(v){const s=String(v??"").trim().toLowerCase();if(!s)return null;
 const m=/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(a|p|am|pm)?\b/.exec(s);if(!m)return null;
 let h=+m[1];if(m[3])h=h%12+(m[3][0]==="p"?12:0);return h>=0&&h<24?h:null}
const isTot=x=>/^(all|total|day|daily|day total)$/i.test(String(fld(x,["hour","time","hour_start","interval"])).trim());
const dropType=/^(header|note|prep|baseline)$/i;
// Latest service day. Today's DATA rows win. PREP/NOTE rows (a later hour with only last-week times) do not.
function speedSlice(rows,today){const r=(rows||[]).filter(x=>x&&!dropType.test(String(x.row_type||"").trim()));
 const dateOf=x=>isoDate(fld(x,["date","business_date","day"]));
 const tots=r.filter(isTot),hr=r.filter(x=>!isTot(x)&&hourOf(fld(x,["hour","time","hour_start","interval"]))!=null);
 const dates=[...new Set(hr.filter(hasTimes).map(dateOf).filter(Boolean))].sort();
 const date=today&&dates.includes(today)?today:(dates[dates.length-1]||"");
 const by=new Map();hr.filter(x=>date&&dateOf(x)===date).forEach(x=>{const h=hourOf(fld(x,["hour","time","hour_start","interval"]));
  const o=by.get(h);if(!o||hasTimes(x)||!hasTimes(o.x))by.set(h,{h,x})});
 const hours=[...by.values()].sort((a,b)=>a.h-b.h);
 const total=(tots.filter(x=>date&&dateOf(x)===date).pop())||null;
 const timed=hasTimes(total)||hours.some(o=>hasTimes(o.x));
 return{date,hours,total,hasTimes:!!(date&&timed)}}
// While a live fetch is in flight, don't paint a saved copy that isn't current. A failed fetch (src cached) still shows.
function paintHold(load,current){return !!(load&&load.refreshing&&load.src!=="cached"&&!current)}
const RUSHES=["breakfast","lunch","dinner","event"];
const isDone=x=>/^(y|yes|true|1|x|done)$/i.test(String(x&&x.done||"").trim());
const itemKey=x=>String(x.station||"").trim().toLowerCase()+"|"+String(x.item||"").trim().toLowerCase();
// Same station+item twice, once "Open" and once a real time: keep the timed row. A lone "Open" stays.
function dedupeItems(items){const out=[];(items||[]).forEach(x=>{const k=itemKey(x),mins=clockMinutes(x.check_by);
  const sibs=out.filter(y=>itemKey(y)===k);
  if(!sibs.length){out.push(x);return}
  if(mins==null){if(sibs.some(y=>clockMinutes(y.check_by)!=null)||sibs.some(y=>clockMinutes(y.check_by)==null))return;out.push(x);return}
  for(let i=out.length-1;i>=0;i--)if(itemKey(out[i])===k&&clockMinutes(out[i].check_by)==null)out.splice(i,1);
  if(out.some(y=>itemKey(y)===k&&clockMinutes(y.check_by)===mins))return;out.push(x)});return out}
function preGroups(rows){const g={};(rows||[]).forEach(x=>{const k=String(x.rush||"").trim().toLowerCase()||"other";(g[k]=g[k]||[]).push(x)});
 const ix=k=>{const i=RUSHES.indexOf(k);return i<0?9:i};
 return Object.keys(g).sort((a,b)=>ix(a)-ix(b)||a.localeCompare(b)).map(k=>{
  const it=dedupeItems(g[k]).sort((a,b)=>(clockMinutes(a.check_by)??9999)-(clockMinutes(b.check_by)??9999));
  const ts=it.map(x=>clockMinutes(x.check_by)).filter(v=>v!=null);
  return{k,it,first:ts.length?Math.min(...ts):null,last:ts.length?Math.max(...ts):null,done:it.filter(isDone).length}})}
// Recurring checks apply today. A rush tied to a different calendar date (or a weekday/weekend rule) does not.
function applies(rush,trigger,today){const d=new Date(today+"T12:00:00");if(isNaN(d))return true;const dow=d.getDay();
 const blob=(String(rush||"")+" "+String(trigger||"")).toLowerCase();
 if(/every\s+sat/.test(blob)&&(dow!==0&&dow!==6))return false;
 if(/(mon\s*[–—\-]\s*fri|weekdays?)/.test(blob)&&(dow===0||dow===6))return false;
 const dates=[...blob.matchAll(/(\d{1,2})\/(\d{1,2})/g)].map(m=>[+m[1],+m[2]]);
 const md=(d.getMonth()+1)*100+d.getDate();
 if(dates.length>=2){const x=dates[0][0]*100+dates[0][1],y=dates[1][0]*100+dates[1][1];if(md<Math.min(x,y)||md>Math.max(x,y))return false}
 else if(dates.length===1&&dates[0][0]*100+dates[0][1]!==md)return false;
 return true}
// Soonest check that still applies today and isn't more than 30 min past. Not "the first named rush".
function preNext(G,nowMin,today){const up=(G||[]).filter(g=>g.last!=null&&g.last+30>=nowMin&&g.k!=="event"&&applies(g.k,(g.it[0]&&g.it[0].trigger)||"",today));
 up.sort((a,b)=>(a.first??9e9)-(b.first??9e9)||(a.last-b.last));return up[0]||null}
// PreRush holds one shift. Column "shift" looks like "2026-11-23 6a-2p". Most common value wins. Blank hides the label.
function preShift(rows){const counts=new Map();(rows||[]).forEach(x=>{const raw=String(x&&x.shift||"").trim();if(!raw)return;counts.set(raw,(counts.get(raw)||0)+1)});
 if(!counts.size)return null;const raw=[...counts.keys()].sort((a,b)=>(counts.get(b)-counts.get(a))||(a<b?-1:a>b?1:0))[0];
 const m=/^(\d{4}-\d{2}-\d{2})\s+(.+)$/.exec(raw);return m?{raw,date:m[1],shift:m[2].trim()}:{raw,date:"",shift:raw}}
// "New 11/21 11:16 AM comment (visit ..., 1/5, ...): text" blurbs stuffed into an SMG coaching cell.
function smgBlurbs(text,today,days){text=String(text||"");const re=/New\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2}:\d{2}\s*[AP]M)\s+comment\s*\(([^)]*)\)\s*:\s*/gi;
 const marks=[];let m;while((m=re.exec(text)))marks.push({i:m.index,end:m.index+m[0].length,mo:+m[1],da:+m[2],y:m[3],time:m[4].replace(/\s+/g," "),paren:m[5]});
 const y0=+String(today||"").slice(0,4)||new Date().getFullYear();
 const since=new Date(today+"T12:00:00");since.setDate(since.getDate()-(+days||7)+1);
 const cut=since.getFullYear()+"-"+pad(since.getMonth()+1)+"-"+pad(since.getDate());
 const out=[];marks.forEach((mk,i)=>{let body=text.slice(mk.end,marks[i+1]?marks[i+1].i:text.length).replace(/\s+Focus:[\s\S]*$/,"").split(/\s+(?:Ten new|Earlier|No new comments)\b/i)[0].replace(/\s+/g," ").trim();
  if(body.length>1200)body=body.slice(0,1197).trim()+"…";if(!body)return;
  let y=mk.y?(mk.y.length===2?2000+(+mk.y):+mk.y):y0;
  let date=y+"-"+pad(mk.mo)+"-"+pad(mk.da);
  if(!mk.y&&date>today)date=(y-1)+"-"+pad(mk.mo)+"-"+pad(mk.da);
  if(date<cut||date>today)return;
  const sc=(String(mk.paren).match(/(\d)\s*\/\s*5/)||[])[1]||"";
  out.push({date,time:mk.time,score:sc,comment:body,sentiment:sc&&+sc<=2?"negative":sc&&+sc>=4?"positive":"",source:"smg"})});
 const seen=new Set();return out.filter(x=>{const k=x.date+"|"+x.time+"|"+x.comment.slice(0,40);if(seen.has(k))return false;seen.add(k);return true})
  .sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:(clockMinutes(b.time)||0)-(clockMinutes(a.time)||0))}
const api={isoDate,clockMinutes,formatClock,speedSlice,paintHold,preGroups,preNext,preShift,applies,smgBlurbs,hasTimes};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.ShiftPresent=api;
})(typeof window!=="undefined"?window:globalThis);
