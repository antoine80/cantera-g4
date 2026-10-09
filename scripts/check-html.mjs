import {readFile} from "node:fs/promises";
import {Script} from "node:vm";
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/);
if(!script)throw Error("Falta script web");
new Script(script[1],{filename:"index.html"});
for(const id of ["importLocal","fileLocal","clearLocal","round","team","content"]){
 if(!html.includes('id="'+id+'"'))throw Error("Falta "+id);
}
console.log("OK: JavaScript de la PWA y componentes de importación válidos");
