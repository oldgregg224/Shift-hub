(function(){
const $=s=>document.querySelector(s),app=$("#app"),I=window.ICON;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u||"")?esc(u):"#";
const n=x=>parseFloat(String(x??"").replace(/[^0-9.\-]/g,""));
const money=v=>isNaN(v)?"—":"$"+Math.round(v).toLocaleString("en-US");
const pct=v=>isNaN(v)?"—":v.toFixed(1)+"%";
const mmss=s=>isNaN(s)?"—":Math.floor(s/60)+":"+String(Math.round(s%60)).padStart(2,"0");
const sgn=(v,d=0)=>(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(d);
// "20:30" -> "8:30 PM"; short "11a"
function clock(t,short){if(window.FloorCompat&&/^\d{4}-\d\d-\d\dT/.test(t||""))t=FloorCompat.fmtTime(t);const m=/^(\d{1,2}):(\d{2})/.exec(t||"");if(!m)return esc(t);let h=+m[1];const ap=h>=12?(short?"p":" PM"):(short?"a":" AM");h=h%12||12;
 return short?(m[2]==="00"?h+ap:h+":"+m[2]+ap):h+":"+m[2]+ap}
const WORD={good:"On target",warn:"Watch",bad:"Over"};
const chip=(st,txt)=>`<span class="chip ${st}">${esc(txt??WORD[st])}</span>`;
// status(value,target,dir): dir "low" = lower is better.
function status(v,t,kind){if(isNaN(v))return "neutral";const d=v-t;switch(kind){
 case "labor":return d<=0?"good":d<=1?"warn":"bad";
 case "sales":{const p=t?d/t*100:0;return p>=0?"good":p>=-5?"warn":"bad"}
 case "oepe":return d<=0?"good":d<=10?"warn":"bad";
 case "guest":return d>=0?"good":d>=-3?"warn":"bad";
 case "count":return v<=0?"good":v<=2?"warn":"bad"}}
const listCount=s=>{s=String(s??"").replace(/^EXAMPLE:\s*/i,"").trim();if(!s||/^(none|0|—|-)$/i.test(s))return 0;const x=Number(s);return isNaN(x)?s.split(/[,;]/).filter(z=>z.trim()).length:x};
const kpi=(lbl,val,meta,st,word,go,sm)=>`<button class="card" type="button" ${go?`data-go="${go}"`:""}><div class="lbl">${esc(lbl)}${st&&st!=="neutral"?chip(st,word):""}</div><div class="hero${sm?" sm":""}">${val}</div>${meta?`<div class="meta">${esc(meta)}</div>`:""}</button>`;
// "1 cases" -> "1 case"
const qu=(q,u)=>{u=String(u||"");return q+" "+(Math.abs(n(q))===1&&/[^s]s$/i.test(u)?u.replace(/es$/i,m=>/(box|sh|ch)es$/i.test(u)?"":"e").replace(/s$/i,""):u)};
const empty=t=>`<p class="empty">${esc(t)}</p>`;

let meta=null,metaAt=0,metaPend=false;
// Last synced time for a tab: Meta.last_updated for that tab, else the rows' own last_updated / updated column.
const fmtT=d=>d.toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"});
const STALE=90*60000;
// Per-tab freshness: Events refresh weekly (Mon), SMG/Comments every 4h; others 90 min.
const STALE_BY={Events:8*864e5,SMG:4.5*36e5,Comments:4.5*36e5};const staleMs=t=>STALE_BY[t]||STALE;
let CUR={src:"sample",stale:false,tab:""};
async function syncTime(tab,rows){if(ShiftData.Key.get()&&(!meta||Date.now()-metaAt>60000)){try{const r=await ShiftData.load("Meta");if(r.live){meta=r.rows;metaPend=!!(r.refreshing||r.src==="cached");metaAt=metaPend?0:Date.now()}}catch(e){}}
 const m=(meta||[]).find(x=>x.tab===tab);const r0=(rows||[]).find(x=>x&&(x.last_updated||x.updated))||{};
 // v32: use the NEWEST of Meta and the rows' own stamp, so a stale Meta copy can never hide fresher rows.
 const cs=[m&&(m.last_updated||m.updated),r0.last_updated||r0.updated].filter(Boolean).map(v=>({v,d:new Date(v)}));if(!cs.length)return null;
 const ok=cs.filter(c=>!isNaN(c.d)).sort((a,b)=>b.d-a.d);return ok.length?ok[0]:{v:cs[0].v,d:null}}
async function setUpd(tab,rows,live,r){if(tab==="Speed"&&cur==="rushes"&&live&&!(rows&&rows.length))return;r=r||{src:live?"live":"sample"};const u=$("#upd");
 if(!live){CUR={src:"sample",stale:false,tab};u.textContent="Sample data · not live";u.classList.remove("stale");return}
 let t=await syncTime(tab,rows),thr=staleMs(tab);
 // Rushes: if Speed has live rows with a newer sync time, show that time with Speed's threshold.
 if(tab==="Events"&&cur==="rushes"){const sp=await within(ShiftData.load("Speed"),2500,null);if(sp&&sp.live&&sp.rows&&sp.rows.length){const t2=await syncTime("Speed",sp.rows);if(t2&&t2.d&&(!t||!t.d||t2.d>t.d)){t=t2;thr=staleMs("Speed")}}}
 // v33: while the live fetch is still in flight (saved copy shown), never style it stale; wait for the live result.
 const pend=!!(r.refreshing||(metaPend&&r.src!=="cached"));
 const stale=!pend&&!!(t&&t.d&&Date.now()-t.d>thr);CUR={src:r.src,stale,tab,at:r.at};
 let txt=t?"Last synced "+(t.d?fmtT(t.d):t.v)+(pend?" · checking…":stale?" · stale":""):(pend?"Checking…":"Last synced: not in Sheet");
 if(r.src==="cached"&&r.at)txt+=" · saved copy from "+new Date(r.at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
 u.textContent=txt;u.classList.toggle("stale",stale||r.src==="cached");TABST[cur]={c:Object.assign({},CUR),upd:txt,cls:stale||r.src==="cached"}}
const TABST={};
const keyMsg=()=>{const b=ShiftData.status.bad;if(b==="key")return "Key didn't work, using sample data";
 if(ShiftData.scriptBroken&&ShiftData.scriptBroken())return "The shared Sheet script deployment is broken (no doGet), showing "+(CUR.src==="cached"?"saved live":"sample")+" data. Ask your GM to paste the full Code.gs and deploy a new version";
 if(CUR.src==="cached")return "Couldn't refresh, showing saved live data";if(b==="net"&&CUR.src==="sample"&&ShiftData.Key.get())return "Couldn't reach live data, using sample data";return ""};
function keyBanner(){let b=$("#keybanner");const m=keyMsg();if(!b){b=document.createElement("p");b.id="keybanner";b.className="err";b.setAttribute("role","alert");b.style.margin="0 16px 8px";$("#upd").after(b)}
 b.hidden=!m;b.textContent=m?(ShiftData.status.bad==="key"?"Shared key didn't work. Open Settings and re-enter it.":m+". Retrying automatically."):""}
function setSrc(live,src){if(src)CUR.src=src;else if(!live)CUR.src="sample";else if(CUR.src==="sample")CUR.src="live";
 keyBanner();const p=$("#src"),s=CUR.src,bad=ShiftData.status.bad,has=!!ShiftData.Key.get();
 const isLive=s==="live"&&!CUR.stale;p.classList.toggle("live",isLive);p.classList.toggle("bad",s==="sample"&&!!bad);
 p.dataset.label=s==="live"?(CUR.stale?"Live · stale":"Live"):s==="cached"?"Cached":bad==="key"?"Key didn't work":(has&&ShiftData.hasUrl()?(bad?"Offline · sample":"Sample"):"Sample · add key");
 p.setAttribute("aria-label",(s==="live"?"Live data":s==="cached"?"Saved live data":keyMsg()||"Sample data")+". Open settings")}
const keyAlert=()=>ShiftData.status.bad==="key"||(CUR.src==="sample"&&keyMsg())?`<button class="alert" type="button" data-go="settings">${I("siren")}<div><b>${esc(keyMsg())}</b><span>Tap to check the key in Settings</span></div></button>`:"";
let LIVE=false;
async function get(tab){const r=await ShiftData.load(tab);LIVE=r.live;CUR.src=r.src;await setUpd(tab,r.rows,r.live,r);setSrc(r.live,r.src);return r.rows}
// "Now" row: live = latest row; sample = row for the current clock hour, clamped to the sample's range.
// ---- Hourly rows (Labor, Speed): tolerate real Sheet shapes ----
// Column names vary: match by normalized key against aliases. Hours may be "06:00", "6", "6:00 AM", "6a", "14"; ALL/Total rows are day totals.
const nk=k=>String(k).toLowerCase().replace(/%/g,"pct").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
function fld(x,al){if(!x)return "";const m={};for(const k in x)m[nk(k)]=x[k];for(const a of al){const v=m[a];if(v!=null&&String(v).trim()!==""&&String(v).trim()!=="—")return v}return ""}
const num=(x,al)=>n(fld(x,al));
function hourOf(v){const s=String(v??"").trim().toLowerCase();if(!s)return null;const m=/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(a|p|am|pm)?\b/.exec(s);if(!m){const d=new Date(s);return isNaN(d)||!/\d{1,2}:\d{2}/.test(s)?null:d.getHours()}
 let h=+m[1];if(m[3]){h=h%12+(m[3][0]==="p"?12:0)}return h>=0&&h<24?h:null}
const hh=h=>{const ap=h>=12?" PM":" AM";return (h%12||12)+":00"+ap},hs=h=>(h%12||12)+(h>=12?"p":"a");
const isTot=x=>/^(all|total|day|daily|day total)$/i.test(String(fld(x,["hour","time","hour_start","interval"])).trim())||/total|summary/i.test(String(x.row_type||""));
// rows -> {hours:[{h,x}] for the latest date (one per hour, last wins), total:x|null}; has(x) says a row carries data.
function hourly(r,has){r=(r||[]).filter(x=>!/^header$/i.test(String(x.row_type||"")));
 const dateOf=x=>String(fld(x,["date","business_date","day"])||"");
 const tots=r.filter(isTot),hr=r.filter(x=>!isTot(x)&&hourOf(fld(x,["hour","time","hour_start","interval"]))!=null);
 const dates=[...new Set(hr.filter(has).map(dateOf))].sort();const d=dates.pop();
 const by=new Map();hr.filter(x=>d===undefined||dateOf(x)===d||!dateOf(x)).forEach(x=>{const h=hourOf(fld(x,["hour","time","hour_start","interval"]));const o=by.get(h);if(!o||has(x)||!has(o.x))by.set(h,{h,x})});
 const hours=[...by.values()].sort((a,b)=>a.h-b.h);
 const tc=tots.filter(has);const total=(tc.filter(x=>!d||dateOf(x)===d).pop())||tc.pop()||null;return{hours,total,date:d}}
// NOW = current clock hour if it has data, else the latest hour with data before now, else the latest hour with data.
function pickNow(H,has){const h=new Date().getHours(),w=H.filter(o=>has(o.x));if(!w.length)return null;
 const ex=w.find(o=>o.h===h);if(ex)return{o:ex,lbl:"Now · "+hh(ex.h)};const b=w.filter(o=>o.h<h).pop();
 if(b)return{o:b,lbl:"Latest · "+hh(b.h)};const l=w[w.length-1];return{o:l,lbl:"Latest · "+hh(l.h)}}
const chipIf=(st,txt)=>st&&st!=="neutral"&&txt&&!/NaN|undefined/.test(txt)?chip(st,txt):"";


// Real Labor tab (Store Ops sync): DAY rows (hour "ALL": cap_hours, sales = projection, target_pct, call, notes)
// and BLOCK rows (hour "HH:MM-HH:MM" or "HH:MM": call, position_to_cut_first, prep_level_notes). labor_pct is often blank.
function rngOf(v){const m=/^\s*(\d{1,2}):?(\d{2})?\s*(?:-|–|to)\s*(\d{1,2}):?(\d{2})?\s*$/.exec(String(v||""));if(m)return{a:+m[1]*60+(+m[2]||0),b:+m[3]*60+(+m[4]||0)};
 const h=hourOf(v);if(h==null)return null;const mm=/:(\d{2})/.exec(String(v));const a=h*60+(mm?+mm[1]:0);return{a,b:a+60}}
const tm=m=>{m=((m%1440)+1440)%1440;const h=Math.floor(m/60),mi=m%60;return (h%12||12)+(mi?":"+String(mi).padStart(2,"0"):"")+(h>=12?"p":"a")};
const AH_=["actual_hours","labor_hours","worked_hours","hours_worked"];
function laborPlan(r,LP,TP,CH,SL,BR){r=(r||[]).filter(x=>!/^(header|example)$/i.test(String(x.row_type||"")));
 const dOf=x=>String(fld(x,["date","business_date","day"])||"").slice(0,10),T=x=>String(x.row_type||"").toUpperCase();
 const days=r.filter(x=>T(x)==="DAY"||isTot(x)),blocks=r.filter(x=>T(x)!=="DAY"&&!isTot(x)&&rngOf(fld(x,["hour","time","block"])));
 if(!days.length&&!blocks.length)return "";
 const today=ymd(new Date()),dates=[...new Set(days.map(dOf))].sort();const dd=dates.includes(today)?today:dates.filter(d=>d<=today).pop()||dates.pop();
 const day=days.filter(x=>dOf(x)===dd).pop();
 const callSt=c=>{c=String(c||"").toUpperCase();return c.includes("EARLY")||c.includes("CUT")?"bad":c.includes("HOLD")?"warn":c?"good":"neutral"};
 const callChip=c=>c&&!/^[—–-]$/.test(c)?chip(callSt(c),c):"";
 const txt=v=>{v=String(v??"").trim();return v&&!/^[—–-]$|^â/.test(v)?v:""};
 const nowM=Date.now();const abs=x=>{const g=rngOf(fld(x,["hour","time","block"])),d=new Date(dOf(x)+"T00:00:00");if(isNaN(d))return null;
  const st=d.getTime()+g.a*6e4,en=d.getTime()+(g.b<=g.a?g.b+1440:g.b)*6e4;return{st,en,g}};
 const B=blocks.map(x=>({x,t:abs(x)})).filter(o=>o.t).sort((a,b)=>a.t.st-b.t.st);
 const cur=B.filter(o=>o.t.st<=nowM&&nowM<o.t.en).pop(),nxt=B.find(o=>o.t.st>nowM),last=B.filter(o=>o.t.en<=nowM).pop();
 const lab=(o)=>{const g=o.t.g;return o.x.hour&&/[-–]/.test(o.x.hour)?tm(g.a)+"–"+tm(g.b):tm(g.a)};
 const dayLbl=d=>d===today?"Today":new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
 let h="";
 if(day){const isT=dd===today,b=isT&&BR||{};const bl=n(b.labor_actual_pct),bs=n(b.sales_actual),bp=n(b.sales_projection);
  const l=isNaN(bl)?num(day,LP):bl,t=num(day,TP),c=num(day,CH),ah=num(day,AH_),pj=isNaN(bp)?num(day,SL):bp,sa=bs,call=txt(fld(day,["call","labor_call"]));
  const s=isNaN(l)||isNaN(t)||l<0||l>500?"neutral":status(l,t,"labor");const d=l-t;
  h+=`<div class="card"><div class="lbl">${dd===today?"Today":"Latest · "+esc(dayLbl(dd))}${s==="neutral"||isNaN(d)?"":chip(s,Math.abs(d).toFixed(1)+" pts "+(d>0?"over":"under")+" target")}</div>
  <div class="hero">${isNaN(l)?(isNaN(c)?"—":esc(+c.toFixed(1))+"<small style='font-size:.45em'> cap hrs</small>"):pct(l)}</div>
  <div class="meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${[isNaN(t)?"":"target "+pct(t),!isNaN(l)&&!isNaN(c)?"cap "+esc(+c.toFixed(1))+" hrs":"",!isNaN(ah)&&!isNaN(c)?esc(+ah.toFixed(1))+" of "+esc(+c.toFixed(1))+" hrs":"",isNaN(sa)?(isNaN(pj)?"":"sales "+money(pj)):"sales "+money(sa)].filter(Boolean).join(" · ")} ${callChip(call)}</div>
  ${[["Cut first",fld(day,["position_to_cut_first","cut_first"])],["Notes",fld(day,["prep_level_notes","prep_notes"])],["Hold times",fld(day,["hold_time_reminders","hold_notes"])]].filter(([,v])=>txt(v)).map(([k,v])=>`<p class="meta" style="-webkit-line-clamp:6"><b>${k}:</b> ${esc(txt(v))}</p>`).join("")}</div>`}
 const F=cur?["Now",cur]:last?["Latest",last]:nxt?["Next",nxt]:null;
 const NX=F&&F[0]!=="Next"&&nxt?nxt:null;
 if(F){const x=F[1].x;h+=`<div class="card${F[0]==="Now"?" now":""}"><div class="lbl">${F[0]} · ${esc(lab(F[1]))}${F[1].t&&dOf(x)!==today?" "+esc(dayLbl(dOf(x))):""}${callChip(txt(x.call))}</div>
  ${txt(fld(x,["position_to_cut_first","cut_first"]))?`<div class="meta"><b>Cut first:</b> ${esc(txt(fld(x,["position_to_cut_first","cut_first"])))}</div>`:""}
  ${txt(fld(x,["prep_level_notes","prep_notes"]))?`<p class="meta" style="-webkit-line-clamp:6">${esc(txt(fld(x,["prep_level_notes","prep_notes"])))}</p>`:""}</div>`}
 if(NX){const x=NX.x,c=txt(fld(x,["position_to_cut_first","cut_first"]));h+=`<div class="card"><div class="lbl">Next · ${esc(lab(NX))}${dOf(x)!==today?" "+esc(dayLbl(dOf(x))):""}${callChip(txt(x.call))}</div>${c?`<div class="meta"><b>Cut first:</b> ${esc(c)}</div>`:""}</div>`}
 const up=B.filter(o=>o.t.en>nowM-36e5*2);
 if(up.length)h+=`<div class="sec">Labor calls</div><div class="list">${up.map(o=>{const x=o.x,cut=txt(fld(x,["position_to_cut_first","cut_first"])),nt=txt(fld(x,["prep_level_notes","prep_notes"]));
  return `<details><summary class="row"><span class="t">${esc(lab(o))}</span><span class="v txt">${esc(dOf(x)===today?"Today":dayLbl(dOf(x)))}${cut?`<small>${esc(cut)}</small>`:""}</span>${callChip(txt(x.call))}${I("chevron-down","cv")}</summary>${nt?`<p class="meta" style="padding:0 12px 12px;-webkit-line-clamp:8">${esc(nt)}</p>`:""}</details>`}).join("")}</div>`;
 return h||empty("No labor plan yet")}
async function whoHome(){try{const {rows}=await Promise.race([roster(),new Promise((_,j)=>setTimeout(()=>j(new Error("slow")),2500))]),now=shiftNow();const sr=rows.filter(x=>x.date===now.date&&x.shift===now.shift);if(!sr.length)return "";
 const m=sr.filter(x=>String(x.role).toLowerCase()==="manager").map(x=>first(x.first_name)).join(", ")||"—",c=sr.length-sr.filter(x=>String(x.role).toLowerCase()==="manager").length;
 return `<button class="card tool" type="button" data-go="whoson">${I("users")}<span><b>Who's on · ${esc(m)}</b><span class="meta">${c} crew this shift</span></span>${I("chevron-right","cv")}</button>`}catch(e){return ""}}
// Resolve p, or after ms resolve with fb() (or fb) so a screen never waits on a slow queued call.
const within=(p,ms,fb)=>new Promise(res=>{let d=0;const t=setTimeout(()=>{if(!d){d=1;res(typeof fb==="function"?fb():fb)}},ms);p.then(v=>{clearTimeout(t);if(!d){d=1;res(v)}},e=>{clearTimeout(t);if(!d){d=1;res(typeof fb==="function"?fb():fb)}})});
let FLATE={};
const S={
async home(){const r=await get("Brief"),b=r[0]||{};
 const sa=n(b.sales_actual),sp=n(b.sales_projection),la=n(b.labor_actual_pct),lp=n(b.labor_projection_pct);
 const ss=isNaN(sp)?"neutral":status(sa,sp,"sales"),ls=isNaN(lp)?"neutral":status(la,lp,"labor");
 const na=v=>/^\s*n\/?a\b/i.test(String(v??"").replace(/^EXAMPLE:\s*/i,""));const odNA=na(b.overdue_checklists);
 const ot=listCount(b.overtime_watch_first_names),od=listCount(b.overdue_checklists),cm=n(b.new_smg_comment_count)||0,hr=n(b.open_harri_requests)||0;
 const rush=b.rush_banner?`<div class="alert">${I("siren")}<div><b>${esc(b.rush_banner)}</b><span>Rush today</span></div></div>`:"";
 return keyAlert()+rush+
 kpi("Sales",money(sa),isNaN(sp)?"":"of "+money(sp)+" projected",ss,(isNaN(sa-sp)?"":(sa-sp<0?"−":"+")+money(Math.abs(sa-sp))+" · ")+({good:"Ahead",warn:"Behind",bad:"Behind"}[ss]||""),null)+
 kpi("Labor",pct(la),isNaN(lp)?"":"target "+pct(lp),ls,(isNaN(la-lp)?"":sgn(la-lp,1)+" · ")+({good:"On target",warn:"Watch",bad:"Over"}[ls]||""),"labor")+
 `<div class="grid">`+
 kpi("Overtime",ot,ot?b.overtime_watch_first_names:"No one close",status(ot,0,"count"),ot?"Watch":"Clear","floor",1)+
 (odNA?"":kpi("Overdue",od,od?b.overdue_checklists:"All checklists done",od?"bad":"good",od?"Late":"Clear","floor",1))+
 kpi("Guest notes",cm,"new comments",null,null,"guest",1)+
 kpi("Requests",hr,"open in Harri",status(hr,0,"count"),hr?"Open":"Clear",null,1)+`</div>`+await whoHome()},

async labor(){const r=await get("Labor");
 const LP=["labor_pct","labor_percent","labor_pct_actual","actual_labor_pct","actual_pct","crew_labor_pct","labor"],TP=["target_pct","labor_target_pct","target","goal_pct","labor_goal_pct","projected_labor_pct","labor_projection_pct"],
 AH=["actual_hours","labor_hours","worked_hours","actual_hrs","hours_worked","hours"],CH=["cap_hours","scheduled_hours","planned_hours","budget_hours","cap_hrs","sched_hours","projected_hours"],SL=["sales","net_sales","sales_actual","actual_sales"];
 const has=x=>!isNaN(num(x,LP))||!isNaN(num(x,AH));const {hours,total}=hourly(r,has);
 if(!hours.some(o=>has(o.x))){let BR=null;try{const b=await ShiftData.load("Brief");BR=(b.rows||[]).filter(x=>!/^(example|header)$/i.test(String(x.row_type||""))).pop()||null}catch(e){}const pv=laborPlan(r,LP,TP,CH,SL,BR);if(pv)return keyAlert()+pv}
 if(!hours.some(o=>has(o.x))&&!total)return keyAlert()+empty("No labor data yet");
 const callSt=c=>{c=String(c||"").toUpperCase();return c.includes("EARLY")?"bad":c.includes("HOLD")?"warn":"good"};
 const tgt=x=>{const t=num(x,TP);return isNaN(t)?NaN:t};
 const hrs=x=>{const a=num(x,AH),c=num(x,CH);return isNaN(a)&&isNaN(c)?"":isNaN(c)?esc(+a.toFixed(2))+" hrs":isNaN(a)?"cap "+esc(+c.toFixed(2))+" hrs":esc(+a.toFixed(2))+" of "+esc(+c.toFixed(2))+" hrs"};
 const card=(lbl,x)=>{const l=num(x,LP),t=tgt(x),s=isNaN(t)?"neutral":status(l,t,"labor"),call=fld(x,["call","labor_call","action"]),hm=hrs(x);
  return `<div class="card"><div class="lbl">${lbl}${chipIf(s,(isNaN(l-t)?"":sgn(l-t,1)+" · ")+(WORD[s]||""))}</div><div class="hero">${pct(l)}</div>
  <div class="meta" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${[isNaN(t)?"":"target "+pct(t),hm].filter(Boolean).join(" · ")} ${call?chip(callSt(call),call):""}</div></div>`};
 const N=pickNow(hours,has);
 return keyAlert()+(N?card(N.lbl,N.o.x):"")+(total?card("Day total",total):"")+
 (hours.length?`<div class="sec">By hour</div><div class="list">${hours.map(({h,x})=>{const l=num(x,LP),t=tgt(x),call=fld(x,["call","labor_call","action"]),st=isNaN(t)?"neutral":status(l,t,"labor"),hm=hrs(x),sa=num(x,SL);
 const cut=fld(x,["position_to_cut_first","cut_first"]),prep=fld(x,["prep_level_notes","prep_notes","prep"]),hold=fld(x,["hold_time_reminders","hold_notes"]);
 return `<details><summary class="row"><span class="t">${hs(h)}</span><span class="v">${pct(l)}<small>${[hm,st!=="neutral"?WORD[st]:""].filter(Boolean).join(" · ")||(has(x)?"":"No data yet")}</small></span>${call?chip(callSt(call),call):""}${I("chevron-down","cv")}</summary>
 <div class="det">${cut?`<div><b>Cut first:</b> ${esc(cut)}</div>`:""}${prep?`<div><b>Prep:</b> ${esc(prep)}</div>`:""}${hold?`<div><b>Hold:</b> ${esc(hold)}</div>`:""}${isNaN(sa)?"":`<div><b>Sales:</b> ${money(sa)}</div>`}${isNaN(t)?"":`<div><b>Target:</b> ${pct(t)}</div>`}</div></details>`}).join("")}</div>`:"")},

async rushes(){const r=await get("Events");const d0=new Date(),today=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,"0")}-${String(d0.getDate()).padStart(2,"0")}`;
 const t=r.filter(x=>x.date===today),wk=new Date(d0.getTime()+7*864e5).toISOString().slice(0,10),nx=r.filter(x=>x.date>today&&x.date<=wk).sort((a,b)=>a.date<b.date?-1:1);
 const win=x=>{const a=clock(x.rush_window_start).replace(":00",""),b=clock(x.rush_window_end).replace(":00","");const pa=a.slice(-2);return (b.endsWith(pa)&&/[AP]M$/.test(a)?a.slice(0,-3):a)+"–"+b};
 const day=s=>{const d=new Date(s+"T12:00:00");return isNaN(d)?esc(s):d.toLocaleDateString("en-US",{weekday:"short"})+" "+d.getDate()};
 const src=x=>x.source_url?`<a class="src-link" href="${safeUrl(x.source_url)}" target="_blank" rel="noopener noreferrer">${I("external-link")}Source</a>`:"";
 return keyAlert()+`<div class="sec">Today</div>`+(t.length?t.map(x=>`<div class="card"><div class="lbl">${esc(x.event)}</div><div class="hero sm">${win(x)}</div>
 ${x.runner_timing?`<div style="margin-top:8px">${chip("neutral",x.runner_timing)}</div>`:""}${x.prep_notes?`<div class="meta">${esc(x.prep_notes)}</div>`:""}${src(x)}</div>`).join(""):empty("No events today"))+
 `<div class="sec">Next 7 days</div>`+(nx.length?`<div class="list">${nx.map(x=>`<details><summary class="row">${chip("neutral",day(x.date))}<span class="v txt">${esc(x.event)}<small>${win(x)}</small></span>${I("chevron-down","cv")}</summary>
 <div class="det" style="padding-left:0">${x.prep_notes?`<div><b>Prep:</b> ${esc(x.prep_notes)}</div>`:""}${x.runner_timing?`<div><b>Runner:</b> ${esc(x.runner_timing)}</div>`:""}${src(x)}</div></details>`).join("")}</div>`:empty("Nothing coming up"))},

async speed(){const r=await get("Speed");
 const OE=["oepe_sec","oepe","oepe_seconds","avg_oepe_sec","oepe_avg_sec"],LW=["last_week_oepe_sec","lw_oepe_sec","last_week_oepe","oepe_last_week_sec"],TT=["total_time_sec","total_sec","total_time","avg_total_sec"],LT=["last_week_total_sec","lw_total_sec"],
 OS=["order_sec","order_time_sec"],CS=["cash_sec","cash_time_sec"],WS=["second_window_sec","present_sec","window_sec","2nd_window_sec"];
 const has=x=>!isNaN(num(x,OE))||!isNaN(num(x,TT));const hasAny=x=>has(x)||!isNaN(num(x,LW));
 const {hours,total}=hourly(r,hasAny);if(!hours.length&&!total)return keyAlert()+empty("No speed data yet");
 const st=x=>String(fld(x,["slow_flag","slow"])).toUpperCase()==="Y"&&has(x)?"bad":isNaN(num(x,LW))?"neutral":status(num(x,OE),num(x,LW),"oepe");
 const N=pickNow(hours,has);const tips=r.filter(x=>fld(x,["pre_rush_positioning_note","positioning_note"]));
 const lwOnly=!hours.some(o=>has(o.x));
 const head=N?(()=>{const x=N.o.x,cd=num(x,OE)-num(x,LW),s=st(x);return `<div class="card"><div class="lbl">${N.lbl}${chipIf(s,isNaN(cd)?WORD[s]:sgn(cd)+"s vs LW")}</div><div class="hero">${mmss(num(x,OE))}</div><div class="meta">OEPE${isNaN(num(x,LW))?"":" · last week "+mmss(num(x,LW))}</div></div>`})()
  :`<div class="card"><div class="lbl">No times yet today</div><div class="meta">${lwOnly?"Showing last week's times by hour below.":"Waiting for the next sync."}</div></div>`;
 return keyAlert()+head+tips.map(x=>`<div class="tip">${I("lightbulb")}<span>${esc(fld(x,["pre_rush_positioning_note","positioning_note"]))}</span></div>`).join("")+
 `<div class="sec">OEPE by hour</div><div class="list">${hours.map(({h,x})=>{const oe=num(x,OE),lw=num(x,LW),d=oe-lw,s=st(x),o=num(x,OS)||0,c=num(x,CS)||0,w=num(x,WS)||0;
 const tag=(isNaN(d)?"":sgn(d)+"s ")+(s==="bad"?"Slow":s==="warn"?"Watch":"");
 return `<details><summary class="row"><span class="t">${hs(h)}</span><span class="v">${mmss(oe)}<small>${[isNaN(lw)?"":"LW "+mmss(lw),isNaN(num(x,TT))?"":"total "+mmss(num(x,TT))].filter(Boolean).join(" · ")}</small></span>${tag.trim()?chip(s,tag):""}${I("chevron-down","cv")}</summary>
 <div class="det">${isNaN(num(x,TT))&&isNaN(num(x,LT))?"":`<div><b>Total:</b> ${mmss(num(x,TT))}${isNaN(num(x,LT))?"":" (LW "+mmss(num(x,LT))+")"}</div>`}${o+c+w?`<div class="bar"><i style="flex:${o};background:var(--accent)"></i><i style="flex:${c};background:var(--ink-3)"></i><i style="flex:${w};background:var(--warn)"></i></div><div>Order ${o}s · Cash ${c}s · 2nd window ${w}s</div>`:""}</div></details>`}).join("")}</div>`},

async guest(){const r=await get("SMG"),cmt=await comments();if(!r.length)return keyAlert()+empty("No guest scores yet")+cmt;const f=r.find(x=>x.coaching_focus);
 const cm=r.filter(x=>x.low_score_comment_names_removed);
 return keyAlert()+(f?`<div class="tip">${I("target")}<span>${esc(f.coaching_focus)}</span></div>`:"")+
 r.map(x=>{const s=n(x.score),l=n(x.last_week),st=status(s,l,"guest");return `<div class="card"><div class="lbl">${esc(x.channel)}${isNaN(l)?"":chip(st,(isNaN(s-l)?"":sgn(s-l)+" · ")+({good:"Up",warn:"Watch",bad:"Down"}[st]||""))}</div><div class="hero">${isNaN(s)?"—":s}</div>${isNaN(l)?"":`<div class="meta">last week ${l}</div>`}</div>`}).join("")+
 (cm.length?`<details class="card more"><summary>Survey low-score comments: ${cm.length}${I("chevron-down","cv")}</summary><div class="det" style="padding:0">${cm.map(x=>`<div><b>${esc(x.channel)}:</b> ${esc(x.low_score_comment_names_removed)}</div>`).join("")}</div></details>`:"")+cmt},

async floor(){FLATE=FLATE||{};const TS=within(toolSync(),150,null);const F=window.Floor;const sub=floorSub;const RP=sub==="positions"?within(roster(),2200,()=>({rows:[]})):null;
 const tabs=[["positions","Positions"],["breaks","Breaks"],["checklist","Checklist"],["fixes","Fixes"],["handoff","Notes"]];
 const seg=`<div class="seg" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" data-sub="${k==="handoff"?"notes":k}" class="${k===sub?"on":""}" aria-selected="${k===sub}">${l}</button>`).join("")}</div>`;
 const lp=F.list(sub).then(v=>saveCache(sub,v));let late=false;
 const rows=await fastList(sub,lp,()=>cur==="floor"&&floorSub===sub,"floor");const store=`<p class="upd" style="padding:0;text-align:center">${ShiftData.live()?"Shared with all managers":"Saved on this phone"}</p>`;
 const tm=ts=>new Date(ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
 const chkRow=(x,attr)=>`<div style="display:flex;align-items:center;gap:8px"><label class="chk" style="flex:1"><input type="checkbox" ${attr}="${esc(x.id)}" ${x.done?"checked":""}><span class="box">${I("check")}</span><span>${esc(x.item)}</span></label>${delBtn(attr==="data-chk"?"checklist":"fixes",x.id)}</div>`;
 const chkList=(attr,emp)=>{const vis=rows.filter(x=>SHOWDONE||!x.done),nd=rows.filter(x=>x.done).length;return (vis.length?`<div class="list">${vis.map(x=>chkRow(x,attr)).join("")}</div>`:empty(rows.length?"All done.":emp))+doneTog(nd)};
 let body="",bar="";
 if(sub==="positions"){const now=shiftNow(),sl=(SHIFTS.find(x=>x[0]===now.shift)||[])[1];
  const today=rows.filter(x=>!x.date||x.date===now.date&&(!x.shift||x.shift===now.shift));
  const placed={};today.forEach(x=>placed[String(x.name).toLowerCase()]=x.position);
  let crew=[];try{crew=(await RP).rows.filter(x=>x.date===now.date&&x.shift===now.shift).sort((a,b)=>(String(b.role).toLowerCase()==="manager")-(String(a.role).toLowerCase()==="manager"))}catch(e){}
  POSOPTS=[...new Set([...crew.filter(x=>String(x.role).toLowerCase()!=="manager").map(x=>String(x.position||"").trim()),...rows.map(x=>String(x.position||"").trim()),"Grill","Fries","Front counter","Drive-thru order","Drive-thru window","Lobby"].filter(Boolean))];
  body=(today.length?`<div class="sec">Placed now</div><div class="list">${today.map(x=>`<div class="row"><span class="v txt">${esc(x.position)}</span><b>${esc(first(x.name))}</b></div>`).join("")}</div>`:empty("No one placed on this shift yet. Tap Place next to a crew member below."))+
  `<div class="sec">On the roster · ${esc(sl||"")}</div>`+(crew.length?`<div class="list">${crew.map((x,i)=>{const nm=first(x.first_name),pl=placed[nm.toLowerCase()];
   return `<div class="row"><span class="v txt">${esc(nm)}<small>${esc(x.position)} · ${clock(x.start,1)}–${clock(x.end,1)}</small></span>${String(x.role).toLowerCase()==="manager"?chip("neutral","Manager"):""}${pl?chip("good",pl):""}<button class="btn" type="button" data-place="${esc(nm)}" data-pos="${esc(x.position)}" aria-label="Place ${esc(nm)}">${pl?"Move":"Place"}</button></div>`}).join("")}</div>`:empty("No crew on today's roster for this shift. Add Roster rows in the Sheet, or place someone below."));
  bar=`<input id="pp" placeholder="Position" aria-label="Position"><input id="pn" placeholder="First name" aria-label="First name" style="max-width:40%"><button class="btn primary sq" data-act="pos" aria-label="Place">${I("plus")}</button>`}
 if(sub==="breaks"){const on=rows.filter(x=>!x.back),done=rows.filter(x=>x.back);
  body=(on.length?`<div class="list">${on.map(x=>`<div class="row"><span class="v txt">${esc(x.name)}<small>out ${tm(x.ts)}</small></span><span class="chip" data-since="${esc(x.ts)}"></span><button class="btn" data-back="${esc(x.id)}">Back</button>${delBtn("breaks",x.id)}</div>`).join("")}</div>`:empty("No one on break right now. Type a first name below and tap Start."))+
  doneTog(done.length)+(done.length&&SHOWDONE?`<div class="sec">Back</div><div class="list">${done.slice(-8).reverse().map(x=>`<div class="row"><span class="v txt">${esc(x.name)}<small>${tm(x.ts)} – ${tm(x.back)}</small></span>${chip("good",Math.round((new Date(x.back)-new Date(x.ts))/60000)+" min")}${delBtn("breaks",x.id)}</div>`).join("")}</div>`:"");
  bar=`<input id="bn" placeholder="First name" aria-label="First name"><button class="btn primary" data-act="brk">Start</button>`}
 if(sub==="checklist"){body=chkList("data-chk","No checklist items for this shift. Add one below.");
  bar=`<input id="ci" placeholder="Checklist item" aria-label="Checklist item"><button class="btn primary sq" data-act="chk" aria-label="Add">${I("plus")}</button>`}
 if(sub==="fixes"){body=chkList("data-fix","No quick fixes listed. Add one below (bigger repairs go in Tools › Equipment).");
  bar=`<input id="fi" placeholder="Fix to do" aria-label="Fix"><button class="btn primary sq" data-act="fix" aria-label="Add">${I("plus")}</button>`}
 if(sub==="handoff"){body=rows.length?`<div class="list">${rows.slice(-10).reverse().map(x=>`<div class="row" style="display:block;padding:12px 0"><div class="note-ts">${new Date(x.ts).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</div>${esc(x.note)}</div>`).join("")}</div>`:empty("No handoff notes yet. Leave one for the next manager below.");
  bar=`<input id="hn" placeholder="Note for next manager" aria-label="Note"><button class="btn primary sq" data-act="hand" aria-label="Save note">${I("plus")}</button>`}
 await TS;return back+seg+body+store+`<div class="addbar">${bar}</div>`}
};
// ---- Guest comments ----
// Display-side scrub for guest text: emails, phone numbers, long digit runs (order/card numbers).
const scrub=t=>String(t??"").replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,"[email]").replace(/\d{11,}/g,"[number]")
 .replace(/(\+?\d[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,"[phone]").replace(/\d{6,}/g,"[number]");
let cmtF="all",cmtDays=7;
async function comments(){let rows=[],live=false,src="";try{const r=await ShiftData.load("Comments");rows=r.rows||[];live=r.live;src=r.src}catch(e){return `<div class="card"><div class="lbl">Comments${chip("bad","Error")}</div><div class="meta">Couldn't load comments.</div></div>`}
 let bc=NaN;try{const b=await ShiftData.load("Brief");const x=(b.rows||[]).filter(x=>!/^(example|header)$/i.test(String(x.row_type||""))).pop();bc=n(x&&x.new_smg_comment_count)}catch(e){}
 const brief=isNaN(bc)?"":` Brief reports ${bc} new comment${bc===1?"":"s"}.`;
 if(src==="unsupported")return `<div class="sec">Comments</div><div class="card stack" role="status"><div class="lbl">Comments need the Apps Script update${chip("warn","Not shared yet")}</div><div class="meta" style="-webkit-line-clamp:6">The shared Sheet script doesn't serve the Comments tab yet.${brief} Ask your GM to redeploy the latest Shift Hub Apps Script.</div></div>`;
 if(live)rows=rows.filter(x=>String(x.row_type||"").toUpperCase()==="DATA").map(x=>Object.assign({},x,{date:isoD(x.date)}));
 if(live&&!rows.length)return `<div class="sec">Comments</div><div class="card stack" role="status"><div class="lbl">No comments in the Sheet yet${isNaN(bc)?"":chip("neutral","Brief: "+bc+" new")}</div><div class="meta" style="-webkit-line-clamp:6">The Comments tab has no DATA rows yet.${brief}</div></div>`;
 if(!live&&rows.length){// sample: shift EXAMPLE dates so the newest is today
  const mx=rows.map(x=>x.date).sort().pop(),b=new Date(mx+"T12:00:00"),t=new Date();t.setHours(12,0,0,0);
  rows=rows.map(x=>{const d=new Date(x.date+"T12:00:00"),o=new Date(t);o.setDate(o.getDate()+Math.round((d-b)/864e5));return Object.assign({},x,{date:ymd(o)})})}
 const since=new Date();since.setDate(since.getDate()-cmtDays+1);const cut=ymd(since);
 const inRange=rows.filter(x=>String(x.date)>=cut).sort((a,b)=>String(b.date).localeCompare(a.date));
 const sen=x=>String(x.sentiment).toLowerCase();const list=cmtF==="all"?inRange:inRange.filter(x=>sen(x)===cmtF);
 const neg=inRange.filter(x=>sen(x)==="negative").length;
 const sc=x=>{const v=n(x.score);return chip(v>=4?"good":v>=3?"warn":"bad",(isNaN(v)?"—":v)+"/5")};
 const seg=(g,opts,curv)=>`<div class="seg" role="tablist">${opts.map(([k,l])=>`<button type="button" role="tab" data-${g}="${k}" class="${String(k)===String(curv)?"on":""}" aria-selected="${String(k)===String(curv)}">${l}</button>`).join("")}</div>`;
 const day=s=>{const d=new Date(s+"T12:00:00");return isNaN(d)?esc(s):d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})};
 return `<div class="sec">Comments</div><div class="card stack"><div class="lbl">Last ${cmtDays} days${cmtF==="all"?chip("neutral","All: "+inRange.length):cmtF==="negative"?chip(neg?"warn":"good","Negative: "+neg):chip("good","Positive: "+list.length)}</div>
 <p class="meta" style="margin:0">Low scores (1–2): ${inRange.filter(x=>n(x.score)<=2).length} · Negative: ${neg} · Positive: ${inRange.filter(x=>sen(x)==="positive").length}${isNaN(bc)?"":" · Brief: "+bc+" new"}</p>
 ${seg("cmtf",[["all","All"],["negative","Negative"],["positive","Positive"]],cmtF)}${seg("cmtd",[[7,"7 days"],[14,"14 days"]],cmtDays)}
 ${list.length?`<div class="list">${list.slice(0,30).map(x=>`<div class="row" style="display:block;padding:12px 0"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="note-ts" style="margin:0;flex:1">${day(x.date)}</span>${sc(x)}${chip(sen(x)==="negative"?"bad":sen(x)==="positive"?"good":"neutral",sen(x)?sen(x)[0].toUpperCase()+sen(x).slice(1):"—")}</div><div style="margin-top:4px">${esc(scrub(x.comment))}</div></div>`).join("")}</div>`:empty(cmtF==="all"?"No comments in this range":"No "+cmtF+" comments in this range")}</div>`}
// ---- Who's on (Roster) ----
const SHIFTS=[["6a-2p","6 AM – 2 PM"],["2p-10p","2 PM – 10 PM"],["10p-6a","10 PM – 6 AM"]];
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function shiftNow(){const d=new Date(),h=d.getHours();const op=new Date(d);if(h<6)op.setDate(op.getDate()-1);
 return{date:ymd(op),shift:h>=6&&h<14?"6a-2p":h>=14&&h<22?"2p-10p":"10p-6a",op}}
const isoD=v=>{v=String(v||"").trim();let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
 m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m)return(m[3].length==2?"20"+m[3]:m[3])+"-"+m[1].padStart(2,"0")+"-"+m[2].padStart(2,"0");const d=new Date(v);return isNaN(d)?v:ymd(d)};
const normShift=v=>{const t=String(v||"").toLowerCase().replace(/\s|:00|m\b/g,"").replace(/[–—to]+/g,"-");return t.startsWith("6a")?"6a-2p":t.startsWith("2p")?"2p-10p":t.startsWith("10p")?"10p-6a":String(v||"").trim()};
async function roster(){const r=await ShiftData.load("Roster");let rows=(r.rows||[]).filter(x=>String(x.row_type||"").toUpperCase()!=="HEADER").map(x=>Object.assign({},x,{date:isoD(x.date),shift:normShift(x.shift),role:String(x.role||"").trim()}));
 if(!r.live&&rows.length){// sample: move EXAMPLE dates so the first one is "today"
  const base=rows.map(x=>x.date).sort()[0],op=shiftNow().op;const b=new Date(base+"T12:00:00");
  rows=rows.map(x=>{const d=new Date(x.date+"T12:00:00");const o=new Date(op);o.setDate(o.getDate()+Math.round((d-b)/864e5));return Object.assign({},x,{date:ymd(o)})})}
 return{rows,live:r.live,r}}
const first=s=>String(s||"").trim().split(/\s+/)[0];
let whoDay=0;
S.whoson=async()=>{const {rows,live,r}=await roster();
 if(r.src==="unsupported"){CUR.src="live";$("#upd").textContent="";setSrc(true,"live");
  return `<div class="card stack" role="status"><div class="lbl">Who's on needs the Apps Script update${chip("warn","Not shared yet")}</div><div class="meta" style="-webkit-line-clamp:6">The shared Sheet script is an older version that doesn't serve the Roster tab yet. Ask your GM to redeploy the latest Shift Hub Apps Script. Everything else is live.</div></div>`}
 CUR.src=r.src;await setUpd("Roster",rows,live,r);setSrc(live,r.src);
 if(live&&!rows.filter(x=>String(x.row_type||"").toUpperCase()!=="EXAMPLE").length)return `<div class="card stack" role="status"><div class="lbl">No roster in the Sheet yet${chip("neutral","Roster tab")}</div><div class="meta" style="-webkit-line-clamp:6">The Sheet has no Roster rows. Add a Roster tab (row_type, date, shift, role, first_name, position, start, end) or let the schedule sync fill it.</div></div>`;
 const now=shiftNow(),d=new Date(now.op);d.setDate(d.getDate()+whoDay);const day=ymd(d);
 const seg=`<div class="seg" role="tablist">${["Today","Tomorrow"].map((l,i)=>`<button type="button" role="tab" data-who="${i}" class="${i===whoDay?"on":""}" aria-selected="${i===whoDay}">${l}</button>`).join("")}</div>`;
 const dayRows=rows.filter(x=>x.date===day);
 const cards=SHIFTS.map(([k,lbl])=>{const sr=dayRows.filter(x=>x.shift===k);const mg=sr.filter(x=>String(x.role).toLowerCase()==="manager"),cr=sr.filter(x=>String(x.role).toLowerCase()!=="manager").sort((a,b)=>String(a.start).localeCompare(b.start));
  const isNow=!whoDay&&k===now.shift;
  return `<div class="card${isNow?" now":""}"><div class="lbl">${lbl}${isNow?chip("good","On now"):chip("neutral",cr.length+" crew")}</div>
  <div class="mgr">${mg.length?mg.map(x=>`<b>${esc(first(x.first_name))}</b>`).join(", "):"<span class='meta'>No manager listed</span>"}<span class="meta" style="margin:0">Manager</span></div>
  ${cr.length?cr.map(x=>`<div class="row"><span class="v txt">${esc(first(x.first_name))}<small>${esc(x.position)}</small></span><span class="tm">${clock(x.start,1)}–${clock(x.end,1)}</span></div>`).join(""):`<p class="meta">No crew listed</p>`}</div>`}).join("");
 return seg+`<button class="btn block" type="button" data-go="cover">${I("users")}Who can cover?</button>`+`<p class="upd" style="padding:0">${d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</p>`+cards};
// ---- Who can cover? (read-only suggestions from Roster + Coverage; no contact info, no messaging) ----
const h1=n=>(Math.round(n*10)/10).toString();
// Time "22:00", "10:00 PM", "10p", "6a" -> minutes after midnight (NaN if unreadable).
const tmin=v=>{let x=String(v||"").trim().toLowerCase().replace(/\s+/g,"").replace(/\./g,"");if(!x)return NaN;if(x==="noon")return 720;if(x==="midnight")return 0;
 const m=x.match(/^(\d{1,4})(?::(\d{2}))?(?::\d{2})?(a|p|am|pm)?$/);if(!m)return NaN;let d=m[1],h,mi;
 if(m[2]!==undefined){h=+d;mi=+m[2]}else if(d.length<=2){h=+d;mi=0}else{h=+d.slice(0,-2);mi=+d.slice(-2)}
 const ap=m[3]?m[3][0]:"";if(ap){if(h<1||h>12)return NaN;if(h===12)h=0;if(ap==="p")h+=12}return h>23||mi>59?NaN:h*60+mi};
window.tmin=tmin;
const hhmm=m=>String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");
const ampm=m=>{const h=Math.floor(m/60);return (h%12||12)+":"+String(m%60).padStart(2,"0")+(h<12?" AM":" PM")};
const dayN=d=>Math.round(new Date(isoD(d)+"T12:00:00Z")/864e5);
// Interval in absolute minutes; end at/before start = overnight (ends next day).
const span=(date,s,e)=>{const a=tmin(s),b=tmin(e);if(isNaN(a)||isNaN(b))return null;const base=dayN(date)*1440;return [base+a,base+b+(b<=a?1440:0)]};
const hrs=v=>{const x=parseFloat(String(v??"").replace(/[^\d.\-]/g,""));return isNaN(x)?0:x};
const nkey=s=>first(s).toLowerCase();
// Availability note parsing (cautions only; never excludes).
const DAYS=["sun","mon","tue","wed","thu","fri","sat"],DFULL=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DRE="(?<![a-z])(sun|mon|tue|wed|thu|fri|sat)(?:days|day|nesdays|nesday|sdays|sday|rsdays|rsday|urdays|urday|rs|r|s|\\.)?(?![a-z])";
const ntime=x=>{x=String(x).trim().toLowerCase();if(/^noon|^midday/.test(x))return 720;if(/^midnight/.test(x))return 1440;const m=x.match(/^(\d{1,2})(?::(\d{2}))?\s*(a|p)?/);if(!m)return NaN;let h=+m[1];if(m[3]){if(h===12)h=0;if(m[3]==="p")h+=12}else if(h>=1&&h<=6)h+=12;return h*60+(+(m[2]||0))};
const fmtM=m=>{m%=1440;const h=Math.floor(m/60),mi=m%60;return (h%12||12)+(mi?":"+String(mi).padStart(2,"0"):"")+(h<12?" AM":" PM")};
const HARRI_OV=/per harri schedule availability overlay|day mapping not shown/i,AV_NOMAP="Availability not mapped to days (check Harri)";
function availWarn(notes,iv){const n=String(notes||"").toLowerCase();if(!n.trim())return[];if(HARRI_OV.test(n))return[];const out=[];const st=iv[0]%1440,en=st+(iv[1]-iv[0]),wd=(Math.floor(iv[0]/1440)+3)%7; /* dayN() rounds noon-UTC up, so epoch day index is +1 */
 const T="(noon|midday|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?|[ap](?![a-z]))?)(?![\\d/:.-]|\\s*(?:hours?|hrs?|h\\b|days?|shifts?|weeks?|min))";let m;
 if((m=n.match(new RegExp("(?:after|from|not before|starting(?: at)?)\\s+"+T)))){const t=ntime(m[1]);if(!isNaN(t)&&st<t)out.push("Note: after "+fmtM(t))}
 if((m=n.match(new RegExp("(?:before|until|till|by|not after)\\s+"+T)))){const t=ntime(m[1]);if(!isNaN(t)&&en>t)out.push("Note: until "+fmtM(t))}
 if(/no\s+(early\s+)?mornings?|not\s+mornings?|no\s+opens?/.test(n)&&st<720)out.push("Note: no mornings");
 if(/no\s+(late\s+)?(nights?|evenings?|closes?|closing|overnights?)|not\s+(nights?|evenings?)/.test(n)&&(en>1020||iv[1]-iv[0]<0))out.push("Note: no nights");
 if(/mornings?\s+only|only\s+mornings?/.test(n)&&en>720)out.push("Note: mornings only");
 if(/(evenings?|nights?)\s+only|only\s+(evenings?|nights?)/.test(n)&&st<960)out.push("Note: evenings only");
 if(/weekends?\s+only|only\s+weekends?/.test(n)&&wd%6!==0)out.push("Note: weekends only");
 if(/weekdays?\s+only|only\s+weekdays?|no\s+weekends?/.test(n)&&wd%6===0)out.push("Note: no weekends");
 // negated days: "no Sundays", "not Mon", "off Tue", "Tue off"
 const neg=new Set();let rest=n.replace(new RegExp("(?:no|not|never|off|except|can'?t(?: work)?)\\s+((?:"+DRE+"(?:\\s*(?:,|/|&|and|or)\\s*)?)+)","g"),(_,g)=>{(g.match(new RegExp(DRE,"g"))||[]).forEach(d=>neg.add(DAYS.indexOf(d.slice(0,3))));return " "}).replace(new RegExp(DRE+"\\s+off","g"),d=>{neg.add(DAYS.indexOf(d.slice(0,3)));return " "});
 if(neg.has(wd))out.push("Note: not "+DFULL[wd]);
 // positive day list/ranges, e.g. "Mon–Fri", "Tue, Thu, Sat only"
 const pos=new Set();rest=rest.replace(new RegExp(DRE+"\\s*(?:-|–|—|to|through|thru)\\s*"+DRE,"g"),(_,a,b)=>{let i=DAYS.indexOf(a),j=DAYS.indexOf(b);for(let k=0;k<7;k++){pos.add(i);if(i===j)break;i=(i+1)%7}return " "});
 (rest.match(new RegExp("\\b"+DRE,"g"))||[]).forEach(d=>pos.add(DAYS.indexOf(d.slice(0,3))));
 if(pos.size&&!pos.has(wd)&&!neg.has(wd))out.push("Note: not "+DFULL[wd]);
 return out}
window.availWarn=availWarn;
// Rest check vs other Roster shifts: back-to-back (gap 0) or under 8 h rest before/after.
function restWarn(sh,iv){const out=[];let a=iv[0],b=iv[1],chain=false;const ss=sh.slice().sort((x,y)=>x.sp[0]-y.sp[0]);let grew=true,gN=0;
 while(grew&&gN++<50){grew=false;ss.forEach(r=>{if(r.sp[1]===a){a=r.sp[0];chain=grew=true}else if(r.sp[0]===b){b=r.sp[1];chain=grew=true}})}
 if(chain)out.push("back-to-back, "+h1((b-a)/60)+" h day");
 let gb=Infinity,ga=Infinity;ss.forEach(r=>{if(r.sp[1]<a)gb=Math.min(gb,a-r.sp[1]);if(r.sp[0]>b)ga=Math.min(ga,r.sp[0]-b)});const g=Math.min(gb,ga);
 if(g<480)out.push("only "+h1(g/60)+" h rest "+(gb<=ga?"before":"after"));return out}
// ---- Coverage data format ----
// New (Store Ops Bot / Harri): "ROLE:Crew Member; GRILL REGULAR MENU:4; WINDOW:3; ..."  Old: "Grill, Fries".
const STATIONS=["BEVERAGE SPECIALIST","DRIVE THRU","FRENCH FRIES","GRILL BREAKFAST MENU","GRILL REGULAR MENU","HASHBROWN","WINDOW","FLOOR","LOBBY","MAINTENANCE","SUPPORT / PREP"];
function parseSkills(v){const s=String(v||"").trim(),o={role:"",st:{},old:[]};if(!s)return o;
 if(/(^|;)\s*ROLE\s*:/i.test(s)||s.includes(";")){s.split(";").map(x=>x.trim()).filter(Boolean).forEach(p=>{const i=p.lastIndexOf(":");if(i<0){o.old.push(p.toLowerCase());return}const k=p.slice(0,i).trim(),val=p.slice(i+1).trim();
   if(/^role$/i.test(k))o.role=val;else{const n=parseInt(val,10);o.st[k.toUpperCase().replace(/\s+/g," ")]=isNaN(n)?null:n}})}
 else o.old=s.split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);return o}
