// Los datos de jugadores nunca se envían a GitHub ni a un servicio externo.
// Se almacenan exclusivamente en el IndexedDB de este origen/dispositivo.
const DB_NAME="cantera-g4-private-v1",STORE="squads";
function validId(id){return /^[a-z0-9_-]{2,64}$/i.test(String(id||""))}
export function parsePlayers(input){
 if(typeof input!=="string"||input.length>16000)throw Error("Formato o tamaño no válido (máximo 16 KB)");
 const lines=input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length>40)throw Error("Máximo 40 integrantes por equipo");
 const seen=new Set();
 return lines.map((line,i)=>{
  const parts=line.split(";").map(x=>x.trim());
  if(parts.length!==3)throw Error("Línea "+(i+1)+": usa dorsal;nombre;posición");
  const [num,name,position]=parts;
  if(num&&!/^\d{1,2}$/.test(num))throw Error("Dorsal inválido en línea "+(i+1));
  if(!name||name.length>90||/[\u0000-\u001f<>]/.test(name))throw Error("Nombre no válido en línea "+(i+1));
  if(position.length>40||/[\u0000-\u001f<>]/.test(position))throw Error("Posición no válida en línea "+(i+1));
  if(num&&seen.has(num))throw Error("Dorsal duplicado: "+num);
  if(num)seen.add(num);
  return {number:num,name,position};
 });
}
export function validateRoster(teamId,players){
 if(!validId(teamId)||!Array.isArray(players)||players.length>40)throw Error("Plantilla no válida");
 // La validación de campos es idéntica para importación y edición.
 return parsePlayers(players.map(p=>[p.number??"",p.name??"",p.position??""].join(";")).join("\n"));
}
function openDB(){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined")return reject(Error("Este navegador no admite IndexedDB"));
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"teamId"})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error("No se puede abrir el almacenamiento"));
 });
}
async function transaction(mode,operation){
 const db=await openDB();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
   const req=operation(store);
   let result;
   req.onsuccess=()=>{result=req.result};
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(tx.error||Error("Error de almacenamiento"));
   tx.onabort=()=>reject(tx.error||Error("Operación cancelada"));
  });
 }finally{db.close()}
}
export async function getRoster(teamId){
 if(!validId(teamId))throw Error("Equipo no válido");
 return (await transaction("readonly",s=>s.get(teamId)))?.players??[];
}
export async function saveRoster(teamId,players){
 const clean=validateRoster(teamId,players);
 await transaction("readwrite",s=>s.put({teamId,players:clean,updatedAt:new Date().toISOString()}));
 return clean;
}
export async function deleteRoster(teamId){
 if(!validId(teamId))throw Error("Equipo no válido");
 return transaction("readwrite",s=>s.delete(teamId));
}
export function parseBackup(data,teamIds){
 if(!data||data.format!=="cantera-g4-private-squads-v1"||!Array.isArray(data.teams)||data.teams.length>16)
  throw Error("El archivo no es una copia de plantillas de Cantera G4");
 const allowed=new Set(teamIds);
 const ids=new Set();
 return data.teams.map(({teamId,players})=>{
  if(!allowed.has(teamId)||ids.has(teamId))throw Error("Equipo ajeno o repetido");
  ids.add(teamId);
  return {teamId,players:validateRoster(teamId,players)};
 });
}
export async function exportBackup(teamIds){
 const teams=[];
 for(const teamId of teamIds)teams.push({teamId,players:await getRoster(teamId)});
 return {format:"cantera-g4-private-squads-v1",exportedAt:new Date().toISOString(),teams};
}
if(typeof window!=="undefined")window.CanteraPrivateSquads={
 parsePlayers,parseBackup,getRoster,saveRoster,deleteRoster,exportBackup
};
