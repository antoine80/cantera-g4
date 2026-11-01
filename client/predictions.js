/* Pronósticos orientativos de Cantera G4. Sin datos externos ni apuestas. */
(function(g){
"use strict";
function done(m){return m.status==="finished"&&Number.isInteger(m.homeScore)&&Number.isInteger(m.awayScore)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function stats(d,id){
 const played=d.matches.filter(m=>done(m)&&(m.home===id||m.away===id));
 const s={id,pj:played.length,w:0,d:0,l:0,gf:0,gc:0};
 for(const m of played){const h=m.home===id,a=h?m.homeScore:m.awayScore,b=h?m.awayScore:m.homeScore;
 s.gf+=a;s.gc+=b;if(a>b)s.w++;else if(a===b)s.d++;else s.l++}return s
}
function factorial(n){let f=1;for(let i=2;i<=n;i++)f*=i;return f}
function pois(k,lambda){return Math.exp(-lambda)*Math.pow(lambda,k)/factorial(k)}
function forecast(d,m){
 const a=stats(d,m.home),b=stats(d,m.away);
 const all=d.matches.filter(done),avg=all.length?all.reduce((v,x)=>v+x.homeScore+x.awayScore,0)/(2*all.length):2.5;
 // Regularización: prior de cuatro partidos, evita extremos con pocas muestras.
 const prior=4,home=clamp(avg*(a.gf+prior*avg)/(a.pj+prior)/avg*(b.gc+prior*avg)/(b.pj+prior)/avg*1.06,.25,7);
 const away=clamp(avg*(b.gf+prior*avg)/(b.pj+prior)/avg*(a.gc+prior*avg)/(a.pj+prior)/avg/1.06,.25,7);
 let win=0,draw=0,lose=0,total=0,mode=0,score=[0,0];
 for(let i=0;i<=15;i++)for(let j=0;j<=15;j++){const p=pois(i,home)*pois(j,away);total+=p;
 if(i>j)win+=p;else if(i===j)draw+=p;else lose+=p;
 if(p>mode){mode=p;score=[i,j]}}
 return {home:home,away:away,win:win/total,draw:draw/total,lose:lose/total,score,playedA:a.pj,playedB:b.pj,
 reliable:a.pj>=3&&b.pj>=3&&all.length>=12}
}
function analyze(d,id){
 const s=stats(d,id);
 return {stats:s,upcoming:d.matches.filter(m=>!done(m)&&(m.home===id||m.away===id)).sort((a,b)=>
 (a.date||"9999").localeCompare(b.date||"9999")||(a.time||"").localeCompare(b.time||"")||a.round-b.round)
 .map(m=>({match:m,rival:m.home===id?m.away:m.home,home:m.home===id,model:forecast(d,m)}))}
}
g.CanteraPredictions={analyze,stats,forecast};
})(window);