window.parseSkills=parseSkills;
// Names: "Juan A" / "Juan A." / "Juan" -> {f:"juan", i:"a"|""}
const pname=s=>{const p=String(s||"").replace(/\./g," ").trim().toLowerCase().split(/\s+/).filter(Boolean);return{f:p[0]||"",i:p[1]?p[1][0]:""}};
const dname=s=>String(s||"").trim().split(/\s+/).slice(0,2).join(" ");
// 0 = different person, 1 = sure match, 2 = possible match (bare first name shared by several crew)
const nmatch=(a,b,dup)=>{if(!a.f||a.f!==b.f)return 0;if(a.i&&b.i)return a.i===b.i?1:0;return dup>1?2:1};
const nhrs=v=>{const s=String(v??"").trim();if(!s)return null;const x=parseFloat(s.replace(/[^\d.\-]/g,""));return isNaN(x)?null:x};
const LATE_ST=["WINDOW","GRILL REGULAR MENU"];
// target: {role (or legacy position), station?, min?, date, start, end, out?}.
// Hours basis = higher of so-far / scheduled that are present; projected = basis + shift; allowed if <= cap.
function covRank(roster,crew,t,cap=40){const iv=span(t.date,t.start,t.end);if(!iv)return{error:"Enter a start and end time (e.g. 11a, 2:30p, 1400)"};const len=(iv[1]-iv[0])/60;
 const role=String(t.role||t.position||"").trim().toLowerCase(),stn=String(t.station||"").trim().toUpperCase(),min=+t.min||1,out=t.out?pname(t.out):null;
 const rows=crew.filter(c=>!/^(HEADER|NOTE)$/i.test(String(c.row_type||"").trim())&&String(c.first_name||"").trim());
 const dup={};rows.forEach(c=>{const f=pname(c.first_name).f;dup[f]=(dup[f]||0)+1});
 const rs=roster.map(r=>Object.assign({sp:span(r.date,r.start,r.end),pn:pname(r.first_name)},r)).filter(r=>r.sp&&r.sp[1]>iv[0]-1440&&r.sp[0]<iv[1]+1440); // only the target day and adjacent days
 const late=(iv[1]-Math.floor(iv[0]/1440)*1440)>1320;
 const ok=[],no=[],seen=new Set();
 rows.forEach(c=>{const pn=pname(c.first_name),key=pn.f+" "+pn.i;if(seen.has(key))return;seen.add(key);
  const outM=out?nmatch(pn,out,dup[pn.f]||0):0;if(outM===1)return;
  const sk=parseSkills(c.positions_skills);const hasRole=sk.role?sk.role.trim().toLowerCase()===role:sk.old.includes(role);
  const lvl=stn?(stn in sk.st?sk.st[stn]:(sk.old.includes(stn.toLowerCase())?0:null)):undefined;
  const so=nhrs(c.week_hours_so_far),sch=nhrs(c.scheduled_week_hours),known=[so,sch].filter(x=>x!==null);const base=known.length?Math.max(...known):0;
  const basis=!known.length?"none":sch!==null&&(so===null||sch>=so)?"scheduled":"so far",proj=Math.round((base+len)*100)/100;
  const mine=[],maybe=[];rs.forEach(r=>{const m=nmatch(pn,r.pn,dup[pn.f]||0);if(m===1)mine.push(r);else if(m===2)maybe.push(r)});
  const hit=r=>r.sp[0]<iv[1]&&iv[0]<r.sp[1];const ov=mine.filter(hit),ovm=maybe.filter(hit);const why=[];
  if(!hasRole)why.push(role?"different role":"no role");if(stn&&(lvl===null||!(lvl>=Math.max(1,min))))why.push(lvl===null?"no "+stn+" level":!lvl?stn+" not rated":stn+" level "+lvl+" < "+min);
  if(ov.length)why.push("overlap");if(proj>cap)why.push("over "+cap);
  let warn=[];if(!why.length){warn=restWarn(mine,iv);const rm=restWarn(maybe,iv);
   if(ovm.length||rm.length||outM===2)warn.push("name match uncertain"+(outM===2?" (called-out?)":ovm.length?" (possible overlap)":" (possible short rest)"));}
  warn=warn.concat(availWarn(c.availability_notes,iv));
  const lateLvl=Math.max(0,...LATE_ST.map(s=>sk.st[s]||0));
  const o={name:dname(c.first_name),role:sk.role||sk.old.join(", "),st:sk.st,lvl,notes:HARRI_OV.test(String(c.availability_notes||""))?"":c.availability_notes||"",nomap:HARRI_OV.test(String(c.availability_notes||"")),so,sch,base,basis,proj,ov:ov.concat(ovm),why,warn,lateLvl};(why.length?no:ok).push(o)});
 ok.sort((a,b)=>(a.warn.length>0)-(b.warn.length>0)||(late&&!a.warn.length&&!b.warn.length?b.lateLvl-a.lateLvl:0)||a.proj-b.proj||a.name.localeCompare(b.name));const counts={};no.forEach(o=>o.why.forEach(w=>{const k=/level/.test(w)?"station level":w;counts[k]=(counts[k]||0)+1}));return{len,ok,no,iv,late,counts,rsN:rs.length}}
