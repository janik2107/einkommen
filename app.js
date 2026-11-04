'use strict';
const VERSION='ek-v5',KEY='einkommen-v1';
const $=s=>document.querySelector(s),view=$('#view');
const EUR=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
const fm=x=>isFinite(x)?EUR.format(Math.abs(x)<.005?0:x):'—';
const fk=x=>Math.abs(x)>=1000?(x/1000).toLocaleString('de-DE',{maximumFractionDigits:Math.abs(x)>=10000?0:1})+'k':Math.round(x).toString();
const pct=x=>isFinite(x)?x.toLocaleString('de-DE',{maximumFractionDigits:1})+' %':'—';
const MON=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let SRC={},SRCS=[];const NOSRC={name:'?',cls:'s3',col:'var(--s3)',l:'?'};
const PALETTE=['#007aff','#34c759','#ff9500','#af52de','#ff2d55','#5ac8fa','#ffcc00','#5856d6','#a2845e','#30b0c7','#ff3b30','#64d2ff','#8e8e93'];
const num=s=>{s=String(s??'').trim().replace(/[€\s]/g,'');if(!s)return NaN;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');else if((s.match(/\./g)||[]).length>1||/^\d{1,3}\.\d{3}$/.test(s))s=s.replace(/\./g,'');return +s};
const inpE=x=>isFinite(x)&&x!==''?(+x).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
const inp=x=>isFinite(x)&&x!==''?(+(+x).toFixed(2)).toLocaleString('de-DE',{maximumFractionDigits:2,useGrouping:false}):'';
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
function defaults(){return{v:5,archive:{},tables:{},recs:{},settings:{mwst:19,rates:{},defaults:{},theme:'auto'},pin:null,setups:[]}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.recs){s.settings=Object.assign(defaults().settings,s.settings);s.setups=s.setups||[];s.archive=s.archive||{};return s}}catch(e){}return defaults()}
let S=load();Calc.setDB(S);
let SUM=new Map();migrate(S,true);buildSrc();
function save(){localStorage.setItem(KEY,JSON.stringify(S));Calc.setDB(S);SUM=new Map();buildSrc()}
// Quellen (Arbeitgeber/Auftraggeber) kommen nur aus den eigenen Daten, nicht aus dem Code
// v1/v2 → v3: Netto-Korrekturen aus v2 werden in „Nach MwSt.“ umgerechnet (gleiches Netto); Netto-Gesamt-Korrekturen entfallen;
// Zeilen ohne Unterart im neuesten Jahr einer Quelle bekommen die Haupt-Unterart
function migrate(st,persist,force){const from=st.v||1;if(from>=5&&!force)return;Calc.setDB(st);const recs=Object.values(st.recs);const T_=r=>st.tables[r.t]||{};
 for(const r of recs){if(!r.ov)continue;const tb=T_(r);
  if(tb.kind==='inc'){const nc=r.net||tb.net;if(r.ov[nc]!=null){const target=+r.ov[nc];delete r.ov[nc];const c=Calc.nachMwstCol(r);let done=false;
    if(c){Calc.clear();const d0=Calc.raw(r,c);r.ov[c]=d0;Calc.clear();const n0=Calc.val(r,nc);r.ov[c]=d0+1000;Calc.clear();const n1=Calc.val(r,nc);const k=(n1-n0)/1000;
     if(k>1e-6){r.ov[c]=Math.round((d0+(target-n0)/k)*100)/100;Calc.clear();done=Math.abs(Calc.val(r,nc)-target)<0.05}if(!done)delete r.ov[c]}
    (r.notes=r.notes||[]).push(done?'Deine Netto-Korrektur aus Version 2 wurde in „Nach MwSt.“ umgerechnet.':'Netto-Korrektur aus Version 2 ('+target.toFixed(2).replace('.',',')+' €) entfernt – bitte „Nach MwSt.“ anpassen.')}}
  if(tb.kind==='bud'&&r.ov.B!=null){r.ovOld={B:r.ov.B};delete r.ov.B}
  if(r.ov&&!Object.keys(r.ov).length)delete r.ov}
 const bySrc={};for(const r of recs){const tb=T_(r);if(tb.kind!=='inc'||!tb.source)continue;(bySrc[tb.source]=bySrc[tb.source]||[]).push(r)}
 for(const rs of Object.values(bySrc)){const y=Math.max(...rs.map(r=>+String(r.date).slice(0,4)));const ry=rs.filter(r=>+String(r.date).slice(0,4)===y).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  // nur Quellen, deren Unterarten VOR dem Namen stehen („<Unterart> <QUELLE> …“); Haupt-Unterart = erste im neuesten Jahr; gilt für alle Jahre
  const pre=new Set(rs.filter(r=>r.sub&&String(r.label||'').toUpperCase().startsWith(r.sub.toUpperCase()+' ')).map(r=>r.sub));
  const main=(ry.find(r=>r.sub&&pre.has(r.sub))||{}).sub;if(!main)continue;
  for(const r of rs)if(!r.sub){r.sub=main;if(r.label&&!String(r.label).toUpperCase().startsWith(main.toUpperCase()+' '))r.label=main+' '+r.label}}
 st.v=5;Calc.setDB(S===st?st:S);if(persist)try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}}
function buildSrc(){const g={};for(const r of Object.values(S.recs)){const t=S.tables[r.t];if(!t||t.kind!=='inc'||!t.source)continue;g[t.source]=(g[t.source]||0)+(Calc.numv(r.v&&r.v.B)||0)}
 SRCS=Object.keys(g).sort((a,b)=>g[b]-g[a]);SRC={};SRCS.forEach((k,i)=>SRC[k]={name:k.length>5&&k===k.toUpperCase()?k[0]+k.slice(1).toLowerCase():k,cls:'s'+(i%4),col:`var(--s${i%4})`,l:k[0].toUpperCase()})}
const SR=k=>SRC[k]||NOSRC;
const U={tab:'home',year:null,filter:'all',detail:null,form:null,bm:null,bedit:false,defs:null,result:null};

/* ---------- Daten-Helfer ---------- */
const T=r=>S.tables[r.t]||{};
const isInc=r=>T(r).kind==='inc',isBud=r=>T(r).kind==='bud';
const srcOf=r=>T(r).source;
const netCol=r=>r.net||T(r).net;
const sm=r=>{if(!SUM.has(r.id))SUM.set(r.id,Calc.incomeSummary(r));return SUM.get(r.id)};
const yr=r=>+String(r.date||'').slice(0,4),mo=r=>+String(r.date||'').slice(5,7)-1;
const all=()=>Object.values(S.recs);
const byDate=(a,b)=>(a.date||'').localeCompare(b.date||'')||ordr(a)-ordr(b);
const ordr=r=>+(r.id.split('-').pop())||0;
const incs=(y,withEmpty)=>all().filter(r=>isInc(r)&&(y==null||yr(r)===y)&&(withEmpty||!r.empty)).sort(byDate);
const buds=y=>all().filter(r=>isBud(r)&&yr(r)===y).sort(byDate);
const years=()=>{const s=new Set(all().filter(r=>isInc(r)||isBud(r)).map(yr).filter(Boolean));return[...s].sort()};
const unknownDay=r=>(r.notes||[]).some(n=>/Tag unbekannt/.test(n))||String(r.date).length<10;
const title=r=>{const s=SR(srcOf(r)).name;return r.sub?r.sub+' · '+s:s};
const dtext=r=>{const d=String(r.date);if(unknownDay(r))return MON[mo(r)]+' '+yr(r)+' · Tag offen';return d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4)};
const ymOf=r=>String(r.date||'').slice(0,7);
const curYM=()=>today().slice(0,7);
// Archiv: alle Monate vor dem aktuellen Monat (rollt automatisch); manuell: archive[ym]=true (archivieren) / false (zurückgeholt)
const isArch=k=>{const m=S.archive||{};if(m[k]===true)return true;if(m[k]===false)return false;return k<curYM()};
function toggleArch(k){S.archive=S.archive||{};const a=isArch(k);if(a){if(k<curYM())S.archive[k]=false;else delete S.archive[k]}else{if(k<curYM())delete S.archive[k];else S.archive[k]=true}save()}
const ymText=k=>MON[+k.slice(5,7)-1]+' '+k.slice(0,4);
const manBadge='<span class="badge man">manuell</span>';
const colLabel=(tb,c)=>((tb.cols||[]).find(x=>x[0]===c)||[,c])[1]||c;
function agg(rs){const z=()=>({g:0,m:0,t:0,d:0,n:0,c:0});const o={ist:z(),plan:z(),src:{},months:[...Array(12)].map(()=>({}))};
 for(const r of rs){const s=sm(r),k=r.plan?'plan':'ist',src=srcOf(r);
  for(const[a,b]of[['g','gross'],['m','mwst'],['t','tax'],['d','ded'],['n','net']]){if(isFinite(s[b]))o[k][a]+=s[b]}o[k].c++;
  if(!r.plan){o.src[src]=o.src[src]||z();o.src[src].g+=s.gross;o.src[src].n+=s.net;o.src[src].t+=s.tax;o.src[src].c++}
  const mm=o.months[mo(r)];mm[src+k]=(mm[src+k]||0)+(isFinite(s.net)?s.net:0)}
 return o}
function deriveRates(){const R=S.settings.rates;for(const r of incs()){if(r.plan)continue;const k=srcOf(r)+':'+yr(r);const st=Calc.waterfall(r,netCol(r)).find(x=>Calc.isTax(x.tlabel)&&r.f[x.col]);
 const m=st&&/\*\s*(\d*\.\d+)\s*$/.exec(r.f[st.col]);if(m&&!(k in R)){R['_'+k]=+(m[1]*100).toFixed(2)}}
 for(const k of Object.keys(R))if(k[0]==='_'){if(!(k.slice(1) in R))R[k.slice(1)]=R[k];delete R[k]}}
function rateFor(src,y){const R=S.settings.rates;if(R[src+':'+y]!=null)return R[src+':'+y];const ks=Object.keys(R).filter(k=>k.startsWith(src+':')).sort();return ks.length?R[ks[ks.length-1]]:30}

/* ---------- Rendering ---------- */
function setTab(t){U.tab=t;U.detail=null;U.check=null;U.wfEdit=null;U.tedit=null;U.sheet=null;U.archive=false;U.amonth=null;U.barch=false;U.netEdit=null;if(t!=='new'||(U.form&&U.form.mode==='edit'))U.form=null;U.bedit=false;U.defs=null;render();scrollTo(0,0)}
function yearSegs(){const ys=years();if(!ys.length)return'';return`<div class="segs">${ys.map(y=>`<button class="seg ${y===U.year?'on':''}" data-act="year" data-v="${y}">${y}</button>`).join('')}</div>`}
function render(){document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('on',b.dataset.tab===U.tab));
 if(U.year==null){const ys=years(),cy=new Date().getFullYear();U.year=ys.includes(cy)?cy:ys[ys.length-1]||cy}
 let h;if(U.check&&S.recs[U.check])h=checklist();else if(U.detail)h=detail();else if(U.form&&U.form.mode==='edit')h=form();else h={home,list,new:form,budget,settings}[U.tab]();
 view.innerHTML=`<div class="tab">${h}</div>`;renderSheet();if(U.tab==='new'||U.form)refreshForm()}
function emptyHint(){return`<div class="card empty"><b>Noch keine Daten</b><p>Öffne den Einrichtungslink oder lade in den Einstellungen die Einrichtungsdatei.</p><button class="link" data-act="tab" data-v="settings">Zu den Einstellungen</button></div>`}
function resultPanel(){const r=U.result;if(!r)return'';return`<div class="panel"><h3>${r.already?'Schon importiert':'Import fertig'}</h3>${r.already?'<p>Diese Daten sind bereits in der App. Es wurde nichts doppelt angelegt.</p>':`<p><b>${r.add}</b> Einträge übernommen${r.skip?`, ${r.skip} waren schon da`:''}.</p>${r.notes?`<p>${r.notes} Einträge haben einen Hinweis (z. B. Tag unbekannt, Tippfehler im Jahr korrigiert, kaputte Formel in Numbers) – du siehst ihn in der Detailansicht.</p>`:''}`}<button class="link" data-act="closeres">OK</button></div>`}

