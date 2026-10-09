import {readFile} from "node:fs/promises";
import {fetchRound,parseRound} from "./sync_ffcv.mjs";
const d=JSON.parse(await readFile(new URL("../data/league.json", import.meta.url),"utf8"));
const ids=new Map(d.teams.map(t=>[String(t.ffcvId),t.id]));
console.log("Probando conectividad FFCV desde GitHub Actions (sin almacenar datos)...");
const raw=await fetchRound(1);
const {matches,byes}=parseRound(raw,1,ids);
console.log("Respuesta válida: J1 =",matches.length,"partidos,",byes.length,"descanso; sin almacenar ni publicar respuestas.");