window.covRank=covRank;
let COV={sel:"",role:"",station:"",min:"1",date:"",start:"",end:"",ran:false};
const SEL='style="width:100%;min-height:48px;padding:10px 12px;border:1px solid var(--line,#d5dbe3);border-radius:12px;background:var(--surface,#fff);color:var(--ink,#111);font:inherit;font-size:16px;margin-top:2px"';
S.cover=async()=>{const R=within(roster(),2500,()=>({rows:[],live:false,r:{src:"slow"}}));const cr=await within(ShiftData.load("Coverage"),2500,()=>({rows:[],src:"slow"})).catch(e=>({rows:[],src:"error",err:e.message}));const {rows,r}=await R;
 const head=`<button class="btn" data-go="whoson" style="align-self:flex-start">${I("chevron-left")}Who's on</button><div class="tip">${I("lock")}<span>Suggestions only · names as in the Sheet · no contact info</span></div>`;
 if(cr.src==="unsupported")return head+`<div class="card stack" role="status"><div class="lbl">Who can cover needs the Apps Script update${chip("warn","Not shared yet")}</div><div class="meta" style="-webkit-line-clamp:6">The shared Sheet script is an older version that doesn't serve the Coverage tab yet. Ask your GM to redeploy the latest Shift Hub Apps Script (v26). Everything else is live.</div></div>`;
 const crew=(cr.rows||[]).filter(x=>!/^(HEADER|NOTE)$/i.test(String(x.row_type||"").trim()));
 const op=shiftNow().op,d0=ymd(op),d1=(()=>{const d=new Date(op);d.setDate(d.getDate()+1);return ymd(d)})();
 const opts=rows.map((x,i)=>[i,x]).filter(([i,x])=>(x.date===d0||x.date===d1)&&x.position&&String(x.role).toLowerCase()!=="manager");
 const sel=COV.sel===""&&opts.length?String(opts[0][0]):COV.sel;
 const roles=[...new Map([...rows.map(x=>x.position),...crew.map(c=>parseSkills(c.positions_skills).role)].map(x=>String(x||"").trim()).filter(Boolean).map(x=>[x.toLowerCase(),x])).values()].sort((a,b)=>a.localeCompare(b));
 const sts=[...new Set(STATIONS.concat(crew.flatMap(c=>Object.keys(parseSkills(c.positions_skills).st))))];
 const nq=(()=>{const d=new Date();return Math.ceil((d.getHours()*60+d.getMinutes())/15)*15%1440})(),hm=m=>String(Math.floor(m/60)%24).padStart(2,"0")+":"+String(m%60).padStart(2,"0"),defS=hm(nq),defE=hm((nq+360)%1440);
 const o_=(v,l,on)=>`<option value="${esc(v)}"${on?" selected":""}>${esc(l)}</option>`;
 const form=`<div class="card stack"><div class="lbl">Shift to cover</div>
 <select id="cvsel" aria-label="Shift from roster" ${SEL}>${o_("manual","Enter a role and time…",sel==="manual")}${opts.map(([i,x])=>o_(i,`${dname(x.first_name)} · ${x.position} · ${x.date===d0?"Today":"Tomorrow"} ${clock(x.start,1)}–${clock(x.end,1)}`,String(i)===sel)).join("")}</select>
 <div id="cvman" class="stack" style="gap:8px${sel==="manual"?"":";display:none"}"><label class="meta" style="margin:0;display:block;overflow:visible">Role<select id="cvrole" aria-label="Role" ${SEL}>${o_("","Choose a role…",!COV.role)}${roles.map(x=>o_(x,x,x===COV.role)).join("")}</select></label>
 <label class="meta" style="margin:0">Date<input id="cvdate" type="date" aria-label="Date" style="width:100%" value="${esc(COV.date||d0)}"></label><div style="display:flex;gap:8px"><label class="meta" style="flex:1;margin:0">Start<input id="cvs" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="e.g. 11a, 2:30p, 1400" aria-label="Start time" data-tm value="${esc(COV.start||ampm(tmin(defS)))}" style="width:100%"><small class="tmok" data-for="cvs"></small></label><label class="meta" style="flex:1;margin:0">End<input id="cve" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="e.g. 11a, 2:30p, 1400" aria-label="End time" data-tm value="${esc(COV.end||ampm(tmin(defE)))}" style="width:100%"><small class="tmok" data-for="cve"></small></label></div></div>
 <div style="display:flex;gap:8px"><label class="meta" style="flex:2;margin:0;display:block;overflow:visible">Station (optional)<select id="cvst" aria-label="Station" ${SEL}>${o_("","Any station",!COV.station)}${sts.map(x=>o_(x,x[0]+x.slice(1).toLowerCase(),x===COV.station)).join("")}</select></label>
 <label class="meta" style="flex:1;margin:0;display:block;overflow:visible">Min level<select id="cvmin" aria-label="Minimum station level" ${SEL}>${[1,2,3,4,5].map(n=>o_(n,n===1?"Any rated (1+)":n+"+",String(n)===String(COV.min))).join("")}</select></label></div>
 <button class="btn primary block" type="button" data-act="cover">Find cover</button></div>`;
 if(!COV.ran)return head+form+(crew.length?"":`<p class="upd" style="padding:0;text-align:center">No Coverage rows in the Sheet yet</p>`);
 let t;if(sel!=="manual"&&rows[+sel]){const x=rows[+sel];t={role:x.position,date:x.date,start:x.start,end:x.end,out:x.first_name}}else {const nz=x=>{const m=tmin(x);return isNaN(m)?x:hhmm(m)};t={role:COV.role,date:COV.date||d0,start:nz(COV.start||defS),end:nz(COV.end||defE)}}
 t.station=COV.station;t.min=COV.min;
 if(!String(t.role).trim())return head+form+`<p class="meta">Choose a role.</p>`;
 const res=covRank(rows,crew,t);if(res.error)return head+form+`<p class="meta">${esc(res.error)}.</p>`;
 const sn=t.station?t.station[0]+t.station.slice(1).toLowerCase():"";
 const sum=`<div class="card"><div class="lbl">${esc(t.role)}${sn?" · "+esc(sn)+(+t.min>1?" "+t.min+"+":""):""} · ${esc(t.date)} ${clock(t.start,1)}–${clock(t.end,1)}${chip("neutral",h1(res.len)+" h")}</div><div class="meta" style="-webkit-line-clamp:8">${t.out?"Called out: <b>"+esc(dname(t.out))+"</b> (not suggested). ":""}Matches Roster role exactly. Hours = scheduled hours this week (or hours so far if higher, when the Sheet has them) plus this shift; must stay at or under 40 h. People with a caution are listed last.${t.station?" Station filter: needs a "+esc(sn)+" level of "+Math.max(1,+t.min)+" or higher in Harri (unrated or missing = not suggested).":""} ${r&&r.src==="slow"?"<b>Roster didn't load in time — overlap and rest were NOT checked.</b>":"Checked against "+res.rsN+" Roster shift"+(res.rsN===1?"":"s")+" on "+esc(t.date)+" ± 1 day."}${res.late?" <b>Runs past 10 PM:</b> among people without a caution, higher Window / Grill regular menu level (per Harri) comes first, then hours.":""}</div></div>`;
 const lv=n=>n===null||n===undefined?"—":n===0?"listed, no level":"level "+n;
 const card=o=>`<div class="row" style="display:block;padding:10px 0"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(o.name)}</b>${chip(o.proj>40?"bad":o.proj>=36?"warn":"good",h1(o.proj)+" h projected")}</div>
  <div class="meta" style="margin:2px 0 0">${esc(o.role||"No role listed")}${t.station?` · ${esc(sn)}: ${lv(o.lvl)} <small>(per Harri)</small>`:""}${res.late&&!t.station?` · Window/Grill: ${o.lateLvl?"level "+o.lateLvl:"—"} <small>(per Harri)</small>`:""}</div>
  <div class="meta" style="margin:2px 0 0">${o.sch!==null?"Scheduled "+h1(o.sch)+" h":"Scheduled hours not in Sheet"}${o.so!==null?" · so far "+h1(o.so)+" h":""} · used ${o.basis==="none"?"0 h (no hours in Sheet)":o.basis+" ("+h1(o.base)+" h)"} + ${h1(res.len)} h</div>
  ${o.warn&&o.warn.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 0">${o.warn.map(w=>chip("warn",w)).join("")}</div>`:""}${o.nomap?`<div style="margin:4px 0 0">${chip("neutral",AV_NOMAP)}</div>`:""}${o.notes?`<div class="meta" style="margin:2px 0 0">Availability: ${esc(o.notes)}</div>`:""}
  ${o.why.length?`<div class="meta" style="margin:2px 0 0">Excluded: ${o.why.map(w=>w==="overlap"?"overlap ("+o.ov.map(r=>esc(r.position||"shift")+" "+clock(r.start,1)+"–"+clock(r.end,1)+(r.date!==t.date?" "+esc(r.date):"")).join(", ")+")":esc(w)).join(" · ")}</div>`:""}</div>`;
 return head+form+sum+`<div class="sec">Can cover (${res.ok.length})</div>`+(res.ok.length?`<div class="list">${res.ok.map(card).join("")}</div>`:empty("No one fits this shift"))+
  (res.no.length?`<details class="card"><summary class="row"><span class="v txt">Not suggested (${res.no.length})<small>${Object.entries(res.counts).map(([k,n])=>esc(k)+" "+n).join(" · ")}</small></span>${I("chevron-down","cv")}</summary><div class="list">${res.no.map(card).join("")}</div></details>`:"")};

// ---- Tools ----
const TOOLS=[["floor","Floor","clipboard-list","Positions, breaks, checklists"],["inventory","Inventory","package","Counts, low stock, order list"],["waste","Waste log","trash","Quick log, daily totals"],["equipment","Equipment","wrench","Issues and fixes"],["crewnotes","Crew notes","notebook","Training, praise, call-outs"],["cover","Who can cover?","users","Suggest crew for an open shift"]];
const back=`<button class="btn" data-go="tools" style="align-self:flex-start">${I("chevron-left")}Tools</button>`;
const OLDK=k=>window.FloorCompat&&FloorCompat.needsUpdate(k)&&ShiftData.live();
const oldCard=k=>OLDK(k)?`<div class="card stack" role="status"><div class="lbl">Tools need the Apps Script update${chip("warn","This phone only")}</div><div class="meta" style="-webkit-line-clamp:4">The shared Sheet script is an older version, so entries here are saved on this phone only for now. Ask your GM to redeploy the latest Shift Hub Apps Script.</div></div>`:"";
const store=k=>OLDK(k)?"":window.FloorCompat&&FloorCompat.slow(k)&&ShiftData.live()?`<p class="upd" style="padding:0;text-align:center">${ShiftData.scriptBroken()?"The shared Sheet script deployment is broken (no doGet), showing this phone's entries. New entries stay on this phone.":"Couldn't reach the shared Sheet (request failed), showing this phone's entries"}</p>`:`<p class="upd" style="padding:0;text-align:center">${ShiftData.live()?"Shared with all managers":"Saved on this phone"}</p>`;
async function toolSync(){try{const r=await ShiftData.load("Brief");await setUpd("Brief",r.rows,r.live,r);setSrc(r.live,r.src)}catch(e){$("#upd").textContent="";setSrc(ShiftData.live())}}
const nowT=()=>{const d=new Date();return{date:ymd(d),time:String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}};
const pick=(g,opts,cur)=>`<div class="seg" data-group="${g}">${opts.map(o=>`<button type="button" data-pick="${esc(o)}" class="${o===cur?"on":""}">${esc(o[0].toUpperCase()+o.slice(1))}</button>`).join("")}</div>`;
const PICK={reason:"expired",ntype:"training"};
S.tools=async()=>{await within(toolSync(),300,null);
 return TOOLS.map(([k,l,ic,m])=>`<button class="card tool" type="button" data-go="${k}">${I(ic)}<span><b>${l}</b><span class="meta">${m}</span></span>${I("chevron-right","cv")}</button>`).join("")};
const SEED=[["Buns","cases",12],["Patties","cases",10],["Fries","cases",15],["Nuggets","cases",8],["Cups","sleeves",20],["Lids","sleeves",20],["Sauce","boxes",6]];
// Bounded Tools list: answer within ~2.2s from the live list or this phone's last saved copy; repaint once when late data lands.
const LATE={};
// Saved list first (never a bare "Loading…"); the shared list repaints in only if it differs. The "updating" note is a
// fixed overlay so nothing on the page moves.
let LTN=0;function lateTip(on){LTN=Math.max(0,LTN+(on?1:-1));let d=document.getElementById("latetip");
 if(!d){d=document.createElement("div");d.id="latetip";d.setAttribute("aria-live","polite");d.style.cssText="position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:30;pointer-events:none;background:rgba(0,0,0,.72);color:#fff;font-size:12px;padding:4px 10px;border-radius:12px;transition:opacity .2s;opacity:0";d.textContent="Updating shared list…";document.body.append(d)}
 d.style.opacity=LTN?"1":"0"}
function fastList(kind,lp,still,screen){const raw=localStorage.getItem("shifthub_flc_"+kind);
 return within(lp,raw?150:2200,()=>{lateTip(1);lp.then(v=>{lateTip(0);if(JSON.stringify(v)!==raw&&still()&&!$("#sheet"))show(screen)},()=>lateTip(0));return cachedList(kind)})}
// This phone's last copy of a Tools list (dates/times normalized, deleted ids removed).
function cachedList(kind){try{let a=JSON.parse(localStorage.getItem("shifthub_flc_"+kind)||"[]");if(window.FloorCompat){a=a.map(FloorCompat.norm);a=FloorCompat.untomb(kind,a)}return a}catch(e){return[]}}
const hasCache=kind=>!!localStorage.getItem("shifthub_flc_"+kind);
const saveCache=(kind,v)=>{try{const j=JSON.stringify(v);if(localStorage.getItem("shifthub_flc_"+kind)!==j)localStorage.setItem("shifthub_flc_"+kind,j)}catch(e){}return v};
async function blist(kind,screen){const lp=Floor.list(kind).then(v=>saveCache(kind,v));
 return fastList(kind,lp,()=>cur===screen,screen)}
const lateNote=k=>"";
S.inventory=async()=>{const TS=within(toolSync(),150,null);const rows=(await blist("inventory","inventory")).slice().sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
 const by={};SEED.forEach(([i,u,p])=>by[i.toLowerCase()]={item:i,unit:u,par:p,hist:[]});
 rows.forEach(x=>{const k=String(x.item).trim().toLowerCase();if(!k)return;const o=by[k]||(by[k]={item:x.item,unit:x.unit,par:"",hist:[]});if(x.unit)o.unit=x.unit;if(x.par!==""&&x.par!=null)o.par=n(x.par);if(x.on_hand!==""&&x.on_hand!=null)o.hist.push({q:n(x.on_hand),t:new Date(x.ts)})});
 const items=Object.values(by);
 const usage=o=>{const h=o.hist;if(h.length<2)return "";const a=h[h.length-2],b=h[h.length-1],used=a.q-b.q,days=Math.max((b.t-a.t)/864e5,.01);
  let tot=0,td=0;for(let i=1;i<h.length-1;i++){const u=h[i-1].q-h[i].q,dd=(h[i].t-h[i-1].t)/864e5;if(u>=0&&dd>0){tot+=u;td+=dd}}
  if(used<0)return `<div><b>Restocked</b> since last count (+${esc(qu(-used,o.unit))})</div>`;
  if(!td)return `<div><b>Used:</b> ${esc(qu(used,o.unit))} since last count</div>`;
  const exp=tot/td*days,diff=used-exp,st=Math.abs(diff)<=Math.max(1,exp*.1)?"good":diff>0?"bad":"warn";
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span><b>Used</b> ${used} vs <b>expected</b> ${exp.toFixed(1)} ${esc(o.unit)}</span>${chip(st,st==="good"?"On track":diff>0?"Over":"Under")}</div>`};
 const st=o=>{const q=o.hist.length?o.hist[o.hist.length-1].q:NaN;if(isNaN(q)||!o.par)return["neutral","Not counted"];return q<o.par*.5?["bad","Low"]:q<o.par?["warn","Below par"]:["good","OK"]};
 const order=items.filter(o=>o.hist.length&&o.par&&o.par-o.hist[o.hist.length-1].q>0);
 await TS;return back+oldCard("inventory")+lateNote("inventory")+(order.length?`<div class="card"><div class="lbl">Order list${chip("warn",order.length+(order.length>1?" items":" item"))}</div>${order.map(o=>`<div class="row"><span class="v txt">${esc(o.item)}</span><b>${esc(qu(o.par-o.hist[o.hist.length-1].q,o.unit))}</b></div>`).join("")}</div>`:"")+
 `<div class="sec">Counts</div><div class="list">${items.map((o,i)=>{const q=o.hist.length?o.hist[o.hist.length-1].q:"";const [s,w]=st(o);
  return `<details><summary class="row"><span class="v txt">${esc(o.item)}<small>${q===""?"—":q} of ${esc(o.par?qu(o.par,o.unit):"— "+o.unit)}${o.hist.length?" · "+o.hist[o.hist.length-1].t.toLocaleDateString("en-US",{weekday:"short"}):""}</small></span>${chip(s,w)}${I("chevron-down","cv")}</summary>
  <div class="det" style="padding-left:0"><div class="stack" style="gap:8px">${usage(o)}<div style="display:flex;gap:8px"><input id="ioh${i}" type="number" inputmode="decimal" placeholder="On hand" aria-label="On hand"><input id="ipar${i}" type="number" inputmode="decimal" placeholder="Par ${o.par||""}" aria-label="Par"></div>
  <button class="btn primary block" data-act="inv" data-i="${i}" data-item="${esc(o.item)}" data-unit="${esc(o.unit)}" data-par="${esc(o.par)}">Save count</button></div></div></details>`}).join("")}</div>`+
 store("inventory")+`<div class="addbar"><input id="ini" placeholder="New item" aria-label="New item"><input id="inu" placeholder="Unit" aria-label="Unit" style="max-width:28%"><input id="inp" type="number" inputmode="decimal" placeholder="Par" aria-label="Par" style="max-width:20%"><button class="btn primary sq" data-act="invnew" aria-label="Add item">${I("plus")}</button></div>`};
