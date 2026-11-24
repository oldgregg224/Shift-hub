// node tests/cover.test.js  — unit tests for js/cover.js ranking + FL FS 450.081 minor rules.
const SF=require("../js/cover.js");let n=0,f=0;const eq=(a,b,m)=>{n++;const ok=JSON.stringify(a)===JSON.stringify(b);if(!ok){f++;console.log("FAIL",m,"\n  got",JSON.stringify(a),"\n  want",JSON.stringify(b))}};
const has=(arr,re,m)=>{n++;if(!arr.some(x=>re.test(x))){f++;console.log("FAIL",m,JSON.stringify(arr))}};
const no=(arr,re,m)=>{n++;if(arr.some(x=>re.test(x))){f++;console.log("FAIL",m,JSON.stringify(arr))}};
const C=(name,o={})=>Object.assign({row_type:"DATA",name,role:"Crew Member",maintenance:"N",minor:"N",age_band:"18+",phone:"+14075550100"},o);
const K=(name,station,level,v="Y")=>({row_type:"DATA",name,station,level:String(level),skills_verified:v});
const H=(name,h,w="2026-11-01")=>({row_type:"DATA",name,week_start:w,scheduled_hours:String(h)});
const t=(h,m=0)=>h*60+m;
const base=(shift,crew,skills,hours,extra={})=>SF.rank(Object.assign({crew,skills,daysOff:[],weekHours:hours,avail:[],schoolCal:[],shift},extra));
// Tue 2026-11-03 (school day, school next day), Fri 2026-11-06 (no school Sat), Sat 2026-07-11 summer.
const grill=(date,s,e)=>({date,start:s,end:e,type:"station",value:"GRILL REGULAR MENU"});
// 1. Ranking: verified first, then level, then hours left; unverified below verified even with higher level.
let r=base(grill("2026-11-03",t(16),t(22)),[C("Ana R"),C("Ben T"),C("Eli S"),C("Zed Q")],[K("Ana R","GRILL REGULAR MENU",3),K("Ben T","GRILL REGULAR MENU",5),K("Eli S","GRILL REGULAR MENU",5,"N"),K("Zed Q","GRILL REGULAR MENU",3)],[H("Ana R",30),H("Ben T",20),H("Eli S",0),H("Zed Q",10)]);
eq(r.ok.map(o=>o.name),["Ben T","Zed Q","Ana R","Eli S"],"rank order");eq(r.ok[3].verified,false,"unverified flag");eq(r.ok[0].after,14,"hours left after shift");
// 2. No skill row -> can't cover; OT -> can't cover.
r=base(grill("2026-11-03",t(16),t(22)),[C("Ana R"),C("Ben T")],[K("Ben T","GRILL REGULAR MENU",4)],[H("Ana R",0),H("Ben T",36)]);
has(r.no.find(o=>o.name==="Ana R").why,/no grill regular menu skill/,"no skill");has(r.no.find(o=>o.name==="Ben T").why,/42 of 40 hrs \(OT\)/,"OT");
// 3. Time off: approved excludes, pending caution (type column and Y/N columns).
r=base(grill("2026-11-03",t(10),t(14)),[C("Ana R"),C("Ben T"),C("Cy D")],["Ana R","Ben T","Cy D"].map(x=>K(x,"GRILL REGULAR MENU",3)),[],{daysOff:[{row_type:"DATA",name:"Ana R",date:"2026-11-03",type:"time_off_approved"},{row_type:"DATA",name:"Ben T",date:"2026-11-03",type:"time_off_pending"},{row_type:"DATA",name:"Cy D",date:"2026-11-04",type:"time_off_approved"}]});
has(r.no.find(o=>o.name==="Ana R").why,/approved time off/,"approved");has(r.ok.find(o=>o.name==="Ben T").warn,/pending time off/,"pending");eq(!!r.ok.find(o=>o.name==="Cy D"),true,"other date ok");
has(r.ok.find(o=>o.name==="Cy D").warn,/week hours not in Sheet/,"missing hours caution");
// 4. Maintenance rule.
const mt=d=>({date:d,start:t(22),end:t(6),type:"station",value:"MAINTENANCE"});
r=base(mt("2026-11-03"),[C("Gus K",{maintenance:"Y",role:"Primary Maintenance Person"}),C("Ana R")],[K("Ana R","MAINTENANCE",5),K("Gus K","MAINTENANCE",5)],[H("Gus K",30),H("Ana R",0)]);
eq(r.ok.map(o=>o.name),["Gus K"],"maint only");has(r.no[0].why,/not maintenance/,"non-maint reason");
r=base(grill("2026-11-03",t(10),t(14)),[C("Gus K",{maintenance:"Y"})],[K("Gus K","GRILL REGULAR MENU",5)],[H("Gus K",0)]);has(r.no[0].why,/maintenance only/,"maint person not on grill");
// 5. Unknown age: never treated as adult -> caution chip, still shown.
r=base(grill("2026-11-03",t(10),t(14)),[C("Eli S",{age_band:"",minor:""})],[K("Eli S","GRILL REGULAR MENU",3)],[H("Eli S",0)]);has(r.ok[0].warn,/age unknown/,"unknown age caution");eq(r.ok[0].band,"","band blank");
// 6. Minors 16-17 (FS 450.081(2)).
const m16=C("Cara M",{minor:"Y",age_band:"16-17"}),k16=K("Cara M","GRILL REGULAR MENU",3);
r=base(grill("2026-11-03",t(16),t(23,30)),[m16],[k16],[H("Cara M",0)]);has(r.no[0].why,/past 11 PM on a school night/,"16-17 11pm");
r=base(grill("2026-11-06",t(16),t(23,30)),[m16],[k16],[H("Cara M",0)]);eq(r.ok.length,1,"16-17 Fri late ok (no school Sat)");
r=base(grill("2026-11-03",t(10),t(14)),[m16],[k16],[H("Cara M",0)]);has(r.no[0].why,/during school hours/,"16-17 school hours");
r=base(grill("2026-11-03",t(16),t(22)),[m16],[k16],[H("Cara M",26)]);has(r.no[0].why,/30 hrs/,"16-17 30h cap");
r=base(grill("2026-11-08",t(9),t(18)),[m16],[k16],[H("Cara M",0,"2026-11-08")]);eq(r.ok.length,1,"16-17 Sunday 9h ok");has(r.ok[0].warn,/meal break/,"16-17 meal break >=8h");
r=base(grill("2026-11-05",t(14,30),t(23)),[m16],[k16],[H("Cara M",0)]);has(r.no[0].why,/over 8 hrs/,"16-17 >8h school night");
r=base(grill("2026-07-11",t(16),t(23,30)),[m16],[k16],[H("Cara M",30,"2026-07-05")]);eq(r.ok.length,1,"16-17 summer late ok, 40 cap");eq(r.ok[0].cap,40,"summer cap 40");
// 7. Minors 14-15 (FS 450.081(1)).
const m14=C("Dev P",{minor:"Y",age_band:"14-15"}),k14=K("Dev P","GRILL REGULAR MENU",2);
r=base(grill("2026-11-03",t(16),t(19)),[m14],[k14],[H("Dev P",0)]);eq(r.ok.length,1,"14-15 3h school day to 7pm ok");eq(r.ok[0].cap,15,"14-15 cap 15 in session");
r=base(grill("2026-11-03",t(16),t(20)),[m14],[k14],[H("Dev P",0)]);has(r.no[0].why,/past 7 PM/,"14-15 7pm");has(r.no[0].why,/over 3 hrs/,"14-15 3h");
r=base(grill("2026-11-03",t(15),t(18)),[m14],[k14],[H("Dev P",13)]);has(r.no[0].why,/of 15 hrs/,"14-15 15h cap");
r=base(grill("2026-07-11",t(12),t(21)),[m14],[k14],[H("Dev P",0,"2026-07-05")]);has(r.no[0].why,/over 8 hrs/,"14-15 summer 8h");
r=base(grill("2026-07-11",t(13),t(21)),[m14],[k14],[H("Dev P",0,"2026-07-05")]);eq(r.ok.length,1,"14-15 summer to 9pm ok");has(r.ok[0].warn,/meal break/,"14-15 meal >4h");
r=base(grill("2026-07-11",t(14),t(22)),[m14],[k14],[H("Dev P",0,"2026-07-05")]);has(r.no[0].why,/past 9 PM/,"14-15 9pm");
r=base(grill("2026-07-11",t(6),t(10)),[m14],[k14],[H("Dev P",0,"2026-07-05")]);has(r.no[0].why,/before 7 AM/,"14-15 7am");
// 8. SchoolCal overrides the default (Tue 11/3 marked no school, e.g. holiday -> Mon night not a school night).
r=base(grill("2026-11-02",t(16),t(23,30)),[m16],[k16],[H("Cara M",0)],{schoolCal:[{date:"2026-11-03",school_day:"N"},{date:"2026-11-02",school_day:"Y"}]});eq(r.ok.length,1,"SchoolCal holiday next day");eq(r.calKnown,true,"cal known");
// 9. Role search + phone link + names.
r=SF.rank({crew:[C("Hana L",{role:"Certified Swing Manager"}),C("Ana R")],skills:[],daysOff:[],weekHours:[H("Hana L",30)],avail:[],schoolCal:[],shift:{date:"2026-11-03",start:t(14),end:t(22),type:"role",value:"Certified Swing Manager"}});
eq(r.ok.map(o=>o.name),["Hana L"],"role match");eq(r.ok[0].left,10,"hours left before OT");has(r.no[0].why,/different role/,"role reason");
eq(SF.telOf("+16892366623"),{href:"tel:+16892366623",label:"689-236-6623"},"tel");eq(SF.telOf("4075550100").href,"tel:+14075550100","tel 10 digit");
eq(r.ok[0].avail,null,"no availability rows -> null (shows 'not in Harri')");
// 10. v41 worked vs scheduled hours: worked wins for the cap/OT math; both reported; blank worked falls back.
const HW=(name,sch,wk,w="2026-11-01")=>({row_type:"DATA",name,week_start:w,scheduled_hours:sch==null?"":String(sch),worked_hours:wk==null?"":String(wk)});
r=base(grill("2026-11-03",t(16),t(22)),[C("Ana R"),C("Ben T"),C("Cy D"),C("Dee F")],["Ana R","Ben T","Cy D","Dee F"].map(x=>K(x,"GRILL REGULAR MENU",3)),[HW("Ana R",32,28),HW("Ben T",30,""),HW("Cy D","",12),HW("Dee F",20,36)]);
const fa=nm=>r.ok.concat(r.no).find(o=>o.name===nm);
eq([fa("Ana R").worked,fa("Ana R").sched,fa("Ana R").wk,fa("Ana R").basis],[28,32,28,"worked"],"worked + scheduled parsed, worked used");
eq(fa("Ana R").left,12,"hours left uses worked");eq(SF.hoursTxt(fa("Ana R")),"worked 28 h · scheduled 32 h","both shown");
eq([fa("Ben T").worked,fa("Ben T").wk,fa("Ben T").basis],[null,30,"scheduled"],"blank worked -> scheduled");eq(SF.hoursTxt(fa("Ben T")),"scheduled 30 h","scheduled only text");
eq([fa("Cy D").sched,fa("Cy D").wk,fa("Cy D").basis,fa("Cy D").known],[null,12,"worked",true],"worked only");eq(SF.hoursTxt(fa("Cy D")),"worked 12 h","worked only text");
has(fa("Dee F").why,/42 of 40 hrs \(OT\)/,"OT from worked hours even though scheduled is low");
no(fa("Ana R").warn,/week hours not in Sheet/,"known week has no missing-hours warning");
// Minor cap uses worked hours too; other week's row ignored; missing row keeps the warning.
r=base(grill("2026-11-06",t(16),t(22)),[m16],[k16],[HW("Cara M",10,26)]);has(r.no[0].why,/32 of 30 hrs/,"16-17 cap from worked");
r=base(grill("2026-11-03",t(16),t(22)),[C("Ana R")],[K("Ana R","GRILL REGULAR MENU",3)],[HW("Ana R",30,30,"2026-11-08")]);has(r.ok[0].warn,/week hours not in Sheet/,"other week ignored -> warning");eq(SF.hoursTxt(r.ok[0]),"","no hours text when row missing");
r=base(grill("2026-11-03",t(16),t(22)),[C("Ana R")],[K("Ana R","GRILL REGULAR MENU",3)],[HW("Ana R","","")]);has(r.ok[0].warn,/week hours not in Sheet/,"blank row -> warning");
// 11. Pending time off is a caution (dated), including M/D/YYYY. Availability edits are not time off.
const ax=C("Alexis A",{minor:"Y",age_band:"16-17"}),kx=K("Alexis A","GRILL REGULAR MENU",3);
r=base(grill("2026-11-13",t(16),t(20)),[ax],[kx],[],{daysOff:[{row_type:"DATA",name:"Alexis A",date:"11/13/2026",type:"time_off_pending"}]});
eq(r.ok.map(o=>o.name),["Alexis A"],"pending time off does not exclude");
has(r.ok[0].warn,/pending time off 2026-11-13/,"Alexis pending time off on 2026-11-13");
r=base(grill("2026-11-13",t(9),t(15)),[ax],[kx],[],{daysOff:[{row_type:"DATA",name:"Alexis A",date:"2026-11-13",type:"time_off_pending"}]});
has(r.no[0].why,/during school hours/,"school hours still exclude");
has(r.no[0].warn,/pending time off/,"pending caution still shows on a can't-cover card");
r=base(grill("2026-11-13",t(16),t(20)),[C("Ben T"),ax],[K("Ben T","GRILL REGULAR MENU",3),kx],[],{daysOff:[{row_type:"DATA",name:"Ben T",date:"2026-11-13",type:"availability_approved"},{row_type:"DATA",name:"Alexis A",date:"2026-11-22",type:"availability_pending"}]});
eq(!!r.ok.find(o=>o.name==="Ben T"),true,"availability_approved is not approved time off");
no(r.ok.find(o=>o.name==="Ben T").why,/time off/,"availability approved has no time-off reason");
no((r.ok.find(o=>o.name==="Alexis A")||{warn:[]}).warn,/pending/,"availability pending on another date is ignored");
r=base(grill("2026-11-22",t(16),t(20)),[ax],[kx],[],{daysOff:[{row_type:"DATA",name:"Alexis A",date:"2026-11-22",type:"availability_pending"}]});
has(r.ok[0].warn,/pending availability change/,"availability pending is its own caution");
no(r.ok[0].warn,/pending time off/,"availability pending is not called time off");
// 12. Worked hours on the sheet's week only. A current-week row does not fill a past week.
r=base(grill("2026-11-13",t(16),t(20)),[ax],[kx],[HW("Alexis A",12.5,4,"2026-11-22")]);
has(r.ok[0].warn,/week hours not in Sheet/,"week of 11/22 does not apply to 11/13");
eq(r.ok[0].basis,"","past week with no row has no basis");
r=base(grill("2026-11-22",t(17),t(22)),[C("Sophia F"),C("Sanuj W"),C("Christian M")],[K("Sophia F","GRILL REGULAR MENU",3),K("Sanuj W","GRILL REGULAR MENU",3),K("Christian M","GRILL REGULAR MENU",3)],[HW("Sophia F",37.5,2.1,"2026-11-22"),HW("Sanuj W",30,2.07,"2026-11-22"),HW("Christian M",7,"","2026-11-22")]);
const f2=nm=>r.ok.concat(r.no).find(o=>o.name===nm);
eq([f2("Sophia F").basis,f2("Sophia F").wk],["worked",2.1],"worked hours used for the cap");
eq(SF.hoursTxt(f2("Sophia F")),"worked 2.1 h · scheduled 37.5 h","both worked and scheduled shown");
eq(SF.hoursTxt(f2("Sanuj W")),"worked 2.1 h · scheduled 30 h","2.07 rounds in the label, math uses worked");
eq(f2("Sanuj W").wk,2.07,"worked value kept");
eq(SF.hoursTxt(f2("Christian M")),"scheduled 7 h","blank worked stays scheduled");
no(f2("Sophia F").warn,/week hours not in Sheet/,"a worked row is not 'not in Sheet'");
// 13. A "mgr …" label copied onto crew or week-hours rows is not a cover shift.
const plain=base(grill("2026-11-03",t(16),t(22)),[C("Ana R"),C("Ben T")],[K("Ana R","GRILL REGULAR MENU",3),K("Ben T","GRILL REGULAR MENU",4)],[H("Ana R",10),H("Ben T",12)]);
const tagged=base(grill("2026-11-03",t(16),t(22)),[C("Ana R",{shift:"mgr 2p-9p"}),C("Ben T",{shift:"mgr 5a-1p"})],[K("Ana R","GRILL REGULAR MENU",3),K("Ben T","GRILL REGULAR MENU",4)],[Object.assign(H("Ana R",10),{shift:"mgr 2p-9p"}),Object.assign(H("Ben T",12),{shift:"mgr 5a-1p"})]);
eq(tagged.ok.map(o=>o.name),plain.ok.map(o=>o.name),"mgr shift text does not change who can cover");
eq(tagged.ok.map(o=>o.wk),plain.ok.map(o=>o.wk),"mgr shift text does not change hours");
eq(tagged.ok.map(o=>o.left),plain.ok.map(o=>o.left),"mgr shift text does not change hours left");
console.log(`${n-f}/${n} passed`);process.exit(f?1:0);
