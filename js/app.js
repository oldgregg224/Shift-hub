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
function clock(t,short){const m=/^(\d{1,2}):(\d{2})/.exec(t||"");if(!m)return esc(t);let h=+m[1];const ap=h>=12?(short?"p":" PM"):(short?"a":" AM");h=h%12||12;
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

let meta=null;
async function setUpd(tab,rows,live){if(live===false){$("#upd").textContent="Sample data · not live";return}try{if(!meta)meta=(await ShiftData.load("Meta")).rows}catch(e){meta=[]}
 const m=meta.find(x=>x.tab===tab);const v=(m&&m.last_updated)||(rows[0]&&rows[0].last_updated)||"";
 const d=new Date(v);$("#upd").textContent=v?"Updated "+(isNaN(d)?v:d.toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})):""}
const keyMsg=()=>({key:"Key didn't work, using sample data",net:"Couldn't reach live data, using sample data"})[ShiftData.status.bad]||"";
function setSrc(live){const p=$("#src");p.classList.toggle("live",live);const bad=ShiftData.status.bad;p.classList.toggle("bad",!!bad);
 const has=!!ShiftData.Key.get();p.dataset.label=live?"Live":bad==="key"?"Key didn't work":bad?"Offline · sample":(has?"Sample · check key":"Sample · add key");
 p.setAttribute("aria-label",(live?"Live data":keyMsg()||"Sample data")+". Open settings")}
const keyAlert=()=>keyMsg()?`<button class="alert" type="button" data-go="settings">${I("siren")}<div><b>${esc(keyMsg())}</b><span>Tap to check the key in Settings</span></div></button>`:"";
let LIVE=false;
async function get(tab){const r=await ShiftData.load(tab);LIVE=r.live;setSrc(r.live);await setUpd(tab,r.rows,r.live);return r.rows}
// "Now" row: live = latest row; sample = row for the current clock hour, clamped to the sample's range.
function nowRow(r){if(LIVE)return{x:r[r.length-1],lbl:"Now · "+clock(r[r.length-1].hour)};
 const h=new Date().getHours(),hs=r.map(x=>parseInt(x.hour,10));let i=hs.findIndex(v=>v===h);
 if(i<0)i=h<Math.min(...hs)?hs.indexOf(Math.min(...hs)):hs.reduce((b,v,j)=>v<=h&&v>=hs[b]?j:b,hs.indexOf(Math.min(...hs)));
 const x=r[i],exact=hs[i]===h;return{x,lbl:(exact?"Now · ":"Sample · ")+clock(x.hour)+(exact?" · sample":" (closest hour)")}}

async function whoHome(){try{const {rows}=await roster(),now=shiftNow();const sr=rows.filter(x=>x.date===now.date&&x.shift===now.shift);if(!sr.length)return "";
 const m=sr.filter(x=>String(x.role).toLowerCase()==="manager").map(x=>first(x.first_name)).join(", ")||"—",c=sr.length-sr.filter(x=>String(x.role).toLowerCase()==="manager").length;
 return `<button class="card tool" type="button" data-go="whoson">${I("users")}<span><b>Who's on · ${esc(m)}</b><span class="meta">${c} crew this shift</span></span>${I("chevron-right","cv")}</button>`}catch(e){return ""}}