const REASONS=["expired","hold time","dropped","wrong order"];
S.waste=async()=>{const TS=within(toolSync(),150,null);const lp=Floor.list("waste").then(v=>saveCache("waste",v));let late=false;
 const rows=await fastList("waste",lp,()=>cur==="waste","waste");const t=nowT().date;
 const today=rows.filter(x=>x.date===t),tq=today.reduce((a,x)=>a+(n(x.qty)||0),0);
 const wk=new Date(Date.now()-7*864e5);const top={};rows.filter(x=>new Date(x.date+"T12:00:00")>=wk).forEach(x=>{const k=String(x.item).trim();top[k]=(top[k]||0)+(n(x.qty)||0)});
 const tops=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,3);
 const quick=["Fries","Patties","Nuggets","Buns","Chicken","Pies"].map(x=>`<button type="button" class="btn" data-fill="wi" data-v="${x}">${x}</button>`).join("");
 await TS;return back+oldCard("waste")+""+`<div class="grid"><div class="card"><div class="lbl">Today</div><div class="hero sm">${tq}</div><div class="meta">items wasted · ${today.length} ${today.length===1?"entry":"entries"}</div></div>
 <div class="card"><div class="lbl">Top 7 days</div>${tops.length?tops.map(([k,v])=>`<div class="meta" style="color:var(--ink-2)"><b>${esc(k)}</b> ${v}</div>`).join(""):`<div class="meta">Nothing logged</div>`}</div></div>
 <div class="card stack"><div class="lbl">Log waste</div><div class="quick">${quick}</div>
 <div style="display:flex;gap:8px"><input id="wi" placeholder="Item" aria-label="Item"><input id="wq" type="number" inputmode="decimal" value="1" aria-label="Quantity" style="max-width:30%"></div>
 ${pick("reason",REASONS,PICK.reason)}<button class="btn primary block" data-act="waste">Log it</button></div>
 <div class="sec">Today's log</div>${today.length?`<div class="list">${today.slice().reverse().map(x=>`<div class="row"><span class="t">${clock(x.time,1)}</span><span class="v txt">${esc(x.qty)} × ${esc(x.item)}</span>${chip("neutral",x.reason)}${delBtn("waste",x.id)}</div>`).join("")}</div>`:empty("Nothing wasted yet today")}`+store("waste")};
