import {readFile,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {sync} from "./sync_ffcv.mjs";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const output=resolve(root,"data/league.json");
const statusPath=resolve(root,"data/sync-status.json");
const publishedUrl="https://antoine80.github.io/cantera-g4/data/league.json";

export function verified(d,now=new Date()){
 if(!d||d.season!=="2026-2027"||d.competitionCode!=="905432332"||
 d.groupCode!=="905432336"||d.syncStatus!=="verified"||
 !Array.isArray(d.importedRounds)||d.importedRounds.length!==9||
 !Array.from({length:9},(_,i)=>i+1).every(n=>d.importedRounds.includes(n))||
 !Array.isArray(d.teams)||d.teams.length<9||d.teams.length>16||
 !Array.isArray(d.matches)||!Array.isArray(d.byes))return false;
 const ids=new Set(d.teams.map(t=>t.id)),codes=new Set(d.teams.map(t=>String(t.ffcvId)));
 if(ids.size!==d.teams.length||codes.size!==d.teams.length)return false;
 const stamped=Date.parse(d.updatedAt||"");
 if(!Number.isFinite(stamped)||stamped<Date.parse("2026-10-01T00:00:00Z")||
 stamped>now.getTime()+5*60*1000)return false;
 for(let n=1;n<=9;n++){
   const matches=d.matches.filter(m=>m.round===n),byes=d.byes.filter(b=>b.round===n);
   if(matches.length<4||matches.length>8||byes.length>1)return false;
   const used=[...matches.flatMap(m=>[m.home,m.away]),...byes.map(b=>b.team)];
   if(new Set(used).size!==used.length||used.some(id=>!ids.has(id)))return false;
 }
 return true;
}
export function failState(error,date=new Date(),lastSuccess=null){
 const msg=String(error?.message||error);
 const code=/\b403\b/.test(msg)?"HTTP_403":
  /\b429\b/.test(msg)?"HTTP_429":
  /\b503\b/.test(msg)?"HTTP_503":
  /timeout|abort|timed out/i.test(msg)?"TIMEOUT":"SYNC_ERROR";
 return {state:"stale",attemptedAt:date.toISOString(),lastSuccessAt:lastSuccess,errorCode:code,
 message:code==="HTTP_403"?"FFCV está rechazando la consulta automática (HTTP 403).": 
  "No se ha podido completar la consulta a FFCV."};
}
async function fetchPublished(fetchImpl=fetch,now=new Date()){
 try{
   const r=await fetchImpl(publishedUrl+"?t="+Date.now(),
    {cache:"no-store",signal:AbortSignal.timeout(12000)});
   if(!r.ok)throw Error("HTTP "+r.status);
   const content=await r.text();
   if(content.length>1200000)throw Error("JSON publicado demasiado grande");
   const value=JSON.parse(content);
   if(!verified(value,now))throw Error("El JSON publicado no supera la validación");
   return value;
 }catch(e){console.warn("Copia publicada no disponible:",e.message);return null}
}
export async function publish({fetcher=fetch,synchronizer=sync,now=new Date(),read=readFile,write=writeFile}={}){
 let baseline=await fetchPublished(fetcher,now);
 const source=JSON.parse(await read(output,"utf8"));
 if(verified(source,now)&&(!baseline||Date.parse(source.updatedAt)>Date.parse(baseline.updatedAt)))
   baseline=source;
 if(baseline){
   // El repositorio contiene inicialmente solo J1 y J9; preservar el JSON completo publicado.
   await write(output,JSON.stringify(baseline,null,2)+"\n");
   console.log("Copia válida preservada desde",baseline.updatedAt,baseline.teams.length,"equipos");
 }
 try{
   const updated=await synchronizer({dryRun:false,output,now});
   if(!verified(updated,now))throw Error("La sincronización no produjo datos completos");
   const status={state:"ok",attemptedAt:now.toISOString(),lastSuccessAt:updated.updatedAt,
       errorCode:null,message:"Datos comprobados y actualizados desde FFCV."};
   await write(statusPath,JSON.stringify(status,null,2)+"\n");
   console.log("Sincronización exitosa:",updated.updatedAt);
   return status;
 }catch(error){
   if(!baseline)throw Error("FFCV no responde y no existe una copia pública verificada; se conserva la publicación anterior.",{cause:error});
   const status=failState(error,now,baseline.updatedAt);
   await write(statusPath,JSON.stringify(status,null,2)+"\n");
   console.warn("SIN ACTUALIZAR:",status.errorCode,"último dato:",status.lastSuccessAt);
   return status;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 publish().catch(e=>{console.error("PUBLICACIÓN NO MODIFICADA:",e.message);process.exitCode=1});
}
