// node tests/hub.test.js — current shift (including overnight), goal/grade fallbacks, task rules, Code.gs whitelist.
const fs=require("fs"),path=require("path");
const SC=require("../js/shift.js");
const TL=require("../js/tasks.js");
let n=0,f=0;
const eq=(a,b,m)=>{n++;const ok=JSON.stringify(a)===JSON.stringify(b);if(!ok){f++;console.log("FAIL",m,"\n  got",JSON.stringify(a),"\n  want",JSON.stringify(b))}};
const ok=(c,m)=>{n++;if(!c){f++;console.log("FAIL",m)}};
// Nov 22 2026 is EST (UTC-5). Jul 11 2026 is EDT (UTC-4).
const ET=(iso)=>new Date(iso);
const row=(o)=>Object.assign({row_type:"DATA",date:"2026-11-22",shift:"6a-2p",start:"06:00",end:"14:00",manager:"Travis (Ian from 10a)"},o);
const goals=[
 row({shift:"6a-2p",start:"06:00",end:"14:00",manager:"Travis (Ian from 10a)",sales_proj:"2400",sales_so_far:"980",on_track:"On track"}),
 row({shift:"2p-10p",start:"14:00",end:"22:00",manager:"Hana L",sales_proj:"3100"}),
 row({date:"2026-11-22",shift:"10p-6a",start:"22:00",end:"06:00",manager:"",sales_proj:"1800"}),
 row({date:"2026-11-23",shift:"10p-6a",start:"22:00",end:"06:00",manager:"Gus K",sales_proj:"1800"})];

// 1. Current shift by clock, America/New_York, including the overnight date roll.
eq(SC.currentShift(ET("2026-11-22T14:30:00Z")),{date:"2026-11-22",shift:"6a-2p",label:"6 AM – 2 PM",ymd:"2026-11-22",minutes:9*60+30},"9:30 AM ET is 6a-2p");
eq(SC.currentShift(ET("2026-11-22T19:00:00Z")).shift,"2p-10p","2:00 PM ET starts 2p-10p");
eq(SC.currentShift(ET("2026-11-22T18:59:00Z")).shift,"6a-2p","1:59 PM ET still 6a-2p");
eq(SC.currentShift(ET("2026-11-23T03:00:00Z")),{date:"2026-11-22",shift:"10p-6a",label:"10 PM – 6 AM",ymd:"2026-11-22",minutes:22*60},"10:00 PM ET starts 10p-6a dated that night");
eq([SC.currentShift(ET("2026-11-23T06:00:00Z")).date,SC.currentShift(ET("2026-11-23T06:00:00Z")).shift],["2026-11-22","10p-6a"],"1 AM on 11/23 is the 11/22 10p-6a shift");
eq([SC.currentShift(ET("2026-11-23T10:59:00Z")).date,SC.currentShift(ET("2026-11-23T10:59:00Z")).shift],["2026-11-22","10p-6a"],"5:59 AM still the overnight shift");
eq([SC.currentShift(ET("2026-11-23T11:00:00Z")).date,SC.currentShift(ET("2026-11-23T11:00:00Z")).shift],["2026-11-23","6a-2p"],"6:00 AM starts the new 6a-2p");
eq([SC.currentShift(ET("2026-07-11T05:00:00Z")).date,SC.currentShift(ET("2026-07-11T05:00:00Z")).shift],["2026-07-10","10p-6a"],"1 AM EDT (summer) still rolls the date back");

