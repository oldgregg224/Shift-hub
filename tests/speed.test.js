// node tests/speed.test.js — Speed day selection (today's OEPE, not a later PREP/last-week row).
const P=require("../js/present.js");
let n=0,f=0;
const eq=(a,b,m)=>{n++;const ok=JSON.stringify(a)===JSON.stringify(b);if(!ok){f++;console.log("FAIL",m,"\n  got",JSON.stringify(a),"\n  want",JSON.stringify(b))}};
const ok=(c,m)=>{n++;if(!c){f++;console.log("FAIL",m)}};
// Live Speed shape from 2026-11-22: hourly DATA rows have oepe_sec and blank total_time_sec.
// A PREP row for the next day carries only last_week_oepe_sec. That must not hide today.
const rows=[
 {row_type:"DATA",date:"2026-11-21",hour:"ALL",oepe_sec:"137",total_time_sec:"",last_week_oepe_sec:"",slow_flag:"Y"},
 {row_type:"DATA",date:"2026-11-22",hour:"05:00",oepe_sec:"100",total_time_sec:"",last_week_oepe_sec:"169",slow_flag:"N",sales:"67.29",sales_proj:"62",hours:"3",hours_need:"1.5"},
 {row_type:"DATA",date:"2026-11-22",hour:"06:00",oepe_sec:"61",total_time_sec:"",last_week_oepe_sec:"132",slow_flag:"N",sales:"69.91",sales_proj:"67",hours:"3"},
 {row_type:"DATA",date:"2026-11-22",hour:"07:00",oepe_sec:"72",total_time_sec:"",last_week_oepe_sec:"71",slow_flag:"N",sales:"62.45",sales_proj:"96",hours:"3.28"},
 {row_type:"DATA",date:"2026-11-22",hour:"08:00",oepe_sec:"71",total_time_sec:"",last_week_oepe_sec:"112",slow_flag:"N",sales:"193.57",sales_proj:"195",hours:"2"},
 {row_type:"DATA",date:"2026-11-22",hour:"ALL",oepe_sec:"71",total_time_sec:"",last_week_oepe_sec:"111",slow_flag:"N",sales:"393.22",sales_proj:"420",hours:"11.28",hours_need:"1.5"},
 {row_type:"NOTE",date:"2026-11-16",hour:"ALL",pre_rush_positioning_note:"note only"},
 {row_type:"PREP",date:"2026-11-23",hour:"11:00",oepe_sec:"",total_time_sec:"",last_week_oepe_sec:"95",last_week_total_sec:"114"}
];
const s=P.speedSlice(rows,"2026-11-22");
eq(s.date,"2026-11-22","today wins over tomorrow's PREP row");
eq(s.hasTimes,true,"oepe_sec counts even when total_time_sec is blank");
eq(s.hours.map(o=>o.h),[5,6,7,8],"today's hours only");
eq(s.hours.map(o=>o.x.oepe_sec),["100","61","72","71"],"today's OEPE");
eq(s.total&&s.total.oepe_sec,"71","day total is today's ALL row");
ok(!s.hours.some(o=>o.x.row_type==="PREP"),"PREP is not an hour");
// A saved copy from another day, while a live fetch is still in flight, must not paint.
eq(P.paintHold({refreshing:true,src:"live"},false),true,"hold stale day while checking");
eq(P.paintHold({refreshing:true,src:"live"},true),false,"today's rows can paint while checking");
eq(P.paintHold({refreshing:true,src:"cached"},false),false,"failed refresh still shows the saved copy");
eq(P.paintHold({src:"sample"},false),false,"sample data is not a hold");
// No current times anywhere: do not invent a day from last-week-only rows.
const lw=P.speedSlice([{row_type:"PREP",date:"2026-11-23",hour:"11:00",last_week_oepe_sec:"95"}],"2026-11-22");
eq(lw.date,"","no day from a PREP row");
eq(lw.hasTimes,false,"last-week-only is not today's times");
const blurbs=P.smgBlurbs("Week note. New 11/21 11:16 AM comment (visit 11/21 11:59 AM, 1/5, channel not shown): Fries came out raw and were not remade. New 11/21 11:28 AM comment (visit 11/21 11:59 AM, 1/5, channel not shown): Never received the soft drink. New 11/21 2:30 PM comment (visit 11/15 1:32 PM, 5/5, channel not shown): Store was running better. Focus: honor fry requests.","2026-11-22",7);
eq(blurbs.map(b=>b.time),["2:30 PM","11:28 AM","11:16 AM"],"SMG blurbs in the last 7 days, newest first");
eq(blurbs.map(b=>b.score),["5","1","1"],"score from the visit note");
eq(blurbs[0].sentiment,"positive","5/5 is positive");
eq(blurbs[2].comment,"Fries came out raw and were not remade.","comment text stops before the next blurb");
ok(!/Focus:/.test(blurbs.map(b=>b.comment).join(" ")),"coaching instructions are not a comment");
eq(P.smgBlurbs("New 10/30 1:00 PM comment (visit 10/30 1:00 PM, 2/5): Old visit.","2026-11-22",7).length,0,"outside the window stays out");
const tail=P.smgBlurbs("New 11/16 6:16 PM comment (visit 11/16 7:13 PM, 5/5): very good. Ten new 11/15 evening comments (all 5/5): a long recap. Focus: honor fry requests.","2026-11-22",7);
eq(tail.length,1,"one dated comment");
eq(tail[0].comment,"very good.","recap after the comment is not part of it");
// A shift column, including a mgr label, must not change which day or hour is shown.
const tagged=rows.map(r=>Object.assign({},r,{shift:"2026-11-22 6a-2p"}));
const s2=P.speedSlice(tagged,"2026-11-22");
eq(s2.date,s.date,"shift column does not change the speed day");
eq(s2.hours.map(o=>o.h),s.hours.map(o=>o.h),"shift column does not change the hours");
eq(s2.total&&s2.total.oepe_sec,"71","day total stays today's ALL row");
const mgrHour=P.speedSlice([{row_type:"DATA",date:"2026-11-22",hour:"mgr 2p-9p",oepe_sec:"80",shift:"mgr 2p-9p"}],"2026-11-22");
eq(mgrHour.hours,[],"a mgr label is not a speed hour");
eq(mgrHour.date,"","a mgr row does not invent a speed day");
eq(mgrHour.hasTimes,false,"a mgr row is not today's times");
console.log(`${n-f}/${n} passed`);
process.exit(f?1:0);