const delBtn=(k,id)=>`<button class="btn sq" type="button" data-del="${esc(k)}" data-id="${esc(id)}" aria-label="Delete">${I("trash")}</button>`;
let SHOWDONE=false;const doneTog=n=>n?`<button class="btn" type="button" data-showdone="1" style="align-self:flex-start">${SHOWDONE?"Hide done":"Show done ("+n+")"}</button>`:"";
const EQS={"open":["bad","Open"],"in progress":["warn","In progress"],"fixed":["good","Fixed"]};
S.equipment=async()=>{const TS=within(toolSync(),150,null);const rows=(await blist("equipment","equipment")).slice().reverse();
 const ord=x=>({open:0,"in progress":1,fixed:2}[x.status]??0);rows.sort((a,b)=>ord(a)-ord(b));const open=rows.filter(x=>x.status!=="fixed").length;
 await TS;return back+oldCard("equipment")+lateNote("equipment")+`<div class="card stack"><div class="lbl">Report an issue${chip(open?"warn":"good",open?open+" open":"All fixed")}</div>
 <input id="eqe" placeholder="Equipment (e.g. Fry vat 2)" aria-label="Equipment"><input id="eqi" placeholder="What's wrong" aria-label="Issue"><input id="eqr" placeholder="Reported by (first name)" aria-label="Reported by">
 <button class="btn primary block" data-act="eq">Report</button></div>
 ${doneTog(rows.length-open)}${rows.length?`<div class="list">${rows.filter(x=>SHOWDONE||x.status!=="fixed").map(x=>{const [s,w]=EQS[x.status]||EQS.open;return `<details><summary class="row"><span class="v txt">${esc(x.equipment)}<small>${esc(x.issue)}</small></span>${chip(s,w)}${I("chevron-down","cv")}</summary>
 <div class="det" style="padding-left:0"><div>Reported by <b>${esc(x.reported_by)||"—"}</b> · ${new Date(x.ts).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</div>${x.fixer?`<div>Fixer: <b>${esc(x.fixer)}</b></div>`:""}
 ${x.status==="fixed"?"":`<div class="stack" style="gap:8px;margin-top:8px"><input id="fx${esc(x.id)}" placeholder="Fixer (first name)" value="${esc(x.fixer||"")}" aria-label="Fixer">
 <div style="display:flex;gap:8px">${x.status!=="in progress"?`<button class="btn" style="flex:1" data-eq="${esc(x.id)}" data-st="in progress">In progress</button>`:""}<button class="btn primary" style="flex:1" data-eq="${esc(x.id)}" data-st="fixed">Fixed</button></div></div>`}<div style="margin-top:8px">${delBtn("equipment",x.id)}</div></div></details>`}).join("")}</div>`:empty("No equipment issues")}`+store("equipment")};
