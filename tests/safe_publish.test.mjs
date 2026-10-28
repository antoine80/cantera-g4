import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {buildLeague} from "../scripts/sync_ffcv.mjs";
import {verified,failState,publish} from "../scripts/safe_publish.mjs";
const base=JSON.parse(await readFile(new URL("../data/league.json",import.meta.url),"utf8"));
const sample=JSON.parse(await readFile(new URL("./fixtures/jornada1.json",import.meta.url),"utf8"));
const create=()=>buildLeague(base,new Map(Array.from({length:9},(_,i)=>[i+1,{...structuredClone(sample),jornada:String(i+1)}])),new Date("2026-10-14T12:00:00Z"));
test("No se publica el JSON parcial incluido en el repositorio",()=>{
 assert.equal(verified(base),false);
});
test("Una liga completa y verificada sí sirve de respaldo",()=>{
 const v=create();
 assert.equal(verified(v),true);
 v.matches.pop();
 assert.equal(verified(v),false);
});
test("Rechaza copias de otros grupos o con fecha futura",()=>{
 const v=create();v.groupCode="666";
 assert.equal(verified(v),false);
 v.groupCode="905432336";v.updatedAt="2099-01-01T00:00:00.000Z";
 assert.equal(verified(v),false);
});
test("La caída HTTP 403 queda marcada como desactualización",()=>{
 const s=failState(new Error("Jornada 1: HTTP 403"),new Date("2026-10-28T12:00:00Z"),"2026-10-13T12:00:00Z");
 assert.equal(s.state,"stale");assert.equal(s.errorCode,"HTTP_403");
 assert.equal(s.lastSuccessAt,"2026-10-13T12:00:00Z");
});
test("Si la API falla, conserva los datos publicados y el estado stale",async()=>{
 const current=create(),writes={};
 const status=await publish({
  now:new Date("2026-10-28T12:00:00Z"),
  fetcher:async()=>({ok:true,text:async()=>JSON.stringify(current)}),
  read:async()=>JSON.stringify(base),
  write:async(p,value)=>{writes[p]=JSON.parse(value)},
  synchronizer:async()=>{throw Error("Jornada 1: HTTP 403")}
 });
 assert.equal(status.state,"stale");
 assert.equal(Object.values(writes).find(v=>v.syncStatus==="verified").matches.length,36);
 assert.equal(Object.values(writes).find(v=>v.state==="stale").errorCode,"HTTP_403");
});
test("Si falla FFCV y tampoco existe respaldo, no publica el JSON parcial",async()=>{
 await assert.rejects(publish({
  fetcher:async()=>({ok:false,status:503}),
  read:async()=>JSON.stringify(base),
  write:async()=>{throw Error("No escribir")},
  synchronizer:async()=>{throw Error("HTTP 403")}
 }),/se conserva la publicación anterior/);
});
test("Si hay datos nuevos, marca sincronización correcta",async()=>{
 const result=create(), writes={};
 const status=await publish({
  now:new Date("2026-10-28T12:00:00Z"),
  fetcher:async()=>({ok:false,status:404}),
  read:async()=>JSON.stringify(base),
  write:async(p,value)=>{writes[p]=JSON.parse(value)},
  synchronizer:async()=>result
 });
 assert.equal(status.state,"ok");assert.equal(status.lastSuccessAt,result.updatedAt);
});
