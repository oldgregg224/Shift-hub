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
console.log(`${n-f}/${n} passed`);process.exit(f?1:0);
