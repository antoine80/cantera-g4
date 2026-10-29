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
const TOKEN_PAGE="https://ffcv.es/competiciones/";
export async function getPageSession(fetchImpl=fetch){
 const response=await fetchImpl(TOKEN_PAGE,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Object.assign(new Error("No se puede consultar la página de FFCV: HTTP "+response.status),{status:response.status});
 const html=await response.text();
 // FFCV entrega un token de página y cookie(s) para la sesión HTTP en curso.
 const meta=html.match(/<meta\s+name=["']ffcv-pt["']\s+content=["']([a-f0-9]{64})["']/i);
 if(!meta)throw Error("La portada FFCV no incluye el token esperado");
 // Solo reutilizar la cookie emitida por la misma respuesta oficial y el mismo origen.
 // No registrar ni persistir estos valores. getSetCookie está disponible en Node 22.
 const pairs=(response.headers?.getSetCookie?.()??[])
  .map(v=>v.split(";")[0].trim())
  .filter(v=>/^[a-zA-Z0-9_!#$%&'*+.^`|~-]+=[^;\r\n]+$/.test(v));
 return {token:meta[1],cookie:pairs.join("; ")};
}
export async function getPageToken(fetchImpl=fetch){
 return (await getPageSession(fetchImpl)).token;
}
function withPageSession(tokenOrSession){
 const session=typeof tokenOrSession==="string"?{token:tokenOrSession}:tokenOrSession;
 const headers={Accept:"application/json",Referer:TOKEN_PAGE,"X-Requested-With":"XMLHttpRequest"};
 if(session?.token)headers["X-FFCV-Page-Token"]=session.token;
 if(session?.cookie)headers.Cookie=session.cookie;
 return headers;
}


const IMAGE_ORIGIN="https://appwebffcv.novanet.es";
export function crestUrl(value){
 if(typeof value!=="string"||!value.trim())return null;
 const raw=value.trim();
 if(raw.startsWith("//")||(!raw.startsWith("/")&&!raw.startsWith("https://")))return null;
 let url;try{url=new URL(raw,IMAGE_ORIGIN)}catch{return null}
 if(url.protocol!=="https:"||!["ffcv.es","appwebffcv.novanet.es"].includes(url.hostname)||
    !url.pathname.startsWith("/pnfg/")||url.username||url.password)return null;
 return IMAGE_ORIGIN+url.pathname+url.search;
}
export function parseOfficial(raw,baseTeams){
 if(!raw||String(raw.codigo_grupo)!==SETTINGS.cod_grupo||
    String(raw.codigo_competicion)!==SETTINGS.cod_competicion||
    !Array.isArray(raw.clasificacion)||raw.clasificacion.length!==baseTeams.length)throw Error("Clasificación oficial ajena o incompleta");
 const codes=new Map(baseTeams.map(t=>[String(t.ffcvId),t]));
 const ranks=new Set(),used=new Set();
 function integer(v,label,allowNegative=false){
   if(!/^-?\d{1,5}$/.test(String(v)))throw Error("Estadística FFCV incompatible: "+label);
   const n=Number(v);if(!Number.isSafeInteger(n)||(!allowNegative&&n<0))throw Error("Estadística negativa: "+label);
   return n;
 }
 const rows=raw.clasificacion.map(p=>{
   const id=String(p.codequipo),team=codes.get(id),rank=integer(p.posicion,"posición");
   if(!team||rank<1||rank>baseTeams.length||ranks.has(rank)||used.has(id))throw Error("Equipo o posición incorrectos en clasificación oficial");
   used.add(id);ranks.add(rank);
   return {id:team.id,name:team.name,rank,
     PTS:integer(p.puntos,"puntos",true),PJ:integer(p.jugados,"PJ"),
     PG:integer(p.ganados,"PG"),PE:integer(p.empatados,"PE"),
     PP:integer(p.perdidos,"PP"),GF:integer(p.goles_a_favor,"GF"),
     GC:integer(p.goles_en_contra,"GC"),crestUrl:crestUrl(p.url_img)};
 }).sort((a,b)=>a.rank-b.rank);
 const round=Number(raw.jornada);
 return {rows,round:Number.isInteger(round)&&round>=1&&round<=9?round:null};
}
export async function fetchOfficialClassification(fetchImpl=fetch,token){
 const url=new URL("https://ffcv.es/competiciones/api/clasificaciones/clasificaciones_ajax.php");
 url.searchParams.set("cod_grupo",SETTINGS.cod_grupo);
 url.searchParams.set("cod_jornada","9");
 const headers=withPageSession(token);
 const response=await fetchImpl(url,{headers,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("Clasificación FFCV: HTTP "+response.status);
 const text=await response.text();
 if(text.length>1000000)throw Error("Clasificación FFCV demasiado grande");
 return JSON.parse(text.replace(/^\uFEFF/,""));
}

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
 if(!raw||String(raw.jornada)!==String(n)||!Array.isArray(raw.partidos)||
    raw.partidos.length<4||raw.partidos.length>9)
   throw Error("Estructura incompatible en J"+n);
 const matches=[],byes=[],used=[],crests=[];
 for(const p of raw.partidos){
   const hc=String(p.cod_equipo_local??""),ac=String(p.cod_equipo_visitante??"");
   const h=hc==="-1"?null:teams.get(hc),a=ac==="-1"?null:teams.get(ac);
   if((hc!=="-1"&&!h)||(ac!=="-1"&&!a)||(!h&&!a))throw Error("Equipo ajeno al grupo en J"+n);
   const date=parseDate(p.fecha);
   if(h&&crestUrl(p.escudo_local))crests.push({id:h,url:crestUrl(p.escudo_local)});
   if(a&&crestUrl(p.escudo_visitante))crests.push({id:a,url:crestUrl(p.escudo_visitante)});
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
 if(matches.length<4||matches.length>8||byes.length>1||
    (matches.length===4&&byes.length===0)||
    used.length!==matches.length*2+byes.length||
    new Set(used).size!==used.length)
   throw Error("Participantes incompletos o duplicados en J"+n);
 return {matches:matches.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||"").localeCompare(b.time||"")),byes,crests};
}

export function discoverTeams(base,answers){
 // El grupo puede incorporar equipos después de haber publicado las primeras jornadas.
 // Usamos el código federativo real; jamás inferimos un equipo solo por su nombre.
 const byCode=new Map(base.teams.map(t=>[String(t.ffcvId),t]));
 if(byCode.size!==base.teams.length)throw Error("Códigos de equipos duplicados en datos base");
 const missing=new Map();
 for(let n=1;n<=9;n++){
   const raw=answers.get(n);
   if(!raw||String(raw.jornada)!==String(n)||!Array.isArray(raw.partidos))
     throw Error("Respuesta de jornada incompatible en J"+n);
   for(const p of raw.partidos){
     for(const [codeRaw,nameRaw] of [[p.cod_equipo_local,p.local],[p.cod_equipo_visitante,p.visitante]]){
       const code=String(codeRaw??"");
       if(code==="-1")continue;
       if(!/^\d{2,12}$/.test(code))throw Error("Código de equipo inválido en J"+n);
       const name=String(nameRaw??"").trim().replace(/\s+/g," ");
       if(!name||name.length>120||name.toLowerCase()==="descansa")
         throw Error("Nombre de equipo inválido en J"+n);
       if(!byCode.has(code)&&!missing.has(code)){
         missing.set(code,{id:"ffcv-"+code,name,ffcvId:code});
       }
     }
   }
 }
 const teams=[...base.teams,...missing.values()];
 if(teams.length<9||teams.length>16||new Set(teams.map(t=>t.id)).size!==teams.length)
   throw Error("Cantidad de equipos inesperada: "+teams.length);
 return teams;
}

export function buildLeague(base,answers,now=new Date(),officialRaw=null){
 if(base.season!=="2026-2027"||base.competitionCode!==SETTINGS.cod_competicion||base.groupCode!==SETTINGS.cod_grupo||!Array.isArray(base.teams)||base.teams.length<9)
   throw Error("Competición incorrecta");
 if(!(answers instanceof Map)||answers.size!==9)throw Error("Se necesitan nueve jornadas completas");
 const teamList=discoverTeams(base,answers);
 const teams=new Map(teamList.map(t=>[String(t.ffcvId),t.id]));
 if(teams.size!==teamList.length)throw Error("Códigos de equipo duplicados");
 const all=[];
 for(let n=1;n<=9;n++){if(!answers.has(n))throw Error("Falta jornada "+n);all.push(parseRound(answers.get(n),n,teams))}
 const official=officialRaw?parseOfficial(officialRaw,teamList):null;
 const images=new Map(all.flatMap(r=>r.crests.map(i=>[i.id,i.url])));
 if(official)for(const row of official.rows){if(row.crestUrl)images.set(row.id,row.crestUrl)}
 const enrichedTeams=teamList.map(t=>({...t,crestUrl:images.get(t.id)||t.crestUrl||null}));
 return {...base,teams:enrichedTeams,matches:all.flatMap(x=>x.matches),byes:all.flatMap(x=>x.byes),
   officialStandings:official?official.rows:[],officialStandingsRound:official?.round??null,
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
export async function fetchRound(n,fetchImpl=fetch,token){
 const u=urlForRound(n);
 for(let attempt=1;attempt<=2;attempt++){
   try{
     const headers=withPageSession(token);
     const response=await fetchImpl(u,{headers,signal:AbortSignal.timeout(20000)});
     if(!response.ok){
       const error=Object.assign(new Error("HTTP "+response.status),{status:response.status});
       if(response.status===401||response.status===403||response.status===404||response.status===429)error.fatal=true;
       throw error;
     }
     const body=await response.text();
     if(body.length>1000000)throw Error("Respuesta excesiva");
     return JSON.parse(body.replace(/^\uFEFF/,""));
   }catch(error){
     if(error.fatal||attempt===2)throw Error("Jornada "+n+": "+error.message,{cause:error});
     await pause(2500);
   }
 }
}

export function isTransientFFCV(error){
 for(let e=error,i=0;e&&i<5;e=e.cause,i++){
   if(e.fatal)return false;
   const code=Number(e.status)||Number(/\\bHTTP\\s+(\\d{3})\\b/.exec(String(e.message||""))?.[1]);
   if(code)return [408,500,502,503,504].includes(code);
   if(["AbortError","TimeoutError","TypeError"].includes(e.name))return true;
 }
 return false;
}
export async function openFFCVSession(sessionFetcher=getPageSession,sleep=pause){
 try{return await sessionFetcher()}
 catch(e){
   if(!isTransientFFCV(e))throw e;
   console.warn("FFCV: error temporal al abrir sesión. Segundo intento tras una pausa.");
   await sleep(3500);
   return sessionFetcher();
 }
}
export async function recoverFFCVRound(n,{fetcher=fetchRound,fetchImpl=fetch,session,sessionFetcher=getPageSession,sleep=pause}={}){
 try{return {raw:await fetcher(n,fetchImpl,session),session}}
 catch(e){
   if(!isTransientFFCV(e))throw e;
   console.warn("FFCV: incidencia temporal en jornada "+n+"; se renovará la sesión y se reintentará una vez.");
   await sleep(4500);
   const refreshed=await openFFCVSession(()=>sessionFetcher(fetchImpl),sleep);
   return {raw:await fetcher(n,fetchImpl,refreshed),session:refreshed};
 }
}

export async function sync({fetcher=fetchRound,dryRun=true,output=DEST,delay=1200,now=new Date()}={}){
 const base=JSON.parse(await readFile(DEST,"utf8")),answers=new Map();
 let token=fetcher===fetchRound?await openFFCVSession():null;
 for(let n=1;n<=9;n++){
   if(fetcher===fetchRound){
     const step=await recoverFFCVRound(n,{session:token});
     token=step.session;
     answers.set(n,step.raw);
   }else answers.set(n,await fetcher(n,fetch,token));
   if(delay&&n<9)await pause(delay);
 }
 let officialRaw=null;
 if(fetcher===fetchRound){
   try{
     const raw=await fetchOfficialClassification(fetch,token);
     const currentTeams=discoverTeams(base,answers);
     const official=parseOfficial(raw,currentTeams);
     officialRaw=raw;
     console.log("Clasificación oficial validada:",official.rows.length,"equipos, jornada",official.round??"desconocida");
   }catch(error){console.warn("Clasificación oficial no disponible; se usará tabla provisional:",error.message)}
 }
 const next=buildLeague(base,answers,now,officialRaw);
 // Diagnóstico legible en GitHub Actions para detectar cambios de fecha u hora.
 for(let n=1;n<=9;n++){
   const games=next.matches.filter(m=>m.round===n);
   const detail=games.map(m=>m.date+" "+(m.time||"--:--")).join(" | ");
   console.log("Fechas FFCV J"+n+": "+detail);
 }

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
 console.log("Validación completa:",d.importedRounds.length,"jornadas,",d.teams.length,"equipos,",d.matches.length,"partidos,",d.byes.length,"descansos");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error("SIN CAMBIOS:",e.message);process.exitCode=1});
}
