// Loads tabs from published CSV (if configured) or bundled sample JSON.
(function(){
function parseCSV(t){const rows=[];let r=[],f="",q=false;for(let i=0;i<t.length;i++){const c=t[i];
 if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
 else if(c=='"')q=true;else if(c==','){r.push(f);f=""}else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;r.push(f);rows.push(r);r=[];f=""}else f+=c}
 if(f||r.length){r.push(f);rows.push(r)}const h=rows.shift()||[];
 return rows.filter(x=>x.some(v=>v!=="")).map(x=>Object.fromEntries(h.map((k,i)=>[k.trim(),x[i]||""])))}
async function load(tab){const url=(window.SHIFTHUB_CONFIG.csv||{})[tab];
 if(url){try{const r=await fetch(url,{cache:"no-store"});if(r.ok)return{rows:parseCSV(await r.text()),live:true}}catch(e){}}
 if(tab==="Meta")return{rows:[],live:false};
 const r=await fetch("data/sample/"+tab.toLowerCase()+".json");return{rows:await r.json(),live:false}}
window.ShiftData={load,parseCSV};
})();
