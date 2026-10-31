(function(){
const $=s=>document.querySelector(s),app=$("#app");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=u=>/^https?:\/\//i.test(u||"")?esc(u):"#";
const card=(t,b,cls="")=>`<div class="card ${cls}"><h2>${esc(t)}</h2>${b}</div>`;
let meta=null;
async function upd(tab,rows){if(!meta)meta=(await ShiftData.load("Meta")).rows;
 const m=meta.find(x=>x.tab===tab);const v=(m&&m.last_updated)||(rows[0]&&rows[0].last_updated)||"unknown";
 let d=new Date(v);return `<p class="upd">Last updated: ${isNaN(d)?esc(v):d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</p>`}
async function get(tab){const r=await ShiftData.load(tab);$("#src").textContent=r.live?"Live sheet":"Sample data";return r.rows}
const n=x=>parseFloat(x);
const S={
async home(){const r=await get("Brief"),b=r[0]||{};const sv=n(b.sales_actual)-n(b.sales_projection),lv=n(b.labor_actual_pct)-n(b.labor_projection_pct);
 return (b.rush_banner?card("🚨 Rush",esc(b.rush_banner),"banner"):"")+
 card("Shift brief",`<p>Sales: <b>$${esc(b.sales_actual)}</b> vs $${esc(b.sales_projection)} <span class="${sv>=0?"good":"bad"}">${isNaN(sv)?"":(sv>=0?"+":"")+sv.toFixed(0)}</span></p>
 <p>Labor: <b>${esc(b.labor_actual_pct)}%</b> vs ${esc(b.labor_projection_pct)}% <span class="${lv<=0?"good":"bad"}">${isNaN(lv)?"":(lv>0?"+":"")+lv.toFixed(1)}</span></p>
 <p>Overtime watch: ${esc(b.overtime_watch_first_names)||"none"}</p><p>New SMG comments: ${esc(b.new_smg_comment_count)}</p>
 <p>Open Harri requests: ${esc(b.open_harri_requests)}</p><p>Overdue checklists: ${esc(b.overdue_checklists)||"none"}</p>${await upd("Brief",r)}`)},
async labor(){const r=await get("Labor");
 return card("Labor by hour (target 21.5%)",`<table><tr><th>Hr</th><th>Cap/Act</th><th>Lab%</th><th>Call</th><th>Cut first</th></tr>${r.map(x=>`<tr><td>${esc(x.hour)}</td><td>${esc(x.cap_hours)}/${esc(x.actual_hours)}</td><td class="${n(x.labor_pct)>n(x.target_pct||21.5)?"bad":"good"}">${esc(x.labor_pct)}</td><td>${esc(x.call)}</td><td>${esc(x.position_to_cut_first)}</td></tr>`).join("")}</table>${await upd("Labor",r)}`)+
 card("Prep & hold times",`<ul>${r.map(x=>`<li><b>${esc(x.hour)}</b> ${esc(x.prep_level_notes)} · ⏲ ${esc(x.hold_time_reminders)}</li>`).join("")}</ul>`)},
async rushes(){const r=await get("Events");const today=new Date().toISOString().slice(0,10);
 const li=x=>`<li><b>${esc(x.date)}</b> ${esc(x.event)} — ${esc(x.rush_window_start)}–${esc(x.rush_window_end)}<br>${esc(x.prep_notes)} · ${esc(x.runner_timing)} <a href="${safeUrl(x.source_url)}" target="_blank" rel="noopener noreferrer">source</a></li>`;
 const t=r.filter(x=>x.date===today),nx=r.filter(x=>x.date!==today);
 return card("Today",t.length?`<ul>${t.map(li).join("")}</ul>`:"<p>No events today.</p>")+card("Next 7 days",`<ul>${nx.map(li).join("")}</ul>${await upd("Events",r)}`)},
async speed(){const r=await get("Speed");
 return card("OEPE by hour vs last week (sec)",`<table><tr><th>Hr</th><th>OEPE</th><th>LW</th><th>Total</th><th>LW</th></tr>${r.map(x=>`<tr class="${x.slow_flag==="Y"?"slow":""}"><td>${esc(x.hour)}${x.slow_flag==="Y"?" 🐢":""}</td><td>${esc(x.oepe_sec)}</td><td>${esc(x.last_week_oepe_sec)}</td><td>${esc(x.total_time_sec)}</td><td>${esc(x.last_week_total_sec)}</td></tr>`).join("")}</table>${await upd("Speed",r)}`)+
 card("Time split (order / cash / 2nd window)",`<ul>${r.map(x=>`<li>${esc(x.hour)}: ${esc(x.order_sec)} / ${esc(x.cash_sec)} / ${esc(x.second_window_sec)}</li>`).join("")}</ul>`)+
 card("Pre-rush positioning",`<ul>${r.filter(x=>x.pre_rush_positioning_note).map(x=>`<li>${esc(x.hour)}: ${esc(x.pre_rush_positioning_note)}</li>`).join("")||"<li>None</li>"}</ul>`)},
async guest(){const r=await get("SMG");const f=r.find(x=>x.coaching_focus);
 return card("Scores by channel",`<table><tr><th>Channel</th><th>Score</th><th>Last wk</th></tr>${r.map(x=>`<tr><td>${esc(x.channel)}</td><td class="${n(x.score)>=n(x.last_week)?"good":"bad"}">${esc(x.score)}</td><td>${esc(x.last_week)}</td></tr>`).join("")}</table>${await upd("SMG",r)}`)+
 card("🎯 Coaching focus",esc(f?f.coaching_focus:"—"))+card("Low-score comments",`<ul>${r.filter(x=>x.low_score_comment_names_removed).map(x=>`<li><b>${esc(x.channel)}:</b> ${esc(x.low_score_comment_names_removed)}</li>`).join("")}</ul>`)},
async floor(){const F=window.Floor;const L=k=>F.list(k);
 const [pos,brk,chk,fix,hand]=await Promise.all(["positions","breaks","checklist","fixes","handoff"].map(L));
 const keyUI=F.key?`<input id="k" type="password" placeholder="Shared key (saved on this phone)"><button class="big" data-act="key">Save key</button>`:"";
 return card("Storage: "+esc(F.name),keyUI)+
 card("Positioning board",`<ul>${pos.map(x=>`<li><b>${esc(x.position)}</b>: ${esc(x.name)}</li>`).join("")}</ul><div class="row"><input id="pp" placeholder="Position"><input id="pn" placeholder="First name"></div><button class="big" data-act="pos">Add</button>`)+
 card("Break tracker",`<ul>${brk.map(x=>`<li>${esc(x.name)} — out ${new Date(x.ts).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})} ${x.back?"✅ back":`<button data-back="${esc(x.id)}">Back</button>`}</li>`).join("")}</ul><input id="bn" placeholder="First name"><button class="big" data-act="brk">Start break</button>`)+
 card("Shift checklist",`${chk.map(x=>`<label class="chk"><input type="checkbox" data-chk="${esc(x.id)}" ${x.done?"checked":""}>${esc(x.item)}</label>`).join("")}<input id="ci" placeholder="Checklist item"><button class="big" data-act="chk">Add item</button>`)+
 card("Fix to-do",`${fix.map(x=>`<label class="chk"><input type="checkbox" data-fix="${esc(x.id)}" ${x.done?"checked":""}>${esc(x.item)}</label>`).join("")}<input id="fi" placeholder="Fix (e.g. from bots' top 3)"><button class="big" data-act="fix">Add fix</button>`)+
 card("Handoff notes",`<ul>${hand.slice(-10).reverse().map(x=>`<li><span class="upd">${new Date(x.ts).toLocaleString()}</span><br>${esc(x.note)}</li>`).join("")}</ul><textarea id="hn" placeholder="Note for next manager"></textarea><button class="big" data-act="hand">Save note</button>`)}
};
let cur="home";
async function show(s){cur=s;document.querySelectorAll("#tabs button").forEach(b=>b.classList.toggle("on",b.dataset.s===s));
 app.innerHTML="<p>Loading…</p>";try{app.innerHTML=await S[s]()}catch(e){app.innerHTML=card("Error",esc(e.message))}}
