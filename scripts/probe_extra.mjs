import {getPageToken,fetchRound,SETTINGS} from "./sync_ffcv.mjs";
const url="https://ffcv.es/competiciones/api/clasificaciones/clasificaciones_html.php";
const token=await getPageToken();
const headers={Accept:"text/html",Referer:"https://ffcv.es/competiciones/","X-Requested-With":"XMLHttpRequest","X-FFCV-Page-Token":token};
const round=await fetchRound(1,fetch,token);
console.log("RESULT_SCHEMA:",JSON.stringify(Object.keys(round)));
console.log("MATCH_SCHEMA:",JSON.stringify(Object.keys(round.partidos?.[0]||{})));
for(const n of [1,9]){
  let u=new URL(url);
  for(const [k,v] of Object.entries({...SETTINGS,cod_jornada:String(n)}))u.searchParams.set(k,v);
  const r=await fetch(u,{headers,signal:AbortSignal.timeout(15000)});
  const content=await r.text();
  console.log("CLASSIFICATION",n,"status",r.status,"len",content.length,"type",r.headers.get("content-type"));
  console.log("CLASSIFICATION_EXCERPT",n,content.slice(0,4200).replace(/\s+/g," ").slice(0,3300));
}
const page=await (await fetch("https://ffcv.es/competiciones/")).text();
const unique=new Set(page.match(/(?:clasificaciones|escudo|equipos|logo|imagenes|foto)[\w./-]{0,90}/gi)||[]);
console.log("PAGE_TERMS",JSON.stringify([...unique].slice(0,75)));
