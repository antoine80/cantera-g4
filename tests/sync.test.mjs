import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {urlForRound,parseDate,parseRound,buildLeague,answersFromHar,sync,getPageToken,fetchRound,crestUrl,parseOfficial,fetchOfficialClassification} from "../scripts/sync_ffcv.mjs";
const base=JSON.parse(await readFile(new URL("../data/league.json",import.meta.url),"utf8"));
const sample=JSON.parse(await readFile(new URL("./fixtures/jornada1.json",import.meta.url),"utf8"));
const ids=new Map(base.teams.map(t=>[String(t.ffcvId),t.id]));
const clone=o=>structuredClone(o);
test("La URL contiene los códigos exactos del grupo 4",()=>{
 const u=new URL(urlForRound(9));assert.equal(u.searchParams.get("cod_grupo"),"905432336");
 assert.equal(u.searchParams.get("cod_competicion"),"905432332");
 assert.equal(u.searchParams.get("cod_jornada"),"9");
 assert.throws(()=>urlForRound(10));
});
test("La respuesta real de J1 contiene cuatro partidos y descanso",()=>{
 const p=parseRound(sample,1,ids);
 assert.equal(p.matches.length,4);assert.equal(p.byes.length,1);
 assert.equal(p.byes[0].team,"hercules");
 assert.deepEqual(p.matches.map(m=>m.actaId).sort(),["26558954","26558955","26558956","26558957"]);
});
test("0 y estado 0 no representan un empate 0-0",()=>{
 const p=parseRound(sample,1,ids);assert(p.matches.every(m=>m.homeScore===null&&m.awayScore===null&&m.status==="scheduled"));
});
test("Un 0-0 auténtico exige marcador explícito y estado finalizado",()=>{
 const p=clone(sample);p.partidos[0].resultado="0 - 0";p.partidos[0].estado="1";
 assert.deepEqual(parseRound(p,1,ids).matches.find(m=>m.actaId==="26558954").homeScore,0);
});
test("Resultado y estado desconocidos se mantienen sin verificar",()=>{
 const p=clone(sample);p.partidos[0].resultado="5 - 1";p.partidos[0].estado="2";
 assert.equal(parseRound(p,1,ids).matches.find(m=>m.actaId==="26558954").status,"unverified");
});
test("Equipos repetidos o ajenos se rechazan",()=>{
 const p=clone(sample);p.partidos[1].cod_equipo_local=p.partidos[0].cod_equipo_local;
 assert.throws(()=>parseRound(p,1,ids),/duplicados/);
 const q=clone(sample);q.partidos[0].cod_equipo_local="000000";
 assert.throws(()=>parseRound(q,1,ids),/ajeno/);
});
test("Fechas inválidas se rechazan",()=>{
 assert.equal(parseDate("18/10/2026"),"2026-10-18");
 assert.throws(()=>parseDate("31/02/2027"),/imposible/);
 assert.throws(()=>parseDate("18/10/2025"),/inesperada/);
});
test("El HAR se filtra por grupo y no importa datos de otros grupos",()=>{
 const valid=urlForRound(1);
 const entries=[valid,valid.replace("cod_grupo=905432336","cod_grupo=1234")].map(url=>({request:{url,headers:[{name:"Cookie",value:"SECRETO-NO-USADO"}]},response:{status:200,content:{text:JSON.stringify(sample)}}}));
 const found=answersFromHar({log:{entries}});
 assert.equal(found.size,1);assert.equal(found.get(1).partidos.length,5);
});
test("No se aceptan jornadas incompletas",()=>{
 const answers=new Map([[1,sample]]);
 assert.throws(()=>buildLeague(base,answers),/nueve jornadas/);
});
test("Nueve jornadas válidas producen 36 partidos y nueve descansos",()=>{
 const answers=new Map(Array.from({length:9},(_,i)=>[i+1,{...clone(sample),jornada:String(i+1)}]));
 const l=buildLeague(base,answers,new Date("2026-10-09T00:00:00Z"));
 assert.equal(l.matches.length,36);assert.equal(l.byes.length,9);assert.equal(l.syncStatus,"verified");
 assert.equal(l.updatedAt,"2026-10-09T00:00:00.000Z");
});
test("Un fallo intermedio no modifica data/league.json",async()=>{
 const before=await readFile(new URL("../data/league.json",import.meta.url));
 await assert.rejects(sync({delay:0,fetcher:async n=>{if(n===4)throw Error("HTTP 503");return {...clone(sample),jornada:String(n)}}}),/HTTP 503/);
 assert.deepEqual(await readFile(new URL("../data/league.json",import.meta.url)),before);
});
test("Simulación con nueve respuestas no escribe datos",async()=>{
 const before=await readFile(new URL("../data/league.json",import.meta.url));
 const d=await sync({delay:0,fetcher:async n=>({...clone(sample),jornada:String(n)})});
 assert.equal(d.matches.length,36);assert.deepEqual(await readFile(new URL("../data/league.json",import.meta.url)),before);
});

