/* Simulador local: los marcadores oficiales nunca se modifican. */
(function(root){
"use strict";
function finished(m){return m.status==="finished"&&Number.isInteger(m.homeScore)&&Number.isInteger(m.awayScore)}
function key(m){return [m.round,m.home,m.away].join(":")}
function simulate(d,overrides,focus){
 const rows=d.teams.map(t=>({id:t.id,name:t.name,PJ:0,PG:0,PE:0,PP:0,GF:0,GC:0,PTS:0}));
 const map=new Map(rows.map(r=>[r.id,r]));
 let simulated=0;
 d.matches.forEach(m=>{
  const k=key(m),chosen=overrides[k],valid=!finished(m)&&chosen&&Number.isInteger(chosen.home)&&Number.isInteger(chosen.away)&&chosen.home>=0&&chosen.away>=0&&chosen.home<=30&&chosen.away<=30;
  if(!finished(m)&&!valid)return;
  const h=map.get(m.home),a=map.get(m.away);
  if(!h||!a)return;
  const hs=valid?chosen.home:m.homeScore,as=valid?chosen.away:m.awayScore;
  if(valid)simulated++;
  h.PJ++;a.PJ++;h.GF+=hs;h.GC+=as;a.GF+=as;a.GC+=hs;
  if(hs>as){h.PG++;a.PP++;h.PTS+=3}
  else if(hs<as){a.PG++;h.PP++;a.PTS+=3}
  else {h.PE++;a.PE++;h.PTS++;a.PTS++}
 });
 rows.sort((a,b)=>b.PTS-a.PTS||((b.GF-b.GC)-(a.GF-a.GC))||b.GF-a.GF||a.name.localeCompare(b.name,"es"));
 return {rows,simulated,focus:rows.findIndex(x=>x.id===focus)+1,team:rows.find(x=>x.id===focus)||null}
}
root.CanteraSimulator={simulate,key,finished};
})(window);
