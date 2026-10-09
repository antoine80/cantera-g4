/* Direcciones de instalaciones deportivas de FFCV (fuentes federativas).
   Solo se usan para abrir Google Maps: no se solicitan datos del usuario. */
(function(root){
"use strict";
const known=[
 ["Estadio Inmaculada F-8 Campo 1","Calle Padre Arrupe, s/n, 03016 Alicante, España"],
 ["Campo Mpal. Via Parque F-8 Campo 1","Camino Garbinet, 14A, 03015 Alicante, España"],
 ["Polideportivo Mpal. Pla Garbinet F-8 Campo 1","Calle Deportista Navarro Olcina, 10, 03015 Alicante, España"],
 ["Campo Mpal. Florida Babel. F-8 Campo 1","Calle Vicente Chávarri, 21, 03007 Alicante, España"],
 ["Camp Nou Los Olmos Mutxamel F-8 Campo 1","Calle Camí Vell, 4, 03110 Mutxamel, Alicante, España"],
 ["Campo Mpal. Tombola F-8 Campo 1","Calle Peñaguila, 13, 03009 Alicante, España"],
 ["Ciudad Dptva. de Alicante F-8 Campo 1","Calle Foguerer José Romeu, 03005 Alicante, España"],
 ["Campo Arena Alicante F-8 Campo 1 B","Avenida Locutor Vicente Hipólito, s/n, 03540 Alicante, España"],
 ["Polideportivo Mpal. Albufereta F-8","Camino Colonia Romana, 27, 03016 Alicante, España"],
 ["Campo Mpal. Cabo Las Huertas F-8 Campo 1","Calle del Palangre, s/n, Alicante, España"]
];
function normalize(s){
 return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
}
const lookup=new Map(known.map(([venue,address])=>[normalize(venue),address]));
function maps(venue){
 const name=String(venue||"").trim();
 if(!name)return null;
 const address=lookup.get(normalize(name));
 if(address){
   return {name,address,exact:true,href:"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(address)+"&dir_action=navigate"};
 }
 const query=name.replace(/\bF-(?:8|11)\b.*$/i,"").trim()+", Alicante, España";
 return {name,address:null,exact:false,href:"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(query)};
}
root.CanteraVenues=Object.freeze({maps,known:Object.freeze(known.map(row=>Object.freeze([...row])))});
})(globalThis);
