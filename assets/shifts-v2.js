(()=>{
const shiftAliases={Z:'Záloha'};
const absenceAliases={V:{label:'Volno',tone:'off'},VVS:{label:'Volno vzniklé svátkem',tone:'off'},D:{label:'Dovolená',tone:'off'},PN:{label:'Nemocenská',tone:'sick'},SD:{label:'Sick day',tone:'sick'}};
const dayNames=['Neděle','Pondělí','Úterý','Středa','Čtvrtek','Pátek','Sobota'];
const clockIcon='<svg class="shift-metric-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>';
const distanceIcon='<svg class="shift-metric-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5c-2 0-3 1.3-3 3s1 3 3 3h12c2 0 3 1.3 3 3s-1 3-3 3H8"/><path d="M8 14l-3 3 3 3"/></svg>';
function fullDay(d){const x=new Date(d+'T12:00:00');return dayNames[x.getDay()]||'';}
function shiftDisplayLine(p){if(p.line)return p.line;return /^Záloha(?:\s|$)/i.test(p.note||'')?'Z':null;}
function perfLabel(line,course,order){const alias=shiftAliases[line];if(alias)return alias;const ref=course!=null&&course!==''?course:(order!=null&&order!==''?order:'');return ref!==''?`${line}/${ref}`:`${line}`;}
function shiftPerf(line,course,order){if(!line)return'';const alias=shiftAliases[line];return `<span class="shift-performance-v3${alias?' shift-performance-alias':''}">${esc(perfLabel(line,course,order))}</span>`;}
function uniquePerformances(ps){const out=[],seen=new Set();for(const p of ps){const line=shiftDisplayLine(p);if(!line)continue;const course=p.course??'',order=p.order??'';const ref=course!==''?course:order;const key=`${line}|${ref}`;if(seen.has(key))continue;seen.add(key);out.push({line,course,order});}return out;}
function summedDuration(ps){let total=0,known=false;for(const p of ps){if(!p.duration)continue;const m=mins(p.duration);if(m==null)continue;total+=m;known=true;}return known?hm(total):'';}
function splitShiftParts(s){const ps=s.parts||[];if(s.actualShift!=='Š'||ps.length<2)return [ps];const tl=timeline(s).filter(p=>p.a!=null&&p.b!=null);if(tl.length<2)return [ps];let split=-1,best=0;for(let i=1;i<tl.length;i++){const gap=tl[i].a-tl[i-1].b;if(gap>=90&&gap>best){best=gap;split=i;}}if(split<0)return [ps];return [tl.slice(0,split),tl.slice(split)];}
function intervalFor(ps){const valid=ps.filter(p=>p.start&&p.end);return valid.length?`${valid[0].start}–${valid.at(-1).end}`:'';}
function operatingRows(s){return splitShiftParts(s).map(ps=>({performances:uniquePerformances(ps),interval:intervalFor(ps)})).filter(r=>r.performances.length||r.interval);}
function absenceHTML(s){const a=absenceAliases[s.actualShift];if(!a)return'';return `<span class="shift-absence-badge shift-absence-${a.tone}">${esc(a.label)}</span>`;}
function rowsHTML(rows){return rows.map(r=>`<div class="shift-operating-row"><div class="shift-performances-v3">${r.performances.map(x=>shiftPerf(x.line,x.course,x.order)).join('')}</div><div class="shift-time-v2">${r.interval?`<span>${esc(r.interval)}</span>`:''}</div></div>`).join('');}
function shiftV2HTML(s){
 const ps=s.parts||[],absence=absenceAliases[s.actualShift],kmKnown=ps.some(p=>p.km!=null),depot=s.depot&&s.depot!=='—'?s.depot:'',duration=summedDuration(ps),rows=operatingRows(s);
 const km=kmKnown?distanceIcon+fmt(sumKm(ps))+' km':'';
 const dur=duration?clockIcon+esc(duration):'';
 const operating=`<div class="shift-operating-v5">${absence?'':rowsHTML(rows)}</div>`;
 const desktop=`<div class="shift-summary-desktop"><div class="shift-date-v3"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></div><div class="shift-meta-v3">${absence?absenceHTML(s):`<span class="shift-ss">${esc(s.actualShift)}</span>${depot?`<span class="shift-depot-v3">${esc(depot)}</span>`:''}`}</div>${operating}<strong class="shift-duration-v3">${dur}</strong><strong class="shift-km-v2">${km}</strong></div>`;
 const mobile=absence?`<div class="shift-summary-mobile shift-mobile-absence"><div class="shift-mobile-date"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></div>${absenceHTML(s)}</div>`:`<div class="shift-summary-mobile shift-mobile-v5"><div class="shift-mobile-top"><div class="shift-mobile-date"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></div><div class="shift-mobile-meta"><span class="shift-ss">${esc(s.actualShift)}</span>${depot?`<span class="shift-depot-v3">${esc(depot)}</span>`:''}</div></div><div class="shift-mobile-rows">${rowsHTML(rows)}</div><div class="shift-mobile-measures"><strong class="shift-duration-v3">${dur}</strong><strong class="shift-km-v2">${km}</strong></div></div>`;
 return `<details class="shift shift-v2${absence?' shift-absence shift-absence-'+absence.tone:''}"><summary>${desktop}${mobile}</summary><div class="parts">${detailHTML(s)}</div></details>`;
}
shiftHTML=shiftV2HTML;
const baseShiftList=shiftList;
shiftList=function(ss){let html=baseShiftList(ss);const m=html.match(/^<div class="filters">[\s\S]*?<\/div>/);const filters=m?m[0]:'';if(filters)html=html.slice(filters.length);return `<div class="shifts-layout-v2"><section class="shifts-main-v2">${html}</section><aside class="shifts-sidebar-v2" aria-label="Filtry směn"><div class="shifts-sidebar-title">FILTRY</div>${filters}</aside></div>`;};
})();