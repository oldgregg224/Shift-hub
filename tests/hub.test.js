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

// 8. Hour-by-hour coach. Read by header name. Blank coach fields hide; the goal card still works.
const coach=SC.viewGoal({"Do This Hour":"Sales are behind this hour. Keep both windows open. Send someone on break only after the line is gone.","Do Next Hour":"Use the lull to restock fries and cups. Have the lunch grill person in place.","Next Hour":"3 PM","Hours Per Hour Left":"2.4","Next Hour Need Hrs":"6.5","Next Hour Proj Sales":"420","Pace Cap Hrs":"4",shift:"6a-2p",date:"2026-11-22",manager:"Travis",hours_left:"21.5",on_track:"On track",speed_focus:"Second window"});
eq(coach.doThisHour,"Sales are behind this hour. Keep both windows open. Send someone on break only after the line is gone.","this hour note by header name");
eq(coach.doNextHour,"Use the lull to restock fries and cups. Have the lunch grill person in place.","next hour note by header name");
eq(coach.nextHourLabel,"3p","3 PM becomes 3p");
eq([coach.perHourLeft,coach.nextHourNeed,coach.nextHourSales,coach.paceCap,coach.hoursLeft],[2.4,6.5,420,4,21.5],"coach numbers by header name");
eq(coach.speedFocus,"Second window","speed focus still on the goal");
eq(SC.coachParts(coach).nextLabel,"Next hour (3p)","next card label");
eq(SC.coachParts(coach).stats,["hoursLeft","perHourLeft","nextHourNeed","nextHourSales","paceCap"],"stats under the coach cards");
const noPace=SC.viewGoal(row({do_this_hour:"Keep two at the window.",do_next_hour:"",next_hour:"",hours_per_hour_left:"",next_hour_need_hrs:"1",next_hour_proj_sales:"",pace_cap_hrs:"",hours_left:""}));
eq(SC.coachParts(noPace).thisHour,"Keep two at the window.","this hour card stays");
eq(SC.coachParts(noPace).nextLabel,"","blank next hour card hides");
eq(SC.coachParts(noPace).stats,["nextHourNeed"],"blank coach fields hide");
const noCoach=SC.viewGoal(row({do_this_hour:"",do_next_hour:"—",next_hour:"n/a",hours_per_hour_left:"",next_hour_need_hrs:"",next_hour_proj_sales:"",pace_cap_hrs:"",hours_left:"12",sales_proj:"2400"}));
eq(noCoach.hasCoach,false,"empty coach falls back to the goal card");
eq(SC.coachParts(noCoach),null,"no coach parts when every new column is blank");
eq(noCoach.hoursLeft,12,"hours left still on the goal when there is no coach");
eq(SC.hourTag("15:00"),"3p","24h next hour");
eq(SC.hourTag("10a"),"10a","sheet short hour kept");

// 9. Per-manager grade rows. Most hours pick the parent shift. 5a-1p is mostly 6a-2p, not the previous night.
eq(SC.isMgrShift("mgr 2p-9p"),true,"mgr prefix");
eq(SC.isMgrShift("Mgr 5a-1p"),true,"Mgr prefix");
eq(SC.isMgrShift("6a-2p"),false,"regular shift is not mgr");
eq(SC.normShift("mgr 2p-9p"),"","mgr shift is not a regular shift id");
eq(SC.normShift("mgr 6a-2p"),"","mgr 6a-2p is not the morning shift");
eq(SC.mgrHours("mgr 2p-9p"),"2p–9p","manager hours label");
eq(SC.mgrHours("mgr 5a-1p"),"5a–1p","early manager hours label");
eq(SC.mgrParent("2026-11-22","mgr 2p-9p"),{date:"2026-11-22",shift:"2p-10p"},"2p-9p sits under 2p-10p");
eq(SC.mgrParent("2026-11-22","mgr 5a-1p"),{date:"2026-11-22",shift:"6a-2p"},"5a-1p is mostly 6a-2p, not the previous night");
eq(SC.mgrParent("2026-11-23","mgr 4a-5a"),{date:"2026-11-22",shift:"10p-6a"},"hours before 6a sit on the previous night");
eq(SC.mgrParent("2026-11-22","mgr 9p-5a"),{date:"2026-11-22",shift:"10p-6a"},"9p-5a is mostly that night's 10p-6a");
eq(SC.mgrParent("2026-11-22","mgr 10a-6p").shift,"6a-2p","a tie goes to the shift that contains the start");
eq(SC.mgrParent("2026-11-22","mgr"),null,"unparsed mgr shift does not crash");
eq(SC.mgrHours("mgr"),"","unparsed mgr has no hours label");
const mixedGrades=[
 {date:"2026-11-22",shift:"mgr 2p-9p",manager:"Hana L",grade:"A"},
 {date:"2026-11-22",shift:"2p-10p",manager:"Hana Shift",grade:"C"},
 {date:"2026-11-22",shift:"6a-2p",manager:"Travis",grade:"B"},
 {date:"2026-11-22",shift:"mgr 5a-1p",manager:"Ian C",grade:"B"},
 {date:"2026-11-22",shift:"10p-6a",manager:"Gus K",grade:"B"},
 {date:"2026-11-22",shift:"mgr 9p-5a",manager:"Gus K",grade:"A"},
 {date:"2026-11-23",shift:"mgr 4a-5a",manager:"Nia P",grade:"C"},
 {date:"2026-11-22",shift:"not a shift",manager:"Zed Q",grade:"D"},
 {date:"2026-11-10",shift:"mgr 2p-9p",manager:"Old",grade:"F"}];
