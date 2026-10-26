import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Data from '../assets/macro-data.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'data','macro-snapshot.json');
let previous={schemaVersion:1,sources:{}};
try{previous=Data.validateSnapshot(JSON.parse(await fs.readFile(destination,'utf8')));}catch{}
const snapshot={schemaVersion:1,generatedAt:new Date().toISOString(),sources:{...previous.sources}};
let missing=false;
await Promise.all(Object.keys(Data.SOURCES).map(async key=>{
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
    try{snapshot.sources[key]=await Data.fetchSource(key,fetch,45000);console.log(key+': fetched '+snapshot.sources[key].fetchedAt);return;}
    catch(error){lastError=error.message;if(!attempt)await new Promise(resolve=>setTimeout(resolve,1200));}
  }
  if(snapshot.sources[key]){snapshot.sources[key]={...snapshot.sources[key],status:'cached',lastAttemptAt:snapshot.generatedAt,lastError};console.warn(key+': retained previous dated observations after '+lastError);}
  else{missing=true;console.error(key+': no verified data available ('+lastError+')');}
}));
if(missing){throw new Error('Incomplete initial dataset; existing snapshot was not overwritten.');}
Data.validateSnapshot(snapshot);
await fs.mkdir(path.dirname(destination),{recursive:true});
const temporary=destination+'.tmp';
await fs.writeFile(temporary,JSON.stringify(snapshot,null,2)+'\n');
await fs.rename(temporary,destination);
console.log('Saved '+destination);