function home(){if(!years().length)return`<h1>Übersicht</h1>${resultPanel()}${emptyHint()}`;
 const y=U.year,a=agg(incs(y)),cur=y===new Date().getFullYear(),istM=incs(y).filter(r=>!r.plan).map(mo),lastM=istM.length?Math.max(...istM):11,p=agg(incs(y-1).filter(r=>!cur||mo(r)<=lastM)),hasPrev=incs(y-1).length>0;
 const planM=[...new Set(incs(y).filter(r=>r.plan).map(mo))].sort((x,z)=>x-z);
 const months=a.months;let max=0;const mt=m=>SRCS.reduce((x,k)=>x+(m[k+'ist']||0)+(m[k+'plan']||0),0);months.forEach(m=>{max=Math.max(max,mt(m))});max=max||1;
 const W=340,H=170,L=30,B=148,bw=17,st=(W-L)/12;const sc=v=>v/max*(B-14);
 const ticks=[0,.5,1].map(f=>f*max);
 let svg=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Netto pro Monat">`+ticks.map(t=>`<line x1="${L}" x2="${W}" y1="${B-sc(t)}" y2="${B-sc(t)}" stroke="var(--sep)" stroke-width=".6"/><text x="${L-4}" y="${B-sc(t)+3}" text-anchor="end">${fk(t)}</text>`).join('');
 svg+=`<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="var(--fill)"/><line x1="0" y1="0" x2="0" y2="4" stroke="var(--sec)" stroke-width="1.4" opacity=".5"/></pattern></defs>`;
 months.forEach((m,i)=>{const x=L+i*st+(st-bw)/2;let yb=B;const seg=(v,fill,op)=>{if(!v||v<=0)return'';const hh=sc(v);yb-=hh;return`<rect x="${x}" y="${yb}" width="${bw}" height="${hh}" fill="${fill}" opacity="${op}"/>`};
  const tot=mt(m);
  svg+=SRCS.map(k=>seg(m[k+'ist'],SR(k).col,1)).join('')+seg(SRCS.reduce((x,k)=>x+(m[k+'plan']||0),0),'url(#hatch)',1);
  if(tot>0)svg+=`<text class="vl" x="${x+bw/2}" y="${yb-3}" text-anchor="middle">${fk(tot)}</text>`;
  svg+=`<text x="${x+bw/2}" y="${B+13}" text-anchor="middle">${MON[i][0]}</text>`});svg+='</svg>';
 const SV=SRCS.map(k=>[k,a.src[k]||{g:0,n:0,c:0,t:0}]),tn=SV.reduce((x,[,v])=>x+v.n,0)||1;
 const cmp=(lbl,c,v)=>{const d=c-v,pc=v?d/Math.abs(v)*100:NaN;return`<div class="cell"><div class="l">${lbl}<small>${y-1}: ${fm(v)}</small></div><div class="r"><b>${fm(c)}</b><br><span class="${d>=0?'up':'down'}">${d>=0?'+':'−'}${fm(Math.abs(d))}${isFinite(pc)?' ('+(d>=0?'+':'−')+pct(Math.abs(pc))+')':''}</span></div></div>`};
 const firstM=incs(y-1).length?Math.min(...incs(y-1).map(mo)):0;
 return`<h1>Übersicht</h1>${resultPanel()}${yearSegs()}
 <div class="card hero"><div class="lbl">Netto ${y}</div><div class="big">${fm(a.ist.n)}</div><div class="sub">aus ${fm(a.ist.g)} brutto · ${pct(a.ist.g?a.ist.n/a.ist.g*100:NaN)} bleiben</div>${a.plan.c?`<div class="sub" style="margin-top:6px"><span class="badge" style="margin:0 4px 0 0">Plan</span>+ ${fm(a.plan.n)} netto geplant (${planM.map(i=>MON[i].slice(0,3)).join(', ')})</div>`:''}</div>
 <div class="grid"><div class="tile"><span>Brutto</span><b>${fm(a.ist.g)}</b><small>${a.ist.c} Überweisungen</small></div><div class="tile"><span><i class="dotc" style="background:var(--red)"></i>Einkommensteuer</span><b>${fm(a.ist.t)}</b><small>${pct(a.ist.g?a.ist.t/a.ist.g*100:NaN)} vom Brutto</small></div>
 <div class="tile"><span><i class="dotc" style="background:var(--orange)"></i>MwSt.</span><b>${fm(a.ist.m)}</b><small>geht ans Finanzamt</small></div><div class="tile"><span><i class="dotc" style="background:var(--sec)"></i>Abzüge</span><b>${fm(a.ist.d)}</b><small>Gehälter, Auto, Büro …</small></div></div>
 <div class="card"><div class="hero"><div class="lbl">Netto pro Monat</div></div>${svg}<div class="legend">${SRCS.map(k=>`<span><i class="dotc" style="background:${SR(k).col}"></i>${esc(SR(k).name)}</span>`).join('')}${a.plan.c?'<span><i class="dotc" style="background:url(#);border:1px dashed var(--sec)"></i>Plan</span>':''}</div></div>
 <div class="gh">${SRCS.map(k=>esc(SR(k).name)).join(' vs. ')}</div><div class="card" style="padding:12px 0 4px"><div style="padding:0 16px"><div class="split">${SV.map(([k,v])=>`<i style="width:${Math.max(v.n,0)/tn*100}%;background:${SR(k).col}"></i>`).join('')}</div></div>
 <div class="group ic" style="box-shadow:none;margin:0">${SV.map(([k,v])=>`<button class="cell" data-act="filter" data-v="${k}"><span class="av ${SR(k).cls}">${SR(k).l}</span><div class="l">${SR(k).name}<small>${v.c} Einträge · brutto ${fm(v.g)} · Steuer ${fm(v.t)}</small></div><div class="r"><b>${fm(v.n)}</b><br>${pct(v.n/tn*100)}</div></button>`).join('')}</div></div>
 ${(()=>{const m={};incs(y).filter(r=>!r.plan).forEach(r=>{const k=srcOf(r)+'|'+(r.sub||'');const v=m[k]=m[k]||{src:srcOf(r),sub:r.sub||'',n:0,g:0,c:0};const q=sm(r);v.n+=q.net;v.g+=q.gross;v.c++});const L=Object.values(m).sort((a,b)=>SRCS.indexOf(a.src)-SRCS.indexOf(b.src)||b.n-a.n);
  return L.length>SRCS.length?`<div class="gh">Nach Art</div><div class="group ic">${L.map(v=>`<div class="cell"><span class="av ${SR(v.src).cls}">${SR(v.src).l}</span><div class="l">${esc(v.sub?(v.sub.length>5?v.sub:v.sub+' · '+SR(v.src).name):SR(v.src).name)}<small>${v.c} Einträge · brutto ${fm(v.g)}</small></div><div class="r"><b>${fm(v.n)}</b></div></div>`).join('')}</div>`:''})()}
 <div class="gh">Vergleich mit ${y-1}</div>${hasPrev?`<div class="group">${cmp('Netto',a.ist.n,p.ist.n)}${cmp('Brutto',a.ist.g,p.ist.g)}${cmp('Einkommensteuer',a.ist.t,p.ist.t)}</div><div class="foot">${cur&&lastM<11?`Gleicher Zeitraum: Januar–${MON[lastM]}. `:''}${firstM>0?`${y-1} enthält Daten erst ab ${MON[firstM]}.`:''}</div>`:`<div class="group"><div class="cell"><div class="l" style="color:var(--sec)">Für ${y-1} gibt es keine Daten.</div></div></div>`}`}

const filt=r=>U.filter==='all'||srcOf(r)===U.filter;
function incRow(r){const s=sm(r),oc=openCount(r);return`<div class="swipe"><button class="swdel" data-act="del" data-id="${r.id}">Löschen</button><button class="cell ${r.plan?'plan':''}" data-act="open" data-id="${r.id}"><span class="av ${SR(srcOf(r)).cls}">${SR(srcOf(r)).l}</span><div class="l"><div class="one">${esc(r.sub&&r.sub.length>5?r.sub:title(r))}</div><small>${r.plan?'<span class="badge" style="margin:0 5px 0 0">Plan</span>':''}${s.manual?'<span class="badge man" style="margin:0 5px 0 0">manuell</span>':''}${unknownDay(r)?'Tag offen':String(r.date).slice(8,10)+'.'+String(r.date).slice(5,7)+'.'} · brutto ${fm(s.gross)}</small></div><div class="r"><b>${fm(s.net)}</b>${oc?`<br><span class="badge open">${oc} offen</span>`:''}</div><span class="chev">›</span></button></div>`}
const sumN=(rs,pl)=>rs.filter(r=>!!r.plan===pl).reduce((x,r)=>x+(isFinite(sm(r).net)?sm(r).net:0),0);
const sumG=rs=>rs.filter(r=>!r.plan).reduce((x,r)=>x+(isFinite(sm(r).gross)?sm(r).gross:0),0);
function monthSection(k,list,withBtn){const n=sumN(list,false),pn=sumN(list,true);
 return`<section class="month"><div class="mh"><span>${ymText(k)}</span><span>netto <b>${fm(n)}</b>${pn?' · Plan '+fm(pn):''}</span></div><div class="group ic">${list.slice().reverse().map(incRow).join('')}</div>${withBtn?`<div class="mfoot"><button class="link" data-act="archtog" data-v="${k}">${isArch(k)?'Monat zurückholen':'Monat archivieren'}</button></div>`:''}</section>`}
function chipsHtml(){return`<div class="chips">${[['all','Alle'],...SRCS.map(k=>[k,SR(k).name])].map(([k,l])=>`<button class="chip ${U.filter===k?'on':''}" data-act="filter" data-v="${k}">${l}</button>`).join('')}</div>`}
function archRow(kind,months,total){return`<div class="group ic"><button class="cell" data-act="${kind}"><span class="av arc"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/></svg></span><div class="l">Archiv<small>${months} Monat${months===1?'':'e'}${total!=null?' · netto '+fm(total):''}</small></div><span class="chev">›</span></button></div>`}
function list(){if(!years().length)return`<h1>Einnahmen</h1>${emptyHint()}`;
 if(U.amonth)return archMonth();if(U.archive)return archiveView();
 const rs=incs().filter(filt);const g={};rs.forEach(r=>(g[ymOf(r)]=g[ymOf(r)]||[]).push(r));
 const live=Object.keys(g).filter(k=>!isArch(k)).sort(),arch=Object.keys(g).filter(isArch);
 const cur=curYM();const hasCur=live.includes(cur)||isArch(cur);
 return`<div class="top"><h1>Einnahmen</h1><button class="plus" data-act="tab" data-v="new" aria-label="Neue Einnahme">+</button></div>${chipsHtml()}${archRow('archopen',arch.length,arch.reduce((x,k)=>x+sumN(g[k],false),0))}
 ${hasCur?'':`<section class="month"><div class="mh"><span>${ymText(cur)}</span><span>netto <b>${fm(0)}</b></span></div><div class="card empty" style="padding:18px">Diesen Monat noch keine Einnahmen.<br><button class="link" data-act="tab" data-v="new">Einnahme erfassen</button></div></section>`}
 ${live.map(k=>monthSection(k,g[k],true)).join('')}
 <div class="foot hint">Ältere Monate wandern am Monatsanfang automatisch ins Archiv. Sie zählen weiter in der Übersicht.</div>`}
function yearBlocks(keys,rowFn,sumFn){const ys=[...new Set(keys.map(k=>k.slice(0,4)))].sort().reverse();U.yopen=U.yopen||new Set([ys[0]]);
 return ys.map(y=>{const ks=keys.filter(k=>k.startsWith(y)).sort().reverse();const open=U.yopen.has(y);const t=sumFn(ks);
  return`<button class="yh" data-act="ytog" data-v="${y}"><span>${y}</span><span class="num">${t}<i class="tw ${open?'o':''}">›</i></span></button>${open?`<div class="group ic">${ks.map(rowFn).join('')}</div>`:''}`}).join('')}