const mixedRecent=SC.recentGrades(mixedGrades,ET("2026-11-23T15:00:00Z"),7);
eq(mixedRecent.map(g=>g.mgr?"mgr:"+g.mgrHours:(g.shift||g.rawShift)),["mgr:4a–5a","10p-6a","mgr:9p–5a","2p-10p","mgr:2p–9p","6a-2p","mgr:5a–1p","not a shift"],"mgr rows sort with their parent shift and do not crash");
eq(mixedRecent.filter(g=>g.date==="2026-11-22"&&g.parentShift==="2p-10p").map(g=>g.mgr),[false,true],"regular 2p-10p stays ahead of its manager row");
const groups=SC.gradeGroups(mixedGrades,ET("2026-11-23T15:00:00Z"),7);
const g22=sh=>groups.find(g=>g.date==="2026-11-22"&&g.shift===sh);
eq(groups.map(g=>g.date+" "+g.shift),["2026-11-22 10p-6a","2026-11-22 2p-10p","2026-11-22 6a-2p","2026-11-22 "],"newest parent shift first; unknown shift last");
eq(g22("2p-10p").grades.map(g=>g.manager),["Hana Shift"],"regular card");
eq(g22("2p-10p").managers.map(g=>g.manager+" "+g.mgrHours),["Hana L 2p–9p"],"indented manager under 2p-10p");
eq(g22("6a-2p").managers.map(g=>g.manager),["Ian C"],"5a-1p under 6a-2p");
eq(g22("10p-6a").managers.map(g=>g.manager),["Gus K","Nia P"],"same-night 9p-5a then next morning's early hours");
eq(g22("10p-6a").managers[1].date,"2026-11-23","early hours keep their own row date");
eq(groups[groups.length-1].grades.map(g=>g.manager),["Zed Q"],"unparsed shift still shows");
ok(!mixedRecent.some(g=>g.manager==="Old"),"old mgr row stays outside 7 days");
const earlyOnly=SC.gradeGroups([{date:"2026-11-17",shift:"mgr 4a-5a",manager:"Nia P",grade:"B"}],ET("2026-11-23T15:00:00Z"),7);
eq([earlyOnly[0].date,earlyOnly[0].shift,earlyOnly[0].managers[0].manager],["2026-11-16","10p-6a","Nia P"],"a row inside the window can sit on the previous night");

// 10. Mgr rows are ignored when picking the current shift or a freshness stamp.
const mgrGoals=[
 row({shift:"2p-10p",manager:"Hana L",start:"14:00",end:"22:00",sales_so_far:"100",live_updated:"2026-11-22T15:00:00Z"}),
 row({shift:"mgr 2p-9p",manager:"Partial",start:"14:00",end:"21:00",sales_so_far:"999",live_updated:"2026-11-22T18:00:00Z"})];
eq(SC.fld(SC.pickCurrent(mgrGoals,ET("2026-11-22T19:00:00Z")),"manager"),"Hana L","current shift skips the mgr row");
eq(SC.pickCurrent([row({shift:"mgr 6a-2p",manager:"Ian C",start:"06:00",end:"14:00"})],ET("2026-11-22T14:30:00Z")),null,"a mgr row is never the current shift");
eq(SC.fld(SC.pickNamed(mgrGoals,"2026-11-22","2p-10p"),"manager"),"Hana L","named shift skips mgr");
eq(SC.newestStamp(mgrGoals,"live_updated").v,"2026-11-22T15:00:00Z","freshness ignores the mgr stamp");
eq(SC.goalState(mgrGoals,ET("2026-11-22T19:00:00Z")).cur.manager,"Hana L","goal card uses the regular row");

