// Una sola comprobación de compatibilidad con el protocolo público de FFCV.
// No guarda ni publica resultados, ni muestra el token en los registros.
const homepage=await fetch("https://ffcv.es/competiciones/",{signal:AbortSignal.timeout(15000)});
console.log("Página oficial:",homepage.status);
if(!homepage.ok)throw Error("No se pudo cargar la página oficial");
const html=await homepage.text();
const match=html.match(/<meta\s+name=["']ffcv-pt["']\s+content=["']([a-fA-F0-9]{64})["']/i);
if(!match)throw Error("La página no entrega el token esperado");
const url=new URL("https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php");
for(const [key,value] of Object.entries({
cod_temporada:"22",cod_competicion:"905432332",cod_grupo:"905432336",cod_jornada:"1",
grupo_nombre:"F.C. - Grup 4",competicion_nombre:"Segona FFCV Benjamí 1r. any Alacant"
}))url.searchParams.set(key,value);
const resp=await fetch(url,{headers:{"Accept":"application/json","X-FFCV-Page-Token":match[1],
"X-Requested-With":"XMLHttpRequest","Referer":"https://ffcv.es/competiciones/"},
signal:AbortSignal.timeout(15000)});
console.log("Respuesta de datos J1:",resp.status);
if(!resp.ok)throw Error("El servidor no admite la consulta API: HTTP "+resp.status);
const json=await resp.json();
console.log("Jornada confirmada:",String(json.jornada),"entradas:",Array.isArray(json.partidos)?json.partidos.length:"formato desconocido");
if(String(json.jornada)!=="1"||!Array.isArray(json.partidos)||json.partidos.length!==5)throw Error("Formato incompatible");