const NTYPES=["training","ready to promote","call-out","praise"];const NST={"training":"neutral","ready to promote":"good","call-out":"warn","praise":"good"};
S.crewnotes=async()=>{const TS=within(toolSync(),150,null);const rows=(await blist("crewnotes","crewnotes")).slice().reverse();
 await TS;return back+oldCard("crewnotes")+lateNote("crewnotes")+`<div class="tip">${I("lock")}<span>Manager only · first names only</span></div>
 <div class="card stack"><div class="lbl">New note</div><input id="cnn" placeholder="First name" aria-label="First name">
 ${pick("ntype",NTYPES,PICK.ntype)}<input id="cnt" placeholder="Note" aria-label="Note"><button class="btn primary block" data-act="cn">Save note</button></div>
 ${rows.length?`<div class="list">${rows.slice(0,30).map(x=>`<div class="row" style="display:block;padding:12px 0"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(x.first_name)}</b>${chip(NST[x.type]||"neutral",x.type)}</div><div>${esc(x.note)}</div><div style="display:flex;justify-content:space-between;align-items:center"><span class="note-ts">${esc(FloorCompat.normDate(x.date))}${x._pending?" "+chip("warn","Pending sync"):""}</span><button class="btn" type="button" data-cndel="${esc(x.id)}" aria-label="Delete note for ${esc(x.first_name)}">${I("trash")}Delete</button></div></div>`).join("")}</div>`:empty("No crew notes yet")}`+store("crewnotes")};