// 2. Row pick confirms start/end. 1 AM selects the row dated the night it started, not the next night's row.
eq(SC.isoD(SC.fld(SC.pickCurrent(goals,ET("2026-11-23T06:00:00Z")),"date")),"2026-11-22","1 AM picks the 11/22 10p-6a row");
eq(SC.normShift(SC.fld(SC.pickCurrent(goals,ET("2026-11-23T06:00:00Z")),"shift")),"10p-6a","1 AM shift name");
eq(SC.fld(SC.pickCurrent(goals,ET("2026-11-22T14:30:00Z")),"manager"),"Travis (Ian from 10a)","morning row");
eq(SC.fld(SC.pickCurrent(goals,ET("2026-11-22T19:00:00Z")),"shift"),"2p-10p","2 PM picks 2p-10p");
// Start/end win over a mismatched shift label: times say overnight even if the label says 6a-2p.
const mis=[row({date:"2026-11-22",shift:"6a-2p",start:"22:00",end:"06:00",manager:"Night lead"})];
eq(SC.fld(SC.pickCurrent(mis,ET("2026-11-23T06:00:00Z")),"manager"),"Night lead","start/end confirm the overnight window");
// A 11/23 10p-6a row has not started at 1 AM on 11/23.
eq(SC.pickCurrent([row({date:"2026-11-23",shift:"10p-6a",start:"22:00",end:"06:00"})],ET("2026-11-23T06:00:00Z")),null,"future overnight row is not current");
// Blank start/end falls back to the shift name and the same overnight date rule.
eq(SC.fld(SC.pickCurrent([row({date:"2026-11-22",shift:"10 PM – 6 AM",start:"",end:"",manager:"Blank times"})],ET("2026-11-23T06:00:00Z")),"manager"),"Blank times","blank times use the shift name");
eq(SC.pickCurrent([row({row_type:"HEADER",date:"2026-11-22",shift:"6a-2p"})],ET("2026-11-22T14:30:00Z")),null,"header row ignored");
eq(SC.fld(SC.pickNext([row({date:"2026-11-22",shift:"2p-10p",manager:"Next"})],ET("2026-11-22T14:30:00Z")),"manager"),"Next","no current row -> next shift");
eq(SC.nextShift(ET("2026-11-23T06:00:00Z")).shift,"6a-2p","next after overnight is 6a-2p");
eq(SC.nextShift(ET("2026-11-23T06:00:00Z")).date,"2026-11-23","next after overnight is the new morning");

// 3. Blank manager and blank live.
const blank=SC.viewGoal(row({manager:"  ",sales_so_far:"",proj_so_far:"",hours_so_far:"",need_so_far:"",hours_left:"",oepe_worst_sec:"",kvs_worst_sec:"",r2p_worst_sec:"",on_track:"",sales_proj:"2400",labor_pct_target:"22.5",hours_cap:"40",oepe_target_sec:"160"}));
eq(blank.manager,"","blank manager value");
eq(blank.managerLabel,"Manager not listed","blank manager label");
eq(blank.live,false,"blank live columns");
eq(blank.salesProj,2400,"targets still read by header name");
const named=SC.viewGoal(row({manager:"Travis (Ian from 10a)",on_track:"Labor +2.5 hrs; KVS 63s at 3 PM",kvs_worst_sec:"63",kvs_target_sec:"50"}));
eq(named.managerLabel,"Travis (Ian from 10a)","manager shown as written");
eq(named.live,true,"on_track counts as live");
eq(SC.trackTone(named.onTrack),"warn","problem text is not on track");
eq(SC.trackTone("On track"),"good","on track tone");
eq(SC.secStatus(63,50),"bad","KVS 13s over target");
eq(SC.secStatus(55,50),"warn","10s over is watch");
eq(SC.salesStatus(980,1100),"bad","sales more than 5% behind");
eq(SC.lowerStatus(18.4,18),"warn","hours within 1 of need");

// 4. Grades: last 7 days, newest first, fallbacks.
const grades=[
 {date:"2026-11-22",shift:"10p-6a",manager:"",grade:"C",goals_hit:"3/6",sales:"1700",sales_proj:"1800",why:"",run_better:"",low_surveys:"2"},
 {date:"2026-11-22",shift:"6a-2p",manager:"Travis (Ian from 10a)",grade:"A",goals_hit:"6/6",sales:"2500",sales_proj:"2400",labor_pct:"21.0",labor_pct_target:"22.5",hours:"38",hours_cap:"40",oepe_sec:"150",kvs_sec:"40",r2p_sec:"48",low_surveys:"0",why:"Hit every goal",run_better:""},
 {date:"2026-11-10",shift:"2p-10p",manager:"Old",grade:"F",why:"too old"},
 {date:"2026-11-16",shift:"2p-10p",manager:"Hana L",grade:"D",sales:"",sales_proj:"",why:"Short crew",run_better:"Call in a second window"}];
