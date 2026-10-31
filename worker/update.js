// Cloudflare Worker: lanzamiento protegido de una ejecución NUEVA de GitHub Actions.
// Configurar secretos GITHUB_TOKEN y UPDATE_KEY en Cloudflare, nunca en GitHub Pages.
const ORIGIN = "https://antoine80.github.io";
function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}
function equal(a,b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++) diff |= (x[i]||0) ^ (y[i]||0);
  return diff === 0;
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin);
    if(origin !== ORIGIN) return new Response("Origen no autorizado", {status:403, headers});
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers});
    if(request.method!=="POST" || new URL(request.url).pathname!=="/update")
      return new Response("No encontrado",{status:404,headers});
    if(!env.GITHUB_TOKEN || !env.UPDATE_KEY || env.UPDATE_KEY.length < 16)
      return Response.json({error:"Servicio sin configurar"},{status:503,headers});
    const key=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    if(!equal(key,env.UPDATE_KEY))
      return Response.json({error:"Clave de administración incorrecta"},{status:401,headers});
    const response=await fetch("https://api.github.com/repos/antoine80/cantera-g4/actions/workflows/publish.yml/dispatches",{
      method:"POST",
      headers:{"Authorization":"Bearer "+env.GITHUB_TOKEN,
        "Accept":"application/vnd.github+json",
        "X-GitHub-Api-Version":"2022-11-28",
        "User-Agent":"cantera-g4-update-worker",
        "Content-Type":"application/json"},
      body:JSON.stringify({ref:"main"})
    });
    if(!response.ok) return Response.json({error:"GitHub no aceptó la ejecución",status:response.status},
      {status:502,headers});
    return Response.json({ok:true,message:"Actualización solicitada. Comprueba el estado en GitHub Actions."},
      {status:202,headers});
  }
};