const APPVER="v33";
const swCache=async()=>{try{const k=(await caches.keys()).filter(x=>x.startsWith("shifthub-"));return k.length?" · cache "+esc(k.join(", ")):""}catch(e){return ""}};
let KEYJUST=false;
S.settings=async()=>{$("#upd").textContent="";const has=!!ShiftData.Key.get();
 let r=null;if(has)r=await ShiftData.load("Brief").catch(()=>null);if(r){CUR.src=r.src;setSrc(r.live,r.src)}else setSrc(false,"sample");
 const bad=ShiftData.status.bad,src=r?r.src:"sample";
 const state=!has?"none":bad==="key"?"key":!ShiftData.hasUrl()?"nourl":src==="live"?"live":src==="cached"?"cached":"down";
 const c={none:chip("warn","Not set"),key:chip("bad","Didn't work"),nourl:chip("warn","No data link"),live:chip("good","Working"),cached:chip("warn","Can't refresh"),down:chip("warn","Can't reach")}[state];
 const msg={key:"The server didn't accept this key. Check it with your GM and enter it again.",cached:"Couldn't reach the Sheet just now, so you're seeing the last saved live data. It retries automatically.",down:"Couldn't reach the Sheet, so you're seeing sample data. Check your connection; it retries automatically."}[state]||"";
 const info={none:"Showing sample data until the key is saved.",key:"Showing sample data.",nourl:"The data link isn't set yet, so you're seeing sample data.",live:"Showing live data.",cached:"Showing saved live data.",down:"Showing sample data."}[state];
 return `<div class="card stack"><div class="lbl">Shared key${c}</div>
 ${has?`<p class="ok" role="status" id="keysaved">${I("check")} Key saved on this phone${KEYJUST?" just now":""}</p>`:""}
 ${msg?`<p class="err" role="alert">${esc(msg)}</p>`:""}
 <div class="meta" style="-webkit-line-clamp:3">${info}</div>
 <input id="k" type="password" autocomplete="off" placeholder="Enter shared key" aria-label="Shared key">
 <button class="btn primary block" data-act="key">Save key</button>
 <div class="meta">Script: <code>${esc(ShiftData.maskedUrl())}</code></div><button class="btn block" type="button" data-act="ping">Check script</button><p class="upd" id="pingres" style="padding:0" role="status"></p>
 <button class="btn danger block" data-act="clearkey">Remove key from this phone</button></div>
 <div class="ver" id="ver">Shift Hub ${APPVER}${await swCache()}</div>`};