const recent=SC.recentGrades(grades,ET("2026-11-22T19:00:00Z"),7);
eq(recent.map(g=>g.date+" "+g.shift),["2026-11-22 10p-6a","2026-11-22 6a-2p","2026-11-16 2p-10p"],"newest first, 7 days, old row dropped");
eq(recent[0].managerLabel,"Manager not listed","blank grade manager");
eq([recent[0].letter,recent[0].tone],["C","warn"],"C is watch");
eq([recent[0].why,recent[0].runBetter],["",""],"blank why and run_better");
eq([recent[1].letter,recent[1].tone,recent[1].managerLabel],["A","good","Travis (Ian from 10a)"],"A keeps the written manager");
eq([recent[2].letter,recent[2].tone,recent[2].sales],["D","bad",null],"D and missing sales");
eq(SC.gradeTone(""),"neutral","blank grade");
eq(SC.gradeTone("F"),"bad","F");
eq(SC.gradeTone("B"),"good","B");

// 5. Freshness: live fields ~2h15m, goal rows ~8.5h when live is blank.
const ago=ms=>({d:new Date(Date.now()-ms)});
eq(SC.goalsAreStale(ago(3*36e5),ago(60e3),Date.now()),true,"live older than 2h15m is stale");
eq(SC.goalsAreStale(ago(60*60e3),ago(9*36e5),Date.now()),false,"fresh live is not stale");
eq(SC.goalsAreStale(null,ago(9*36e5),Date.now()),true,"no live and goals older than 8.5h");
eq(SC.goalsAreStale(null,ago(2*36e5),Date.now()),false,"goals row still inside 8.5h");
eq(SC.LIVE_STALE_MS,2.25*36e5,"live limit");
eq(SC.GOAL_STALE_MS,8.5*36e5,"goal limit");

// 6. Task validation, names, repeat math.
eq(TL.ACTIONS,["task_add","task_done","task_undo","task_delete"],"action whitelist");
eq(TL.personName("Maria Lopez"),"Maria L","crew name is first + last initial");
eq(TL.personName("Ana R"),"Ana R","already short");
eq(TL.personName("  "),"" ,"blank name");
const bad=TL.validateAdd({title:"",assignee:"Ana R"});eq(bad.ok,false,"title required");eq(bad.error,"Title is required");
eq(TL.validateAdd({title:"Wipe the trays",assignee:""}).error,"Assignee is required");
const long=TL.validateAdd({title:"x".repeat(200),note:"n".repeat(500),assignee:"Maria Lopez",station:"s".repeat(80),due_date:"2026-11-22",due_shift:"6 AM - 2 PM",repeat:"Daily",created_by:"Travis B"});
eq(long.ok,true,"limited fields still save");
eq([long.row.title.length,long.row.note.length,long.row.station.length],[80,280,40],"length limits");
eq(long.row.assignee,"Maria L","assignee normalized");
eq(long.row.created_by,"Travis B","created_by normalized");
eq([long.row.due_shift,long.row.repeat,long.row.status],["6a-2p","daily","open"],"shift and repeat canonical, always open");
eq(TL.validateAdd({title:"X",assignee:"Ana R",due_shift:"nights"}).ok,false,"bad shift");
eq(TL.validateAdd({title:"X",assignee:"Ana R",due_date:"2026-02-31"}).ok,false,"impossible date");
eq(TL.validateAdd({title:"X",assignee:"Ana R",due_date:"11/22/2026"}).ok,false,"date must be YYYY-MM-DD");
eq(TL.validateAdd({title:"X",assignee:"Ana R",repeat:"weekly:Mon,Wed"}).error,"A repeating task needs a due date");
eq(TL.validateAdd({title:"X",assignee:"Ana R",repeat:"hourly"}).ok,false,"bad repeat");
eq(TL.parseRepeat("weekly:Mon,Wed,Mon").text,"weekly:Mon,Wed","weekly days unique and ordered");
eq(TL.parseRepeat("weekly:Fun").error,"Weekly days must be Mon through Sun");
eq(TL.nextDue("2026-11-22","daily"),"2026-11-23","daily next");
eq(TL.nextDue("2026-11-30","daily"),"2026-12-01","daily month roll");
eq(TL.nextDue("2026-11-23","weekly:Mon"),"2026-11-30","weekly same weekday is +7");
eq(TL.nextDue("2026-11-23","weekly:Mon,Wed"),"2026-11-25","weekly next listed day");
eq(TL.nextDue("2026-11-22","none"),"","none does not spawn");
eq(TL.nextDue("","daily"),"","no due date");
const nxt=TL.nextInstance({title:"Count waste",note:"",assignee:"Ana R",station:"Grill",due_date:"2026-11-23",due_shift:"6a-2p",repeat:"weekly:Mon,Wed",created_by:"Hana L"});
eq([nxt.due_date,nxt.status,nxt.done_by,nxt.repeat],["2026-11-25","open","","weekly:Mon,Wed"],"next instance copies the rule");
eq(TL.sameOpen([{title:"Count waste",assignee:"Ana R",due_date:"2026-11-25",due_shift:"6a-2p",repeat:"weekly:Mon,Wed",status:"open"}],nxt),true,"does not duplicate an open next");
eq(TL.sameOpen([{title:"Count waste",assignee:"Ana R",due_date:"2026-11-25",due_shift:"6a-2p",repeat:"weekly:Mon,Wed",status:"done"}],nxt),false,"a done row is not a duplicate");
eq(TL.validateDone({id:"",done_by:"Ana R"}).ok,false,"done needs an id");
eq(TL.validateDone({id:"../x",done_by:"Ana R"}).ok,false,"id charset");
eq(TL.validateDone({id:"abc-123",done_by:""}).error,"done_by is required");
eq(TL.validateDone({id:"abc-123",done_by:"Maria Lopez"}),{ok:true,id:"abc-123",done_by:"Maria L"},"done_by normalized");
eq(TL.validateDelete({id:"abc-123"}).ok,true,"delete id");
eq(TL.validateUndo({id:"bad id"}).ok,false,"undo id");

