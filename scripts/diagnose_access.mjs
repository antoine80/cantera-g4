// Diagnóstico limitado de acceso oficial FFCV: 1 página + 1 jornada.
// No registra cookies, token, direcciones IP, ni contenidos de los partidos.
const base="https://ffcv.es/competiciones/";
const url=new URL("api/partidos/resultados_por_grupo_jornada_data.php",base);
for(const [key,value] of Object.entries({
  cod_temporada:"22",cod_competicion:"905432332",cod_grupo:"905432336",
  cod_jornada:"1",grupo_nombre:"F.C. - Grup 4",
  competicion_nombre:"Segona FFCV Benjamí 1r. any Alacant"
}))url.searchParams.set(key,value);
function summary(label,r){
 const h=r.headers;
 console.log(label,JSON.stringify({
  status:r.status,contentType:h.get("content-type")?.split(";")[0]||"none",
  serverPresent:!!h.get("server"),hasRetryAfter:!!h.get("retry-after"),
  hasSetCookie:!!h.get("set-cookie"),
  hasRequestId:!!(h.get("x-request-id")||h.get("cf-ray")||h.get("x-amz-cf-id"))
 }));
}
try{
 const page=await fetch(base,{signal:AbortSignal.timeout(15000)});
 summary("Página FFCV",page);
 if(!page.ok)process.exit(0);
 const html=await page.text();
 const token=html.match(/<meta\s+name=["']ffcv-pt["']\s+content=["']([a-f0-9]{64})["']/i)?.[1];
 console.log("Token de página presente:",Boolean(token));
 if(!token)process.exit(0);
 const reply=await fetch(url,{headers:{
  "Accept":"application/json","Referer":base,"X-Requested-With":"XMLHttpRequest",
  "X-FFCV-Page-Token":token
 },signal:AbortSignal.timeout(15000)});
 summary("API FFCV",reply);
 if(!reply.ok){
  const body=(await reply.text()).slice(0,2000);
  console.log("Tipo de rechazo:",/captcha|challenge/i.test(body)?"desafío interactivo":
   /access denied|forbidden|bloquead|denegad|permission/i.test(body)?"acceso denegado":
   /^\s*</.test(body)?"documento HTML":/^\s*\{/.test(body)?"error JSON":"otro o sin contenido");
 }else{
  const j=await reply.json();
  console.log("Datos recibidos:",String(j.jornada)==="1"&&Array.isArray(j.partidos)?"jornada válida":"formato inesperado");
 }
}catch(e){console.log("Diagnóstico no concluido:",e.name||"Error",String(e.message).slice(0,140))}