test("Un token de página FFCV válido se obtiene de HTML, sin HAR",async()=>{
 const token="1".repeat(64);
 const fakeFetch=async()=>({ok:true,text:async()=>'<head><meta name="ffcv-pt" content="'+token+'"></head>'});
 assert.equal(await getPageToken(fakeFetch),token);
});
test("La petición de API contiene el token que entrega la página",async()=>{
 let headers=null;
 const fakeFetch=async(u,options)=>{headers=options.headers;return {ok:true,text:async()=>JSON.stringify(sample)}};
 const token="c".repeat(64);
 const response=await fetchRound(1,fakeFetch,token);
 assert.equal(response.jornada,"1");
 assert.equal(headers["X-FFCV-Page-Token"],token);
 assert.equal(headers["X-Requested-With"],"XMLHttpRequest");
});
test("El token no se acepta si no está en una etiqueta meta válida",async()=>{
 await assert.rejects(getPageToken(async()=>({ok:true,text:async()=>"<html>sin token</html>"})),/token esperado/);
});

test("Los escudos FFCV solo admiten rutas de imágenes oficiales",()=>{
 assert.equal(crestUrl("/pnfg/pimg/Clubes/escudo.png?nova=1"),"https://appwebffcv.novanet.es/pnfg/pimg/Clubes/escudo.png?nova=1");
 for(const bad of ["javascript:alert(1)","https://example.com/pnfg/image.png","//evil.com/logo.png","/external/img.png","data:image/png;base64,a"])assert.equal(crestUrl(bad),null);
});
function officialRaw(){
 return {estado:"1",codigo_competicion:"905432332",codigo_grupo:"905432336",jornada:"1",clasificacion:base.teams.map((t,i)=>({
   codequipo:String(t.ffcvId),nombre:t.name,posicion:String(i+1),jugados:"1",
   ganados:i===0?"1":"0",perdidos:"0",empatados:i===0?"0":"1",
   goles_a_favor:i===0?"3":"0",goles_en_contra:"0",puntos:i===0?"3":"1",
   url_img:"/pnfg/pimg/Clubes/"+t.id+".png"
 }))};
}
test("FFCV manda ranking y puntos sin recalcular; nueve escudos oficiales",()=>{
 const official=officialRaw();
 const validated=parseOfficial(official,base.teams);
 assert.equal(validated.rows.length,9);
 assert.equal(validated.round,1);
 assert.equal(validated.rows[0].PTS,3);
 const rounds=new Map(Array.from({length:9},(_,i)=>[i+1,{...clone(sample),jornada:String(i+1)}]));
 const league=buildLeague(base,rounds,new Date("2026-10-09T00:00:00Z"),official);
 assert.equal(league.officialStandings.length,9);
 assert.equal(league.officialStandings[0].rank,1);
 assert(league.teams.every(t=>t.crestUrl?.startsWith("https://appwebffcv.novanet.es/pnfg/")));
});
test("La clasificación de otro grupo o con equipos repetidos se rechaza",()=>{
 const different=officialRaw();different.codigo_grupo="666";
 assert.throws(()=>parseOfficial(different,base.teams),/ajena/);
 const duplicate=officialRaw();duplicate.clasificacion[1].codequipo=duplicate.clasificacion[0].codequipo;
 assert.throws(()=>parseOfficial(duplicate,base.teams),/incorrectos/);
});
test("La API de clasificación incluye token y código del grupo correcto",async()=>{
 let url,headers;
 const fake=async(u,opts)=>{url=new URL(u);headers=opts.headers;return {ok:true,text:async()=>JSON.stringify(officialRaw())}};
 const returned=await fetchOfficialClassification(fake,"a".repeat(64));
 assert.equal(returned.clasificacion.length,9);
 assert.equal(url.searchParams.get("cod_grupo"),"905432336");
 assert.equal(url.searchParams.get("cod_jornada"),"9");
 assert.equal(headers["X-FFCV-Page-Token"],"a".repeat(64));
});