// 7. Overdue, including the overnight shift, and sort.
const due=(date,shift,status)=>({title:shift||"x",status:status||"open",due_date:date,due_shift:shift||"",assignee:"Ana R"});
eq(TL.isOverdue(due("2026-11-22","6a-2p"),ET("2026-11-22T18:59:00Z")),false,"before 2 PM not overdue");
eq(TL.isOverdue(due("2026-11-22","6a-2p"),ET("2026-11-22T19:00:00Z")),true,"2 PM ends 6a-2p");
eq(TL.isOverdue(due("2026-11-22","10p-6a"),ET("2026-11-23T06:00:00Z")),false,"1 AM overnight is not overdue yet");
eq(TL.isOverdue(due("2026-11-22","10p-6a"),ET("2026-11-23T11:00:00Z")),true,"6 AM ends 10p-6a");
eq(TL.isOverdue(due("2026-11-21",""),ET("2026-11-22T14:30:00Z")),true,"date-only overdue the next day");
eq(TL.isOverdue(due("2026-11-22",""),ET("2026-11-22T14:30:00Z")),false,"date-only due today");
eq(TL.isOverdue(due("2026-11-22","6a-2p","done"),ET("2026-11-22T19:00:00Z")),false,"done is not overdue");
const ordered=TL.sortOpen([due("2026-11-23","6a-2p"),due("2026-11-22","6a-2p"),due("2026-11-22","2p-10p")],ET("2026-11-22T19:00:00Z"));
eq(ordered.map(t=>t.due_date+" "+t.due_shift),["2026-11-22 6a-2p","2026-11-22 2p-10p","2026-11-23 6a-2p"],"overdue first, then date and shift");

