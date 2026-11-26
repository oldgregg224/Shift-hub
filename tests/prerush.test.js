// node tests/prerush.test.js — Pre-rush AM/PM and the duplicate "Open" drinks row.
const P=require("../js/present.js");
let n=0,f=0;
const eq=(a,b,m)=>{n++;const ok=JSON.stringify(a)===JSON.stringify(b);if(!ok){f++;console.log("FAIL",m,"\n  got",JSON.stringify(a),"\n  want",JSON.stringify(b))}};
const ok=(c,m)=>{n++;if(!c){f++;console.log("FAIL",m)}};
eq(P.formatClock("6:30 PM",true),"6:30p","dinner is PM");
eq(P.formatClock("3:30 PM",true),"3:30p","afternoon is PM");
eq(P.formatClock("2:15 PM",true),"2:15p","early release is PM");
eq(P.formatClock("10:30 AM",true),"10:30a","morning stays AM");
eq(P.formatClock("9:30 PM",true),"9:30p","close is PM");
eq(P.formatClock("1:30 PM",true),"1:30p","1:30 PM");
eq(P.formatClock("8:00 PM",true),"8p","8:00 PM short drops :00");
eq(P.formatClock("16:45",true),"4:45p","24h still works");
eq(P.formatClock("06:30",true),"6:30a","24h morning");
eq(P.formatClock("20:30",false),"8:30 PM","long 24h");
eq(P.formatClock("Open",true),null,"Open is not a clock time");
eq(P.clockMinutes("6:30 PM"),18*60+30,"minutes honor PM");
eq(P.clockMinutes("10:30 AM"),10*60+30,"minutes honor AM");
const drinks="Soda/drink machine working; syrups and Diet Coke stocked";
const rows=[
 {rush:"Dinner",check_by:"6:30 PM",station:"Kitchen",item:"Both kitchen sides open by 7 PM",why:"Dinner peak",trigger:"Daily",done:""},
 {rush:"Afternoon shift change",check_by:"3:30 PM",station:"Manager",item:"Keep the overlap",why:"Handoff",trigger:"Daily",done:""},
 {rush:"Early release",check_by:"2:15 PM",station:"Grill",item:"Grill person in by 2:45 PM",why:"Early release",trigger:"Wed 12/2 (Events tab)",done:""},
 {rush:"Drinks and machine check",check_by:"Open",station:"Drinks",item:drinks,why:"Survey",trigger:"Daily",done:""},
 {rush:"Drinks and machine check",check_by:"10:30 AM",station:"Drinks",item:drinks,why:"Survey",trigger:"Daily",done:""},
 {rush:"Guest requests",check_by:"Open",station:"Kitchen",item:"Remake special requests without pushback",why:"",trigger:"Daily",done:""},
 {rush:"Break-week lunch",check_by:"10:30 AM",station:"Grill",item:"Strongest grill person on by 11 AM",why:"Break",trigger:"Mon–Fri 11/23–11/27",done:""},
 {rush:"Weekend lunch",check_by:"11:00 AM",station:"Grill",item:"Second person on grill",why:"Weekend",trigger:"Every Sat and Sun",done:""},
 {rush:"Christmas Parade 12/5",check_by:"9:30 AM",station:"Manager",item:"Look-ahead",why:"Parade",trigger:"12/5 Winter Garden Christmas Parade",done:""},
 {rush:"Close",check_by:"9:30 PM",station:"Grill / Presenter",item:"Two on grill",why:"Close",trigger:"Daily",done:""}
];
const G=P.preGroups(rows);
const drinksG=G.find(g=>g.k==="drinks and machine check");
eq(drinksG.it.length,1,"Open + 10:30 AM same item is one row");
eq(drinksG.it[0].check_by,"10:30 AM","kept the timed drinks row");
eq(P.formatClock(drinksG.it[0].check_by,true),"10:30a","drinks time label");
const guest=G.find(g=>g.k==="guest requests");
eq(guest.it.length,1,"a real Open row stays");
eq(guest.it[0].check_by,"Open","Open label kept when it is the only row");
const dinner=G.find(g=>g.k==="dinner");
eq(P.formatClock(dinner.it[0].check_by,true),"6:30p","dinner row label");
eq(dinner.first,18*60+30,"dinner sorts as 6:30 PM");
// Sunday 2026-11-22 8:45 AM: soonest check that applies today, not a PM time read as AM and not a future parade.
const nx=P.preNext(G,8*60+45,"2026-11-22");
ok(nx&&nx.k==="drinks and machine check","next check Sunday morning is the 10:30 AM daily drinks check");
eq(nx&&nx.first,10*60+30,"next check-by is 10:30");
const mon=P.preNext(G,8*60+45,"2026-11-23");
ok(mon&&mon.k==="break-week lunch","Monday during the break uses the break-week lunch");
// The PreRush tab is one shift and adds a shift column. Grouping stays the same. The header can show that shift.
const withShift=rows.map(r=>Object.assign({shift:"2026-11-23 6a-2p"},r));
const G2=P.preGroups(withShift);
eq(G2.map(g=>g.k),G.map(g=>g.k),"shift column does not split or drop groups");
eq(G2.find(g=>g.k==="dinner").first,dinner.first,"PM checks still sort as PM");
eq(P.preShift(withShift),{raw:"2026-11-23 6a-2p",date:"2026-11-23",shift:"6a-2p"},"shift label parsed");
eq(P.preShift([{item:"Round eggs",shift:""},{item:"Second taker"}]),null,"blank shift hides the label");
const mixed=[
 {rush:"breakfast",check_by:"06:30",station:"Grill",item:"Eggs",shift:"2026-11-23 6a-2p"},
 {rush:"breakfast",check_by:"06:45",station:"Drive Thru",item:"Headset",shift:"2026-11-23 6a-2p"},
 {rush:"lunch",check_by:"10:45",station:"Fries",item:"Baskets",shift:"2026-11-22 2p-10p"}];
eq(P.preShift(mixed).raw,"2026-11-23 6a-2p","header uses the shift on most rows");
eq(P.preGroups(mixed).length,2,"current-shift rows still group by rush");
const fs=require("fs"),path=require("path");
const appJs=fs.readFileSync(path.join(__dirname,"..","js","app.js"),"utf8");
const presentJs=fs.readFileSync(path.join(__dirname,"..","js","present.js"),"utf8");
const code=fs.readFileSync(path.join(__dirname,"..","apps-script","Code.gs"),"utf8");
ok(!/PreRushBank/.test(appJs+presentJs+code),"pre-rush does not read PreRushBank");
const stale=P.preRushHeader({raw:"2026-11-25 10p-6a",date:"2026-11-25",shift:"10p-6a"},{date:"2026-11-26",shift:"6a-2p"});
eq(stale.match,false,"Wednesday night is not Thursday morning");
eq(stale.title,"Last shift's pre-rush (Wed 10p-6a)","stale pre-rush names the shift it belongs to");
eq(stale.warning,"Not updated for this shift yet","stale pre-rush warns");
const fresh=P.preRushHeader({raw:"2026-11-26 6a-2p",date:"2026-11-26",shift:"6a-2p"},{date:"2026-11-26",shift:"6a-2p"});
eq(fresh.match,true,"matching column J is this shift");
eq(fresh.title,"This shift","current pre-rush title");
eq(fresh.warning,"","no warning when the shift matches");
console.log(`${n-f}/${n} passed`);
process.exit(f?1:0);
