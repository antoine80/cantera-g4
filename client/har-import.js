/* Importación privada del HAR de FFCV: no realiza peticiones ni envía datos. */
(function(root){
"use strict";
const GROUP={cod_temporada:"22",cod_competicion:"905432332",cod_grupo:"905432336"};
const PATH="/competiciones/api/partidos/resultados_por_grupo_jornada_data.php";
function fail(message){throw new Error(message)}
function iso(value){
 const m=/^(\d{2})\/(\d{2})\/(2026|2027)$/.exec(String(value||""));
 if(!m)fail("Fecha incorrecta: "+value);
 const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));
 if(d.getUTCFullYear()!==+m[3]||d.getUTCMonth()!==+m[2]-1||d.getUTCDate()!==+m[1])fail("Fecha imposible: "+value);
 return m[3]+"-"+m[2]+"-"+m[1];
}
function body(entry){
 const c=entry.response&&entry.response.content;
 if(!c||typeof c.text!=="string")fail("La exportación HAR no contiene el cuerpo de la respuesta; activa Guardar contenido al exportar.");
 let raw=c.text;
 if(c.encoding==="base64"){
   if(typeof root.atob!=="function"||typeof root.TextDecoder!=="function")fail("Este navegador no puede leer el HAR codificado");
   const decoded=root.atob(raw),bytes=Uint8Array.from(decoded,ch=>ch.charCodeAt(0));
   raw=new root.TextDecoder("utf-8").decode(bytes);
 }
 return JSON.parse(raw.replace(/^\uFEFF/,""));
}
function parseRound(raw,n,byFfcv){
 if(!raw||String(raw.jornada)!==String(n)||!Array.isArray(raw.partidos)||raw.partidos.length!==5)fail("La jornada "+n+" no contiene cinco entradas");
 const matches=[],byes=[],used=[];
 for(const p of raw.partidos){
   const hc=String(p.cod_equipo_local??""),ac=String(p.cod_equipo_visitante??"");
   const home=hc==="-1"?null:byFfcv.get(hc);
   const away=ac==="-1"?null:byFfcv.get(ac);
   if((hc!=="-1"&&!home)||(ac!=="-1"&&!away)||(!home&&!away))fail("Equipo desconocido en la jornada "+n);
   const date=iso(p.fecha);
   if(!home||!away){
     if(![p.local,p.visitante].some(v=>String(v||"").trim().toLowerCase()==="descansa"))fail("Descanso incompatible en J"+n);
     const team=home||away;
     used.push(team);byes.push({round:n,team,date});continue;
   }
   const time=String(p.hora??"").trim();
   if(time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))fail("Hora incompatible J"+n);
   const sourceState=String(p.estado??"").trim(),sourceResult=String(p.resultado??"").trim();
   const score=/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(sourceResult);
   const finished=sourceState==="1"&&!!score;
   used.push(home,away);
   matches.push({round:n,date,time:time||null,home,away,
      homeScore:finished?Number(score[1]):null,awayScore:finished?Number(score[2]):null,
      status:finished?"finished":sourceState==="0"?"scheduled":"unverified",
      venue:String(p.campo??"").trim(),actaId:String(p.codacta??""),
      sourceState,sourceResult});
 }
 if(matches.length!==4||byes.length!==1||used.length!==9||new Set(used).size!==9)
   fail("Equipos duplicados o incompletos en J"+n);
 matches.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||"").localeCompare(b.time||""));
 return {matches,byes};
}
function fromHar(har,publicLeague,localLeague){
 if(!har||!har.log||!Array.isArray(har.log.entries))fail("No es un HAR válido");
 if(!publicLeague||publicLeague.groupCode!==GROUP.cod_grupo||publicLeague.competitionCode!==GROUP.cod_competicion||publicLeague.season!=="2026-2027")
   fail("Los datos públicos no corresponden al grupo 4");
 const teams=publicLeague.teams;
 if(!Array.isArray(teams)||teams.length!==9)fail("Faltan los nueve equipos");
 const codes=new Map(teams.map(t=>[String(t.ffcvId),t.id]));
 if(codes.size!==9)fail("Los equipos no tienen códigos únicos");
 const rounds=new Map(),times=[];
 for(const e of har.log.entries){
   let u;try{u=new URL(e.request.url)}catch{continue}
   if(u.origin!=="https://ffcv.es"||u.pathname!==PATH||
      Object.keys(GROUP).some(k=>u.searchParams.get(k)!==GROUP[k])||
      e.response?.status!==200)continue;
   const n=Number(u.searchParams.get("cod_jornada"));
   if(!Number.isInteger(n)||n<1||n>9)continue;
   let parsed;try{parsed=body(e)}catch(err){fail("J"+n+": "+err.message)}
   const validated=parseRound(parsed,n,codes);
   rounds.set(n,validated);
   if(e.startedDateTime){const t=Date.parse(e.startedDateTime);if(Number.isFinite(t))times.push(t)}
 }
 if(rounds.size===0)fail("No hay respuestas JSON del grupo 4 de Benjamín 1.º año en este HAR");
 const old=localLeague&&localLeague.syncStatus==="har_complete"?localLeague:null;
 if(!old&&rounds.size!==9)fail("La primera carga exige las nueve jornadas: este HAR contiene "+rounds.size+"/9");
 const matches=[],byes=[];
 for(let n=1;n<=9;n++){
   const fresh=rounds.get(n);
   const entry=fresh||(old?{matches:old.matches.filter(m=>m.round===n),byes:old.byes.filter(b=>b.round===n)}:null);
   if(!entry||entry.matches.length!==4||entry.byes.length!==1)fail("Falta la jornada "+n);
   matches.push(...entry.matches);
   byes.push(...entry.byes);
 }
 const stamped=times.length?new Date(Math.max(...times)).toISOString():new Date().toISOString();
 if(old&&old.capturedAt&&new Date(stamped)<new Date(old.capturedAt))
   fail("Este HAR es anterior al calendario privado que tienes guardado");
 return {data:{...publicLeague,matches,byes,importedRounds:[1,2,3,4,5,6,7,8,9],
   syncStatus:"har_complete",source:"FFCV (HAR leído localmente)",capturedAt:stamped,updatedAt:null},
   importedRounds:[...rounds.keys()].sort((a,b)=>a-b)};
}
root.CanteraHar=Object.freeze({fromHar});
})(globalThis);
