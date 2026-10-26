const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../assets/macro-data.js'), E=require('../assets/rates-engine.js');
const fs=require('node:fs'),vm=require('node:vm');
const snap=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../data/macro-snapshot.json'),'utf8'));
const wb=(rows,pages=1)=>JSON.stringify([{pages,lastupdated:'2026-10-08'},rows]);
const g=(country,value,date)=>({countryiso3code:country,value,date,indicator:{id:'NY.GDP.MKTP.KD.ZG'}});
const bis=(kind,rows)=>'DATAFLOW,FREQ,REF_AREA,UNIT_MEASURE,TIME_PERIOD,OBS_VALUE,UNIT_MULT,OBS_STATUS,COMPILATION\n'+rows.map(r=>[kind==='policy'?'BIS:WS_CBPOL(1.0)':'BIS:WS_LONG_CPI(1.0)',kind==='policy'?'D':'M',r.area||'CN',kind==='policy'?'368':'771',r.date,r.value,r.mult||'0','A','1-year loan prime rate'].join(',')).join('\n');
function ecb(rows){return 'KEY,INSTRUMENT_FM,PROVIDER_FM_ID,DATA_TYPE_FM,TIME_PERIOD,OBS_VALUE,UNIT,UNIT_MULT,OBS_STATUS\n'+rows.map(r=>['k','G_N_A','SV_C_YM',r.t===.5?'SR_6M':'SR_'+r.t+'Y',r.date,r.value,'PCPA','0','A'].join(',')).join('\n');}
test('CSV quoted fields, embedded newlines, escaped quotes and zero survive parsing',()=>{
 assert.deepEqual(D.csv('\uFEFFa,b,c\r\n"x,y","multi\nline","say ""yes"""\r\n0,,2'),[['a','b','c'],['x,y','multi\nline','say "yes"'],['0','','2']]);
 assert.throws(()=>D.csv('"unfinished'),/Unclosed/);
});
test('GDP identifies euro area by ISO3, retains zero, skips null and rejects incomplete pages',()=>{
 const result=D.parseGrowth(wb([g('EMU',0,'2025'),g('EMU',null,'2026'),g('EMU',1.2,'2024')]));
 assert.equal(result.eu.value,0);assert.equal(result.eu.previous.value,1.2);assert.equal(result.eu.date,'2025');
 assert.throws(()=>D.parseGrowth(wb([g('USA',1,'2025')],2)),/incomplete/);
});
test('BIS sorts dates, retains zero and preserves the LPR definition',()=>{
 const data=D.parseBIS(bis('policy',[{date:'2026-10-19',value:1},{date:'2026-10-20',value:0}]),'policy');
 assert.equal(data.cn.value,0);assert.equal(data.cn.previous.value,1);assert.match(data.cn.definition,/loan prime/);
});
test('BIS rejects wrong units, invalid dates and duplicate observations',()=>{
 assert.throws(()=>D.parseBIS(bis('policy',[{date:'2026-10-20',value:1,mult:'2'}]),'policy'),/units/);
 assert.throws(()=>D.parseBIS(bis('policy',[{date:'2026-02-30',value:1}]),'policy'),/frequency/);
 assert.throws(()=>D.parseBIS(bis('policy',[{date:'2026-10-20',value:1},{date:'2026-10-20',value:2}]),'policy'),/Duplicate/);
});
test('ECB selects the most recent complete common-date curve, never mixed dates',()=>{
 const rows=D.TENORS.map(t=>({t,date:'2026-10-20',value:2}));rows.push({t:1,date:'2026-10-21',value:3});
 const curve=D.parseECB(ecb(rows));assert.equal(curve.date,'2026-10-20');
 assert.equal(curve.points.length,7);assert.ok(Math.abs(curve.points[0].yield-(Math.exp(.02)-1)*100)<1e-12);
 assert.throws(()=>D.parseECB(ecb(rows.slice(1))),/complete/);
});
test('Continuous to annual-effective conversion preserves discount factors including negative rates',()=>{
 for(const z of [-1,0,2,5])for(const t of [.5,10,30])assert.ok(Math.abs(Math.exp(-z/100*t)-Math.pow(1+D.annualEffective(z)/100,-t))<1e-12);
});
test('Fed curve uses Svensson only for 6M and skips incomplete latest rows',()=>{
 const headers=['Date','BETA0','BETA1','BETA2','BETA3','TAU1','TAU2',...D.TENORS.slice(1).map(t=>'SVENY'+String(t).padStart(2,'0'))];
 const row=['2026-10-20',3,0,0,0,1,2,...D.TENORS.slice(1).map(()=>4)];
 const partial=['2026-10-21',3,0,0,0,1,2,4];
 const curve=D.parseFed('Research metadata\n'+headers.join(',')+'\n'+row.join(',')+'\n'+partial.join(','));
 assert.equal(curve.date,'2026-10-20');assert.equal(curve.rawPoints[0].yield,3);assert.equal(curve.rawPoints[1].yield,4);
 assert.match(curve.method,/extrapolation/);
});
test('Fetcher negotiates the BIS CSV media type and rejects HTTP failures',async()=>{
 let accept;await D.fetchSource('policy',async(url,options)=>{accept=options.headers.Accept;return{ok:true,text:async()=>bis('policy',['US','XM','GB','JP','CN'].map(area=>({area,date:'2026-10-20',value:2})))};});
 assert.equal(accept,'application/vnd.sdmx.data+csv;version=1.0.0');
 await assert.rejects(D.fetchSource('growth',async()=>({ok:true,text:async()=>wb([g('USA',2,'2025')])})),/Incomplete five-market/);
 await assert.rejects(D.fetchSource('ecb',async()=>({ok:false,status:503})),/HTTP 503/);
});
test('Checked-in snapshot contains five-market observations and two valid pricing curves',()=>{
 D.validateSnapshot(snap);
 for(const source of ['growth','inflation','policy'])assert.deepEqual(Object.keys(snap.sources[source].data).sort(),['cn','eu','jp','uk','us']);
 for(const source of ['fed','ecb']){
 const curve=snap.sources[source].data;assert.equal(curve.points.length,7);
 const price=E.analyze(curve.points,{maturity:10,coupon:3,frequency:2,face:100},{parallel:25,steepness:0,belly:0},1000000);
 assert.ok(price.base.price>0);assert.ok(price.pnl<0);
 }
 const bad=structuredClone(snap);bad.sources.fed.data.points[0].yield=null;assert.throws(()=>D.validateSnapshot(bad),/Invalid curve/);
});
test('Browser refresh failure retains dated observations and clearly marks them cached',async()=>{
 const nodes=new Map(),node=()=>({children:[],append(...v){this.children.push(...v);},replaceChildren(...v){this.children=v;},addEventListener(){},textContent:''});
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
 const context={window:{MacroData:{...D,fetchSource:async()=>{throw Error('offline');}}},document:doc,fetch:async()=>({ok:true,json:async()=>structuredClone(snap)}),AbortSignal,Date,console};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/macro-feed.js'),'utf8'),context);
 let updates=0;await context.window.MacroFeed.init({onUpdate(){updates++;}});
 assert.equal(updates,2);assert.equal(context.window.MacroFeed.getCurve('eu').date,snap.sources.ecb.data.date);
 assert.equal(context.window.MacroFeed.getCurve('eu').refreshStatus,'cached');
 assert.match(context.window.MacroFeed.memoLines('us').join('\n'),/cached/);
 assert.equal(nodes.get('refresh-data').disabled,false);
});