const TITLE={home:"Home",whoson:"Who's on",labor:"Labor",rushes:"Rushes",speed:"Speed",guest:"Guest",tools:"Tools",floor:"Floor",inventory:"Inventory",waste:"Waste log",equipment:"Equipment",crewnotes:"Crew notes",cover:"Who can cover?",settings:"Settings"};
const TABOF={cover:"whoson",floor:"tools",inventory:"tools",waste:"tools",equipment:"tools",crewnotes:"tools"};
// Position picker sheet (replaces prompt()).
let POSOPTS=[];
function closeSheet(){const s=$("#sheet");if(s)s.remove()}
function openSheet(name,cur){closeSheet();const d=document.createElement("div");d.id="sheet";d.className="sheet-bg";
 d.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t"><div class="lbl" id="sh-t">Place ${esc(name)}</div>
 <div class="quick">${POSOPTS.map(p=>`<button type="button" class="btn${p===cur?" primary":""}" data-setpos="${esc(p)}">${esc(p)}</button>`).join("")}</div>
 <div style="display:flex;gap:8px"><input id="sh-o" placeholder="Other position" aria-label="Other position"><button type="button" class="btn primary" data-setpos="">Place</button></div>
 <button type="button" class="btn block" data-shclose>Cancel</button></div>`;
 document.body.appendChild(d);
 d.addEventListener("click",async e=>{if(e.target===d||e.target.closest("[data-shclose]")){closeSheet();return}
  const b=e.target.closest("[data-setpos]");if(!b)return;const pos=(b.dataset.setpos||($("#sh-o").value||"")).trim();if(!pos){$("#sh-o").focus();return}
  const w=shiftNow();try{await Floor.add("positions",{date:w.date,shift:w.shift,position:pos,name:first(name)});closeSheet();show("floor")}catch(err){alert("Could not save: "+err.message+(/no doGet|no doPost/.test(err.message)?". Ask your GM to paste the full Code.gs and deploy a new version.":""))}});
 d.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();if(e.key==="Enter"&&e.target.id==="sh-o")d.querySelector('[data-setpos=""]').click()});
 (d.querySelector(".btn.primary")||d.querySelector("button")).focus()}
let cur="home",floorSub="positions",timer=null;
function tick(){document.querySelectorAll("[data-since]").forEach(el=>{const m=Math.floor((Date.now()-new Date(el.dataset.since))/60000);
 el.className="chip "+(m>=30?"bad":m>=25?"warn":"good");el.textContent=m+" min"})}
// Stale-while-revalidate: paint the last HTML for this screen at once, then swap in fresh HTML if it changed.
// seq guards against a slow load overwriting a screen the user has already left.
const VIEW={};let seq=0,shown="",DEFER="";
// Never redraw a form under the user's fingers: if an input is focused or edited, hold the repaint until it's done.
const editing=()=>{const a=document.activeElement;if(a&&app.contains(a)&&a.matches("input:not([type=checkbox]),textarea"))return true;
 return [...app.querySelectorAll("input:not([type=checkbox]):not([type=password]),textarea")].some(i=>i.value!==i.defaultValue)};
app.addEventListener("focusout",()=>setTimeout(()=>{if(DEFER&&DEFER===cur&&!editing()){DEFER="";show(cur)}},150));
const FOCUS={cover:["Roster","Coverage","Meta"],home:["Brief","Labor","Roster","Meta"],whoson:["Roster","Meta"],labor:["Labor","Brief","Meta"],rushes:["Events","Speed","Meta"],speed:["Speed","Meta"],guest:["SMG","Comments","Brief","Meta"],tools:["Brief","Meta"]};
const PV=new Set(["floor:positions","floor:breaks","floor:checklist","floor:fixes","floor:handoff","inventory","waste","equipment","crewnotes"]);
const pvGet=vk=>{try{return PV.has(vk)?localStorage.getItem("shifthub_view_"+vk):null}catch(e){return null}};
const pvSet=(vk,h)=>{if(!PV.has(vk))return;clearTimeout(pvSet[vk]);pvSet[vk]=setTimeout(()=>{try{localStorage.setItem("shifthub_view_"+vk,h)}catch(e){}},500)};
// Repaint only what changed: top-level blocks whose HTML is identical are left alone (inputs keep focus, caret, typed text).
// Replaced inputs get their typed value, focus and selection back, so a background repaint never moves the cursor.
function paint(h){const a=document.activeElement,fid=a&&app.contains(a)&&a.id?a.id:"",ss=fid&&a.selectionStart!=null?[a.selectionStart,a.selectionEnd]:null;
 const keep=Object.fromEntries([...app.querySelectorAll("input[id]:not([type=checkbox]):not([type=password]),textarea[id]")].filter(i=>i.value!==i.defaultValue).map(i=>[i.id,i.value]));
 const open=new Set([...app.querySelectorAll("details[open] summary")].map(x=>x.textContent));
 const t=document.createElement("div");t.innerHTML=h;const N=[...t.children],O=[...app.children];
 if(N.length===O.length){N.forEach((n,i)=>{if(O[i].outerHTML!==n.outerHTML&&!(O[i].contains(a)&&O[i].tagName===n.tagName&&O[i].className===n.className&&O[i].innerHTML.replace(/ open=""/g,"")===n.innerHTML))O[i].replaceWith(n)})}
 else app.replaceChildren(...N);
 app.querySelectorAll("details").forEach(d=>{const su=d.querySelector("summary");if(su&&open.has(su.textContent))d.open=true});
 for(const id in keep){const el=document.getElementById(id);if(el&&el.value===el.defaultValue)el.value=keep[id]}
 if(fid&&document.activeElement!==document.getElementById(fid)){const el=document.getElementById(fid);if(el){el.focus({preventScroll:true});if(ss)try{el.setSelectionRange(ss[0],ss[1])}catch(e){}}}}
async function show(s,o={}){try{window.FloorSync&&window.FloorSync()}catch(e){}const my=++seq,vk=s==="floor"?"floor:"+floorSub:s,moved=shown!==vk;cur=s;shown=vk;
 try{ShiftData.setFocus(s==="floor"?[floorSub,"Roster","Brief","Meta"]:FOCUS[s]||[s,"Brief","Meta"])}catch(e){}$("#title").textContent=TITLE[s];
 document.querySelectorAll("#tabs button").forEach(b=>{const on=b.dataset.s===(TABOF[s]||s);b.classList.toggle("on",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
 if(s==="cover")delete VIEW[vk];if(!o.fresh&&!VIEW[vk]&&s!=="cover"){const pv=pvGet(vk);if(pv)VIEW[vk]=pv}
 const had=!o.fresh&&VIEW[vk];if(moved){if(had)app.innerHTML=VIEW[vk];else app.innerHTML=empty("Loading…")}else if(o.fresh)app.innerHTML=empty("Loading…");
 if(moved)scrollTop_(s);
 try{const h=await Promise.race([S[s](),new Promise((_,j)=>setTimeout(()=>j(new Error("This screen took too long to load")),40000))]);if(my!==seq)return;
  if(!moved&&!o.force&&editing()){VIEW[vk]=h;DEFER=s;repill(s);return}
  if(h!==VIEW[vk]||!had||!moved){paint(h);VIEW[vk]=h;if(s!=="cover")pvSet(vk,h);if(moved&&!had)scrollTop_(s)}repill(s)}catch(e){if(my!==seq)return;if(had)return;delete VIEW[vk];app.innerHTML=`<div class="card stack" role="alert"><div class="lbl">Couldn't load ${esc(TITLE[s])}${chip("bad","Error")}</div><div class="meta">${esc(e.message)}. Check your connection and try again.</div><button class="btn primary block" type="button" data-retry="${s}">${I("refresh-cw")}Try again</button></div>`}
 clearInterval(timer);if(document.querySelector("[data-since]")){tick();timer=setInterval(tick,30000)}
}
// Pill + Last synced always reflect the screen on show, even if another screen's late load touched them.
function repill(s){const t=TABST[s];if(!t||s==="settings")return;CUR=Object.assign({},t.c);const u=$("#upd");u.textContent=t.upd;u.classList.toggle("stale",t.cls);setSrc(CUR.src!=="sample",CUR.src)}
function scrollTop_(s){const nw=document.querySelector(".card.now");if(nw&&s==="whoson")nw.scrollIntoView({block:"center"});else window.scrollTo(0,0)}
document.querySelectorAll("[data-i]").forEach(el=>el.outerHTML=I(el.dataset.i));
$("#gear").innerHTML=I("settings");
$("#tabs").onclick=e=>{const b=e.target.closest("button");if(b)show(b.dataset.s)};
app.addEventListener("click",async e=>{const rt=e.target.closest("[data-retry]");if(rt){ShiftData.reset();show(rt.dataset.retry,{fresh:1});return}
 const go=e.target.closest("[data-go]");if(go){show(go.dataset.go);return}
 const cf=e.target.closest("[data-cmtf]");if(cf){cmtF=cf.dataset.cmtf;const y=scrollY;await show("guest");scrollTo(0,y);return}
 const cdd=e.target.closest("[data-cmtd]");if(cdd){cmtDays=+cdd.dataset.cmtd;const y=scrollY;await show("guest");scrollTo(0,y);return}
 const wh=e.target.closest("[data-who]");if(wh){whoDay=+wh.dataset.who;show("whoson");return}
 const pk=e.target.closest("[data-pick]");if(pk){const g=pk.parentElement.dataset.group;PICK[g]=pk.dataset.pick;pk.parentElement.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b===pk));return}
 const fl=e.target.closest("[data-fill]");if(fl){$("#"+fl.dataset.fill).value=fl.dataset.v;$("#wq").focus();return}
 const sb=e.target.closest("[data-sub]");if(sb){floorSub=sb.dataset.sub==="notes"?"handoff":sb.dataset.sub;show("floor");return}
 const sd=e.target.closest("[data-showdone]");if(sd){SHOWDONE=!SHOWDONE;show(cur,{force:1});return}
 const dl=e.target.closest("[data-del]");if(dl){if(!confirm("Delete this entry?"))return;dl.disabled=true;try{(dl.closest("details")||dl.closest(".row")).remove();VIEW[shown]=app.innerHTML;pvSet(shown,app.innerHTML)}catch(err){}const pr=window.Floor.remove(dl.dataset.del,dl.dataset.id);show(cur,{force:1});try{await pr}catch(err){alert("Could not delete: "+err.message)}show(cur,{force:1});return}
 const t=e.target.closest("button,input")||e.target,F=window.Floor,ADD=(k,r)=>{const tmp=Object.assign({},r,{id:"tmp"+Date.now(),ts:new Date().toISOString(),_pending:1});saveCache(k,cachedList(k).concat([tmp]));clr();show(cur,{force:1});
  return F.add(k,r).then(x=>{const c=cachedList(k).filter(y=>y.id!==tmp.id);if(x&&x.id)c.push(Object.assign({},r,x));saveCache(k,c);return x},e=>{saveCache(k,cachedList(k).filter(y=>y.id!==tmp.id));throw e})},v=id=>($("#"+id)||{}).value?.trim();
 if(t.tagName==="BUTTON"&&t.dataset.act){if(t.dataset.busy)return;t.dataset.busy="1";t.disabled=true;setTimeout(()=>{t.disabled=false;delete t.dataset.busy},1500)}
 const clr=()=>app.querySelectorAll(".addbar input,.card.stack input").forEach(i=>{if(!/^fx/.test(i.id))i.value=""});
 try{const a=t.dataset.act;
 if(a==="cover"){COV={sel:v("cvsel")||"manual",role:v("cvrole")||"",station:v("cvst")||"",min:v("cvmin")||"1",date:v("cvdate")||"",start:v("cvs")||"",end:v("cve")||"",ran:true};show("cover",{force:1});return}
 if(a==="key"){if(!v("k")){$("#k").focus();return}ShiftData.Key.set(v("k"));meta=null;KEYJUST=true;for(const k in VIEW)delete VIEW[k];await show("settings",{fresh:1});KEYJUST=false;return}
 if(a==="ping"){const o=$("#pingres");o.textContent="Checking…";try{const r=await ShiftData.ping();o.textContent=r.ok?"Script OK · compatible (script "+(r.version||"?")+")":"Script problem: "+r.error}catch(e){o.textContent="Couldn't reach the script ("+e.message+")"}return}
 if(a==="clearkey"){ShiftData.Key.set("");meta=null;for(const k in VIEW)delete VIEW[k];show("settings");return}
 if(a==="pos"&&v("pp")){const w=shiftNow();await F.add("positions",{date:w.date,shift:w.shift,position:v("pp"),name:first(v("pn"))})}
 else if(t.dataset.place){openSheet(t.dataset.place,t.dataset.pos);return}
 else if(a==="brk"&&v("bn"))await ADD("breaks",{name:first(v("bn"))});
 else if(a==="chk"&&v("ci"))await ADD("checklist",{item:v("ci")});
 else if(a==="fix"&&v("fi"))await ADD("fixes",{item:v("fi")});
 else if(a==="hand"&&v("hn"))await ADD("handoff",{note:v("hn")});
 else if(a==="inv"){const i=t.dataset.i,q=v("ioh"+i),p=v("ipar"+i);if(!q&&!p)return;await ADD("inventory",{item:t.dataset.item,unit:t.dataset.unit,on_hand:q||"",par:p||t.dataset.par||""});clr();show("inventory",{force:1});return}
 else if(a==="invnew"&&v("ini")){await ADD("inventory",{item:v("ini"),unit:v("inu")||"",on_hand:"",par:v("inp")||""});clr();show("inventory",{force:1});return}
 else if(a==="waste"&&v("wi")){const w=nowT();await ADD("waste",{date:w.date,time:w.time,item:v("wi"),qty:v("wq")||"1",reason:PICK.reason});clr();show("waste",{force:1});return}
 else if(a==="eq"&&v("eqe")){await ADD("equipment",{equipment:v("eqe"),issue:v("eqi")||"",reported_by:first(v("eqr")),status:"open",fixer:"",updated:new Date().toISOString()});clr();show("equipment",{force:1});return}
 else if(t.dataset.eq){await F.update("equipment",t.dataset.eq,{status:t.dataset.st,fixer:first(v("fx"+t.dataset.eq)),updated:new Date().toISOString()});clr();show("equipment",{force:1});return}
 else if(a==="cn"&&v("cnn")&&v("cnt")){const row={date:nowT().date,first_name:first(v("cnn")),type:PICK.ntype,note:v("cnt")};
  // Accepted on this phone first (shows "Pending sync" at once), then sent in the background; the form clears only after that.
  const saved=await F.add("crewnotes",row);if($("#cnn"))$("#cnn").value="";if($("#cnt"))$("#cnt").value="";
  if(saved&&saved._pending){try{const c=JSON.parse(localStorage.getItem("shifthub_flc_crewnotes")||"[]");c.push(saved);localStorage.setItem("shifthub_flc_crewnotes",JSON.stringify(c))}catch(e){}}
  try{const pe=document.createElement("div");pe.className="row";pe.style.cssText="display:block;padding:12px 0";
   pe.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(row.first_name)}</b>${chip(NST[row.type]||"neutral",row.type)}</div><div>${esc(row.note)}</div><div class="note-ts">${esc(row.date)} ${chip("warn","Pending sync")}</div>`;
   let L=document.querySelector("#app .list");if(!L){const em=document.querySelector("#app .empty");L=document.createElement("div");L.className="list";if(em)em.replaceWith(L);else $("#app").append(L)}L.prepend(pe);VIEW.crewnotes=app.innerHTML}catch(e){}
  if(cur==="crewnotes")clr();show("crewnotes",{force:1});return}
 else if(t.dataset.cndel){if(!confirm("Delete this crew note?"))return;try{t.closest(".row").remove();VIEW.crewnotes=app.innerHTML;pvSet("crewnotes",app.innerHTML)}catch(err){}const pr2=F.remove("crewnotes",t.dataset.cndel);show("crewnotes",{force:1});await pr2;clr();show("crewnotes",{force:1});return}
 else if(t.dataset.back)await F.update("breaks",t.dataset.back,{back:new Date().toISOString()});
 else if(t.dataset.chk)await F.update("checklist",t.dataset.chk,{done:t.checked});
 else if(t.dataset.fix)await F.update("fixes",t.dataset.fix,{done:t.checked});
 else return;clr();show("floor",{force:1})}catch(err){alert("Could not save: "+err.message+(/no doGet|no doPost/.test(err.message)?". Ask your GM to paste the full Code.gs and deploy a new version.":""))}});
app.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches(".addbar input, #k")){const b=e.target.parentElement.querySelector("[data-act]");if(b)b.click()}});
$("#gear").onclick=()=>show("settings");$("#src").onclick=()=>show("settings");
setInterval(()=>{if(DEFER&&DEFER===cur&&!editing()&&!document.hidden){DEFER="";show(cur)}},4000);
window.addEventListener("shifthub:floorsync",()=>{if(!document.querySelector("#app input:focus")&&!$("#sheet")&&["floor","inventory","waste","equipment","crewnotes"].includes(cur))show(cur)});
// v32: live data re-fetch on open/return/focus/online and every 3 min (dashboard data is read-only).
let LASTPULL=Date.now();const pull=()=>{if(document.hidden||!ShiftData.Key.get()||Date.now()-LASTPULL<20000)return;LASTPULL=Date.now();meta=null;metaAt=0;ShiftData.reset();
 if(!document.querySelector("#app input:focus")&&!$("#sheet")&&["home","whoson","labor","rushes","speed","guest","tools","cover"].includes(cur))show(cur)};
document.addEventListener("visibilitychange",()=>{if(!document.hidden)pull()});window.addEventListener("focus",pull);window.addEventListener("pageshow",e=>{if(e.persisted)pull()});window.addEventListener("online",pull);
setInterval(()=>{LASTPULL=0;pull()},180000);
window.addEventListener("shifthub:data",e=>{if(e.detail&&e.detail.tab==="Meta"){meta=null;metaAt=0}if(!document.querySelector("#app input:focus")&&!$("#sheet")&&["home","whoson","labor","rushes","speed","guest","tools","cover"].includes(cur))show(cur)});
app.addEventListener("input",e=>{if(e.target.matches&&e.target.matches("[data-tm]")){const o=e.target.parentElement.querySelector(".tmok"),m=tmin(e.target.value);if(o)o.textContent=e.target.value.trim()?(isNaN(m)?"Not a time yet":"= "+ampm(m)):""}});
app.addEventListener("change",e=>{if(e.target.matches&&e.target.matches("[data-tm]")){const m=tmin(e.target.value);if(!isNaN(m))e.target.value=ampm(m)}if(e.target.id==="cvsel"){COV.sel=e.target.value;const m=$("#cvman");if(m)m.style.display=e.target.value==="manual"?"":"none"}});
setSrc(false);show("home");
if(window.caches)caches.keys().then(ks=>ks.filter(k=>k.startsWith("shifthub-")&&k!=="shifthub-"+APPVER).forEach(k=>caches.delete(k))).catch(()=>{});
if("serviceWorker" in navigator){const sw=navigator.serviceWorker,had=!!sw.controller;
 // New version took over: reload once. Guard: only if a worker controlled the page at load, and not twice within 10s.
 sw.addEventListener("controllerchange",()=>{if(!had)return;const t=+sessionStorage.getItem("shifthub_swreload")||0;if(Date.now()-t<10000)return;
  sessionStorage.setItem("shifthub_swreload",Date.now());window.__shReload=1;location.reload()});
 sw.register("sw.js",{updateViaCache:"none"}).then(r=>{r.update();verCheck(r);document.addEventListener("visibilitychange",()=>{if(!document.hidden)r.update()})}).catch(()=>{})}
})();

// v14: force update. If the deployed version differs from this page's APPVER, update the service worker,
// drop old caches and reload once (guarded per version so it can never loop).
async function verCheck(reg){try{const r=await fetch("version.json?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const v=(await r.json()).v;
 if(!v||v===APPVER)return;const g="shifthub_reloaded_"+v;if(sessionStorage.getItem(g))return;sessionStorage.setItem(g,"1");
 try{await reg.update()}catch(e){}
 await new Promise(res=>{const nw=reg.installing||reg.waiting;if(!nw||nw.state==="activated")return res();const t=setTimeout(res,6000);nw.addEventListener("statechange",()=>{if(nw.state==="activated"){clearTimeout(t);res()}})});try{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith("shifthub-")).map(k=>caches.delete(k)))}catch(e){}
 if(!window.__shReload){window.__shReload=1;location.reload()}}catch(e){}}

