import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import "../client/har-import.js";
const {fromHar}=globalThis.CanteraHar;
const base=JSON.parse(await readFile(new URL("../data/league.json",import.meta.url),"utf8"));
const jornada=JSON.parse(await readFile(new URL("./fixtures/jornada1.json",import.meta.url),"utf8"));
const endpoint="https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php";
function sample(n,change=()=>{}){
 const fixture=structuredClone(jornada);fixture.jornada=String(n);change(fixture);
 return fixture;
}
function entry(n,data,ts="2026-10-09T10:00:00.000Z"){
 const u=new URL(endpoint);
 for(const [k,v] of Object.entries({cod_temporada:"22",cod_competicion:"905432332",cod_grupo:"905432336",cod_jornada:String(n)}))u.searchParams.set(k,v);
 return {startedDateTime:ts,request:{url:u.toString(),headers:[{name:"Cookie",value:"no-debe-quedar-en-los-datos"}]},response:{status:200,content:{text:JSON.stringify(data)}}};
}
function har(n=9){return {log:{entries:Array.from({length:n},(_,i)=>entry(i+1,sample(i+1)))}}}
test("HAR con las nueve jornadas entrega 36 encuentros y nueve descansos",()=>{
 const r=fromHar(har(),base,null);
 assert.deepEqual(r.importedRounds,[1,2,3,4,5,6,7,8,9]);
 assert.equal(r.data.matches.length,36);
 assert.equal(r.data.byes.length,9);
 assert.equal(r.data.syncStatus,"har_complete");
 assert(!JSON.stringify(r.data).includes("no-debe-quedar-en-los-datos"));
});
test("Un resultado 0 con estado 0 no significa 0-0",()=>{
 const r=fromHar(har(),base,null);
 assert(r.data.matches.every(m=>m.homeScore===null&&m.awayScore===null));
});
test("HAR de una jornada actualiza solo esa jornada sobre la copia privada",()=>{
 const initial=fromHar(har(),base,null).data;
 const updated=entry(4,sample(4,p=>{p.partidos[0].estado="1";p.partidos[0].resultado="3 - 2";p.partidos[0].hora="17:45"}),"2026-10-11T17:00:00.000Z");
 const r=fromHar({log:{entries:[updated]}},base,initial);
 assert.deepEqual(r.importedRounds,[4]);
 const result=r.data.matches.find(x=>x.round===4&&x.homeScore===3);
 assert.equal(result.awayScore,2);
 assert.equal(result.status,"finished");
 assert.equal(result.time,"17:45");
 assert.equal(r.data.matches.filter(x=>x.round===5).length,4);
 assert.equal(r.data.matches.filter(x=>x.round===1).length,4);
});
test("Primera importación exige todas las jornadas",()=>{
 assert.throws(()=>fromHar(har(1),base,null),/primera carga exige las nueve jornadas/);
});
test("No acepta grupo ajeno aunque aparezca en el HAR",()=>{
 const bad=har();
 for(const e of bad.log.entries)e.request.url=e.request.url.replace("cod_grupo=905432336","cod_grupo=99999");
 assert.throws(()=>fromHar(bad,base,null),/No hay respuestas JSON del grupo 4/);
});
test("Rechaza partidos duplicados",()=>{
 const bad=har();
 const payload=JSON.parse(bad.log.entries[0].response.content.text);
 payload.partidos[0].cod_equipo_local=payload.partidos[1].cod_equipo_local;
 bad.log.entries[0].response.content.text=JSON.stringify(payload);
 assert.throws(()=>fromHar(bad,base,null),/duplicados/);
});
test("No sobrescribe datos con un HAR más antiguo",()=>{
 const initial=fromHar(har(),base,null).data;
 const e=entry(3,sample(3),"2026-10-08T10:00:00.000Z");
 assert.throws(()=>fromHar({log:{entries:[e]}},base,initial),/anterior/);
});
test("Rechaza HAR sin cuerpos de respuesta",()=>{
 const h=har();delete h.log.entries[0].response.content.text;
 assert.throws(()=>fromHar(h,base,null),/cuerpo de la respuesta/);
});
