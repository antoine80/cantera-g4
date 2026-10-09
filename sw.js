const CACHE="cantera-g4-v6",FILES=["./","./index.html","./manifest.webmanifest","./icons/icon.svg","./client/har-import.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
 const req=e.request,u=new URL(req.url);if(req.method!=="GET"||u.origin!==location.origin)return;
 const data=u.pathname.endsWith("/data/league.json");if(data||req.mode==="navigate"){
  e.respondWith(fetch(req).then(async res=>{if(res.ok){const cache=await caches.open(CACHE);await cache.put(data?"./data/league.json":req,res.clone())}return res})
   .catch(async()=>await caches.match(data?"./data/league.json":req)||(data?null:await caches.match("./index.html"))||new Response("Sin conexión",{status:503})));
  return;
 }
 e.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});