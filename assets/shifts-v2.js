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
function shiftIntervals(s){const ps=s.parts||[];if(!ps.length)return[];if(s.actualShift!=='Š')return ps[0]?.start&&ps.at(-1)?.end?[`${ps[0].start}–${ps.at(-1).end}`]:[];const tl=timeline(s).filter(p=>p.a!=null&&p.b!=null);if(!tl.length)return[];let split=-1,best=0;for(let i=1;i<tl.length;i++){const gap=tl[i].a-tl[i-1].b;if(gap>=90&&gap>best){best=gap;split=i;}}if(split<0)return [`${tl[0].start}–${tl.at(-1).end}`];return [`${tl[0].start}–${tl[split-1].end}`,`${tl[split].start}–${tl.at(-1).end}`];}
function absenceHTML(s){const a=absenceAliases[s.actualShift];if(!a)return'';return `<span class="shift-absence-badge shift-absence-${a.tone}">${esc(a.label)}</span>`;}
function shiftV2HTML(s){
 const ps=s.parts||[],performances=uniquePerformances(ps),absence=absenceAliases[s.actualShift],kmKnown=ps.some(p=>p.km!=null),depot=s.depot&&s.depot!=='—'?s.depot:'',intervals=shiftIntervals(s),duration=summedDuration(ps);
 const perf=performances.map(x=>shiftPerf(x.line,x.course,x.order)).join('');
 const times=intervals.map(x=>`<span>${esc(x)}</span>`).join('');
 const km=kmKnown?distanceIcon+fmt(sumKm(ps))+' km':'';
 const dur=duration?clockIcon+esc(duration):'';
 const desktop=`<div class="shift-summary-desktop"><div class="shift-date-v3"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></div><div class="shift-meta-v3">${absence?absenceHTML(s):`<span class="shift-ss">${esc(s.actualShift)}</span>${depot?`<span class="shift-depot-v3">${esc(depot)}</span>`:''}`}</div><div class="shift-performances-v3">${absence?'':perf}</div><div class="shift-time-v2">${times}</div><strong class="shift-duration-v3">${dur}</strong><strong class="shift-km-v2">${km}</strong></div>`;
 const mobile=absence?`<div class="shift-summary-mobile shift-mobile-absence"><div class="shift-mobile-date"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></div>${absenceHTML(s)}</div>`:`<div class="shift-summary-mobile"><div class="shift-mobile-left"><div class="shift-mobile-heading"><span class="shift-ss">${esc(s.actualShift)}</span><span>${esc(fullDay(s.date))}</span></div><strong class="shift-mobile-date-value">${date(s.date)}</strong><div class="shift-performances-v3">${perf}</div></div><div class="shift-mobile-metrics"><strong class="shift-km-v2">${km}</strong><strong class="shift-duration-v3">${dur}</strong></div><div class="shift-mobile-context">${depot?`<strong class="shift-depot-v3">${esc(depot)}</strong>`:''}<div class="shift-time-v2">${times}</div></div></div>`;
 return `<details class="shift shift-v2${absence?' shift-absence shift-absence-'+absence.tone:''}"><summary>${desktop}${mobile}</summary><div class="parts">${detailHTML(s)}</div></details>`;
}
shiftHTML=shiftV2HTML;
})();