function archiveView(){const rs=incs().filter(filt);const g={};rs.forEach(r=>(g[ymOf(r)]=g[ymOf(r)]||[]).push(r));const keys=Object.keys(g).filter(isArch);
 return`<div class="navbar"><button data-act="archclose">‹ Einnahmen</button></div><h1 style="margin-top:2px">Archiv</h1>${chipsHtml()}
 ${keys.length?yearBlocks(keys,k=>`<button class="cell" data-act="amonth" data-v="${k}"><span class="av arc2">${+k.slice(5,7)}</span><div class="l">${MON[+k.slice(5,7)-1]}<small>brutto ${fm(sumG(g[k]))}</small></div><div class="r"><b>${fm(sumN(g[k],false))}</b>${g[k].some(r=>sm(r).manual)?'<br>'+manBadge:''}</div><span class="chev">›</span></button>`,
  ks=>'netto '+fm(ks.reduce((x,k)=>x+sumN(g[k],false),0))+' · brutto '+fm(ks.reduce((x,k)=>x+sumG(g[k]),0))):'<div class="card empty">Noch nichts im Archiv.</div>'}`}
function archMonth(){const k=U.amonth;const rs=incs().filter(r=>ymOf(r)===k&&filt(r));
 return`<div class="navbar"><button data-act="amback">‹ Archiv</button></div><h1 style="margin-top:2px">${ymText(k)}</h1>
 <div class="grid"><div class="tile"><span>Netto</span><b>${fm(sumN(rs,false))}</b></div><div class="tile"><span>Brutto</span><b>${fm(sumG(rs))}</b></div></div>
 ${rs.length?`<div class="group ic">${rs.slice().reverse().map(incRow).join('')}</div>`:'<div class="card empty">Keine Einträge.</div>'}
 <div class="group" style="margin-top:18px"><button class="cell btn" data-act="archtog" data-v="${k}">${isArch(k)?'Monat zurückholen':'Monat archivieren'}</button></div>`}