// 11. Grade adjustments and callouts. Names stay first + last initial. No guest fields.
const adj=SC.viewGrade({date:"2026-11-22",shift:"2p-10p",manager:"Hana L",grade:"C",Callouts:"2","Short Hours Excused":"3.5",Adjusted_Note:"Two people called out. The grade uses the other hours."});
eq(SC.calloutLine(adj),"Callouts: 2 · 3.5 short hours excused","callout line");
eq(adj.adjustedNote,"Two people called out. The grade uses the other hours.","adjusted note by header name");
eq(SC.calloutLine(SC.viewGrade({date:"2026-11-22",shift:"6a-2p",callouts:"",short_hours_excused:"",adjusted_note:""})),"","blank adjustment hides");
eq(SC.calloutLine(SC.viewGrade({date:"2026-11-22",shift:"6a-2p",short_hours_excused:"1"})),"1 short hour excused","one hour");
eq(SC.calloutLine(SC.viewGrade({date:"2026-11-22",shift:"10p-6a",callouts:"1"})),"Callouts: 1","callouts only");
const callRows=[
 {row_type:"DATA",date:"2026-11-22",shift:"2p-10p",name:"Ana R",role:"Crew",sched_start:"14:00",sched_end:"22:00",source:"Harri",note:"Guest was upset about fries"},
 {row_type:"DATA",date:"2026-11-22",shift:"6 AM - 2 PM",name:"Ben T",role:"Grill",sched_start:"06:00",sched_end:"14:00",note:"Called ahead"},
 {row_type:"DATA",date:"2026-11-22",shift:"mgr 2p-9p",name:"Maria Lopez",role:"Window",sched_start:"14:00",sched_end:"21:00",note:"Left early"},
 {row_type:"DATA",date:"2026-11-21",shift:"2p-10p",name:"Cy D",role:"Crew",sched_start:"14:00",sched_end:"18:00"},
 {row_type:"HEADER",date:"2026-11-22",shift:"2p-10p",name:"Example",role:"Crew",sched_start:"14:00",sched_end:"22:00"}];
const listed=SC.calloutsFor(callRows,adj);
eq(listed.map(c=>c.name),["Ana R"],"regular card lists that date and shift");
eq(Object.keys(listed[0]).sort(),["end","name","role","start"],"callout has name, role, and times only");
ok(!/guest|fries|Harri/i.test(JSON.stringify(listed)),"guest text and source stay off the card");
eq(SC.calloutsFor(callRows,SC.viewGrade({date:"2026-11-22",shift:"6a-2p"})).map(c=>c.name),["Ben T"],"shift alias matches");
eq(SC.calloutsFor(callRows,SC.viewGrade({date:"2026-11-22",shift:"mgr 2p-9p",manager:"Hana L"})).map(c=>c.name),["Maria L"],"mgr card matches its own shift and shortens a full name");
eq(SC.calloutsFor(callRows,SC.viewGrade({date:"2026-11-22",shift:"10p-6a"})),[],"other shift has no callouts");

// 12. Sample rows carry the new columns, per-manager grades, and callouts.
const sample=name=>JSON.parse(fs.readFileSync(path.join(__dirname,"..","data","sample",name),"utf8"));
const goalSample=sample("shiftgoals.json");
ok(goalSample.some(r=>String(r.do_this_hour||"").trim()&&String(r.do_next_hour||"").trim()&&String(r.next_hour||"").trim()),"sample goals have coach notes");
ok(goalSample.some(r=>String(r.pace_cap_hrs||"").trim())&&goalSample.some(r=>!String(r.pace_cap_hrs||"").trim()),"sample pace cap can be blank");
eq(SC.viewGoal(goalSample.find(r=>r.shift==="6a-2p")).hasCoach,true,"sample morning row coaches");
const gradeSample=sample("shiftgrades.json");
ok(gradeSample.some(r=>SC.isMgrShift(r.shift)),"sample grades include a mgr row");
ok(gradeSample.some(r=>String(r.callouts||"").trim()&&String(r.short_hours_excused||"").trim()&&String(r.adjusted_note||"").trim()),"sample grades have adjustment columns");
const callSample=sample("callouts.json");
["date","shift","name","role","sched_start","sched_end","source","note","last_updated"].forEach(k=>ok(callSample.some(r=>k in r),"callouts sample has "+k));
ok(callSample.every(r=>!/guest/i.test(JSON.stringify(r))),"sample callouts have no guest info");
ok(callSample.every(r=>SC.shortName(r.name)===r.name),"sample callout names are already short");
const preSample=sample("prerush.json");
ok(preSample.every(r=>/^\d{4}-\d{2}-\d{2}\s+\S+/.test(String(r.shift||""))),"sample pre-rush rows carry a shift label");