test("Un club nuevo se incorpora a todos los datos, con una jornada de cinco partidos",()=>{
 const extra={name:"C.D. El Campello 'D'",id:"905432999"};
 const baseRound=structuredClone(sample);
 // Jornada 4 incluye un nuevo partido: el descanso del Hércules pasa a partido ante El Campello.
 const dynamic=structuredClone(baseRound);
 dynamic.jornada="4";
 const desc=dynamic.partidos.find(p=>String(p.cod_equipo_local)==="-1"||String(p.cod_equipo_visitante)==="-1");
 assert(desc);
 const hercules=String(desc.cod_equipo_local)==="-1"?desc.cod_equipo_visitante:desc.cod_equipo_local;
 dynamic.partidos=dynamic.partidos.filter(p=>p!==desc);
 dynamic.partidos.push({...dynamic.partidos[0],local:"Hércules C.F. S.A.D. 'D'",visitante:extra.name,
   cod_equipo_local:hercules,cod_equipo_visitante:extra.id,codacta:"99990001"});
 const rounds=new Map(Array.from({length:9},(_,i)=>[i+1,{...structuredClone(sample),jornada:String(i+1)}]));
 rounds.set(4,dynamic);
 const result=buildLeague(base,rounds,new Date("2026-10-13T00:00:00Z"));
 assert.equal(result.teams.length,10);
 assert.equal(result.matches.length,37);
 assert.equal(result.byes.length,8);
 const campello=result.teams.find(t=>t.ffcvId===extra.id);
 assert.equal(campello.name,extra.name);
 assert.equal(campello.id,"ffcv-"+extra.id);
 const game=result.matches.find(m=>m.round===4&&m.away===campello.id);
 assert(game);
 assert.equal(game.home,"hercules");
 assert.equal(result.matches.filter(m=>m.round===4).length,5);
});
test("La clasificación oficial acepta diez equipos cuando la competición crece",()=>{
 const extra={id:"ffcv-905432999",name:"C.D. El Campello 'D'",ffcvId:"905432999"};
 const all=[...base.teams,extra];
 const input={codigo_grupo:"905432336",codigo_competicion:"905432332",jornada:"4",
 clasificacion:all.map((t,i)=>({codequipo:t.ffcvId,posicion:i+1,puntos:"0",
 jugados:"0",ganados:"0",empatados:"0",perdidos:"0",goles_a_favor:"0",goles_en_contra:"0"}))};
 const parsed=parseOfficial(input,all);
 assert.equal(parsed.rows.length,10);
 assert.equal(parsed.rows[9].id,extra.id);
 assert.throws(()=>parseOfficial({...input,clasificacion:input.clasificacion.slice(0,9)},all),/incompleta/);
});
test("Un partido duplicado sigue rechazándose aunque haya diez equipos",()=>{
 const round=structuredClone(sample);
 round.partidos[1].cod_equipo_local=round.partidos[0].cod_equipo_local;
 const rounds=new Map(Array.from({length:9},(_,i)=>[i+1,{...structuredClone(sample),jornada:String(i+1)}]));
 rounds.set(2,{...round,jornada:"2"});
 assert.throws(()=>buildLeague(base,rounds),/duplicados/);
});