const S={
async home(){const r=await get("Brief"),b=r[0]||{};
 const sa=n(b.sales_actual),sp=n(b.sales_projection),la=n(b.labor_actual_pct),lp=n(b.labor_projection_pct);
 const ss=status(sa,sp,"sales"),ls=status(la,lp,"labor");
 const ot=listCount(b.overtime_watch_first_names),od=listCount(b.overdue_checklists),cm=n(b.new_smg_comment_count)||0,hr=n(b.open_harri_requests)||0;
 const rush=b.rush_banner?`<div class="alert">${I("siren")}<div><b>${esc(b.rush_banner)}</b><span>Rush today</span></div></div>`:"";
 return keyAlert()+rush+
 kpi("Sales",money(sa),"of "+money(sp)+" projected",ss,(isNaN(sa-sp)?"":(sa-sp<0?"−":"+")+money(Math.abs(sa-sp))+" · ")+({good:"Ahead",warn:"Behind",bad:"Behind"}[ss]||""),null)+
 kpi("Labor",pct(la),"target "+pct(lp),ls,(isNaN(la-lp)?"":sgn(la-lp,1)+" · ")+({good:"On target",warn:"Watch",bad:"Over"}[ls]||""),"labor")+
 `<div class="grid">`+
 kpi("Overtime",ot,ot?b.overtime_watch_first_names:"No one close",status(ot,0,"count"),ot?"Watch":"Clear","floor",1)+
 kpi("Overdue",od,od?b.overdue_checklists:"All checklists done",od?"bad":"good",od?"Late":"Clear","floor",1)+
 kpi("Guest notes",cm,"new comments",null,null,"guest",1)+
 kpi("Requests",hr,"open in Harri",status(hr,0,"count"),hr?"Open":"Clear",null,1)+`</div>`+await whoHome()},

async labor(){const r=await get("Labor");if(!r.length)return keyAlert()+empty("No labor data yet");
 const callSt=c=>{c=String(c||"").toUpperCase();return c.includes("EARLY")?"bad":c.includes("HOLD")?"warn":"good"};
 const N=nowRow(r),cur=N.x,cl=n(cur.labor_pct),ct=n(cur.target_pct)||21.5,cs=status(cl,ct,"labor");
 return keyAlert()+`<div class="card"><div class="lbl">${N.lbl}${chip(cs,sgn(cl-ct,1)+" · "+WORD[cs])}</div><div class="hero">${pct(cl)}</div>
 <div class="meta" style="display:flex;align-items:center;gap:8px">target ${pct(ct)} ${cur.call?chip(callSt(cur.call),cur.call):""}</div></div>
 <div class="sec">By hour</div><div class="list">${r.map(x=>{const l=n(x.labor_pct),t=n(x.target_pct)||21.5;
 return `<details><summary class="row"><span class="t">${clock(x.hour,1)}</span><span class="v">${pct(l)}<small>${esc(x.actual_hours)} of ${esc(x.cap_hours)} hrs · ${chip(status(l,t,"labor")).replace(/<[^>]+>/g,"")}</small></span>${x.call?chip(callSt(x.call),x.call):""}${I("chevron-down","cv")}</summary>
 <div class="det">${x.position_to_cut_first&&x.position_to_cut_first!=="—"?`<div><b>Cut first:</b> ${esc(x.position_to_cut_first)}</div>`:""}${x.prep_level_notes?`<div><b>Prep:</b> ${esc(x.prep_level_notes)}</div>`:""}${x.hold_time_reminders?`<div><b>Hold:</b> ${esc(x.hold_time_reminders)}</div>`:""}${x.sales?`<div><b>Sales:</b> ${money(n(x.sales))}</div>`:""}</div></details>`}).join("")}</div>`},

async rushes(){const r=await get("Events");const d0=new Date(),today=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,"0")}-${String(d0.getDate()).padStart(2,"0")}`;
 const t=r.filter(x=>x.date===today),wk=new Date(d0.getTime()+7*864e5).toISOString().slice(0,10),nx=r.filter(x=>x.date>today&&x.date<=wk).sort((a,b)=>a.date<b.date?-1:1);
 const win=x=>{const a=clock(x.rush_window_start).replace(":00",""),b=clock(x.rush_window_end).replace(":00","");const pa=a.slice(-2);return (b.endsWith(pa)&&/[AP]M$/.test(a)?a.slice(0,-3):a)+"–"+b};
 const day=s=>{const d=new Date(s+"T12:00:00");return isNaN(d)?esc(s):d.toLocaleDateString("en-US",{weekday:"short"})+" "+d.getDate()};
 const src=x=>x.source_url?`<a class="src-link" href="${safeUrl(x.source_url)}" target="_blank" rel="noopener noreferrer">${I("external-link")}Source</a>`:"";
 return keyAlert()+`<div class="sec">Today</div>`+(t.length?t.map(x=>`<div class="card"><div class="lbl">${esc(x.event)}</div><div class="hero sm">${win(x)}</div>
 ${x.runner_timing?`<div style="margin-top:8px">${chip("neutral",x.runner_timing)}</div>`:""}${x.prep_notes?`<div class="meta">${esc(x.prep_notes)}</div>`:""}${src(x)}</div>`).join(""):empty("No events today"))+
 `<div class="sec">Next 7 days</div>`+(nx.length?`<div class="list">${nx.map(x=>`<details><summary class="row">${chip("neutral",day(x.date))}<span class="v txt">${esc(x.event)}<small>${win(x)}</small></span>${I("chevron-down","cv")}</summary>
 <div class="det" style="padding-left:0">${x.prep_notes?`<div><b>Prep:</b> ${esc(x.prep_notes)}</div>`:""}${x.runner_timing?`<div><b>Runner:</b> ${esc(x.runner_timing)}</div>`:""}${src(x)}</div></details>`).join("")}</div>`:empty("Nothing coming up"))},

async speed(){const r=await get("Speed");if(!r.length)return keyAlert()+empty("No speed data yet");
 const st=x=>x.slow_flag==="Y"?"bad":status(n(x.oepe_sec),n(x.last_week_oepe_sec),"oepe");
 const N=nowRow(r),cur=N.x,cd=n(cur.oepe_sec)-n(cur.last_week_oepe_sec);
 const tips=r.filter(x=>x.pre_rush_positioning_note);
 return keyAlert()+`<div class="card"><div class="lbl">${N.lbl}${chip(st(cur),isNaN(cd)?WORD[st(cur)]:sgn(cd)+"s vs LW")}</div><div class="hero">${mmss(n(cur.oepe_sec))}</div><div class="meta">OEPE · last week ${mmss(n(cur.last_week_oepe_sec))}</div></div>`+
 tips.map(x=>`<div class="tip">${I("lightbulb")}<span>${esc(x.pre_rush_positioning_note)}</span></div>`).join("")+
 `<div class="sec">OEPE by hour</div><div class="list">${r.map(x=>{const d=n(x.oepe_sec)-n(x.last_week_oepe_sec),s=st(x),o=n(x.order_sec)||0,c=n(x.cash_sec)||0,w=n(x.second_window_sec)||0;
 return `<details><summary class="row"><span class="t">${clock(x.hour,1)}</span><span class="v">${mmss(n(x.oepe_sec))}<small>LW ${mmss(n(x.last_week_oepe_sec))} · total ${mmss(n(x.total_time_sec))}</small></span>${chip(s,(isNaN(d)?"":sgn(d)+"s ")+(s==="bad"?"Slow":s==="warn"?"Watch":""))}${I("chevron-down","cv")}</summary>
 <div class="det"><div><b>Total:</b> ${mmss(n(x.total_time_sec))} (LW ${mmss(n(x.last_week_total_sec))})</div>${o+c+w?`<div class="bar"><i style="flex:${o};background:var(--accent)"></i><i style="flex:${c};background:var(--ink-3)"></i><i style="flex:${w};background:var(--warn)"></i></div><div>Order ${o}s · Cash ${c}s · 2nd window ${w}s</div>`:""}</div></details>`}).join("")}</div>`},

async guest(){const r=await get("SMG"),cmt=await comments();if(!r.length)return keyAlert()+empty("No guest scores yet")+cmt;const f=r.find(x=>x.coaching_focus);
 const cm=r.filter(x=>x.low_score_comment_names_removed);
 return keyAlert()+(f?`<div class="tip">${I("target")}<span>${esc(f.coaching_focus)}</span></div>`:"")+
 r.map(x=>{const s=n(x.score),l=n(x.last_week),st=status(s,l,"guest");return `<div class="card"><div class="lbl">${esc(x.channel)}${chip(st,(isNaN(s-l)?"":sgn(s-l)+" · ")+({good:"Up",warn:"Watch",bad:"Down"}[st]||""))}</div><div class="hero">${isNaN(s)?"—":s}</div><div class="meta">last week ${isNaN(l)?"—":l}</div></div>`}).join("")+
 (cm.length?`<details class="card more"><summary>Survey low-score comments: ${cm.length}${I("chevron-down","cv")}</summary><div class="det" style="padding:0">${cm.map(x=>`<div><b>${esc(x.channel)}:</b> ${esc(x.low_score_comment_names_removed)}</div>`).join("")}</div></details>`:"")+cmt},

async floor(){$("#upd").textContent="";const F=window.Floor;const sub=floorSub;
 setSrc(ShiftData.live());
 const tabs=[["positions","Positions"],["breaks","Breaks"],["checklist","Checklist"],["fixes","Fixes"],["handoff","Notes"]];
 const seg=`<div class="seg" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" data-sub="${k==="handoff"?"notes":k}" class="${k===sub?"on":""}" aria-selected="${k===sub}">${l}</button>`).join("")}</div>`;
 const rows=await F.list(sub);const store=`<p class="upd" style="padding:0;text-align:center">${ShiftData.live()?"Shared with all managers":"Saved on this phone"}</p>`;
 const tm=ts=>new Date(ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
 const chkRow=(x,attr)=>`<label class="chk"><input type="checkbox" ${attr}="${esc(x.id)}" ${x.done?"checked":""}><span class="box">${I("check")}</span><span>${esc(x.item)}</span></label>`;
 let body="",bar="";
 if(sub==="positions"){const now=shiftNow(),sl=(SHIFTS.find(x=>x[0]===now.shift)||[])[1];
  const today=rows.filter(x=>!x.date||x.date===now.date&&(!x.shift||x.shift===now.shift));
  const placed={};today.forEach(x=>placed[String(x.name).toLowerCase()]=x.position);
  let crew=[];try{crew=(await roster()).rows.filter(x=>x.date===now.date&&x.shift===now.shift).sort((a,b)=>(String(b.role).toLowerCase()==="manager")-(String(a.role).toLowerCase()==="manager"))}catch(e){}
  POSOPTS=[...new Set([...crew.filter(x=>String(x.role).toLowerCase()!=="manager").map(x=>String(x.position||"").trim()),...rows.map(x=>String(x.position||"").trim()),"Grill","Fries","Front counter","Drive-thru order","Drive-thru window","Lobby"].filter(Boolean))];
  body=(today.length?`<div class="sec">Placed now</div><div class="list">${today.map(x=>`<div class="row"><span class="v txt">${esc(x.position)}</span><b>${esc(first(x.name))}</b></div>`).join("")}</div>`:empty("No one placed on this shift yet. Tap Place next to a crew member below."))+
  `<div class="sec">On the roster · ${esc(sl||"")}</div>`+(crew.length?`<div class="list">${crew.map((x,i)=>{const nm=first(x.first_name),pl=placed[nm.toLowerCase()];
   return `<div class="row"><span class="v txt">${esc(nm)}<small>${esc(x.position)} · ${clock(x.start,1)}–${clock(x.end,1)}</small></span>${String(x.role).toLowerCase()==="manager"?chip("neutral","Manager"):""}${pl?chip("good",pl):""}<button class="btn" type="button" data-place="${esc(nm)}" data-pos="${esc(x.position)}" aria-label="Place ${esc(nm)}">${pl?"Move":"Place"}</button></div>`}).join("")}</div>`:empty("No crew on today's roster for this shift. Add Roster rows in the Sheet, or place someone below."));
  bar=`<input id="pp" placeholder="Position" aria-label="Position"><input id="pn" placeholder="First name" aria-label="First name" style="max-width:40%"><button class="btn primary sq" data-act="pos" aria-label="Place">${I("plus")}</button>`}
 if(sub==="breaks"){const on=rows.filter(x=>!x.back),done=rows.filter(x=>x.back);
  body=(on.length?`<div class="list">${on.map(x=>`<div class="row"><span class="v txt">${esc(x.name)}<small>out ${tm(x.ts)}</small></span><span class="chip" data-since="${esc(x.ts)}"></span><button class="btn" data-back="${esc(x.id)}">Back</button></div>`).join("")}</div>`:empty("No one on break right now. Type a first name below and tap Start."))+
  (done.length?`<div class="sec">Back</div><div class="list">${done.slice(-8).reverse().map(x=>`<div class="row"><span class="v txt">${esc(x.name)}<small>${tm(x.ts)} – ${tm(x.back)}</small></span>${chip("good",Math.round((new Date(x.back)-new Date(x.ts))/60000)+" min")}</div>`).join("")}</div>`:"");
  bar=`<input id="bn" placeholder="First name" aria-label="First name"><button class="btn primary" data-act="brk">Start</button>`}
 if(sub==="checklist"){body=rows.length?`<div class="list">${rows.map(x=>chkRow(x,"data-chk")).join("")}</div>`:empty("No checklist items for this shift. Add one below.");
  bar=`<input id="ci" placeholder="Checklist item" aria-label="Checklist item"><button class="btn primary sq" data-act="chk" aria-label="Add">${I("plus")}</button>`}
 if(sub==="fixes"){body=rows.length?`<div class="list">${rows.map(x=>chkRow(x,"data-fix")).join("")}</div>`:empty("No quick fixes listed. Add one below (bigger repairs go in Tools › Equipment).");
  bar=`<input id="fi" placeholder="Fix to do" aria-label="Fix"><button class="btn primary sq" data-act="fix" aria-label="Add">${I("plus")}</button>`}
 if(sub==="handoff"){body=rows.length?`<div class="list">${rows.slice(-10).reverse().map(x=>`<div class="row" style="display:block;padding:12px 0"><div class="note-ts">${new Date(x.ts).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</div>${esc(x.note)}</div>`).join("")}</div>`:empty("No handoff notes yet. Leave one for the next manager below.");
  bar=`<input id="hn" placeholder="Note for next manager" aria-label="Note"><button class="btn primary sq" data-act="hand" aria-label="Save note">${I("plus")}</button>`}
 return back+seg+body+store+`<div class="addbar">${bar}</div>`}
};
// ---- Guest comments ----
// Display-side scrub for guest text: emails, phone numbers, long digit runs (order/card numbers).
const scrub=t=>String(t??"").replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,"[email]").replace(/\d{11,}/g,"[number]")
 .replace(/(\+?\d[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,"[phone]").replace(/\d{6,}/g,"[number]");
let cmtF="all",cmtDays=7;
async function comments(){let rows=[],live=false;try{const r=await ShiftData.load("Comments");rows=r.rows||[];live=r.live}catch(e){return `<div class="card"><div class="lbl">Comments${chip("bad","Error")}</div><div class="meta">Couldn't load comments.</div></div>`}
 if(live)rows=rows.filter(x=>String(x.row_type).toUpperCase()==="DATA");
 else if(rows.length){// sample: shift EXAMPLE dates so the newest is today
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
 <p class="meta" style="margin:0">Low scores (1–2): ${inRange.filter(x=>n(x.score)<=2).length} · Negative: ${neg} · Positive: ${inRange.filter(x=>sen(x)==="positive").length}</p>
 ${seg("cmtf",[["all","All"],["negative","Negative"],["positive","Positive"]],cmtF)}${seg("cmtd",[[7,"7 days"],[14,"14 days"]],cmtDays)}
 ${list.length?`<div class="list">${list.slice(0,30).map(x=>`<div class="row" style="display:block;padding:12px 0"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="note-ts" style="margin:0;flex:1">${day(x.date)}</span>${sc(x)}${chip(sen(x)==="negative"?"bad":sen(x)==="positive"?"good":"neutral",sen(x)?sen(x)[0].toUpperCase()+sen(x).slice(1):"—")}</div><div style="margin-top:4px">${esc(scrub(x.comment))}</div></div>`).join("")}</div>`:empty(cmtF==="all"?"No comments in this range":"No "+cmtF+" comments in this range")}</div>`}
// ---- Who's on (Roster) ----
const SHIFTS=[["6a-2p","6 AM – 2 PM"],["2p-10p","2 PM – 10 PM"],["10p-6a","10 PM – 6 AM"]];
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function shiftNow(){const d=new Date(),h=d.getHours();const op=new Date(d);if(h<6)op.setDate(op.getDate()-1);
 return{date:ymd(op),shift:h>=6&&h<14?"6a-2p":h>=14&&h<22?"2p-10p":"10p-6a",op}}
async function roster(){const r=await ShiftData.load("Roster");let rows=r.rows||[];
 if(!r.live&&rows.length){// sample: move EXAMPLE dates so the first one is "today"
  const base=rows.map(x=>x.date).sort()[0],op=shiftNow().op;const b=new Date(base+"T12:00:00");
  rows=rows.map(x=>{const d=new Date(x.date+"T12:00:00");const o=new Date(op);o.setDate(o.getDate()+Math.round((d-b)/864e5));return Object.assign({},x,{date:ymd(o)})})}
 return{rows,live:r.live}}
const first=s=>String(s||"").trim().split(/\s+/)[0];
let whoDay=0;
S.whoson=async()=>{const {rows,live}=await roster();setSrc(live);await setUpd("Roster",rows,live);
 const now=shiftNow(),d=new Date(now.op);d.setDate(d.getDate()+whoDay);const day=ymd(d);
 const seg=`<div class="seg" role="tablist">${["Today","Tomorrow"].map((l,i)=>`<button type="button" role="tab" data-who="${i}" class="${i===whoDay?"on":""}" aria-selected="${i===whoDay}">${l}</button>`).join("")}</div>`;
 const dayRows=rows.filter(x=>x.date===day);
 const cards=SHIFTS.map(([k,lbl])=>{const sr=dayRows.filter(x=>x.shift===k);const mg=sr.filter(x=>String(x.role).toLowerCase()==="manager"),cr=sr.filter(x=>String(x.role).toLowerCase()!=="manager").sort((a,b)=>String(a.start).localeCompare(b.start));
  const isNow=!whoDay&&k===now.shift;
  return `<div class="card${isNow?" now":""}"><div class="lbl">${lbl}${isNow?chip("good","On now"):chip("neutral",cr.length+" crew")}</div>
  <div class="mgr">${mg.length?mg.map(x=>`<b>${esc(first(x.first_name))}</b>`).join(", "):"<span class='meta'>No manager listed</span>"}<span class="meta" style="margin:0">Manager</span></div>
  ${cr.length?cr.map(x=>`<div class="row"><span class="v txt">${esc(first(x.first_name))}<small>${esc(x.position)}</small></span><span class="tm">${clock(x.start,1)}–${clock(x.end,1)}</span></div>`).join(""):`<p class="meta">No crew listed</p>`}</div>`}).join("");
 return seg+`<p class="upd" style="padding:0">${d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</p>`+cards};

// ---- Tools ----
const TOOLS=[["floor","Floor","clipboard-list","Positions, breaks, checklists"],["inventory","Inventory","package","Counts, low stock, order list"],["waste","Waste log","trash","Quick log, daily totals"],["equipment","Equipment","wrench","Issues and fixes"],["crewnotes","Crew notes","notebook","Training, praise, call-outs"]];
const back=`<button class="btn" data-go="tools" style="align-self:flex-start">${I("chevron-left")}Tools</button>`;
const store=()=>`<p class="upd" style="padding:0;text-align:center">${ShiftData.live()?"Shared with all managers":"Saved on this phone"}</p>`;
const nowT=()=>{const d=new Date();return{date:ymd(d),time:String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")}};
const pick=(g,opts,cur)=>`<div class="seg" data-group="${g}">${opts.map(o=>`<button type="button" data-pick="${esc(o)}" class="${o===cur?"on":""}">${esc(o[0].toUpperCase()+o.slice(1))}</button>`).join("")}</div>`;
const PICK={reason:"expired",ntype:"training"};
S.tools=async()=>{$("#upd").textContent="";setSrc(ShiftData.live());
 return TOOLS.map(([k,l,ic,m])=>`<button class="card tool" type="button" data-go="${k}">${I(ic)}<span><b>${l}</b><span class="meta">${m}</span></span>${I("chevron-right","cv")}</button>`).join("")};
const SEED=[["Buns","cases",12],["Patties","cases",10],["Fries","cases",15],["Nuggets","cases",8],["Cups","sleeves",20],["Lids","sleeves",20],["Sauce","boxes",6]];
S.inventory=async()=>{$("#upd").textContent="";setSrc(ShiftData.live());const rows=(await Floor.list("inventory")).slice().sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
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
 return back+(order.length?`<div class="card"><div class="lbl">Order list${chip("warn",order.length+(order.length>1?" items":" item"))}</div>${order.map(o=>`<div class="row"><span class="v txt">${esc(o.item)}</span><b>${esc(qu(o.par-o.hist[o.hist.length-1].q,o.unit))}</b></div>`).join("")}</div>`:"")+
 `<div class="sec">Counts</div><div class="list">${items.map((o,i)=>{const q=o.hist.length?o.hist[o.hist.length-1].q:"";const [s,w]=st(o);
  return `<details><summary class="row"><span class="v txt">${esc(o.item)}<small>${q===""?"—":q} of ${esc(o.par?qu(o.par,o.unit):"— "+o.unit)}${o.hist.length?" · "+o.hist[o.hist.length-1].t.toLocaleDateString("en-US",{weekday:"short"}):""}</small></span>${chip(s,w)}${I("chevron-down","cv")}</summary>
  <div class="det" style="padding-left:0"><div class="stack" style="gap:8px">${usage(o)}<div style="display:flex;gap:8px"><input id="ioh${i}" type="number" inputmode="decimal" placeholder="On hand" aria-label="On hand"><input id="ipar${i}" type="number" inputmode="decimal" placeholder="Par ${o.par||""}" aria-label="Par"></div>
  <button class="btn primary block" data-act="inv" data-i="${i}" data-item="${esc(o.item)}" data-unit="${esc(o.unit)}" data-par="${esc(o.par)}">Save count</button></div></div></details>`}).join("")}</div>`+
 store()+`<div class="addbar"><input id="ini" placeholder="New item" aria-label="New item"><input id="inu" placeholder="Unit" aria-label="Unit" style="max-width:28%"><input id="inp" type="number" inputmode="decimal" placeholder="Par" aria-label="Par" style="max-width:20%"><button class="btn primary sq" data-act="invnew" aria-label="Add item">${I("plus")}</button></div>`};
const REASONS=["expired","hold time","dropped","wrong order"];
S.waste=async()=>{$("#upd").textContent="";setSrc(ShiftData.live());const rows=await Floor.list("waste");const t=nowT().date;
 const today=rows.filter(x=>x.date===t),tq=today.reduce((a,x)=>a+(n(x.qty)||0),0);
 const wk=new Date(Date.now()-7*864e5);const top={};rows.filter(x=>new Date(x.date+"T12:00:00")>=wk).forEach(x=>{const k=String(x.item).trim();top[k]=(top[k]||0)+(n(x.qty)||0)});
 const tops=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,3);
 const quick=["Fries","Patties","Nuggets","Buns","Chicken","Pies"].map(x=>`<button type="button" class="btn" data-fill="wi" data-v="${x}">${x}</button>`).join("");
 return back+`<div class="grid"><div class="card"><div class="lbl">Today</div><div class="hero sm">${tq}</div><div class="meta">items wasted · ${today.length} ${today.length===1?"entry":"entries"}</div></div>
 <div class="card"><div class="lbl">Top 7 days</div>${tops.length?tops.map(([k,v])=>`<div class="meta" style="color:var(--ink-2)"><b>${esc(k)}</b> ${v}</div>`).join(""):`<div class="meta">Nothing logged</div>`}</div></div>
 <div class="card stack"><div class="lbl">Log waste</div><div class="quick">${quick}</div>
 <div style="display:flex;gap:8px"><input id="wi" placeholder="Item" aria-label="Item"><input id="wq" type="number" inputmode="decimal" value="1" aria-label="Quantity" style="max-width:30%"></div>
 ${pick("reason",REASONS,PICK.reason)}<button class="btn primary block" data-act="waste">Log it</button></div>
 <div class="sec">Today's log</div>${today.length?`<div class="list">${today.slice().reverse().map(x=>`<div class="row"><span class="t">${clock(x.time,1)}</span><span class="v txt">${esc(x.qty)} × ${esc(x.item)}</span>${chip("neutral",x.reason)}</div>`).join("")}</div>`:empty("Nothing wasted yet today")}`+store()};
const EQS={"open":["bad","Open"],"in progress":["warn","In progress"],"fixed":["good","Fixed"]};
S.equipment=async()=>{$("#upd").textContent="";setSrc(ShiftData.live());const rows=(await Floor.list("equipment")).slice().reverse();
 const ord=x=>({open:0,"in progress":1,fixed:2}[x.status]??0);rows.sort((a,b)=>ord(a)-ord(b));const open=rows.filter(x=>x.status!=="fixed").length;
 return back+`<div class="card stack"><div class="lbl">Report an issue${chip(open?"warn":"good",open?open+" open":"All fixed")}</div>
 <input id="eqe" placeholder="Equipment (e.g. Fry vat 2)" aria-label="Equipment"><input id="eqi" placeholder="What's wrong" aria-label="Issue"><input id="eqr" placeholder="Reported by (first name)" aria-label="Reported by">
 <button class="btn primary block" data-act="eq">Report</button></div>
 ${rows.length?`<div class="list">${rows.map(x=>{const [s,w]=EQS[x.status]||EQS.open;return `<details><summary class="row"><span class="v txt">${esc(x.equipment)}<small>${esc(x.issue)}</small></span>${chip(s,w)}${I("chevron-down","cv")}</summary>
 <div class="det" style="padding-left:0"><div>Reported by <b>${esc(x.reported_by)||"—"}</b> · ${new Date(x.ts).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</div>${x.fixer?`<div>Fixer: <b>${esc(x.fixer)}</b></div>`:""}
 ${x.status==="fixed"?"":`<div class="stack" style="gap:8px;margin-top:8px"><input id="fx${esc(x.id)}" placeholder="Fixer (first name)" value="${esc(x.fixer||"")}" aria-label="Fixer">
 <div style="display:flex;gap:8px">${x.status!=="in progress"?`<button class="btn" style="flex:1" data-eq="${esc(x.id)}" data-st="in progress">In progress</button>`:""}<button class="btn primary" style="flex:1" data-eq="${esc(x.id)}" data-st="fixed">Fixed</button></div></div>`}</div></details>`}).join("")}</div>`:empty("No equipment issues")}`+store()};
const NTYPES=["training","ready to promote","call-out","praise"];const NST={"training":"neutral","ready to promote":"good","call-out":"warn","praise":"good"};
S.crewnotes=async()=>{$("#upd").textContent="";setSrc(ShiftData.live());const rows=(await Floor.list("crewnotes")).slice().reverse();
 return back+`<div class="tip">${I("lock")}<span>Manager only · first names only</span></div>
 <div class="card stack"><div class="lbl">New note</div><input id="cnn" placeholder="First name" aria-label="First name">
 ${pick("ntype",NTYPES,PICK.ntype)}<input id="cnt" placeholder="Note" aria-label="Note"><button class="btn primary block" data-act="cn">Save note</button></div>
 ${rows.length?`<div class="list">${rows.slice(0,30).map(x=>`<div class="row" style="display:block;padding:12px 0"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>${esc(x.first_name)}</b>${chip(NST[x.type]||"neutral",x.type)}</div><div>${esc(x.note)}</div><div class="note-ts">${esc(x.date)}</div></div>`).join("")}</div>`:empty("No crew notes yet")}`+store()};

S.settings=async()=>{$("#upd").textContent="";const has=!!ShiftData.Key.get();setSrc(ShiftData.live());
 await ShiftData.load("Brief").catch(()=>{});setSrc(ShiftData.live());const bad=ShiftData.status.bad;
 const c=!has?chip("warn","Not set"):bad==="key"?chip("bad","Didn't work"):bad?chip("warn","Can't reach"):ShiftData.live()?chip("good","Working"):chip("neutral","Saved");
 return `<div class="card stack"><div class="lbl">Shared key${c}</div>
 ${bad?`<p class="err" role="alert">${esc(keyMsg())}.${bad==="key"?" Check the key with your GM and enter it again.":" Check your connection and try again."}</p>`:""}
 <div class="meta" style="-webkit-line-clamp:3">Data link ${ShiftData.hasUrl()?"is set":"is not set yet"}. ${has?(ShiftData.live()?"Showing live data.":"Showing sample data."):"Showing sample data until the key is saved."}</div>
 <input id="k" type="password" autocomplete="off" placeholder="Enter shared key" aria-label="Shared key">
 <button class="btn primary block" data-act="key">Save key</button>
 <button class="btn danger block" data-act="clearkey">Remove key from this phone</button></div>`};

const TITLE={home:"Home",whoson:"Who's on",labor:"Labor",rushes:"Rushes",speed:"Speed",guest:"Guest",tools:"Tools",floor:"Floor",inventory:"Inventory",waste:"Waste log",equipment:"Equipment",crewnotes:"Crew notes",settings:"Settings"};
const TABOF={floor:"tools",inventory:"tools",waste:"tools",equipment:"tools",crewnotes:"tools"};
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
  const w=shiftNow();try{await Floor.add("positions",{date:w.date,shift:w.shift,position:pos,name:first(name)});closeSheet();show("floor")}catch(err){alert("Could not save: "+err.message)}});
 d.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet();if(e.key==="Enter"&&e.target.id==="sh-o")d.querySelector('[data-setpos=""]').click()});
 (d.querySelector(".btn.primary")||d.querySelector("button")).focus()}