$("#tabs").onclick=e=>{const b=e.target.closest("button");if(b)show(b.dataset.s)};
app.addEventListener("click",async e=>{const t=e.target,F=window.Floor,v=id=>($("#"+id)||{}).value?.trim();
 try{const a=t.dataset.act;
 if(a==="key"){localStorage.setItem("shifthub_key",v("k")||"");t.textContent="Saved ✓";return}
 if(a==="pos"&&v("pp"))await F.add("positions",{position:v("pp"),name:v("pn")});
 else if(a==="brk"&&v("bn"))await F.add("breaks",{name:v("bn")});
 else if(a==="chk"&&v("ci"))await F.add("checklist",{item:v("ci")});
 else if(a==="fix"&&v("fi"))await F.add("fixes",{item:v("fi")});
 else if(a==="hand"&&v("hn"))await F.add("handoff",{note:v("hn")});
 else if(t.dataset.back)await F.update("breaks",t.dataset.back,{back:new Date().toISOString()});
 else if(t.dataset.chk)await F.update("checklist",t.dataset.chk,{done:t.checked});
 else if(t.dataset.fix)await F.update("fixes",t.dataset.fix,{done:t.checked});
 else return;show("floor")}catch(err){alert("Could not save: "+err.message)}});
show("home");
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
