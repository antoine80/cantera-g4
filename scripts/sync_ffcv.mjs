import {readFile,writeFile,rename} from "node:fs/promises";
const BASE="https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php";
const OPT={cod_temporada:"22",cod_competicion:"905432332",cod_grupo:"905432336",grupo_nombre:"F.C. - Grup 4",competicion_nombre:"Segona FFCV Benjamí 1r. any Alacant"};
const file="data/league.json",current=JSON.parse(await readFile(file,"utf8"));
if(current.groupCode!==OPT.cod_grupo||current.competitionCode!==OPT.cod_competicion)throw Error("Competición incorrecta");
const teams=new Map(current.teams.map(t=>[String(t.ffcvId),t.id])),rounds=[];
function date(v){const m=/^(\d\d)\/(\d\d)\/(2026|2027)$/.exec(v);if(!m)throw Error("Fecha inválida: "+v);return m[3]+"-"+m[2]+"-"+m[1]}
for(let n=1;n<=9;n++){
 const url=BASE+"?"+new URLSearchParams({...OPT,cod_jornada:String(n)});
 let raw;for(let a=0;a<3;a++){try{const r=await fetch(url,{headers:{Accept:"application/json",Referer:"https://ffcv.es/competiciones/"} ,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error("HTTP "+r.status);raw=await r.json();break}catch(e){if(a===2)throw Error("Jornada "+n+": "+e.message);await new Promise(r=>setTimeout(r,1500))}}
 if(Number(raw.jornada)!==n||!Array.isArray(raw.partidos)||raw.partidos.length!==5)throw Error("Estructura inválida J"+n);
 const matches=[],byes=[],used=[];
 for(const p of raw.partidos){
  const h=String(p.cod_equipo_local),a=String(p.cod_equipo_visitante),home=h==="-1"?null:teams.get(h),away=a==="-1"?null:teams.get(a);
  if((h!=="-1"&&!home)||(a!=="-1"&&!away)||(!home&&!away))throw Error("Equipo desconocido J"+n);
  const when=date(p.fecha);
  if(!home||!away){if(![p.local,p.visitante].some(t=>String(t).trim().toLowerCase()==="descansa"))throw Error("Descanso inválido");const team=home||away;used.push(team);byes.push({round:n,team,date:when});continue}
  used.push(home,away);
  const match=/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(String(p.resultado??"").trim()),status=String(p.estado??""),done=status==="1"&&!!match;
  matches.push({round:n,date:when,time:String(p.hora||"").trim()||null,home,away,homeScore:done?+match[1]:null,awayScore:done?+match[2]:null,status:done?"finished":status==="0"?"scheduled":"unverified",venue:String(p.campo||"").trim(),actaId:String(p.codacta||"")});
 }
 if(matches.length!==4||byes.length!==1||new Set(used).size!==9)throw Error("Emparejamientos incompletos J"+n);
 rounds.push({matches,byes});console.log("Jornada",n,"validada");if(n!==9)await new Promise(r=>setTimeout(r,1200));
}
const next={...current,matches:rounds.flatMap(r=>r.matches),byes:rounds.flatMap(r=>r.byes),importedRounds:[1,2,3,4,5,6,7,8,9],syncStatus:"verified",updatedAt:new Date().toISOString(),source:"FFCV: respuestas JSON de su sitio web"};
if(!process.argv.includes("--dry-run")){await writeFile(file+".tmp",JSON.stringify(next,null,2)+"\n");await rename(file+".tmp",file)}
console.log("OK: 9 jornadas, 36 partidos y 9 descansos");
