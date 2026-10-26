/* Live public API cards with an independently dated same-origin fallback. */
(function(){
'use strict';
const D=window.MacroData,$=id=>document.getElementById(id);
let snapshot={schemaVersion:1,sources:{}},active='us',onUpdate=()=>{},busy=false;
const labels={growth:'Real GDP growth',inflation:'CPI inflation · YoY',policy:'Policy-rate series'};
const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function policyLabel(){return active==='cn'?'1Y loan prime rate (LPR)':active==='eu'?'ECB deposit facility rate':'Policy-rate series';}
function oldObservation(key,date){const start=key==='growth'?date+'-12-31':key==='inflation'?date+'-28':date;const age=(Date.now()-Date.parse(start+'T00:00:00Z'))/86400000;return age>(key==='growth'?550:key==='inflation'?105:14);}
function getCurve(key){const source=key==='us'?'fed':key==='eu'?'ecb':null;const entry=snapshot.sources[source];return entry?{...entry.data,fetchedAt:entry.fetchedAt,refreshStatus:entry.status,apiUrl:entry.url}:null;}
function render(){
  $('official-cards').replaceChildren(...['growth','inflation','policy'].map(key=>{
    const entry=snapshot.sources[key],r=entry?.data?.[active],card=make('article',undefined,'official-card');
    card.append(make('h3',key==='policy'?policyLabel():labels[key]),make('strong',r?fmt(r.value)+'%':'Unavailable','official-value'));
    card.append(make('p',r?'Observation: '+r.date+' · '+D.SOURCES[key].frequency:'No verified observation for this market.','small'));
    if(r?.previous)card.append(make('p','Previous: '+fmt(r.previous.value)+'% ('+r.previous.date+') · '+(r.value-r.previous.value>=0?'+':'')+fmt(r.value-r.previous.value)+' pp','official-change'));
    const a=make('a',D.SOURCES[key].label+' ↗');a.href=D.SOURCES[key].page;a.target='_blank';a.rel='noopener noreferrer';card.append(a);
    const state=r?(entry.status==='cached'?'Cached · latest refresh failed':oldObservation(key,r.date)?'Older observation · check next release':'Latest available from source'):'Source unavailable';
    card.append(make('p',state,'source-state'+(!r||entry.status==='cached'||oldObservation(key,r.date)?' stale':'')));
    if(entry)card.append(make('p','Retrieved: '+new Date(entry.fetchedAt).toISOString().replace('T',' ').slice(0,19)+' UTC','retrieved'));
    if(key==='policy'&&r){const detail=make('details');detail.append(make('summary','Series definition'));detail.append(make('p',r.definition,'small'));card.append(detail);}
    return card;
  }));
  const c=getCurve(active);
  $('curve-coverage').textContent=c?c.provider+' · observation '+c.date+' · '+c.frequency+'. Retrieved '+c.fetchedAt+'. '+(c.refreshStatus==='cached'?'Cached: latest refresh failed. ':'')+((Date.now()-Date.parse(c.date))/86400000>14?'Older curve: check the source release. ':'')+c.method:'No automated, convention-verified zero curve is connected for this market. The pricing curve remains a clearly marked illustrative or user-entered assumption. Macro indicators above are independent API observations.';
  $('feed-status').textContent=busy?'Contacting World Bank, BIS and ECB…':Object.keys(snapshot.sources).length?'Source dates differ. Annual GDP is structural context, not a current-quarter growth signal. China’s LPR is not comparable to an overnight policy rate.':'Official feeds are unavailable. Refresh to retry; example curves are never presented as retrieved data.';
  $('refresh-data').disabled=busy;
}
async function refresh(){
  if(busy)return;busy=true;render();
  await Promise.all(['growth','inflation','policy','ecb'].map(async key=>{try{snapshot.sources[key]=await D.fetchSource(key,fetch,22000);}catch(e){if(snapshot.sources[key])snapshot.sources[key]={...snapshot.sources[key],status:'cached',lastError:e.message,lastAttemptAt:new Date().toISOString()};}}));
  busy=false;snapshot.generatedAt=new Date().toISOString();render();onUpdate();
}
function setMarket(key){active=key;render();}
function memoLines(key){
 const lines=['','## Retrieved macro observations'];
 for(const name of ['growth','inflation','policy']){const entry=snapshot.sources[name],r=entry?.data?.[key];lines.push(r?'- '+labels[name]+': '+r.value+'%, observation '+r.date+'; retrieved '+entry.fetchedAt+'; '+entry.status+'. Source: '+D.SOURCES[name].page:'- '+labels[name]+': unavailable.');if(name==='policy'&&r)lines.push('  Definition: '+r.definition);}
 lines.push('Different release calendars and frequencies; annual GDP is not a nowcast. Macro data do not automatically set the scenario shocks.');
 return lines;
}
async function init(options){
 onUpdate=options.onUpdate;
 $('refresh-data').addEventListener('click',refresh);
 $('export-provenance').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download='macro-data-provenance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 try{const r=await fetch('/data/macro-snapshot.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Snapshot unavailable');snapshot=D.validateSnapshot(await r.json());render();onUpdate();}catch{render();}
 await refresh();
}
window.MacroFeed=Object.freeze({init,setMarket,getCurve,memoLines});
})();