// 13. Code.gs v30: Callouts is readable, PreRushBank is not, task writes stay on Tasks.
const gs=fs.readFileSync(path.join(__dirname,"..","apps-script","Code.gs"),"utf8");
ok(/const VERSION='v30';/.test(gs),"Code.gs VERSION v30");
const tabs=/const TABS=\[([^\]]+)\]/.exec(gs);ok(!!tabs,"TABS present");
const tabList=tabs[1].split(",").map(s=>s.replace(/['\s]/g,""));
["Brief","Labor","Events","Speed","SMG","Roster","Comments","Meta","Coverage","Crew","Skills","Availability","DaysOff","WeekHours","SchoolCal","OutOfStock","PreRush","OTRisk","ShiftGoals","ShiftGrades","Callouts","Tasks"].forEach(t=>ok(tabList.indexOf(t)>=0,"TABS has "+t));
ok(tabList.indexOf("PreRushBank")<0,"PreRushBank is not a tab");
ok(!/PreRushBank/.test(gs),"Code.gs does not read PreRushBank");
ok(!/SHIFTHUB_KEY\s*=\s*['"][^'"]+['"]/.test(gs),"no key literal");
const ver=JSON.parse(fs.readFileSync(path.join(__dirname,"..","version.json"),"utf8"));
eq(ver.v,"v46","app version v46");
const sw=fs.readFileSync(path.join(__dirname,"..","sw.js"),"utf8");
ok(/shifthub-v46/.test(sw),"service worker cache v46");
ok(/"callouts"/.test(sw),"service worker caches callouts");
const app=fs.readFileSync(path.join(__dirname,"..","js","app.js"),"utf8");
ok(/const APPVER="v46"/.test(app),"in-app version v46");
ok(!/PreRushBank/.test(app),"app does not read PreRushBank");
ok(/noindex/.test(fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8")),"noindex stays");

// 14. Home and Labor must share one row. Thu 9:20 AM must not treat a future 9 PM as "latest now",
// and must not show Wednesday 9 AM's 76.7% while the labor screen shows Wednesday 9 PM.
const laborRows=[
 {row_type:"DATA",date:"2026-11-25",hour:"09:00",labor_pct:"76.7",actual_hours:"21.29",target_pct:"21.5"},
 {row_type:"DATA",date:"2026-11-25",hour:"21:00",labor_pct:"20.1",actual_hours:"9.06",target_pct:"21.5"},
 {row_type:"DATA",date:"2026-11-26",hour:"21:00",labor_pct:"20.1",actual_hours:"9.06",target_pct:"21.5"}];
const thu=ET("2026-11-26T14:20:00Z");
const picked=SC.laborPick(laborRows,thu);
eq(picked&&picked.date,"2026-11-25","latest labor is Wednesday, not a future Thursday 9 PM");
eq(picked&&picked.hour,21,"9 PM is the latest hour at or before 9:20 AM");
eq([picked.pct,picked.hours],[20.1,9.06],"percent and hours come from that same row");
eq(picked.prior,true,"a prior shift is labeled as prior");
eq(picked.label,"Wed 9 PM · stale","a row from before today is named by the day and marked stale");
eq(picked.stale,true,"older than today is stale on Home and Labor");
const morning=[].concat(laborRows,{row_type:"DATA",date:"2026-11-26",hour:"08:00",labor_pct:"22.4",actual_hours:"6.5",target_pct:"21.5"});
const nowRow=SC.laborPick(morning,thu);
eq([nowRow.date,nowRow.hour,nowRow.pct,nowRow.prior],["2026-11-26",8,22.4,false],"today's latest hour at or before now wins");
eq(nowRow.label,"Today · 8 AM","today's earlier hour is not last night");
ok(!/76\.7/.test(String(nowRow.pct)),"home cannot keep Wednesday morning once a later row exists");
const appSrc=fs.readFileSync(path.join(__dirname,"..","js","app.js"),"utf8");
ok((appSrc.match(/ShiftCal\.laborPick\(/g)||[]).length>=2,"home and the labor screen both call laborPick");

// 15. Grade labor percent, low surveys, and a duplicate single-manager card.
eq(SC.asPct("21.4%"),21.4,"percent sign is already a percent");
eq(SC.asPct("0.214"),21.4,"a fraction becomes a percent");
eq(SC.asPct(21.4),21.4,"a percent above 1 stays");
eq(SC.asPct(""),null,"blank percent");
const frac=SC.viewGrade({date:"2026-11-26",shift:"6a-2p",manager:"Hana L",grade:"B",labor_pct:"0.231",labor_pct_target:"21",low_surveys:"0.1125"});
eq(frac.laborPct,23.1,"grade labor fraction is a percent");
eq(frac.surveyText,"11%","low survey fraction rounds to a percent");
const blankLabor=SC.viewGrade({date:"2026-11-26",shift:"2p-10p",manager:"Gus K",grade:"C",labor_pct:"",labor_pct_target:"21.5",hours:"58.77",hours_cap:"61.5",low_surveys:"2",goals_hit:"1 of 4 fully met (labor). Score 97 (A): sales 20/20 (101% of projection), labor 30/30, speed 46.6/50"});
eq(blankLabor.laborPct,null,"blank labor_pct is not hours divided by the cap");
eq(blankLabor.hoursLine,"Hours 58.8 of 61.5 needed","hours are shown against the hours need");
eq(blankLabor.hoursTone,"good","58.8 is under a 61.5 need");
eq(blankLabor.laborPctTarget,21.5,"the percent target stays on the row and is not the hours comparison");
const overHours=SC.viewGrade({date:"2026-11-26",shift:"6a-2p",labor_pct:"",hours:"70",hours_cap:"61.5"});
eq(overHours.hoursTone,"bad","hours over the need is over, not a labor percent");
eq(blankLabor.surveyText,"2","a count above 1 stays a count");
eq(SC.surveyText(0),"0","zero surveys stay zero");
const dup=SC.gradeGroups([
 {date:"2026-11-26",shift:"2p-10p",manager:"Hana L",grade:"C"},
 {date:"2026-11-26",shift:"mgr 2p-9p",manager:"Hana L",grade:"C"}],thu,7);
eq(dup[0].grades.length,1,"shift row stays");
eq(dup[0].managers.length,0,"the only manager card matching the shift manager is not repeated");
const keep=SC.gradeGroups([
 {date:"2026-11-26",shift:"2p-10p",manager:"Hana L",grade:"C"},
 {date:"2026-11-26",shift:"mgr 2p-9p",manager:"Ian C",grade:"B"}],thu,7);
eq(keep[0].managers.map(g=>g.manager),["Ian C"],"a different manager still shows");

// 16. My tasks and the assignee list share one name list, including assignees missing from crew.
eq(TL.peopleNames([["Ana R","Ben T"],["Jason O"],["Hana Lee"]]),["Ana R","Ben T","Hana L","Jason O"],"union of crew, managers, and assignees");
eq(TL.peopleNames([["Cody","Cody O","Luz","LUZ N","MANUELLA M","Manuella"]]),["Cody O","Luz N","Manuella M"],"one first name drops when one First L exists");
eq(TL.peopleNames([["Cody","Cody O","Cody B"]]),["Cody","Cody B","Cody O"],"two full names keep a bare first name");
eq(SC.isoD(46349),"2026-11-23","Sheets serial 46349 is 2026-11-23");
eq(SC.isoD("46349"),"2026-11-23","serial dates arrive as text too");
eq(SC.isoD(21.5),"","a percent is not a serial date");
const serialGrade=SC.viewGrade({date:46349,shift:"6a-2p",manager:"Hana L",grade:"A",labor_pct:"",hours:"58.77",hours_cap:"61.5"});
eq(serialGrade.date,"2026-11-23","a grade serial date is a real day");
eq(SC.recentGrades([serialGrade&&{date:46349,shift:"6a-2p",grade:"A",manager:"Hana L"}],ET("2026-11-26T15:00:00Z"),7).length,1,"serial-dated grade stays inside the week");
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