// 8. Code.gs v29: tabs, version, and the task write whitelist (plain JS block, no Apps Script APIs).
const gs=fs.readFileSync(path.join(__dirname,"..","apps-script","Code.gs"),"utf8");
ok(/const VERSION='v29';/.test(gs),"Code.gs VERSION v29");
const tabs=/const TABS=\[([^\]]+)\]/.exec(gs);ok(!!tabs,"TABS present");
const tabList=tabs[1].split(",").map(s=>s.replace(/['\s]/g,""));
["Brief","Labor","Events","Speed","SMG","Roster","Comments","Meta","Coverage","Crew","Skills","Availability","DaysOff","WeekHours","SchoolCal","OutOfStock","PreRush","OTRisk","ShiftGoals","ShiftGrades","Tasks"].forEach(t=>ok(tabList.indexOf(t)>=0,"TABS has "+t));
ok(!/SHIFTHUB_KEY\s*=\s*['"][^'"]+['"]/.test(gs),"no key literal");
const block=/\/\*TASKLIB_BEGIN\*\/([\s\S]*?)\/\*TASKLIB_END\*\//.exec(gs);
ok(!!block,"task lib block");
let GS=null;if(block){GS=new Function(block[1]+"\nreturn TaskLib;")()}
ok(!!GS,"task lib evals");
if(GS){
 eq(GS.ACTIONS,["task_add","task_done","task_undo","task_delete"],"Code.gs actions");
 eq(GS.ACTIONS,TL.ACTIONS,"whitelist matches the app");
 const cases=[
  [{title:"",assignee:"Ana R"},"title"],
  [{title:"Wipe",assignee:"Maria Lopez",due_date:"2026-11-23",due_shift:"2p-10p",repeat:"weekly:Mon,Wed",created_by:"Hana Lee"},"add"],
  [{title:"X",assignee:"Ana R",repeat:"weekly:Nope"},"bad weekly"],
  [{title:"X".repeat(90),note:"n".repeat(300),assignee:"Ben Thomas",station:"Grill line extra words",due_shift:"10p-6a",repeat:"none"},"limits"]];
 cases.forEach(([body,name])=>{const a=TL.validateAdd(body),b=GS.validateAdd(body);eq(b,a,"validateAdd "+name)});
 eq(GS.nextDue("2026-11-23","weekly:Mon,Wed"),TL.nextDue("2026-11-23","weekly:Mon,Wed"),"nextDue weekly");
 eq(GS.nextDue("2026-11-30","daily"),TL.nextDue("2026-11-30","daily"),"nextDue daily");
 eq(GS.nextDue("2026-11-23","weekly:Mon"),"2026-11-30","Code.gs +7");
 eq(GS.nextInstance({title:"Count waste",assignee:"Ana R",due_date:"2026-11-23",due_shift:"6a-2p",repeat:"weekly:Mon,Wed",note:"n",station:"Grill",created_by:"Hana L"}).due_date,"2026-11-25","Code.gs spawn");
 eq(GS.validateDone({id:"abc-123",done_by:"Maria Lopez"}),TL.validateDone({id:"abc-123",done_by:"Maria Lopez"}),"validateDone");
 eq(GS.validateDelete({id:"abc-123"}),TL.validateDelete({id:"abc-123"}),"validateDelete");
 eq(GS.personName("Travis (Ian from 10a)"),"Travis A","personName is for assignees, not the manager column");
}
function fnBody(src,name){const start=src.indexOf("function "+name);if(start<0)return "";const i=src.indexOf("{",start);let d=0;
 for(let j=i;j<src.length;j++){if(src[j]==="{")d++;else if(src[j]==="}"){d--;if(!d)return src.slice(start,j+1)}}return ""}
const post=fnBody(gs,"taskPost_");
ok(post.indexOf("function taskPost_")===0,"taskPost_ found");
ok(!/getSheetByName\(/.test(post),"taskPost_ does not open other sheets");
ok(!/Floor_/.test(post),"taskPost_ does not touch Floor sheets");
ok(/taskTable_\(/.test(post),"taskPost_ uses the Tasks table");
const dopost=gs.slice(gs.indexOf("function doPost"));
ok(dopost.indexOf("TaskLib.ACTIONS")<dopost.indexOf("kind_(e)"),"task actions are handled before floor kinds");
ok(dopost.indexOf("taskPost_(act,body)")>0,"doPost calls taskPost_");
ok(/const KINDS=\['positions','breaks','checklist','fixes','handoff','inventory','waste','equipment','crewnotes'\]/.test(gs),"floor kinds unchanged");
console.log(`${n-f}/${n} passed`);
process.exit(f?1:0);
