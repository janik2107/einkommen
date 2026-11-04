'use strict';
/* Rechenkern: wertet die aus Numbers übernommenen Formeln aus (gleiche Ergebnisse wie die Tabelle).
   Bezüge: [D] = Spalte D derselben Zeile, [id:D] = andere Zeile, [$mwst] / [$rate:QUELLE:JAHR] = Einstellungen. */
(function(G){
const cache=new Map();let DB=null;
function setDB(db){DB=db;cache.clear()}
function clear(){cache.clear()}
const numv=x=>typeof x==='number'&&isFinite(x)?x:(typeof x==='string'&&x.trim()!==''&&isFinite(+x)?+x:0);
function tok(f){const t=[];let i=0;while(i<f.length){const c=f[i];
 if(c===' '){i++;continue}
 if('+-*/()'.includes(c)){t.push(c);i++;continue}
 if(c==='['){const j=f.indexOf(']',i);t.push({ref:f.slice(i+1,j)});i=j+1;continue}
 const m=/^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(f.slice(i));if(m){t.push(+m[0]);i+=m[0].length;continue}
 throw new Error('Formel: '+f)}return t}
const astCache=new Map();
function parse(f){if(astCache.has(f))return astCache.get(f);const t=tok(f);let p=0;
 const expr=()=>{let a=term();while(t[p]==='+'||t[p]==='-'){const o=t[p++];a={o,a,b:term()}}return a};
 const term=()=>{let a=fac();while(t[p]==='*'||t[p]==='/'){const o=t[p++];a={o,a,b:fac()}}return a};
 const fac=()=>{const x=t[p++];if(x==='('){const e=expr();p++;return e}if(x==='-')return{o:'neg',a:fac()};if(x==='+')return fac();if(typeof x==='number')return{n:x};if(x&&x.ref)return{r:x.ref};throw new Error('Formel: '+f)};
 const a=expr();astCache.set(f,a);return a}
function refTarget(rec,r){if(r[0]==='$')return{setting:r.slice(1)};const i=r.lastIndexOf(':');return i<0?{id:rec.id,c:r}:{id:r.slice(0,i),c:r.slice(i+1)}}
function setting(k){const s=DB.settings||{};if(k==='mwst')return numv(s.mwst??19)/100;
 if(k.startsWith('rate:')){const[,src,yr]=k.split(':');const r=(s.rates||{})[src+':'+yr]??(s.rates||{})[src+':*'];return numv(r??30)/100}return 0}
function ev(rec,a){if(a.n!=null)return a.n;if(a.r){const t=refTarget(rec,a.r);if(t.setting)return setting(t.setting);return val(DB.recs[t.id],t.c)}
 if(a.o==='neg')return-ev(rec,a.a);const x=ev(rec,a.a),y=ev(rec,a.b);return a.o==='+'?x+y:a.o==='-'?x-y:a.o==='*'?x*y:y===0?NaN:x/y}
function val(rec,c){if(!rec)return 0;const k=rec.id+':'+c;if(cache.has(k))return cache.get(k);cache.set(k,0);let v;
 const f=rec.f&&rec.f[c];if(f){if(f==='#REF!')v=rec.v&&typeof rec.v[c]==='number'?rec.v[c]:NaN;else{try{v=ev(rec,parse(f))}catch(e){v=NaN}}}else v=numv(rec.v&&rec.v[c]);
 cache.set(k,v);return v}
// Lineare Zerlegung (nur + und -): {key:coef}, sonst null
function linear(rec,a,coef,out){if(a.n!=null){out.push(['#',a.n*coef]);return true}
 if(a.r){const t=refTarget(rec,a.r);if(t.setting)return false;out.push([t.id+':'+t.c,coef]);return true}
 if(a.o==='neg')return linear(rec,a.a,-coef,out);if(a.o==='+'||a.o==='-')return linear(rec,a.a,coef,out)&&linear(rec,a.b,a.o==='+'?coef:-coef,out);return false}
// Rechenweg der Netto-Spalte: Basis (meist Überweisung) und alle Zu-/Abzüge in Tabellen-Reihenfolge
function waterfall(rec,netCol,deep=true){let terms=[[rec.id+':'+netCol,1]];
 for(let guard=0;guard<(deep?12:1);guard++){const bi=terms.findIndex(([k,c])=>k!=='#'&&c>0);if(bi<0)break;const[k,c]=terms[bi];const[id,col]=[k.slice(0,k.lastIndexOf(':')),k.slice(k.lastIndexOf(':')+1)];
  const r=DB.recs[id],f=r&&r.f&&r.f[col];if(!f||f==='#REF!')break;const out=[];if(!linear(r,parse(f),c,out))break;
  terms.splice(bi,1,...out);
  const m=new Map();for(const[kk,cc]of terms)m.set(kk==='#'?'#'+m.size:kk,(m.get(kk)||0)+cc);terms=[...m.entries()].filter(([kk,cc])=>Math.abs(cc)>1e-12).map(([kk,cc])=>[kk.startsWith('#')?'#':kk,cc]);
  const fx=terms.filter(t=>t[0]==='#').reduce((s,t)=>s+t[1],0);terms=terms.filter(t=>t[0]!=='#');if(Math.abs(fx)>1e-12)terms.push(['#',fx])}
 return terms.map(([k,c])=>{if(k==='#')return{key:'#',col:'',label:'Korrektur (fester Betrag)',coef:1,amount:c};
  const i=k.lastIndexOf(':'),id=k.slice(0,i),col=k.slice(i+1),r=DB.recs[id],tb=DB.tables[r.t];const lab=(tb.cols.find(x=>x[0]===col)||[,col])[1]||col;
  return{key:k,col,label:lab+(id!==rec.id?' ('+(r.label||id)+')':''),coef:c,amount:c*val(r,col)}})}
const isTax=l=>/^ESt|Steuerdiff/i.test(l.trim()),isMwst=l=>/^MwSt/i.test(l.trim());
function incomeSummary(rec){const tb=DB.tables[rec.t];const net=val(rec,rec.net||tb.net);const w=waterfall(rec,rec.net||tb.net);
 let gross=val(rec,'B'),mwst=0,tax=0,ded=0;const base=w[0];
 for(const x of w.slice(1)){if(isMwst(x.label))mwst-=x.amount;else if(isTax(x.label))tax-=x.amount;else ded-=x.amount}
 if(!gross&&base)gross=base.amount; // Zeile ohne Überweisung: Basis ist der erste Betrag im Rechenweg
 else if(base&&base.col!=='B')ded+=gross-base.amount; // Basis ≠ Überweisung: Differenz zählt als Abzug
 return{gross,mwst,tax,ded,net,steps:w}}
G.Calc={setDB,clear,val,waterfall,incomeSummary,parse,isTax,isMwst,numv};
})(typeof window!=='undefined'?window:globalThis);
