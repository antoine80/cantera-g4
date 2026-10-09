const CACHE="cantera-g4-v1",SHELL=["./","./index.html","./manifest.webmanifest","./icons/icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
if(new URL(req.url).pathname.endsWith("/data/league.json")){event.respondWith(fetch(req).then(async res=>{if(res.ok){let cache=await caches.open(CACHE);await cache.put("./data/league.json",res.clone())}return res}).catch(()=>caches.match("./data/league.json").then(r=>r||new Response("{}",{status:503}))));return}
event.respondWith(caches.match(req).then(c=>c||fetch(req)))});
