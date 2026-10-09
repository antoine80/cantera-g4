import {readFile,writeFile,rename} from "node:fs/promises";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const DEST=join(ROOT,"data","league.json");
const ENDPOINT="https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php";
export const SETTINGS=Object.freeze({
 cod_temporada:"22",cod_competicion:"905432332",cod_grupo:"905432336",
 grupo_nombre:"F.C. - Grup 4",competicion_nombre:"Segona FFCV Benjamí 1r. any Alacant"
});
const scoreRegex=/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/;
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
export function urlForRound(n){
 if(!Number.isInteger(n)||n<1||n>9)throw Error("Jornada fuera de rango");
 return ENDPOINT+"?"+new URLSearchParams({...SETTINGS,cod_jornada:String(n)});
}
export function parseDate(input){
 const m=/^(\d{2})\/(\d{2})\/(2026|2027)$/.exec(String(input));
 if(!m)throw Error("Fecha inesperada: "+input);
 const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));
 if(d.getUTCDate()!==+m[1]||d.getUTCMonth()!==+m[2]-1)throw Error("Fecha imposible");
 return m[3]+"-"+m[2]+"-"+m[1];
}
export function parseRound(raw,n,teams){
 if(!raw||String(raw.jornada)!==String(n)||!Array.isArray(raw.partidos)||raw.partidos.length!==5)
   throw Error("Estructura incompatible en J"+n);
 const matches=[],byes=[],used=[];
 for(const p of raw.partidos){
   const hc=String(p.cod_equipo_local??""),ac=String(p.cod_equipo_visitante??"");
   const h=hc==="-1"?null:teams.get(hc),a=ac==="-1"?null:teams.get(ac);
   if((hc!=="-1"&&!h)||(ac!=="-1"&&!a)||(!h&&!a))throw Error("Equipo ajeno al grupo en J"+n);
   const date=parseDate(p.fecha);
   if(!h||!a){
     if(![p.local,p.visitante].some(v=>String(v).trim().toLowerCase()==="descansa"))
       throw Error("Descanso no identificado J"+n);
     const id=h||a;used.push(id);byes.push({round:n,team:id,date});continue;
   }
   const time=String(p.hora??"").trim();
   if(time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error("Hora incorrecta J"+n);
   const sourceState=String(p.estado??"").trim(),sourceResult=String(p.resultado??"").trim();
   const score=scoreRegex.exec(sourceResult),complete=sourceState==="1"&&!!score;
   used.push(h,a);
   matches.push({round:n,date,time:time||null,home:h,away:a,
     homeScore:complete?Number(score[1]):null,awayScore:complete?Number(score[2]):null,
     status:complete?"finished":sourceState==="0"?"scheduled":"unverified",
     venue:String(p.campo??"").trim(),actaId:String(p.codacta??""),
     sourceState,sourceResult});
 }
 if(matches.length!==4||byes.length!==1||used.length!==9||new Set(used).size!==9)
   throw Error("Participantes incompletos o duplicados en J"+n);
 return {matches:matches.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||"").localeCompare(b.time||"")),byes};
}
export function buildLeague(base,answers,now=new Date()){
 if(base.season!=="2026-2027"||base.competitionCode!==SETTINGS.cod_competicion||base.groupCode!==SETTINGS.cod_grupo||base.teams.length!==9)
   throw Error("Competición incorrecta");
 const teams=new Map(base.teams.map(t=>[String(t.ffcvId),t.id]));
 if(teams.size!==9||new Set(teams.values()).size!==9)throw Error("Nueve equipos distintos necesarios");
 if(!(answers instanceof Map)||answers.size!==9)throw Error("Se necesitan nueve jornadas completas");
 const all=[];
 for(let n=1;n<=9;n++){if(!answers.has(n))throw Error("Falta jornada "+n);all.push(parseRound(answers.get(n),n,teams))}
 return {...base,matches:all.flatMap(x=>x.matches),byes:all.flatMap(x=>x.byes),
   importedRounds:[1,2,3,4,5,6,7,8,9],syncStatus:"verified",
   source:"FFCV — respuestas JSON del sitio oficial",updatedAt:now.toISOString()};
}
export function answersFromHar(har){
 const answers=new Map();
 for(const entry of har?.log?.entries??[]){
   let u;try{u=new URL(entry?.request?.url)}catch{continue}
   if(u.origin!=="https://ffcv.es"||u.pathname!==new URL(ENDPOINT).pathname||
      ["cod_temporada","cod_competicion","cod_grupo"].some(k=>u.searchParams.get(k)!==SETTINGS[k]))continue;
   const n=Number(u.searchParams.get("cod_jornada"));
   if(!Number.isInteger(n)||n<1||n>9||entry.response?.status!==200)continue;
   const c=entry.response?.content;
   if(typeof c?.text!=="string")continue;
   const body=c.encoding==="base64"?Buffer.from(c.text,"base64").toString("utf8"):c.text;
   answers.set(n,JSON.parse(body.replace(/^\uFEFF/,"")));
 }
 return answers;
}
export async function fetchRound(n,fetchImpl=fetch){
 const u=urlForRound(n);
 for(let attempt=1;attempt<=3;attempt++){
   try{
     const response=await fetchImpl(u,{headers:{Accept:"application/json",Referer:"https://ffcv.es/competiciones/"},
       signal:AbortSignal.timeout(20000)});
     if(!response.ok)throw Error("HTTP "+response.status);
     const body=await response.text();
     if(body.length>1000000)throw Error("Respuesta excesiva");
     return JSON.parse(body.replace(/^\uFEFF/,""));
   }catch(error){
     if(attempt===3)throw Error("Jornada "+n+": "+error.message,{cause:error});
     await pause(attempt*1200);
   }
 }
}
export async function sync({fetcher=fetchRound,dryRun=true,output=DEST,delay=1200,now=new Date()}={}){
 const base=JSON.parse(await readFile(DEST,"utf8")),answers=new Map();
 for(let n=1;n<=9;n++){answers.set(n,await fetcher(n));if(delay&&n<9)await pause(delay)}
 const next=buildLeague(base,answers,now);
 if(!dryRun){
   const temp=output+".tmp";
   await writeFile(temp,JSON.stringify(next,null,2)+"\n","utf8");
   await rename(temp,output);
 }
 return next;
}
async function main(){
 const args=process.argv.slice(2);
 if(args.some(x=>!["--dry-run","--write"].includes(x)))throw Error("Opción desconocida");
 if(args.includes("--write")&&args.includes("--dry-run"))throw Error("Elige una modalidad");
 const write=args.includes("--write");
 console.log(write?"Sincronización con escritura":"Diagnóstico sin modificar archivos");
 const d=await sync({dryRun:!write});
 console.log("Validación completa:",d.importedRounds.length,"jornadas,",d.matches.length,"partidos,",d.byes.length,"descansos");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error("SIN CAMBIOS:",e.message);process.exitCode=1});
}