function prettyF(r,f){const tb=T(r);return'= '+f.replace(/\[\$mwst\]/g,'MwSt').replace(/\[\$rate:[^\]]+\]/g,'Steuersatz').replace(/\[([^\]:]+):([A-Z]{1,2})\]/g,(m,id,c)=>{const o=S.recs[id];return o?`„${colLabel(T(o),c)}“ (${o.label||id})`:'?'}).replace(/\[([A-Z]{1,2})\]/g,(m,c)=>colLabel(tb,c)).replace(/\*/g,' × ').replace(/\//g,' ÷ ').replace(/-/g,' − ').replace(/\+/g,' + ').replace(/(\d)\.(\d)/g,'$1,$2')}
const PEN='<svg class="pen" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
// „Nach MwSt.“ direkt ändern: manuelle Überschreibung der Zwischensumme; ESt, Abzüge und Netto rechnen mit den Tabellen-Formeln neu
function nachMwstRow(r,s,run){const c=Calc.nachMwstCol(r);if(!c)return`<div class="cell subt"><div class="l">= Nach MwSt.</div><div class="r">${fm(run)}</div></div>`;
 const key=r.id+':'+c,man=Calc.isOv(r,c),calc=Calc.raw(r,c);
 if(U.netEdit===key)return`<div class="cell subt edit"><div class="l">= Nach MwSt.</div><input id="netin" inputmode="decimal" value="${inpE(run)}" autocomplete="off"></div><div class="cell subt"><div class="rowbtns" style="width:100%;margin:8px 0"><button data-act="netcancel">Abbrechen</button><button class="primary" style="width:auto;flex:1" data-act="netsave" data-v="${key}">Sichern</button></div></div>`;
 return`<button class="cell subt nm" data-act="netedit" data-v="${key}" aria-label="Nach MwSt. ändern"><div class="l">= Nach MwSt.${man?manBadge:''}</div><div class="r">${fm(run)} ${PEN}</div></button>${man?`<div class="cell subt ovrow"><div class="l"><small>berechnet: ${fm(calc)}<br>Differenz ${run-calc>=0?'+':'−'}${fm(Math.abs(run-calc))}</small></div><button class="link" data-act="netreset" data-v="${key}">Wiederherstellen</button></div>`:''}`}
function lineKey(r,x){return x.extra?'x:'+x.xid:(x.key.startsWith(r.id+':')?'c:'+x.col:null)}
function steps(r,s){let run=0,html='';const st=s.steps;const ed=U.wfEdit===r.id;
 st.forEach((x,i)=>{run+=x.amount;if(x.manual)return;const base=i===0;if(!base&&x.col&&r.removed&&x.col in r.removed&&!x.extra)return;
  if(ed&&!base){const k=lineKey(r,x);const own=!!k,isVal=x.extra||(own&&!r.f[x.col]);
   html+=`<div class="cell erow">${isVal?`<button class="rm" data-act="lrm" data-v="${k}" aria-label="Entfernen">−</button>`:'<span class="rm0"></span>'}${own?`<input class="lname" data-lname="${k}" value="${esc(x.label)}">`:`<div class="l">${esc(x.label)}</div>`}${isVal?`<input class="lamt" data-lamt="${k}" inputmode="decimal" value="${inpE(Math.abs(x.amount))}">`:`<div class="r">${fm(Math.abs(x.amount))}</div>`}</div>`;
   if(Calc.isMwst(x.tlabel)){const nx=st[i+1];html+=`<div class="cell subt"><div class="l">= Nach MwSt.</div><div class="r">${fm(run+(nx&&nx.manual?nx.amount:0))}</div></div>`}return}const lab=base?(x.col==='B'?'Überweisung (brutto)':esc(x.label)):esc(x.label);
  const neg=x.coef<0;const cls=base?'':(neg?'neg':'pos')+(Calc.isTax(x.tlabel)?' tax':'');
  html+=`<div class="cell ${cls}"><div class="l">${base?'':(neg?'− ':'+ ')}${lab}${Calc.isTax(x.tlabel)?'<span class="tag">Steuer</span>':''}${Calc.isMwst(x.tlabel)?`<span class="tag">${pct(s.gross?(-x.amount)/(s.gross+x.amount)*100:NaN)} auf netto</span>`:''}</div><div class="r">${fm(Math.abs(x.amount))}</div></div>`;
  if(Calc.isMwst(x.tlabel)){const nx=st[i+1];html+=nachMwstRow(r,s,run+(nx&&nx.manual?nx.amount:0))}});
 return html+`<div class="cell tot"><div class="l">= Netto</div><div class="r">${fm(s.net)}</div></div>`}
function detail(){const r=S.recs[U.detail];if(!r){U.detail=null;return list()}const tb=T(r);if(isInc(r))return detailInc(r,tb);
 if(isBud(r)){U.detail=null;return budget()}
 const s=sm(r);const texts=tb.cols.filter(([c])=>c!=='A'&&typeof r.v[c]==='string'&&r.v[c].trim()&&!r.f[c]);
 const shown=new Set(s.steps.map(x=>x.key));
 const other=tb.cols.filter(([c])=>c!=='A'&&!shown.has(r.id+':'+c)&&!(typeof r.v[c]==='string'&&!r.f[c])&&(r.f[c]||isFinite(Calc.val(r,c))));
 return`<div class="navbar"><button data-act="back">‹ ${U.amonth?'Archiv':U.tab==='budget'?'Verteilung':'Einnahmen'}</button><button data-act="edit" data-id="${r.id}">Bearbeiten</button></div>
 <div class="dhead"><span class="av ${SR(srcOf(r)).cls}" style="margin:0 auto;width:44px;height:44px;flex:none;border-radius:12px;font-size:20px">${SR(srcOf(r)).l}</span><h2>${esc(title(r))}${r.plan?'<span class="badge">Plan</span>':''}</h2><div class="t">${dtext(r)}</div><div class="big">${fm(s.net)}</div><div class="t">netto von ${fm(s.gross)} brutto${s.manual?' · Nach MwSt. manuell':''}</div></div>
 ${(r.notes||[]).length?`<div class="warn"><b>Hinweis</b><ul>${r.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></div>`:''}
 <div class="gh">Rechenweg wie in der Tabelle</div>${Calc.nachMwstCol(r)&&!s.manual?'<div class="foot" style="margin:-2px 16px 8px">Tippe auf „Nach MwSt.“, um den Betrag zu ändern.</div>':''}<div class="group wf">${steps(r,s)}</div>
 <div class="grid" style="margin-top:12px"><div class="tile"><span>MwSt.</span><b>${fm(s.mwst)}</b></div><div class="tile"><span>Einkommensteuer</span><b>${fm(s.tax)}</b></div></div>
 ${texts.map(([c,l])=>`<div class="gh">${esc(l)}</div><div class="group"><div class="cell"><div class="l">${esc(r.v[c])}</div></div></div>`).join('')}
 ${other.length?`<details class="group" style="margin-top:14px"><summary>Weitere Spalten aus der Tabelle (${other.length})</summary>${other.map(([c,l])=>`<div class="cell"><div class="l">${esc(l)}${r.f[c]?`<small>${esc(r.f[c]==='#REF!'?'Formel kaputt (#REF!)':prettyF(r,r.f[c]))}</small>`:''}</div><div class="r">${fm(Calc.val(r,c))}</div></div>`).join('')}</details>`:''}
 <div class="group" style="margin-top:22px"><button class="cell btn danger" data-act="del" data-id="${r.id}">Eintrag löschen</button></div>
 <div class="foot">Quelle: ${esc(tb.name)}</div>`}

function textCols(r){return T(r).cols.filter(([c,l])=>c!=='A'&&!r.f[c]&&(/Erklär|Beschreib|Bemerk|Notiz/i.test(l)||(typeof r.v[c]==='string'&&r.v[c].trim()&&!/^x$/i.test(r.v[c].trim()))))}
const rl=(r,c,l)=>(r.lbl&&r.lbl[c])||l||colLabel(T(r),c);
function textBlock(r,c,l){const key='v:'+r.id+':'+c,val=/^x$/i.test(String(r.v[c]??'').trim())?'':String(r.v[c]??'');
 if(U.tedit===key)return`<div class="gh">${esc(l)}</div><div class="group tedit"><textarea id="tin" rows="3">${esc(val)}</textarea><div class="rowbtns"><button data-act="tcancel">Abbrechen</button><button class="primary" style="width:auto;flex:1" data-act="tsave" data-v="${key}">Sichern</button></div></div>`;
 return`<div class="gh">${esc(l)}</div><div class="group"><button class="cell tcell" data-act="tedit" data-v="${key}"><div class="l">${val.trim()?esc(val).replace(/\n/g,'<br>'):'<span style="color:var(--ter)">Tippen zum Hinzufügen</span>'}</div><span class="pen2">${PEN}</span></button></div>`}
function notesBlock(r,title){const ns=r.notes||[];const ek='n:'+r.id+':';
 const ed=(n,i,isNew)=>`<div class="tedit"><textarea id="tin" rows="2">${esc(n)}</textarea><div class="rowbtns">${isNew?'':`<button class="danger" data-act="tdel" data-v="${ek+i}">Löschen</button>`}<button data-act="tcancel">Abbrechen</button><button class="primary" style="width:auto;flex:1" data-act="tsave" data-v="${ek+i}">Sichern</button></div></div>`;
 const row=(n,i)=>U.tedit===ek+i?ed(n,i):`<button class="cell tcell" data-act="tedit" data-v="${ek+i}"><div class="l">${esc(n)}</div><span class="pen2">${PEN}</span></button>`;
 return`<div class="gh">${title||'Hinweise'}</div><div class="group">${ns.map(row).join('')}${U.tedit===ek+'new'?ed('','new',true):`<button class="cell btn" data-act="tedit" data-v="${ek}new">+ Hinweis hinzufügen</button>`}</div>`}
function removedBlock(r){const rm=Object.keys(r.removed||{});if(!rm.length)return'';return`<div class="gh">Entfernte Posten</div><div class="group">${rm.map(c=>`<div class="cell"><div class="l">${esc(rl(r,c))}<small>${fm(Calc.numv(r.removed[c]))}</small></div><button class="link" data-act="lrestore" data-v="${r.id}:${c}">Wiederherstellen</button></div>`).join('')}</div>`}
function detailInc(r,tb){const s=sm(r);const ed=U.wfEdit===r.id;
 const shown=new Set(s.steps.map(x=>x.key));const tc=textCols(r);const tcs=new Set(tc.map(x=>x[0]));
 const other=tb.cols.filter(([c])=>c!=='A'&&!tcs.has(c)&&!shown.has(r.id+':'+c)&&!(typeof r.v[c]==='string'&&!r.f[c])&&(r.f[c]||isFinite(Calc.val(r,c))));
 const it=checkItems(r),isDone=x=>!!(r.done&&r.done[x.key]),done=it.filter(isDone).length;
 return`<div class="navbar"><button data-act="back">‹ ${U.amonth?'Archiv':U.tab==='budget'?'Verteilung':'Einnahmen'}</button><button data-act="edit" data-id="${r.id}">Bearbeiten</button></div>
 <div class="dhead"><span class="av ${SR(srcOf(r)).cls}" style="margin:0 auto;width:44px;height:44px;flex:none;border-radius:12px;font-size:20px">${SR(srcOf(r)).l}</span><h2>${esc(title(r))}${r.plan?'<span class="badge">Plan</span>':''}</h2><div class="t">${dtext(r)}</div><div class="big">${fm(s.net)}</div><div class="t">netto von ${fm(s.gross)} brutto${s.manual?' · Nach MwSt. manuell':''}</div></div>
 ${r.plan?`<div class="card" style="text-align:center"><div style="color:var(--sec);font-size:15px;margin-bottom:10px">Diese Einnahme ist noch geplant.</div><button class="primary" data-act="transfer" data-id="${r.id}">Überweisung ist eingegangen</button></div>`:
 `<div class="group ic"><button class="cell" data-act="checkopen" data-id="${r.id}"><span class="av ck ${it.length&&done===it.length?'all':''}">✓</span><div class="l">Ausgaben überweisen<small>${done} von ${it.length} erledigt${it.length-done?' · offen '+fm(it.filter(x=>!isDone(x)).reduce((a,x)=>a+x.amount,0)):''}</small></div><span class="chev">›</span></button></div>`}
 <div class="gh"><span>Rechenweg wie in der Tabelle</span><button class="link" data-act="wfedit" data-id="${r.id}" style="font-size:13px;padding:0;text-transform:none">${ed?'Fertig':'Posten bearbeiten'}</button></div>${!ed&&Calc.nachMwstCol(r)&&!s.manual?'<div class="foot hint" style="margin:-2px 16px 8px">Tippe auf „Nach MwSt.“, um den Betrag zu ändern.</div>':''}
 <div class="group wf">${steps(r,s)}</div>${ed?`<div class="group" style="margin-top:8px"><button class="cell btn" data-act="ladd" data-id="${r.id}">+ Posten hinzufügen</button></div><div class="foot hint">Namen und Beträge direkt ändern. Mit − entfernst du einen Posten. Netto und Steuer rechnen sofort neu.</div>`:''}
 ${removedBlock(r)}
 <div class="grid" style="margin-top:12px"><div class="tile"><span>MwSt.</span><b>${fm(s.mwst)}</b></div><div class="tile"><span>Einkommensteuer</span><b>${fm(s.tax)}</b></div></div>
 ${tc.map(([c,l])=>textBlock(r,c,rl(r,c,l))).join('')}
 ${notesBlock(r)}
 ${other.length?`<details class="group" style="margin-top:14px"><summary>Weitere Spalten aus der Tabelle (${other.length})</summary>${other.map(([c,l])=>`<div class="cell"><div class="l">${esc(l)}${r.f[c]?`<small>${esc(r.f[c]==='#REF!'?'Formel kaputt (#REF!)':prettyF(r,r.f[c]))}</small>`:''}</div><div class="r">${fm(Calc.val(r,c))}</div></div>`).join('')}</details>`:''}
 <div class="group" style="margin-top:22px"><button class="cell btn danger" data-act="del" data-id="${r.id}">Einnahme löschen</button></div>
 <div class="foot hint">Quelle: ${esc(tb.name)}</div>`}
/* ---------- Abhaken ---------- */
function checkItems(r){if(isInc(r)){const s=sm(r);return s.steps.slice(1).filter(x=>!x.manual&&x.amount<-0.004&&!(x.col&&!x.extra&&r.removed&&x.col in r.removed)).map(x=>({key:lineKey(r,x)||x.key,name:x.label,tag:Calc.isMwst(x.tlabel)?'ans Finanzamt':Calc.isTax(x.tlabel)?'Steuer-Rücklage':'',amount:-x.amount}))}
 if(isBud(r)){const tb=T(r),{b}=budCols(tb);const L=[];const add=(k,n,v)=>{if(isFinite(v)&&v>0.004)L.push({key:k,name:n,amount:v,tag:''})};
  if(!(r.removed&&'C' in r.removed))add('c:C',rl(r,'C'),Calc.val(r,'C'));b.forEach(([c,l])=>{if(!(r.removed&&c in r.removed))add('c:'+c,rl(r,c,l),Calc.val(r,c))});(r.extra||[]).forEach(x=>add('x:'+x.id,x.name,Calc.numv(x.amount)));return L}return[]}
function openCount(r){if(!r.chk||r.plan)return 0;return checkItems(r).filter(x=>!(r.done&&r.done[x.key])).length}
function checklist(){const r=S.recs[U.check],it=checkItems(r),bud=isBud(r);const dn=x=>!!(r.done&&r.done[x.key]);const done=it.filter(dn).length,open=it.filter(x=>!dn(x)).reduce((a,x)=>a+x.amount,0);
 return`<div class="navbar"><button data-act="checkclose">‹ Zurück</button></div><h1 style="margin-top:2px">${bud?'Verteilung abhaken':'Ausgaben überweisen'}</h1>
 <div class="card"><div class="hero"><div class="lbl">${bud?MON[mo(r)]+' '+yr(r):esc(title(r))+' · '+dtext(r)}</div><div class="big">${done} von ${it.length}</div><div class="sub">erledigt${open>0.004?' · noch offen '+fm(open):' · alles erledigt'}</div></div><div class="bar"><i style="width:${it.length?done/it.length*100:0}%"></i></div></div>
 <div class="group ic">${it.map(x=>`<button class="cell ckrow ${dn(x)?'done':''}" data-act="ck" data-v="${esc(x.key)}"><span class="cbox">${dn(x)?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>':''}</span><div class="l">${esc(x.name)}${x.tag?`<small>${x.tag}</small>`:''}</div><div class="r"><b>${fm(x.amount)}</b></div></button>`).join('')||'<div class="cell"><div class="l" style="color:var(--sec)">Keine Posten.</div></div>'}</div>
 <div class="rowbtns"><button data-act="ckall" data-v="0">Alle zurücksetzen</button><button class="tinted" data-act="ckall" data-v="1">Alle abhaken</button></div>
 <div class="foot hint">Tippe einen Posten an, wenn du ihn überwiesen hast. Der Stand wird gespeichert.</div>`}
/* ---------- Überweisung prüfen (Sheet) ---------- */
function renderSheet(){let el=$('#sheet');if(!el){el=document.createElement('div');el.id='sheet';document.body.appendChild(el)}const sh=U.sheet;if(!sh){el.innerHTML='';el.hidden=true;return}el.hidden=false;
 el.innerHTML=`<div class="sback" data-act="shclose"></div><div class="sheetp" role="dialog"><div class="grab"></div><h3>Überweisung prüfen</h3>
 <div class="group"><label class="cell"><span>Überweisungstag</span><input type="date" id="shdate" value="${esc(sh.date)}"></label></div>
 <p class="q">Stimmt die Überweisungssumme?</p>${sh.editSum?`<input id="shsum" class="bigin" inputmode="decimal" value="${inpE(sh.sum)}">`:`<div class="bigv num">${fm(sh.sum)}</div>`}
 <div class="rowbtns">${sh.editSum?`<button data-act="shcancel">Abbrechen</button><button class="primary" style="width:auto;flex:1" data-act="shok">Übernehmen</button>`:`<button data-act="shedit">Ändern</button><button class="primary" style="width:auto;flex:1" data-act="shok">Ja, passt</button>`}</div></div>`;
 if(sh.editSum){const i=$('#shsum');i.focus();i.select()}}
function setFormDate(F,v){const d=F.rec,old=String(d.date);d.date=v;if(F.mode==='new'&&old.slice(0,4)!==v.slice(0,4)){const rx=/\[\$rate:([A-Z]+):\d+\]/;for(const c in d.f)d.f[c]=d.f[c].replace(rx,'[$rate:$1:'+v.slice(0,4)+']');for(const c in F.orig)F.orig[c]=F.orig[c].replace(rx,'[$rate:$1:'+v.slice(0,4)+']')}}
function sheetOk(){const sh=U.sheet;const date=$('#shdate').value||sh.date;let sum=sh.sum;if(sh.editSum){const x=num($('#shsum').value);if(!(x>0)){toast('Bitte Betrag eingeben');return}sum=x}
 U.sheet=null;
 if(sh.mode==='form'){const F=U.form;setFormDate(F,date);if(!F.rec.f.B)F.rec.v.B=sum;const id=saveForm(true);if(id){const r=S.recs[id];r.chk=true;save();U.check=id;render();scrollTo(0,0)}return}
 if(sh.mode==='plan'){const r=S.recs[sh.id];r.date=date;r.plan=false;delete r.empty;if(!r.f.B)r.v.B=sum;r.notes=(r.notes||[]).filter(n=>!/Tag unbekannt/.test(n));r.notes.push('Überweisung am '+date.split('-').reverse().join('.')+' bestätigt');r.chk=true;save();U.detail=r.id;U.check=r.id;toast('Eingang gesichert');render();scrollTo(0,0)}}
/* ---------- Posten bearbeiten ---------- */
function applyLine(r,k,what,val){const t=k.slice(0,1),id=k.slice(2);
 if(t==='x'){const x=(r.extra||[]).find(e=>e.id===id);if(!x)return;if(what==='name')x.name=val||'Eigener Posten';else x.amount=isFinite(num(val))?num(val):0}
 else{if(what==='name'){r.lbl=r.lbl||{};const tl=colLabel(T(r),id);if(!val||val===tl)delete r.lbl[id];else r.lbl[id]=val;if(!Object.keys(r.lbl).length)delete r.lbl}else{const x=num(val);r.v[id]=isFinite(x)?x:0}}}
function removeLine(r,k){const t=k.slice(0,1),id=k.slice(2);if(t==='x'){r.extra=(r.extra||[]).filter(e=>e.id!==id);if(!r.extra.length){delete r.extra;delete r.xcol}}else{r.removed=r.removed||{};r.removed[id]=r.v[id];r.v[id]=0}if(r.done)delete r.done[k]}
function addLine(r,xcol,name){r.extra=r.extra||[];r.xcol=xcol;const id=Date.now().toString(36)+Math.random().toString(36).slice(2,5);r.extra.push({id,name,amount:0});return id}

/* ---------- Neu / Bearbeiten ---------- */
function subsOf(src){const ys=incs().filter(r=>srcOf(r)===src);if(!ys.length)return[];const maxY=Math.max(...ys.map(yr));const subs=[...new Set(ys.filter(r=>yr(r)===maxY&&r.sub).map(r=>r.sub))];return subs.length?subs:['']}
function template(src,sub){const rs=incs().filter(r=>srcOf(r)===src&&!r.plan&&!r.user);const main=subsOf(src)[0];const m=rs.filter(r=>r.sub===sub||(!r.sub&&sub===main));return(m.length?m:rs).sort(byDate).pop()}
function dkey(src,sub){return src+'|'+(sub||'')}
function makeDraft(src,sub,date){const tpl=template(src,sub);if(!tpl)return null;const tb=T(tpl);
 const r={id:'u'+Date.now().toString(36),t:tpl.t,label:'',v:{},f:{},notes:[],date,sub,plan:false,user:true,tpl:tpl.id};
 Calc.setDB(S);const net=netCol(tpl);const taxSt=Calc.waterfall(tpl,net).filter(x=>Calc.isTax(x.tlabel)).map(x=>x.col);
 for(const[c]of tb.cols){if(c==='A')continue;const f=tpl.f[c],v=tpl.v[c];if(typeof v==='string'&&!f)continue;
  if(f&&f!=='#REF!'){let g=f.replace(/\[([^\]$:][^\]:]*):([A-Z]{1,2})\]/g,(m,id,cc)=>'('+(+Calc.val(S.recs[id],cc).toFixed(6))+')');
   if(!/\[/.test(g)){r.v[c]=+Calc.val(tpl,c).toFixed(6);continue}
   g=g.replace(/\/\s*1\.19(?![\d])/g,'/(1+[$mwst])');if(taxSt.includes(c))g=g.replace(/\*\s*\d*\.\d+\s*$/,'*[$rate:'+src+':'+date.slice(0,4)+']');r.f[c]=g}
  else r.v[c]=typeof v==='number'?v:0}
 r.v.B=0;delete r.f.B;const d=S.settings.defaults[dkey(src,sub)]||{};for(const c in d)if(!r.f[c])r.v[c]=d[c];return r}
function withDraft(fn){const d=U.form.rec;Calc.setDB({tables:S.tables,recs:{...S.recs,[d.id]:d},settings:S.settings});try{return fn(d)}finally{Calc.setDB(S)}}
function initForm(){const src=U.form?.src||SRCS[0],subs=subsOf(src);const sub=U.form&&subs.includes(U.form.sub)?U.form.sub:subs[0];const date=U.form?.rec?.date||today();
 const old=U.form;const rec=makeDraft(src,sub,date);U.form={mode:'new',src,sub,rec,orig:rec&&JSON.parse(JSON.stringify(rec.f)),addBudget:true,replace:true};
 if(old&&old.mode==='new'&&rec){if(old.rec&&old.rec.v.B)rec.v.B=old.rec.v.B;rec.plan=old.rec?.plan||false}}
function planMatch(F){const d=F.rec;const c=incs().filter(r=>r.plan&&r.id!==d.id&&srcOf(r)===F.src&&String(r.date).slice(0,7)===d.date.slice(0,7));return c.find(r=>(r.sub||'')===(F.sub||''))||(F.sub===subsOf(F.src)[0]?c.find(r=>!r.sub):null)}
function budFor(date){return all().find(r=>isBud(r)&&String(r.date).slice(0,7)===date.slice(0,7))}
function form(){if(!years().length)return`<h1>Neue Einnahme</h1>${emptyHint()}`;
 if(!U.form||(U.form.mode==='new'&&!U.form.rec))initForm();const F=U.form,d=F.rec;if(!d)return`<h1>Neue Einnahme</h1><div class="card empty">Für diese Quelle gibt es noch keine Vorlage.</div>`;
 const edit=F.mode==='edit',tpl=S.recs[d.tpl];
 const pm=edit?null:planMatch(F),bud=edit?null:budFor(d.date);
 return`${edit?`<div class="navbar"><button data-act="cancel">Abbrechen</button><b>Bearbeiten</b><button data-act="save" style="font-weight:600">Sichern</button></div>`:'<h1>Neue Einnahme</h1>'}
 ${edit?`<div class="info">${esc(title(d))} · ${esc(d.label||'')}</div>`:`<div class="segs">${SRCS.map(k=>`<button class="seg ${F.src===k?'on':''}" data-act="fsrc" data-v="${k}">${SR(k).name}</button>`).join('')}</div>
 <div class="chips">${subsOf(F.src).map(s=>`<button class="chip ${F.sub===s?'on':''}" data-act="fsub" data-v="${esc(s)}">${esc(s||SR(F.src).name)}</button>`).join('')}</div>`}
 <div class="group"><label class="cell"><span>Datum</span><input type="date" id="fdate" value="${esc(String(d.date).length===10?d.date:d.date+'-01')}"></label>
 <label class="cell"><span>Überweisung (brutto)</span><input id="fgross" inputmode="decimal" placeholder="0,00 €" value="${d.v.B?inpE(d.v.B):''}" ${d.f.B?'disabled':''}></label>
 <label class="cell"><span>Noch nicht erhalten (Plan)</span><input type="checkbox" id="fplan" ${d.plan?'checked':''} style="flex:0;width:22px;height:22px;accent-color:var(--accent)"></label></div>
 <div class="gh"><span>Rechenweg</span><span id="fnet"></span></div><div class="group wf" id="fsteps"></div>
 ${(()=>{const ex=extraCols(d);return ex.length?`<div class="gh">Für die Steuer (nicht vom Netto abgezogen)</div><div class="group">${ex.map(([c,l])=>`<label class="cell"><span>${esc(l)}</span><input data-col="${c}" inputmode="decimal" value="${inpE(d.v[c])}"></label>`).join('')}</div>`:''})()}
 <div class="foot hint">${edit?'Felder ändern, „Sichern“ tippen. Leere Steuer-/MwSt.-Felder werden automatisch berechnet.':`Werte vorausgefüllt aus „${esc(tpl?tpl.label:'')}“ und deinen Standard-Abzügen. ESt-Satz ${pct(rateFor(F.src,+d.date.slice(0,4)))}, MwSt. ${pct(S.settings.mwst)} (Einstellungen). Jeder Wert ist änderbar.`}</div>
 ${edit?'':`<div class="group" style="margin-top:16px">${pm?`<label class="cell"><div class="l">Plan-Eintrag ersetzen<small>„${esc(pm.label)}“ wird durch diesen Eintrag ersetzt</small></div><input type="checkbox" id="frepl" ${F.replace?'checked':''} style="flex:0;width:22px;height:22px;accent-color:var(--accent)"></label>`:''}
 ${bud&&!(pm&&F.replace)?`<label class="cell"><div class="l">In Verteilung ${MON[mo(bud)]} ${yr(bud)} zählen<small>Netto wird zu „Netto Gesamt“ addiert</small></div><input type="checkbox" id="fbud" ${F.addBudget?'checked':''} style="flex:0;width:22px;height:22px;accent-color:var(--accent)"></label>`:''}</div>
 <div style="margin-top:16px"><button class="primary" data-act="save">Einnahme sichern</button></div>`}`}
function extraCols(d){return withDraft(()=>{const st=new Set(Calc.waterfall(d,netCol(d)).map(x=>x.col));const fs=Object.values(d.f).join(' ');return T(d).cols.filter(([c])=>c!=='A'&&c!=='B'&&!st.has(c)&&!d.f[c]&&typeof d.v[c]==='number'&&fs.includes('['+c+']'))})}
function refreshForm(){const F=U.form,box=$('#fsteps');if(!F||!F.rec||!box)return;const d=F.rec;
 withDraft(()=>{Calc.clear();const s=Calc.incomeSummary(d);const keep=document.activeElement&&document.activeElement.dataset.col;
  const rows=s.steps.map((x,i)=>{if(i===0&&x.col==='B')return'';const own=x.key.startsWith(d.id+':');const fx=own&&d.f[x.col];const isT=Calc.isTax(x.tlabel),isM=Calc.isMwst(x.tlabel);
   const sign=x.coef<0?'−':'+';
   if(!own)return`<div class="cell"><div class="l">${sign} ${esc(x.label)}</div><div class="r">${fm(Math.abs(x.amount))}</div></div>`;
   return`<label class="cell ${isT?'tax':''}"><div class="l">${sign} ${esc(x.label)}${isT?'<span class="tag">Steuer · auto</span>':isM?'<span class="tag">auto</span>':''}</div><input data-col="${x.col}" inputmode="decimal" ${fx?`placeholder="${inpE(Math.abs(x.amount))}" value=""`:`value="${inpE(d.v[x.col])}"`}></label>`}).join('');
  if(!keep||!box.querySelector(`[data-col="${keep}"]`)){box.innerHTML=rows+`<div class="cell tot"><div class="l">= Netto</div><div class="r" id="fnetv">${fm(s.net)}</div></div>`}
  else{box.querySelectorAll('input[data-col]').forEach(i=>{const c=i.dataset.col;if(d.f[c]){const st=s.steps.find(x=>x.col===c&&x.key.startsWith(d.id));if(st)i.placeholder=inpE(Math.abs(st.amount))}});$('#fnetv').textContent=fm(s.net)}
  $('#fnet').textContent='Steuer '+fm(s.tax)});}
function onFormInput(e){const F=U.form;if(!F||!F.rec)return;const d=F.rec,t=e.target;
 if(t.id==='fgross'){d.v.B=num(t.value)||0;refreshForm();return}
 if(t.dataset.col){const c=t.dataset.col,v=num(t.value);const orig=F.orig[c];
  if(t.value.trim()===''){if(orig){d.f[c]=orig}else d.v[c]=0}else{if(orig)delete d.f[c];d.v[c]=isFinite(v)?v:0}refreshForm()}}
function onFormChange(e){const F=U.form;if(!F||!F.rec)return;const d=F.rec,t=e.target;
 if(t.id==='fdate'&&t.value){setFormDate(F,t.value);render()}
 if(t.id==='fplan')d.plan=t.checked;if(t.id==='frepl'){F.replace=t.checked;render()}if(t.id==='fbud')F.addBudget=t.checked}
function freeze(f){return f.replace(/\[\$mwst\]/g,'('+S.settings.mwst/100+')').replace(/\[\$rate:([A-Z]+):(\d+)\]/g,(m,s,y)=>'('+rateFor(s,+y)/100+')')}
function saveForm(confirmed){const F=U.form,d=F.rec;if(!(d.v.B>0)&&!d.f.B&&!(F.mode==='edit')){toast('Bitte Brutto-Betrag eingeben');return}
 const dateChanged=F.mode==='new'||(S.recs[d.id]&&S.recs[d.id].date!==d.date);
 if(!confirmed&&!d.plan&&dateChanged){U.sheet={mode:'form',date:String(d.date).length===10?d.date:d.date+'-01',sum:Calc.val(d,'B')};renderSheet();return}
 for(const c in d.f)d.f[c]=freeze(d.f[c]);
 if(F.mode==='edit'){S.recs[d.id]=d;save();U.form=null;U.detail=d.id;toast('Gesichert');render();return d.id}
 const ds=d.date.slice(8,10)+'.'+d.date.slice(5,7)+'.'+d.date.slice(0,4);
 const tl=(S.recs[d.tpl]&&S.recs[d.tpl].label)||F.src;d.label=/\d{1,2}\.\d{4}/.test(tl)?tl.replace(/(\d{1,2}|XX|0x)?\.?\d{1,2}\.\d{4,5}/,ds):tl+' '+ds;if(F.sub&&!d.label.toLowerCase().includes(F.sub.toLowerCase().slice(0,6)))d.label=F.sub+' '+d.label;
 d.notes=['In der App erfasst'];const pm=planMatch(F);
 if(pm&&F.replace){d.id=pm.id;d.notes.push('Ersetzt den Plan-Eintrag „'+pm.label+'“');S.recs[pm.id]=d}
 else{S.recs[d.id]=d;const bud=budFor(d.date);if(bud&&F.addBudget){const ref=`[${d.id}:${netCol(d)}]`;if(bud.f.B&&bud.f.B!=='#REF!')bud.f.B+='+'+ref;else if(!bud.f.B)bud.f.B=(Calc.numv(bud.v.B)?Calc.numv(bud.v.B)+'+':'')+ref}}
 save();const id=d.id;U.form=null;U.tab='list';U.year=yr(d);U.detail=id;toast('Einnahme gesichert');render();scrollTo(0,0);return id}

/* ---------- Verteilung ---------- */
function budCols(tb){const cols=tb.cols||[];const u=cols.find(([c,l])=>/^(Übrig|Variante 1\b.*)$/i.test(l.trim()));
 const b=cols.filter(([c,l])=>c>='F'&&c.length===1&&!/Bemerkung|Variante|Übrig/i.test(l));return{u:u&&u[0],b,note:(cols.find(([c,l])=>/Bemerkung/i.test(l))||[])[0]}}
function linRefs(r,c){const f=r.f[c];if(!f||f==='#REF!')return[];return[...f.matchAll(/\[([^\]$:][^\]:]*):([A-Z]{1,2})\]/g)].map(m=>({id:m[1],c:m[2]}))}
function donut(segs){const tot=segs.reduce((s,x)=>s+x.v,0)||1;const R=56,C=2*Math.PI*R;let off=0;
 return`<svg class="donut" viewBox="0 0 150 150" width="150" height="150"><circle cx="75" cy="75" r="${R}" fill="none" stroke="var(--fill)" stroke-width="22"/>`+segs.map(x=>{const l=x.v/tot*C;const s=`<circle cx="75" cy="75" r="${R}" fill="none" stroke="${x.col}" stroke-width="22" stroke-dasharray="${Math.max(l-1.2,0.01)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 75 75)"/>`;off+=l;return s}).join('')+'</svg>'}
const allBuds=()=>all().filter(isBud).sort(byDate);
function budArchive(){const ab=allBuds().filter(x=>isArch(ymOf(x)));const by={};ab.forEach(x=>by[ymOf(x)]=x);
 return`<div class="navbar"><button data-act="barchclose">‹ Verteilung</button></div><h1 style="margin-top:2px">Archiv</h1>
 ${ab.length?yearBlocks(Object.keys(by),k=>{const x=by[k],tb=T(x),{u}=budCols(tb);const B=Calc.val(x,'B'),ub=u?Calc.val(x,u):NaN;return`<button class="cell" data-act="bmopen" data-id="${x.id}"><span class="av arc2">${+k.slice(5,7)}</span><div class="l">${MON[+k.slice(5,7)-1]}<small>Übrig ${fm(ub)}</small></div><div class="r"><b>${fm(B)}</b>${Calc.isOv(x,'B')?'<br>'+manBadge:''}</div><span class="chev">›</span></button>`},
  ks=>'netto '+fm(ks.reduce((t,k)=>{const v=Calc.val(by[k],'B');return t+(isFinite(v)?v:0)},0))):'<div class="card empty">Noch nichts im Archiv.</div>'}`}
function budget(){const AB=allBuds();if(!AB.length)return`<h1>Verteilung</h1><div class="card empty">Es gibt noch keine Verteilung.</div>`;
 if(U.barch&&!U.bm)return budArchive();
 const liveB=AB.filter(x=>!isArch(ymOf(x))),archB=AB.filter(x=>isArch(ymOf(x)));
 let r=AB.find(x=>x.id===U.bm);if(!r){r=liveB.find(x=>ymOf(x)===curYM())||liveB[0]||archB[archB.length-1];U.bm=r.id}
 const inArch=isArch(ymOf(r)),bs0=inArch?archB:liveB,y=yr(r),bs=AB.filter(x=>yr(x)===y);
 const tb=T(r),{u,b,note}=budCols(tb),i=bs0.indexOf(r);const B=Calc.val(r,'B'),Cg=Calc.val(r,'C'),D=Calc.val(r,'D'),E=Calc.val(r,'E');
 const ub=u?Calc.val(r,u):NaN;const fixed=u?Calc.waterfall(r,u,false).filter(x=>x.key==='#').reduce((s,x)=>s-x.amount,0):0;
 const segs=[];if(Cg>0)segs.push({k:'C',n:rl(r,'C'),v:Cg});b.forEach(([c,l])=>{const v=Calc.val(r,c);if(v>0)segs.push({k:c,n:rl(r,c,l),v})});(r.xcol===u?(r.extra||[]):[]).forEach(x=>{const v=Calc.numv(x.amount);if(v>0)segs.push({k:'x:'+x.id,n:x.name,v})});if(fixed>0.005)segs.push({k:'#',n:'Feste Beträge (in der Übrig-Formel)',v:fixed});if(ub>0)segs.push({k:u,n:'Übrig',v:ub});
 segs.forEach((s,j)=>s.col=s.k===u?'var(--green)':s.k==='C'?'var(--accent)':PALETTE[(j+2)%PALETTE.length]);const st=segs.reduce((s,x)=>s+x.v,0);
 const refs=linRefs(r,'B').map(x=>S.recs[x.id]).filter(x=>x&&!x.empty);const incM=incs(y).filter(x=>mo(x)===mo(r)&&!x.plan).reduce((s,x)=>s+sm(x).net,0);
 if(U.bedit)return budEdit(r,tb,b);
 // Plan vs Ist
 const rowsPI=[['C',colLabel(tb,'C')],...b];if(u)rowsPI.push([u,'Übrig']);const sumBy=(c,pl)=>bs.filter(x=>!!x.plan===pl).reduce((s,x)=>{const v=Calc.val(x,c);return s+(isFinite(v)?v:0)},0);const anyPlan=bs.some(x=>x.plan);
 const retR=all().filter(x=>T(x).kind==='ret'&&yr(x)===y).sort(byDate);
  return`${inArch?`<div class="navbar"><button data-act="bmback">‹ Archiv</button><button data-act="archtog" data-v="${ymOf(r)}">Zurückholen</button></div><h1 style="margin-top:2px">Verteilung</h1>`:`<h1>Verteilung</h1>`}
 <div class="pm"><button data-act="bm" data-v="${i-1}" ${i<=0?'disabled style="opacity:.3"':''}>‹</button><span>${MON[mo(r)]} ${y}${r.plan?'<span class="badge">Plan</span>':''}</span><button data-act="bm" data-v="${i+1}" ${i>=bs0.length-1?'disabled style="opacity:.3"':''}>›</button></div>
 ${inArch?'':archRow('barchopen',archB.length,null)}${inArch?'':`<div class="mfoot" style="text-align:right;margin:-4px 0 8px"><button class="link" data-act="archtog" data-v="${ymOf(r)}">Monat archivieren</button></div>`}
 ${isFinite(B)?'':`<div class="warn"><b>Netto Gesamt fehlt.</b> In der Numbers-Tabelle ist die Formel für diesen Monat kaputt (#REF!). Laut deinen Einnahmen waren es in ${MON[mo(r)]} netto ${fm(incM)}.</div>`}
 <div class="card"><div class="hero"><div class="lbl">Netto Gesamt</div><div class="big">${fm(B)}</div><div class="sub">${refs.length?`aus ${refs.length} Einnahme${refs.length>1?'n':''}`:''}${D?` · + ${fm(D)} übrige MwSt.`:''}</div></div>
 ${segs.length?`<div class="donutwrap" style="margin-top:14px">${donut(segs)}<div><div class="lbl" style="color:var(--sec);font-size:13px;font-weight:600">ÜBRIG</div><div style="font-size:26px;font-weight:700" class="num ${ub<0?'down':'up'}">${fm(ub)}</div><div class="sub" style="color:var(--sec);font-size:14px">${isFinite(B)&&B?pct(ub/B*100)+' vom Netto':''}</div></div></div>`:''}</div>
 ${E&&isFinite(E)?`<div class="info">Gehalt fehlend: ${fm(E)} – so viel fehlt noch bis zum Gehalt von ${fm(Cg)}.</div>`:''}
 <div class="gh"><span>Aufteilung</span><button class="link" data-act="bedit" style="font-size:13px;padding:0;text-transform:none">Bearbeiten</button></div><div class="group">${segs.map(s=>`<div class="cell"><div class="l"><i class="dotc" style="background:${s.col};margin-right:8px"></i>${esc(s.n)}</div><div class="r"><b>${fm(s.v)}</b> · ${pct(st?s.v/st*100:NaN)}</div></div>`).join('')||'<div class="cell"><div class="l" style="color:var(--sec)">Nichts verteilt.</div></div>'}${ub<0?`<div class="cell"><div class="l down">Übrig (negativ)</div><div class="r down">${fm(ub)}</div></div>`:''}</div>
 ${(()=>{const it=checkItems(r),d=it.filter(x=>r.done&&r.done[x.key]).length;return`<div class="group ic" style="margin-top:10px"><button class="cell" data-act="checkopen" data-id="${r.id}"><span class="av ck ${it.length&&d===it.length?'all':''}">✓</span><div class="l">Verteilung abhaken<small>${d} von ${it.length} erledigt</small></div><span class="chev">›</span></button></div>`})()}${note?textBlock(r,note,rl(r,note,'Bemerkung')):''}${notesBlock(r)}
 ${refs.length?`<div class="gh">Netto kommt aus</div><div class="group ic">${refs.map(x=>`<button class="cell" data-act="open" data-id="${x.id}"><span class="av ${SR(srcOf(x)).cls}">${SR(srcOf(x)).l}</span><div class="l">${esc(title(x))}${x.plan?'<span class="badge">Plan</span>':''}<small>${dtext(x)}</small></div><div class="r"><b>${fm(sm(x).net)}</b></div><span class="chev">›</span></button>`).join('')}</div>`:''}
 <div class="gh">${anyPlan?'Plan vs. Ist':'Summe'} ${y}</div><div class="group"><div class="pvi h"><span>Topf</span><span>Ist</span><span>${anyPlan?'Plan':''}</span></div>
 <div class="pvi"><span><b>Netto Gesamt</b></span><span><b>${fm(sumBy('B',false))}</b></span><span>${anyPlan?fm(sumBy('B',true)):''}</span></div>
 ${rowsPI.map(([c,l])=>`<div class="pvi"><span>${esc(c===u?'Übrig':l)}</span><span>${fm(sumBy(c,false))}</span><span>${anyPlan?fm(sumBy(c,true)):''}</span></div>`).join('')}</div>
 <div class="foot hint">Ist = Monate, die schon gelaufen sind · Plan = geplante Monate (${bs.filter(x=>x.plan).map(x=>MON[mo(x)].slice(0,3)).join(', ')||'keine'}). Monate mit kaputter Formel zählen mit 0.</div>
 ${retR.length?`<div class="gh">Gehalt zurück bekommen ${y}</div><div class="group">${retR.map(x=>{const tb2=T(x);return`<div class="cell"><div class="l">${esc(x.label)}<small>${tb2.cols.filter(([c])=>c!=='A').map(([c,l])=>esc(l)+' '+fm(Calc.val(x,c))).join(' · ')}</small></div></div>`}).join('')}</div>`:''}`}
function budEdit(r,tb,b){const {u}=budCols(tb);const cols=[['C',colLabel(tb,'C')],['D',colLabel(tb,'D')],...b].filter(([c])=>!(r.removed&&c in r.removed));
 const row=([c,l])=>r.f[c]?`<div class="cell erow"><span class="rm0"></span><input class="lname" data-bl="${c}" value="${esc(rl(r,c,l))}"><div class="r">${fm(Calc.val(r,c))}</div></div>`:`<div class="cell erow">${c==='D'?'<span class="rm0"></span>':`<button class="rm" data-act="brm" data-v="c:${c}" aria-label="Entfernen">−</button>`}<input class="lname" data-bl="${c}" value="${esc(rl(r,c,l))}"><input class="lamt" data-bcol="${c}" inputmode="decimal" value="${inpE(Calc.numv(r.v[c]))}"></div>`;
 return`<div class="navbar"><button data-act="bcancel">Abbrechen</button><b>${MON[mo(r)]} ${yr(r)}</b><button data-act="bsave" style="font-weight:600">Sichern</button></div>
 <div class="gh">Töpfe</div><div class="group">${cols.map(row).join('')}${(r.xcol===u?(r.extra||[]):[]).map(x=>`<div class="cell erow"><button class="rm" data-act="brm" data-v="x:${x.id}" aria-label="Entfernen">−</button><input class="lname" data-bxn="${x.id}" value="${esc(x.name)}"><input class="lamt" data-bxa="${x.id}" inputmode="decimal" value="${inpE(Calc.numv(x.amount))}"></div>`).join('')}</div>
 <div class="group" style="margin-top:8px"><button class="cell btn" data-act="badd">+ Topf hinzufügen</button></div>${removedBlock(r)}
 <div class="foot hint">„Übrig“ rechnet sich danach automatisch neu – mit derselben Formel wie in deiner Tabelle, eigene Töpfe werden zusätzlich abgezogen.</div>`}
function applyBudInputs(r){view.querySelectorAll('[data-bcol]').forEach(i=>{const x=num(i.value);r.v[i.dataset.bcol]=isFinite(x)?x:0});view.querySelectorAll('[data-bl]').forEach(i=>applyLine(r,'c:'+i.dataset.bl,'name',i.value.trim()));
 view.querySelectorAll('[data-bxn]').forEach(i=>applyLine(r,'x:'+i.dataset.bxn,'name',i.value.trim()));view.querySelectorAll('[data-bxa]').forEach(i=>applyLine(r,'x:'+i.dataset.bxa,'amt',i.value))}
/* ---------- Einstellungen ---------- */
function settings(){const st=S.settings,n=all().length;const rk=Object.keys(st.rates).filter(k=>/^[A-Z]+:\d{4}$/.test(k)).sort((a,b)=>b.split(':')[1]-a.split(':')[1]||a.localeCompare(b));
 if(U.defs)return defsView();
 const kinds=[];for(const s of SRCS)for(const sub of subsOf(s))kinds.push([s,sub]);
 return`<h1>Einstellungen</h1>${resultPanel()}
 <div class="gh">Darstellung</div><div class="segs">${[['auto','Automatisch'],['light','Hell'],['dark','Dunkel']].map(([k,l])=>`<button class="seg ${st.theme===k?'on':''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div>
 <div class="group"><label class="cell"><span>Erklärtexte anzeigen</span><input type="checkbox" data-set="hints" ${st.hints!==false?'checked':''} style="flex:0;width:22px;height:22px;accent-color:var(--accent)"></label></div><div class="foot">Blendet die grauen Hilfetexte in der App aus oder ein.</div>
 <div class="gh">Steuern für neue Einträge</div><div class="group"><label class="cell"><span>MwSt.</span><input data-set="mwst" inputmode="decimal" value="${inp(st.mwst)}" style="flex:0 0 70px"><span class="r">%</span></label>
 ${rk.map(k=>{const[s,y]=k.split(':');return`<label class="cell"><span>ESt-Satz ${SR(s).name||s} ${y}</span><input data-rate="${k}" inputmode="decimal" value="${inp(st.rates[k])}" style="flex:0 0 70px"><span class="r">%</span></label>`}).join('')}</div>
 <div class="foot hint">Gilt nur für neue Einträge. Alte Einträge behalten genau die Werte aus deiner Tabelle.</div>
 <div class="gh">Standard-Abzüge</div><div class="group">${kinds.map(([s,sub])=>`<button class="cell" data-act="defs" data-v="${s}|${esc(sub)}"><div class="l">${esc(sub?sub+' · ':'')}${SR(s).name}<small>${Object.keys(st.defaults[dkey(s,sub)]||{}).length?'eigene Werte':'wie letzter Eintrag'}</small></div><span class="chev">›</span></button>`).join('')}</div>
 <div class="gh">Daten</div><div class="group"><div class="cell"><div class="l">Gespeichert auf diesem Gerät</div><div class="r">${n} Zeilen</div></div>
 <button class="cell btn" data-act="export">Backup sichern (JSON)</button><button class="cell btn" data-act="import">Backup oder Einrichtungsdatei laden</button><button class="cell btn" data-act="paste">Einrichtungslink einfügen</button><button class="cell btn" data-act="csv">Als CSV exportieren</button></div>
 <div class="foot hint">Deine Daten liegen nur hier auf dem Gerät, nicht im Internet. Mach ab und zu ein Backup.</div>
 <div class="gh">Sicherheit</div><div class="group">${S.pin?`<button class="cell btn" data-act="pinset">PIN ändern</button><button class="cell btn danger" data-act="pinoff">PIN-Sperre ausschalten</button>`:`<button class="cell btn" data-act="pinset">PIN-Sperre einschalten</button>`}</div>
 <div class="foot hint">Die 4-stellige PIN schützt vor neugierigen Blicken. Sie verschlüsselt die Daten nicht.</div>
 <div class="group" style="margin-top:22px"><button class="cell btn danger" data-act="wipe">Alle Daten löschen</button></div><div class="foot" style="text-align:center;margin-top:14px">Einkommen · Version ${VERSION}</div>`}
function defsView(){const[s,sub]=U.defs.split('|');const d=makeDraft(s,sub,today());if(!d)return'';const tb=T(d);
 const cur=S.settings.defaults[dkey(s,sub)]||{};const tpl=S.recs[d.tpl];
 const cols=Calc.waterfall(Object.assign(d,{v:{...d.v,B:1000}}),netCol(d)).length?null:null;
 Calc.setDB({tables:S.tables,recs:{...S.recs,[d.id]:d},settings:S.settings});const w=Calc.waterfall(d,netCol(d));Calc.setDB(S);
 const ded=w.filter(x=>x.key.startsWith(d.id+':')&&x.col!=='B'&&!d.f[x.col]);
 return`<div class="navbar"><button data-act="defsback">‹ Einstellungen</button><b>${esc(sub?sub+' · ':'')}${SR(s).name}</b><span style="width:60px"></span></div>
 <div class="gh">Abzüge pro neuem Eintrag</div><div class="group">${ded.map(x=>`<label class="cell"><span>${esc(x.label)}</span><input data-def="${x.col}" inputmode="decimal" value="${inpE(cur[x.col]??tpl.v[x.col])}"></label>`).join('')}</div>
 <div class="foot hint">Vorgabe ist der letzte Eintrag („${esc(tpl.label)}“). Steuern und MwSt. rechnet die App selbst.</div>
 <div class="group" style="margin-top:18px"><button class="cell btn" data-act="defsreset">Auf letzten Eintrag zurücksetzen</button></div>`}

/* ---------- Import / Export ---------- */
function b64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}
async function inflate(bytes){const ds=new DecompressionStream('deflate-raw');return await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text()}
async function sha(s){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function importObj(o){if(!o||o.app!=='einkommen'||!Array.isArray(o.records))throw new Error('Das ist keine Einkommen-Datei.');
 if(o.kind==='backup'){if(!confirm('Backup laden? Das ersetzt alle Daten, die gerade in der App sind.'))return null;
  S.tables=o.tables||{};S.recs={};o.records.forEach(r=>S.recs[r.id]=r);S.settings=Object.assign(defaults().settings,o.settings||{});S.setups=o.setups||S.setups;S.archive=o.archive||{};S.v=o.v||1;migrate(S,false,true);save();return{add:o.records.length,skip:0,notes:0}}
 let add=0,skip=0,notes=0;for(const[k,t]of Object.entries(o.tables||{}))if(!S.tables[k])S.tables[k]=t;
 for(const r of o.records){if(S.recs[r.id]){skip++;continue}S.recs[r.id]=r;add++;if((r.notes||[]).length)notes++}
 Calc.setDB(S);SUM=new Map();migrate(S,false,true);deriveRates();save();return{add,skip,notes}}
async function importSetup(code){code=code.trim().replace(/^.*#setup=/,'');const fp=(await sha(code)).slice(0,24);
 if(S.setups.includes(fp)&&all().length){U.result={already:true};return}
 const o=JSON.parse(await inflate(unb64u(code)));const res=importObj(o);if(res){S.setups.push(fp);save();U.result=res;const ys=years();U.year=ys.includes(new Date().getFullYear())?new Date().getFullYear():ys[ys.length-1]}}
function download(name,text,type){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
function exportBackup(){const o={app:'einkommen',v:5,kind:'backup',created:new Date().toISOString(),tables:S.tables,records:all(),settings:S.settings,setups:S.setups,archive:S.archive||{}};download('einkommen-backup-'+today()+'.json',JSON.stringify(o),'application/json');toast('Backup erstellt')}
function exportCSV(){const n=x=>isFinite(x)?(+x.toFixed(2)).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false}):'';const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
 const rows=[['Datum','Quelle','Art','Bezeichnung','Brutto','MwSt','Einkommensteuer','Abzüge','Netto','Status','Nach MwSt','Nach MwSt manuell','Nach MwSt berechnet']];
 for(const r of incs(null,true)){const s=sm(r);rows.push([unknownDay(r)?String(r.date).slice(0,7):r.date,SR(srcOf(r)).name,r.sub||'',r.label,n(s.gross),n(s.mwst),n(s.tax),n(s.ded),n(s.net),r.plan?'Plan':'Ist',...(()=>{const c=Calc.nachMwstCol(r);return c?[n(Calc.val(r,c)),Calc.isOv(r,c)?'ja':'nein',n(Calc.raw(r,c))]:['','','']})()].map((x,i)=>(i>=4&&i<=8)||i===10||i===12?x:q(x)))}
 download('einkommen-'+today()+'.csv','\ufeff'+rows.map(r=>r.join(';')).join('\r\n'),'text/csv');toast('CSV erstellt')}

/* ---------- PIN ---------- */
let pinBuf='',pinMode=null,pinFirst='';
function showLock(mode){pinMode=mode;pinBuf='';pinFirst='';const L=$('#lock');L.hidden=false;drawLock()}
function drawLock(msg){const L=$('#lock');const t=pinMode==='unlock'?'PIN eingeben':pinFirst?'PIN wiederholen':'Neue PIN wählen';
 L.innerHTML=`<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg><h2>${t}</h2><div class="pdots" id="pdots">${[0,1,2,3].map(i=>`<i class="${i<pinBuf.length?'f':''}"></i>`).join('')}</div><div style="min-height:18px;color:var(--red);font-size:14px">${msg||''}</div>
 <div class="pad">${[1,2,3,4,5,6,7,8,9].map(d=>`<button data-pin="${d}">${d}</button>`).join('')}<button class="x" data-pin="${pinMode==='unlock'?'':'x'}">${pinMode==='unlock'?'':'Abbrechen'}</button><button data-pin="0">0</button><button class="x" data-pin="b">⌫</button></div>`}
async function pinKey(k){if(k==='x'){$('#lock').hidden=true;return}if(k==='b'){pinBuf=pinBuf.slice(0,-1);drawLock();return}if(k===''||pinBuf.length>=4)return;pinBuf+=k;drawLock();if(pinBuf.length<4)return;
 const p=pinBuf;await new Promise(r=>setTimeout(r,120));
 if(pinMode==='unlock'){const ok=S.pin&&await sha(S.pin.salt+p)===S.pin.hash;if(ok){$('#lock').hidden=true;$('#lock').innerHTML='';hiddenAt=0}else{pinBuf='';drawLock('Falsche PIN');$('#pdots').classList.add('shake')}return}
 if(!pinFirst){pinFirst=p;pinBuf='';drawLock();return}
 if(pinFirst!==p){pinFirst='';pinBuf='';drawLock('Stimmt nicht überein – bitte neu');return}
 const salt=[...crypto.getRandomValues(new Uint8Array(12))].map(b=>b.toString(16).padStart(2,'0')).join('');S.pin={salt,hash:await sha(salt+p)};save();$('#lock').hidden=true;toast('PIN-Sperre an');render()}
let hiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(S.pin&&hiddenAt&&Date.now()-hiddenAt>60000&&$('#lock').hidden)showLock('unlock')});

/* ---------- Events ---------- */
const splitKey=k=>{const i=k.lastIndexOf(':');return[k.slice(0,i),k.slice(i+1)]};
function saveNet(key,txt){const[rid,c]=splitKey(key);const r=S.recs[rid];if(!r)return;const x=num(txt);if(!isFinite(x)){toast('Bitte einen Betrag eingeben');return}
 const calc=Calc.raw(r,c);r.ov=r.ov||{};if(isFinite(calc)&&Math.abs(calc-x)<0.005){delete r.ov[c];if(!Object.keys(r.ov).length)delete r.ov}else r.ov[c]=Math.round(x*100)/100;
 U.netEdit=null;save();toast('Nach MwSt. gesichert – Steuer und Netto neu berechnet');render()}
document.addEventListener('keydown',e=>{if(e.target.id==='netin'){if(e.key==='Enter'){e.preventDefault();saveNet(U.netEdit,e.target.value)}if(e.key==='Escape'){U.netEdit=null;render()}}});
function toast(t){const e=$('#toast');e.textContent=t;e.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>e.hidden=true,2400)}
document.addEventListener('click',async e=>{const p=e.target.closest('[data-pin]');if(p){pinKey(p.dataset.pin);return}
 const tb=e.target.closest('.tabbar button');if(tb){setTab(tb.dataset.tab);return}
 const swp=e.target.closest('.swipe');if(swp&&!e.target.closest('.swdel')){if(swp.dataset.swiped)return;if(swp.classList.contains('open')){swp.classList.remove('open');return}}
 const a=e.target.closest('[data-act]');if(!a)return;const v=a.dataset.v,id=a.dataset.id;
 switch(a.dataset.act){
 case'tab':setTab(v);break;
 case'year':U.year=+v;U.bm=null;render();break;
 case'filter':U.filter=v;if(U.tab!=='list'){U.tab='list'}render();break;
 case'open':U.detail=id;U.netEdit=null;render();scrollTo(0,0);break;
 case'back':U.detail=null;U.netEdit=null;render();break;
 case'edit':{const r=JSON.parse(JSON.stringify(S.recs[id]));U.form={mode:'edit',src:srcOf(r),sub:r.sub,rec:r,orig:JSON.parse(JSON.stringify(r.f))};U.detail=null;render();scrollTo(0,0);break}
 case'cancel':U.detail=U.form?.rec?.id;U.form=null;render();break;
 case'save':saveForm();break;
 case'fsrc':{const date=U.form.rec?.date||today(),B=U.form.rec?.v?.B,pl=U.form.rec?.plan;U.form={mode:'new',src:v,rec:{date,v:{B},plan:pl}};initForm();U.form.rec&&(U.form.rec.date=date);render();break}
 case'fsub':{const date=U.form.rec.date,B=U.form.rec.v.B,pl=U.form.rec.plan;U.form.sub=v;initForm();U.form.rec.date=date;if(B)U.form.rec.v.B=B;U.form.rec.plan=pl;render();break}
 case'del':if(confirm('Diese Einnahme wirklich löschen?')){delete S.recs[id];save();U.detail=null;U.check=null;U.wfEdit=null;toast('Gelöscht');render()}break;
 case'bm':{const AB=allBuds(),cur=AB.find(x=>x.id===U.bm),ia=cur&&isArch(ymOf(cur));const L=AB.filter(x=>isArch(ymOf(x))===!!ia);const r=L[+v];if(r){U.bm=r.id;U.netEdit=null;render()}break}
 case'archopen':U.archive=true;U.amonth=null;render();scrollTo(0,0);break;case'archclose':U.archive=false;render();break;
 case'amonth':U.amonth=v;render();scrollTo(0,0);break;case'amback':U.amonth=null;render();break;
 case'ytog':U.yopen=U.yopen||new Set();U.yopen.has(v)?U.yopen.delete(v):U.yopen.add(v);render();break;
 case'archtog':{const was=isArch(v);toggleArch(v);toast(was?'Zurückgeholt':'Archiviert');if(U.tab==='budget'){U.bm=null;U.barch=false}else{U.amonth=null}render();break}
 case'barchopen':U.barch=true;U.bm=null;render();scrollTo(0,0);break;case'barchclose':U.barch=false;U.bm=null;render();break;
 case'bmopen':U.bm=id;U.barch=true;render();scrollTo(0,0);break;case'bmback':U.bm=null;U.barch=true;render();break;
 case'netedit':U.netEdit=v;render();{const i=$('#netin');if(i){i.focus();i.select()}}break;case'netcancel':U.netEdit=null;render();break;
 case'netsave':saveNet(v,$('#netin').value);break;
 case'netreset':{const[rid,c]=splitKey(v);const r=S.recs[rid];if(r&&r.ov){delete r.ov[c];if(!Object.keys(r.ov).length)delete r.ov}save();toast('Berechneter Wert wiederhergestellt');render();break}
 case'bedit':U.bedit=true;render();break;case'bcancel':U.bedit=false;render();break;
 case'brm':{const r=S.recs[U.bm];applyBudInputs(r);removeLine(r,v);save();render();break}
 case'badd':{const r=S.recs[U.bm];applyBudInputs(r);const{u}=budCols(T(r));addLine(r,u,'Neuer Topf');save();render();const l=[...view.querySelectorAll('[data-bxn]')].pop();if(l){l.focus();l.select()}break}
 case'transfer':{const r=S.recs[id];U.sheet={mode:'plan',id,date:today(),sum:Calc.val(r,'B')};renderSheet();break}
 case'shclose':U.sheet=null;renderSheet();break;case'shcancel':U.sheet.editSum=false;renderSheet();break;case'shedit':U.sheet.editSum=true;renderSheet();break;case'shok':sheetOk();break;
 case'checkopen':U.check=id;render();scrollTo(0,0);break;case'checkclose':U.check=null;render();break;
 case'ck':{const r=S.recs[U.check];r.done=r.done||{};if(r.done[v])delete r.done[v];else r.done[v]=true;r.chk=true;save();render();break}
 case'ckall':{const r=S.recs[U.check];r.done={};if(v==='1')checkItems(r).forEach(x=>r.done[x.key]=true);r.chk=true;save();render();break}
 case'wfedit':U.wfEdit=U.wfEdit===id?null:id;render();break;
 case'lrm':{const r=S.recs[U.detail];removeLine(r,v);save();toast('Posten entfernt');render();break}
 case'ladd':{const r=S.recs[id];addLine(r,netCol(r),'Neuer Posten');save();render();const l=[...view.querySelectorAll('[data-lname^="x:"]')].pop();if(l){l.focus();l.select()}break}
 case'lrestore':{const[rid,c]=splitKey(v);const r=S.recs[rid];if(r&&r.removed&&c in r.removed){r.v[c]=r.removed[c];delete r.removed[c];if(!Object.keys(r.removed).length)delete r.removed}save();toast('Wiederhergestellt');render();break}
 case'tedit':U.tedit=v;render();{const t=$('#tin');if(t){t.focus();t.setSelectionRange(t.value.length,t.value.length)}}break;case'tcancel':U.tedit=null;render();break;
 case'tsave':case'tdel':{const[k,rid,ix]=v.split(':');const r=S.recs[rid];const val=($('#tin')||{}).value||'';
  if(k==='v'){r.v[ix]=val.trim()}else{r.notes=r.notes||[];if(a.dataset.act==='tdel')r.notes.splice(+ix,1);else if(ix==='new'){if(val.trim())r.notes.push(val.trim())}else{if(val.trim())r.notes[+ix]=val.trim();else r.notes.splice(+ix,1)}}
  U.tedit=null;save();toast('Gesichert');render();break}
 case'bsave':{const r=S.recs[U.bm];applyBudInputs(r);save();U.bedit=false;toast('Gesichert');render();break}
 case'theme':S.settings.theme=v;save();applyTheme();render();break;
 case'defs':U.defs=v;render();scrollTo(0,0);break;case'defsback':U.defs=null;render();break;
 case'defsreset':delete S.settings.defaults[U.defs];save();render();toast('Zurückgesetzt');break;
 case'export':exportBackup();break;case'csv':exportCSV();break;case'import':$('#file').click();break;
 case'paste':{const t=prompt('Einrichtungslink hier einfügen:');if(t)try{await importSetup(t);U.tab='home';render()}catch(err){alert('Der Link konnte nicht gelesen werden: '+err.message)}break}
 case'closeres':U.result=null;render();break;
 case'pinset':showLock('set');break;case'pinoff':if(confirm('PIN-Sperre ausschalten?')){S.pin=null;save();render()}break;
 case'wipe':if(confirm('Wirklich ALLE Daten auf diesem Gerät löschen? Mach vorher ein Backup.')){localStorage.removeItem(KEY);S=defaults();save();U.year=null;U.result=null;render()}break}});
view.addEventListener('input',e=>{const t=e.target;if(t.id==='fgross'||t.dataset.col!=null)onFormInput(e);
 if(t.dataset.set==='hints'){S.settings.hints=t.checked;save();applyTheme();return}
 if(t.dataset.set==='mwst'){const x=num(t.value);if(isFinite(x)){S.settings.mwst=x;save()}}
 if(t.dataset.rate){const x=num(t.value);if(isFinite(x)){S.settings.rates[t.dataset.rate]=x;save()}}
 if(t.dataset.def){const k=U.defs,x=num(t.value);S.settings.defaults[k]=S.settings.defaults[k]||{};if(isFinite(x))S.settings.defaults[k][t.dataset.def]=x;save()}});
view.addEventListener('change',e=>{const t=e.target;
 if(t.dataset.lname||t.dataset.lamt){const r=S.recs[U.detail];if(!r)return;if(t.dataset.lname)applyLine(r,t.dataset.lname,'name',t.value.trim());else applyLine(r,t.dataset.lamt,'amt',t.value);save();const sel=t.dataset.lname?`[data-lamt="${t.dataset.lname}"]`:null;render();if(sel){const n=view.querySelector(sel);if(n)n.focus()}return}
 onFormChange(e)});
// Wischen zum Löschen (iOS)
let SW=null;view.addEventListener('touchstart',e=>{const w=e.target.closest('.swipe');document.querySelectorAll('.swipe.open').forEach(x=>{if(x!==w)x.classList.remove('open')});if(!w)return;SW={w,x:e.touches[0].clientX,y:e.touches[0].clientY,dx:0,lock:null}},{passive:true});
view.addEventListener('touchmove',e=>{if(!SW)return;const dx=e.touches[0].clientX-SW.x,dy=e.touches[0].clientY-SW.y;if(SW.lock==null&&(Math.abs(dx)>8||Math.abs(dy)>8))SW.lock=Math.abs(dx)>Math.abs(dy);if(SW.lock){SW.dx=dx;SW.w.classList.add('sw');const base=SW.w.classList.contains('open')?-88:0;const c=SW.w.querySelector('.cell');c.style.transition='none';c.style.transform=`translateX(${Math.min(0,Math.max(-130,base+dx))}px)`}},{passive:true});
view.addEventListener('touchend',()=>{if(!SW)return;const w=SW.w,c=w.querySelector('.cell');c.style.transition='';c.style.transform='';w.classList.remove('sw');if(SW.lock){if(SW.dx<-40)w.classList.add('open');else if(SW.dx>30)w.classList.remove('open');w.dataset.swiped='1';setTimeout(()=>delete w.dataset.swiped,350)}SW=null});
$('#file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const res=importObj(JSON.parse(await f.text()));if(res){U.result=res;U.year=null;render()}}catch(err){alert('Datei konnte nicht geladen werden: '+err.message)}});
function applyTheme(){document.body.classList.toggle('nohints',S.settings.hints===false);const t=S.settings.theme;if(t==='auto')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=t}

(async function start(){applyTheme();if(S.pin)showLock('unlock');
 if(/#setup=/.test(location.hash)){const code=location.hash;history.replaceState(null,'',location.pathname+location.search);try{await importSetup(code)}catch(err){U.result=null;alert('Einrichtungslink konnte nicht gelesen werden: '+err.message)}}
 render();
 if('serviceWorker'in navigator&&!/nosw/.test(location.search))navigator.serviceWorker.register('sw.js').catch(()=>{})})();