let cur="home",floorSub="positions",timer=null;
function tick(){document.querySelectorAll("[data-since]").forEach(el=>{const m=Math.floor((Date.now()-new Date(el.dataset.since))/60000);
 el.className="chip "+(m>=30?"bad":m>=25?"warn":"good");el.textContent=m+" min"})}
// Stale-while-revalidate: paint the last HTML for this screen at once, then swap in fresh HTML if it changed.
// seq guards against a slow load overwriting a screen the user has already left.
const VIEW={};let seq=0,shown="";
async function show(s,o={}){const my=++seq,moved=shown!==s;cur=s;shown=s;$("#title").textContent=TITLE[s];
 document.querySelectorAll("#tabs button").forEach(b=>{const on=b.dataset.s===(TABOF[s]||s);b.classList.toggle("on",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
 const had=!o.fresh&&VIEW[s];if(had)app.innerHTML=VIEW[s];else if(moved||o.fresh)app.innerHTML=empty("Loading…");
 if(moved)scrollTop_(s);
 try{const h=await S[s]();if(my!==seq)return;if(h!==VIEW[s]||!had){app.innerHTML=h;VIEW[s]=h;if(moved&&!had)scrollTop_(s)}}catch(e){if(my!==seq)return;if(had)return;delete VIEW[s];app.innerHTML=`<div class="card stack" role="alert"><div class="lbl">Couldn't load ${esc(TITLE[s])}${chip("bad","Error")}</div><div class="meta">${esc(e.message)}. Check your connection and try again.</div><button class="btn primary block" type="button" data-retry="${s}">${I("refresh-cw")}Try again</button></div>`}
 clearInterval(timer);if(document.querySelector("[data-since]")){tick();timer=setInterval(tick,30000)}
}
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
 const t=e.target.closest("button,input")||e.target,F=window.Floor,v=id=>($("#"+id)||{}).value?.trim();
 try{const a=t.dataset.act;
 if(a==="key"){ShiftData.Key.set(v("k"));meta=null;for(const k in VIEW)delete VIEW[k];show("home");return}
 if(a==="clearkey"){ShiftData.Key.set("");meta=null;for(const k in VIEW)delete VIEW[k];show("settings");return}
 if(a==="pos"&&v("pp")){const w=shiftNow();await F.add("positions",{date:w.date,shift:w.shift,position:v("pp"),name:first(v("pn"))})}
 else if(t.dataset.place){openSheet(t.dataset.place,t.dataset.pos);return}
 else if(a==="brk"&&v("bn"))await F.add("breaks",{name:first(v("bn"))});
 else if(a==="chk"&&v("ci"))await F.add("checklist",{item:v("ci")});
 else if(a==="fix"&&v("fi"))await F.add("fixes",{item:v("fi")});
 else if(a==="hand"&&v("hn"))await F.add("handoff",{note:v("hn")});
 else if(a==="inv"){const i=t.dataset.i,q=v("ioh"+i),p=v("ipar"+i);if(!q&&!p)return;await F.add("inventory",{item:t.dataset.item,unit:t.dataset.unit,on_hand:q||"",par:p||t.dataset.par||""});show("inventory");return}
 else if(a==="invnew"&&v("ini")){await F.add("inventory",{item:v("ini"),unit:v("inu")||"",on_hand:"",par:v("inp")||""});show("inventory");return}
 else if(a==="waste"&&v("wi")){const w=nowT();await F.add("waste",{date:w.date,time:w.time,item:v("wi"),qty:v("wq")||"1",reason:PICK.reason});show("waste");return}
 else if(a==="eq"&&v("eqe")){await F.add("equipment",{equipment:v("eqe"),issue:v("eqi")||"",reported_by:first(v("eqr")),status:"open",fixer:"",updated:new Date().toISOString()});show("equipment");return}
 else if(t.dataset.eq){await F.update("equipment",t.dataset.eq,{status:t.dataset.st,fixer:first(v("fx"+t.dataset.eq)),updated:new Date().toISOString()});show("equipment");return}
 else if(a==="cn"&&v("cnn")&&v("cnt")){await F.add("crewnotes",{date:nowT().date,first_name:first(v("cnn")),type:PICK.ntype,note:v("cnt")});show("crewnotes");return}
 else if(t.dataset.back)await F.update("breaks",t.dataset.back,{back:new Date().toISOString()});
 else if(t.dataset.chk)await F.update("checklist",t.dataset.chk,{done:t.checked});
 else if(t.dataset.fix)await F.update("fixes",t.dataset.fix,{done:t.checked});
 else return;show("floor")}catch(err){alert("Could not save: "+err.message)}});
app.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches(".addbar input, #k")){const b=e.target.parentElement.querySelector("[data-act]");if(b)b.click()}});
$("#gear").onclick=()=>show("settings");$("#src").onclick=()=>show("settings");
setSrc(false);show("home");
if("serviceWorker" in navigator){const sw=navigator.serviceWorker,had=!!sw.controller;
 // New version took over: reload once. Guard: only if a worker controlled the page at load, and not twice within 10s.
 sw.addEventListener("controllerchange",()=>{if(!had)return;const t=+sessionStorage.getItem("shifthub_swreload")||0;if(Date.now()-t<10000)return;
  sessionStorage.setItem("shifthub_swreload",Date.now());location.reload()});
 sw.register("sw.js",{updateViaCache:"none"}).then(r=>{r.update();document.addEventListener("visibilitychange",()=>{if(!document.hidden)r.update()})}).catch(()=>{})}
})();
