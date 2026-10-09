import test from "node:test";
import assert from "node:assert/strict";
import "../client/venues.js";
const api=globalThis.CanteraVenues;
const expected={
 "Estadio Inmaculada F-8 Campo 1":"Calle Padre Arrupe, s/n, 03016 Alicante, España",
 "Campo Mpal. Via Parque F-8 Campo 1":"Camino Garbinet, 14A, 03015 Alicante, España",
 "Polideportivo Mpal. Pla Garbinet F-8 Campo 1":"Calle Deportista Navarro Olcina, 10, 03015 Alicante, España",
 "Campo Mpal. Florida Babel. F-8 Campo 1":"Calle Vicente Chávarri, 21, 03007 Alicante, España",
 "Camp Nou Los Olmos Mutxamel F-8 Campo 1":"Calle Camí Vell, 4, 03110 Mutxamel, Alicante, España",
 "Campo Mpal. Tombola F-8 Campo 1":"Calle Peñaguila, 13, 03009 Alicante, España",
 "Ciudad Dptva. de Alicante F-8 Campo 1":"Calle Foguerer José Romeu, 03005 Alicante, España",
 "Campo Arena Alicante F-8 Campo 1 B":"Avenida Locutor Vicente Hipólito, s/n, 03540 Alicante, España",
 "Polideportivo Mpal. Albufereta F-8":"Camino Colonia Romana, 27, 03016 Alicante, España",
 "Campo Mpal. Cabo Las Huertas F-8 Campo 1":"Calle del Palangre, s/n, Alicante, España"
};
test("Los diez campos oficiales tienen dirección y enlace de navegación",()=>{
 assert.equal(api.known.length,10);
 for(const [name,address] of Object.entries(expected)){
   const place=api.maps(name);
   assert.equal(place.address,address);
   assert.equal(place.exact,true);
   const u=new URL(place.href);
   assert.equal(u.origin,"https://www.google.com");
   assert.equal(u.pathname,"/maps/dir/");
   assert.equal(u.searchParams.get("api"),"1");
   assert.equal(u.searchParams.get("destination"),address);
   assert.equal(u.searchParams.get("dir_action"),"navigate");
 }
});
test("Una variante de espacios o tildes mantiene su dirección",()=>{
 assert.equal(api.maps("  Campo Mpal. Via   Parque F-8 Campo 1 ").address,expected["Campo Mpal. Via Parque F-8 Campo 1"]);
});
test("Un campo nuevo usa búsqueda y nunca atribuye dirección falsa",()=>{
 const p=api.maps("Polideportivo Nuevo F-8 Campo 2");
 assert.equal(p.address,null);
 assert.equal(p.exact,false);
 const u=new URL(p.href);
 assert.equal(u.pathname,"/maps/search/");
 assert.match(u.searchParams.get("query"),/Polideportivo Nuevo/);
 assert(!u.searchParams.get("query").includes("Campo 2"));
});
test("No hay navegación para un campo vacío",()=>{
 assert.equal(api.maps(""),null);
 assert.equal(api.maps(null),null);
});
