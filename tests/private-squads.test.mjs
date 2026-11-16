import test from "node:test";
import assert from "node:assert/strict";
import {parsePlayers,parseBackup,validateRoster} from "../client/private-squads.mjs";
test("Edita dorsales nombres y posiciones sin conexión",()=>{
 assert.deepEqual(parsePlayers("1;Jugador A;Portería\n10;Jugador B;Delantera"),[
  {number:"1",name:"Jugador A",position:"Portería"},
  {number:"10",name:"Jugador B",position:"Delantera"}
 ]);
});
test("La importación rechaza dorsales duplicados, HTML y un nombre vacío",()=>{
 assert.throws(()=>parsePlayers("4;Jugador A;Defensa\n4;Jugador B;Delantera"),/duplicado/);
 assert.throws(()=>parsePlayers("4;<script>;Defensa"),/Nombre no válido/);
 assert.throws(()=>parsePlayers("4;;Defensa"),/Nombre no válido/);
});
test("Una copia privada solamente importa equipos de la liga",()=>{
 const file={format:"cantera-g4-private-squads-v1",teams:[{teamId:"betis",players:[{number:"7",name:"Jugador C",position:"Medio"}]}]};
 assert.equal(parseBackup(file,["betis"])[0].players[0].number,"7");
 assert.throws(()=>parseBackup(file,["arena"]),/ajeno/);
});
test("No se admiten más de 40 integrantes ni números de dorsal extraños",()=>{
 assert.throws(()=>parsePlayers(Array(41).fill("1;Jugador;Defensa").join("\n")),/40/);
 assert.throws(()=>validateRoster("betis",[{number:"999",name:"Jugador",position:"Portería"}]),/Dorsal inválido/);
});
