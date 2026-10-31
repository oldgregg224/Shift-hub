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
const empty=t=>`<p class="empty">${esc(t)}</p>`;

let meta=null;
async function setUpd(tab,rows){try{if(!meta)meta=(await ShiftData.load("Meta")).rows}catch(e){meta=[]}
 const m=meta.find(x=>x.tab===tab);const v=(m&&m.last_updated)||(rows[0]&&rows[0].last_updated)||"";
 const d=new Date(v);$("#upd").textContent=v?"Updated "+(isNaN(d)?v:d.toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})):""}
function setSrc(live){const p=$("#src");p.classList.toggle("live",live);
 const has=!!ShiftData.Key.get();p.dataset.label=live?"Live":(has?"Sample · check key":"Sample · add key");
 p.setAttribute("aria-label",(live?"Live data":"Sample data")+". Open settings")}
async function get(tab){const r=await ShiftData.load(tab);setSrc(r.live);await setUpd(tab,r.rows);return r.rows}

const S={
async home(){const r=await get("Brief"),b=r[0]||{};
 const sa=n(b.sales_actual),sp=n(b.sales_projection),la=n(b.labor_actual_pct),lp=n(b.labor_projection_pct);
 const ss=status(sa,sp,"sales"),ls=status(la,lp,"labor");
 const ot=listCount(b.overtime_watch_first_names),od=listCount(b.overdue_checklists),cm=n(b.new_smg_comment_count)||0,hr=n(b.open_harri_requests)||0;
 const rush=b.rush_banner?`<div class="alert">${I("siren")}<div><b>${esc(b.rush_banner)}</b><span>Rush today</span></div></div>`:"";
 return rush+
 kpi("Sales",money(sa),"of "+money(sp)+" projected",ss,(isNaN(sa-sp)?"":(sa-sp<0?"−":"+")+money(Math.abs(sa-sp))+" · ")+({good:"Ahead",warn:"Behind",bad:"Behind"}[ss]||""),null)+
 kpi("Labor",pct(la),"target "+pct(lp),ls,(isNaN(la-lp)?"":sgn(la-lp,1)+" · ")+({good:"On target",warn:"Watch",bad:"Over"}[ls]||""),"labor")+
 `<div class="grid">`+
 kpi("Overtime",ot,ot?b.overtime_watch_first_names:"No one close",status(ot,0,"count"),ot?"Watch":"Clear","floor",1)+
 kpi("Overdue",od,od?b.overdue_checklists:"All checklists done",od?"bad":"good",od?"Late":"Clear","floor",1)+
 kpi("Guest notes",cm,"new comments",null,null,"guest",1)+
 kpi("Requests",hr,"open in Harri",status(hr,0,"count"),hr?"Open":"Clear",null,1)+`</div>`},

async labor(){const r=await get("Labor");if(!r.length)return empty("No labor data yet");
 const callSt=c=>{c=String(c||"").toUpperCase();return c.includes("EARLY")?"bad":c.includes("HOLD")?"warn":"good"};
 const cur=r[r.length-1],cl=n(cur.labor_pct),ct=n(cur.target_pct)||21.5,cs=status(cl,ct,"labor");
 return `<div class="card"><div class="lbl">Now · ${clock(cur.hour)}${chip(cs,sgn(cl-ct,1)+" · "+WORD[cs])}</div><div class="hero">${pct(cl)}</div>
 <div class="meta" style="display:flex;align-items:center;gap:8px">target ${pct(ct)} ${cur.call?chip(callSt(cur.call),cur.call):""}</div></div>
 <div class="sec">By hour</div><div class="list">${r.map(x=>{const l=n(x.labor_pct),t=n(x.target_pct)||21.5;
 return `<details><summary class="row"><span class="t">${clock(x.hour,1)}</span><span class="v">${pct(l)}<small>${esc(x.actual_hours)} of ${esc(x.cap_hours)} hrs · ${chip(status(l,t,"labor")).replace(/<[^>]+>/g,"")}</small></span>${x.call?chip(callSt(x.call),x.call):""}${I("chevron-down","cv")}</summary>
 <div class="det">${x.position_to_cut_first&&x.position_to_cut_first!=="—"?`<div><b>Cut first:</b> ${esc(x.position_to_cut_first)}</div>`:""}${x.prep_level_notes?`<div><b>Prep:</b> ${esc(x.prep_level_notes)}</div>`:""}${x.hold_time_reminders?`<div><b>Hold:</b> ${esc(x.hold_time_reminders)}</div>`:""}${x.sales?`<div><b>Sales:</b> ${money(n(x.sales))}</div>`:""}</div></details>`}).join("")}</div>`},

async rushes(){const r=await get("Events");const d0=new Date(),today=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,"0")}-${String(d0.getDate()).padStart(2,"0")}`;
 const t=r.filter(x=>x.date===today),wk=new Date(d0.getTime()+7*864e5).toISOString().slice(0,10),nx=r.filter(x=>x.date>today&&x.date<=wk).sort((a,b)=>a.date<b.date?-1:1);
 const win=x=>{const a=clock(x.rush_window_start).replace(":00",""),b=clock(x.rush_window_end).replace(":00","");const pa=a.slice(-2);return (b.endsWith(pa)&&/[AP]M$/.test(a)?a.slice(0,-3):a)+"–"+b};
 const day=s=>{const d=new Date(s+"T12:00:00");return isNaN(d)?esc(s):d.toLocaleDateString("en-US",{weekday:"short"})+" "+d.getDate()};
 const src=x=>x.source_url?`<a class="src-link" href="${safeUrl(x.source_url)}" target="_blank" rel="noopener noreferrer">${I("external-link")}Source</a>`:"";
 return `<div class="sec">Today</div>`+(t.length?t.map(x=>`<div class="card"><div class="lbl">${esc(x.event)}</div><div class="hero sm">${win(x)}</div>
 ${x.runner_timing?`<div style="margin-top:8px">${chip("neutral",x.runner_timing)}</div>`:""}${x.prep_notes?`<div class="meta">${esc(x.prep_notes)}</div>`:""}${src(x)}</div>`).join(""):empty("No events today"))+
 `<div class="sec">Next 7 days</div>`+(nx.length?`<div class="list">${nx.map(x=>`<details><summary class="row">${chip("neutral",day(x.date))}<span class="v txt">${esc(x.event)}<small>${win(x)}</small></span>${I("chevron-down","cv")}</summary>
 <div class="det" style="padding-left:0">${x.prep_notes?`<div><b>Prep:</b> ${esc(x.prep_notes)}</div>`:""}${x.runner_timing?`<div><b>Runner:</b> ${esc(x.runner_timing)}</div>`:""}${src(x)}</div></details>`).join("")}</div>`:empty("Nothing coming up"))},

async speed(){const r=await get("Speed");if(!r.length)return empty("No speed data yet");
 const st=x=>x.slow_flag==="Y"?"bad":status(n(x.oepe_sec),n(x.last_week_oepe_sec),"oepe");
 const cur=r[r.length-1],cd=n(cur.oepe_sec)-n(cur.last_week_oepe_sec);
 const tips=r.filter(x=>x.pre_rush_positioning_note);
 return `<div class="card"><div class="lbl">Now · ${clock(cur.hour)}${chip(st(cur),isNaN(cd)?WORD[st(cur)]:sgn(cd)+"s vs LW")}</div><div class="hero">${mmss(n(cur.oepe_sec))}</div><div class="meta">OEPE · last week ${mmss(n(cur.last_week_oepe_sec))}</div></div>`+
 tips.map(x=>`<div class="tip">${I("lightbulb")}<span>${esc(x.pre_rush_positioning_note)}</span></div>`).join("")+
 `<div class="sec">OEPE by hour</div><div class="list">${r.map(x=>{const d=n(x.oepe_sec)-n(x.last_week_oepe_sec),s=st(x),o=n(x.order_sec)||0,c=n(x.cash_sec)||0,w=n(x.second_window_sec)||0;
 return `<details><summary class="row"><span class="t">${clock(x.hour,1)}</span><span class="v">${mmss(n(x.oepe_sec))}<small>LW ${mmss(n(x.last_week_oepe_sec))} · total ${mmss(n(x.total_time_sec))}</small></span>${chip(s,(isNaN(d)?"":sgn(d)+"s ")+(s==="bad"?"Slow":s==="warn"?"Watch":""))}${I("chevron-down","cv")}</summary>
 <div class="det"><div><b>Total:</b> ${mmss(n(x.total_time_sec))} (LW ${mmss(n(x.last_week_total_sec))})</div>${o+c+w?`<div class="bar"><i style="flex:${o};background:var(--accent)"></i><i style="flex:${c};background:var(--ink-3)"></i><i style="flex:${w};background:var(--warn)"></i></div><div>Order ${o}s · Cash ${c}s · 2nd window ${w}s</div>`:""}</div></details>`}).join("")}</div>`},

async guest(){const r=await get("SMG");if(!r.length)return empty("No guest scores yet");const f=r.find(x=>x.coaching_focus);
 const cm=r.filter(x=>x.low_score_comment_names_removed);
 return (f?`<div class="tip">${I("target")}<span>${esc(f.coaching_focus)}</span></div>`:"")+
 r.map(x=>{const s=n(x.score),l=n(x.last_week),st=status(s,l,"guest");return `<div class="card"><div class="lbl">${esc(x.channel)}${chip(st,(isNaN(s-l)?"":sgn(s-l)+" · ")+({good:"Up",warn:"Watch",bad:"Down"}[st]||""))}</div><div class="hero">${isNaN(s)?"—":s}</div><div class="meta">last week ${isNaN(l)?"—":l}</div></div>`}).join("")+
 (cm.length?`<details class="card more"><summary>${cm.length} low-score comment${cm.length>1?"s":""}${I("chevron-down","cv")}</summary><div class="det" style="padding:0">${cm.map(x=>`<div><b>${esc(x.channel)}:</b> ${esc(x.low_score_comment_names_removed)}</div>`).join("")}</div></details>`:"")},

async floor(){$("#upd").textContent="";const F=window.Floor;const sub=floorSub;
 setSrc(ShiftData.live());
 const tabs=[["positions","Positions"],["breaks","Breaks"],["checklist","Checklist"],["fixes","Fixes"],["handoff","Notes"]];
 const seg=`<div class="seg" role="tablist">${tabs.map(([k,l])=>`<button type="button" role="tab" data-sub="${k==="handoff"?"notes":k}" class="${k===sub?"on":""}" aria-selected="${k===sub}">${l}</button>`).join("")}</div>`;
 const rows=await F.list(sub);const store=`<p class="upd" style="padding:0;text-align:center">${ShiftData.live()?"Shared with all managers":"Saved on this phone"}</p>`;
 const tm=ts=>new Date(ts).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
 const chkRow=(x,attr)=>`<label class="chk"><input type="checkbox" ${attr}="${esc(x.id)}" ${x.done?"checked":""}><span class="box">${I("check")}</span><span>${esc(x.item)}</span></label>`;
 let body="",bar="";
 if(sub==="positions"){body=rows.length?`<div class="list">${rows.map(x=>`<div class="row"><span class="v txt">${esc(x.position)}</span><span>${esc(x.name)}</span></div>`).join("")}</div>`:empty("No one positioned yet");
  bar=`<input id="pp" placeholder="Position" aria-label="Position"><input id="pn" placeholder="First name" aria-label="First name" style="max-width:40%"><button class="btn primary sq" data-act="pos" aria-label="Add">${I("plus")}</button>`}
 if(sub==="breaks"){const on=rows.filter(x=>!x.back),done=rows.filter(x=>x.back);
  body=(on.length?`<div class="list">${on.map(x=>`<div class="row"><span class="v txt">${esc(x.name)}<small>out ${tm(x.ts)}</small></span><span class="chip" data-since="${esc(x.ts)}"></span><button class="btn" data-back="${esc(x.id)}">Back</button></div>`).join("")}</div>`:empty("No one on break"))+
  (done.length?`<div class="sec">Back</div><div class="list">${done.slice(-8).reverse().map(x=>`<div class="row"><span class="v txt">${esc(x.name)}<small>${tm(x.ts)} – ${tm(x.back)}</small></span>${chip("good",Math.round((new Date(x.back)-new Date(x.ts))/60000)+" min")}</div>`).join("")}</div>`:"");
  bar=`<input id="bn" placeholder="First name" aria-label="First name"><button class="btn primary" data-act="brk">Start</button>`}
 if(sub==="checklist"){body=rows.length?`<div class="list">${rows.map(x=>chkRow(x,"data-chk")).join("")}</div>`:empty("No checklist items");
  bar=`<input id="ci" placeholder="Checklist item" aria-label="Checklist item"><button class="btn primary sq" data-act="chk" aria-label="Add">${I("plus")}</button>`}
 if(sub==="fixes"){body=rows.length?`<div class="list">${rows.map(x=>chkRow(x,"data-fix")).join("")}</div>`:empty("No fixes listed");
  bar=`<input id="fi" placeholder="Fix to do" aria-label="Fix"><button class="btn primary sq" data-act="fix" aria-label="Add">${I("plus")}</button>`}
 if(sub==="handoff"){body=rows.length?`<div class="list">${rows.slice(-10).reverse().map(x=>`<div class="row" style="display:block;padding:12px 0"><div class="note-ts">${new Date(x.ts).toLocaleString([],{weekday:"short",hour:"numeric",minute:"2-digit"})}</div>${esc(x.note)}</div>`).join("")}</div>`:empty("No handoff notes");
  bar=`<input id="hn" placeholder="Note for next manager" aria-label="Note"><button class="btn primary sq" data-act="hand" aria-label="Save note">${I("plus")}</button>`}
 return seg+body+store+`<div class="addbar">${bar}</div>`}
};
S.settings=async()=>{$("#upd").textContent="";const has=!!ShiftData.Key.get();setSrc(ShiftData.live());
 return `<div class="card stack"><div class="lbl">Shared key${chip(has?"good":"warn",has?"Saved on this phone":"Not set")}</div>
 <div class="meta" style="-webkit-line-clamp:3">Data link ${ShiftData.hasUrl()?"is set":"is not set yet"}. ${has?"":"Showing sample data until the key is saved."}</div>
 <input id="k" type="password" autocomplete="off" placeholder="Enter shared key" aria-label="Shared key">
 <button class="btn primary block" data-act="key">Save key</button>
 <button class="btn danger block" data-act="clearkey">Remove key from this phone</button></div>`};

const TITLE={home:"Home",labor:"Labor",rushes:"Rushes",speed:"Speed",guest:"Guest",floor:"Floor",settings:"Settings"};
let cur="home",floorSub="positions",timer=null;
function tick(){document.querySelectorAll("[data-since]").forEach(el=>{const m=Math.floor((Date.now()-new Date(el.dataset.since))/60000);
 el.className="chip "+(m>=30?"bad":m>=25?"warn":"good");el.textContent=m+" min"})}
async function show(s){cur=s;$("#title").textContent=TITLE[s];
 document.querySelectorAll("#tabs button").forEach(b=>{const on=b.dataset.s===s;b.classList.toggle("on",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
 app.innerHTML=empty("Loading…");try{app.innerHTML=await S[s]()}catch(e){app.innerHTML=`<div class="card"><div class="lbl">Error${chip("bad","Problem")}</div><div class="meta">${esc(e.message)}</div></div>`}
 clearInterval(timer);if(document.querySelector("[data-since]")){tick();timer=setInterval(tick,30000)}
 window.scrollTo(0,0)}
document.querySelectorAll("[data-i]").forEach(el=>el.outerHTML=I(el.dataset.i));
$("#gear").innerHTML=I("settings");
$("#tabs").onclick=e=>{const b=e.target.closest("button");if(b)show(b.dataset.s)};
app.addEventListener("click",async e=>{const go=e.target.closest("[data-go]");if(go){show(go.dataset.go);return}
 const sb=e.target.closest("[data-sub]");if(sb){floorSub=sb.dataset.sub==="notes"?"handoff":sb.dataset.sub;show("floor");return}
 const t=e.target.closest("button,input")||e.target,F=window.Floor,v=id=>($("#"+id)||{}).value?.trim();
 try{const a=t.dataset.act;
 if(a==="key"){ShiftData.Key.set(v("k"));meta=null;show("home");return}
 if(a==="clearkey"){ShiftData.Key.set("");meta=null;show("settings");return}
 if(a==="pos"&&v("pp"))await F.add("positions",{position:v("pp"),name:v("pn")});
 else if(a==="brk"&&v("bn"))await F.add("breaks",{name:v("bn")});
 else if(a==="chk"&&v("ci"))await F.add("checklist",{item:v("ci")});
 else if(a==="fix"&&v("fi"))await F.add("fixes",{item:v("fi")});
 else if(a==="hand"&&v("hn"))await F.add("handoff",{note:v("hn")});
 else if(t.dataset.back)await F.update("breaks",t.dataset.back,{back:new Date().toISOString()});
 else if(t.dataset.chk)await F.update("checklist",t.dataset.chk,{done:t.checked});
 else if(t.dataset.fix)await F.update("fixes",t.dataset.fix,{done:t.checked});
 else return;show("floor")}catch(err){alert("Could not save: "+err.message)}});
app.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches(".addbar input, #k")){const b=e.target.parentElement.querySelector("[data-act]");if(b)b.click()}});
$("#gear").onclick=()=>show("settings");$("#src").onclick=()=>show("settings");
setSrc(false);show("home");
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
