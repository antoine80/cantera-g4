import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {urlForRound,parseDate,parseRound,buildLeague,answersFromHar,sync} from "../scripts/sync_ffcv.mjs";
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
