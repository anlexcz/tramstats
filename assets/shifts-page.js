(()=>{
'use strict';

const ABSENCES={
  V:{label:'Volno',tone:'off'},
  VVS:{label:'Volno vzniklé svátkem',tone:'off'},
  D:{label:'Dovolená',tone:'off'},
  PN:{label:'Nemocenská',tone:'sick'},
  SD:{label:'Sick day',tone:'sick'},
  MD:{label:'Mateřská dovolená',tone:'off'}
};
const DAY_NAMES=['Neděle','Pondělí','Úterý','Středa','Čtvrtek','Pátek','Sobota'];
const iconDepot='<svg class="shift-list-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10M10 20v-6h4v6"/></svg>';
const iconKm='<svg class="shift-list-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5c-2 0-3 1.3-3 3s1 3 3 3h12c2 0 3 1.3 3 3s-1 3-3 3H8"/><path d="M8 14l-3 3 3 3"/></svg>';
const iconClock='<svg class="shift-list-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>';
const iconInterval='<svg class="shift-list-interval-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M8 9l-3 3 3 3M16 9l3 3-3 3"/></svg>';

state.year='all';
state.dateFrom=state.dateFrom||'';
state.dateTo=state.dateTo||'';
state.workOnly=state.workOnly||false;
state.pageSize=state.pageSize||25;
state.visibleCount=Number(sessionStorage.getItem('tramstats-shifts-visible'))||state.pageSize;

const norm=value=>String(value??'').toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const fullDay=iso=>DAY_NAMES[new Date(iso+'T12:00:00').getDay()]||'';
const typeLabel=s=>s.shiftType?.name||s.actualShift||'';
const depotLabel=s=>s.depotMeta?.name||s.depot||'';
const hasTimedPart=s=>(s.parts||[]).some(p=>p.start&&p.end);

function durationLabel(parts){
  let total=0,known=false;
  for(const p of parts){
    if(!p.duration) continue;
    const m=mins(p.duration);
    if(m==null) continue;
    total+=m;known=true;
  }
  return known?hm(total):'';
}
function performanceRows(s){
  const out=[];
  const hasValue=v=>v!=null&&v!=='';
  const lineTokens=line=>String(line||'').split('+').map(x=>x.trim()).filter(Boolean);
  for(const p of s.parts||[]){
    if(!p.line&&!p.start&&!p.end) continue;
    const line=p.line||(/^Záloha(?:\s|$)/i.test(p.note||'')?'Z':'');
    if(line==='Z'){
      out.push({identity:`Z|${p.partNo??out.length}`,label:'Záloha',start:p.start||'',end:p.end||''});
      continue;
    }

    const hasCourse=hasValue(p.course);
    const ref=hasCourse?p.course:(p.order??'');
    const identity=hasCourse?`course|${p.course}`:`order|${line}|${ref}`;
    const previous=out[out.length-1];

    if(previous&&previous.identity===identity){
      for(const token of lineTokens(line))if(!previous.lines.includes(token))previous.lines.push(token);
      if(!previous.start&&p.start)previous.start=p.start;
      if(p.end)previous.end=p.end;
      previous.label=`${previous.lines.join('+')}${hasValue(ref)?`/${ref}`:''}`;
      continue;
    }

    const lines=lineTokens(line);
    out.push({
      identity,
      lines,
      label:line?`${lines.join('+')}${hasValue(ref)?`/${ref}`:''}`:'',
      start:p.start||'',
      end:p.end||''
    });
  }
  return out.map(r=>({...r,interval:r.start&&r.end?`${r.start}–${r.end}`:''}));
}
function workMetrics(s){
  const ps=s.parts||[];
  const knownKm=ps.some(p=>p.km!=null);
  return {
    type:typeLabel(s),
    depot:depotLabel(s),
    km:knownKm?`${fmt(sumKm(ps))} km`:'',
    duration:durationLabel(ps),
    performances:performanceRows(s)
  };
}
function performancesHTML(rows){
  if(!rows.length)return '<span class="shift-list-empty">Bez výkonu</span>';
  return rows.map(r=>`<span class="shift-list-performance"><b>${esc(r.label||'—')}</b>${r.interval?`<span class="shift-list-range">${iconInterval}<span>${esc(r.interval)}</span></span>`:''}</span>`).join('');
}
function metaItem(icon,label,cls=''){return label?`<span class="shift-list-meta ${cls}">${icon}<span>${esc(label)}</span></span>`:'';}

function shiftCard(s){
  const absence=ABSENCES[s.actualShift];
  if(absence){
    return `<a class="shift-list-card shift-list-absence shift-list-absence-${absence.tone}" href="shifts/detail/?date=${encodeURIComponent(s.date)}" data-shift-date="${esc(s.date)}"><span class="shift-list-date"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></span><span class="shift-list-absence-badge">${esc(absence.label)}</span></a>`;
  }
  const m=workMetrics(s);
  const performance=performancesHTML(m.performances);
  return `<a class="shift-list-card shift-list-work" href="shifts/detail/?date=${encodeURIComponent(s.date)}" data-shift-date="${esc(s.date)}">
    <span class="shift-list-date"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></span>
    <span class="shift-list-type">${esc(m.type)}</span>
    <span class="shift-list-mobile-head"><span class="shift-list-mobile-date"><strong>${date(s.date)}</strong><small>${esc(fullDay(s.date))}</small></span><span class="shift-list-mobile-type">${esc(m.type)}</span></span>
    <span class="shift-list-performances">${performance}</span>
    <span class="shift-list-depot">${metaItem(iconDepot,m.depot)}</span>
    <span class="shift-list-km">${metaItem(iconKm,m.km)}</span>
    <span class="shift-list-duration">${metaItem(iconClock,m.duration)}</span>
    <span class="shift-list-mobile-meta">${metaItem(iconDepot,m.depot)}${metaItem(iconKm,m.km)}${metaItem(iconClock,m.duration)}</span>
  </a>`;
}

function filterRows(ss){
  const q=norm(state.query);
  return ss.filter(s=>{
    if(state.type&&s.actualShift!==state.type)return false;
    if(state.depot&&s.depot!==state.depot)return false;
    if(state.dateFrom&&s.date<state.dateFrom)return false;
    if(state.dateTo&&s.date>state.dateTo)return false;
    if(state.workOnly&&!hasTimedPart(s))return false;
    if(q&&!norm(JSON.stringify(s)).includes(q))return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
filtered=filterRows;
shiftHTML=shiftCard;

function optionRows(items,selected,labelFn=x=>x){
  return items.map(x=>`<option value="${esc(x)}" ${selected===x?'selected':''}>${esc(labelFn(x))}</option>`).join('');
}
function controls(ss,prefix=''){
  const id=x=>prefix+x;
  const types=[...new Set(ss.map(s=>s.actualShift).filter(Boolean))].sort();
  const depots=[...new Set(ss.map(s=>s.depot).filter(Boolean))].sort();
  const typeNames=new Map(ss.map(s=>[s.actualShift,typeLabel(s)]));
  const depotNames=new Map(ss.map(s=>[s.depot,depotLabel(s)]));
  const dateField=window.TramStatsDateRange?.field(prefix)||'';
  return `<label>TYP SMĚNY<select id="${id('shift-type-filter')}"><option value="">Všechny typy směn</option>${optionRows(types,state.type,x=>typeNames.get(x)||x)}</select></label>
    <label>VOZOVNA<select id="${id('depot-filter')}"><option value="">Všechny vozovny</option>${optionRows(depots,state.depot,x=>depotNames.get(x)||x)}</select></label>
    ${dateField}
    <label class="shift-work-only"><input id="${id('work-only-filter')}" type="checkbox" ${state.workOnly?'checked':''}><span>Jen pracovní záznamy</span></label>
    <div class="shift-page-size"><span>NAČÍST PO</span><div>${[25,50,100,200].map(n=>`<button type="button" data-page-size="${n}" class="${state.pageSize===n?'active':''}">${n}</button>`).join('')}</div></div>`;
}
function shiftPage(ss){
  const list=filterRows(ss);
  const shown=Math.min(Math.max(state.visibleCount,state.pageSize),list.length);
  const active=[state.type,state.depot,state.dateFrom||state.dateTo,state.workOnly].filter(Boolean).length;
  const filterBody=controls(ss);
  const mobileBody=controls(ss,'mobile-');
  return `<div class="shift-filters">
      <div class="shift-search"><span>⌕</span><input id="shift-search" type="search" placeholder="KO 15T, 3 9118, 95/64, 25.4.…" value="${esc(state.query)}" aria-label="Hledat ve směnách"><button type="button" id="mobile-filter-open">FILTRY${active?` <b>${active}</b>`:''}</button></div>
      <div class="shift-desktop-controls">${filterBody}<button type="button" class="shift-clear-filters">ZRUŠIT FILTRY</button></div>
      <div class="shift-count">Zobrazeno ${shown} z ${list.length} evidovaných dnů</div>
      <div class="shift-mobile-sheet" aria-hidden="true"><button class="shift-sheet-backdrop" type="button" aria-label="Zavřít filtry"></button><div class="shift-sheet-panel"><div class="shift-sheet-head"><strong>FILTRY</strong><button class="shift-sheet-close" type="button">×</button></div>${mobileBody}<button type="button" class="shift-clear-filters">ZRUŠIT FILTRY</button><button type="button" class="shift-sheet-done">ZOBRAZIT ${list.length} SMĚN</button></div></div>
    </div>
    <div id="shift-results">${list.slice(0,shown).map(shiftCard).join('')||'<div class="empty">Žádný odpovídající záznam.</div>'}</div>
    ${shown<list.length?`<div class="shift-load-more"><button type="button" id="shift-load-more">NAČÍST DALŠÍCH ${Math.min(state.pageSize,list.length-shown)}</button><span>${shown} / ${list.length}</span></div>`:''}`;
}
shiftList=shiftPage;

function rerender(reset=true,keepSheet=false){
  if(reset)state.visibleCount=state.pageSize;
  render();
  if(keepSheet)document.body.classList.add('shift-filters-open');
}
function setFilter(target){
  const id=target.id;
  const mobile=id.startsWith('mobile-');
  if(id==='shift-search'){state.query=target.value;rerender(true,false);requestAnimationFrame(()=>{const x=document.querySelector('#shift-search');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length);}});return true;}
  if(id==='shift-type-filter'||id==='mobile-shift-type-filter'){state.type=target.value;rerender(true,mobile);return true;}
  if(id==='depot-filter'||id==='mobile-depot-filter'){state.depot=target.value;rerender(true,mobile);return true;}
  if(id==='work-only-filter'||id==='mobile-work-only-filter'){state.workOnly=target.checked;rerender(true,mobile);return true;}
  return false;
}
document.addEventListener('input',e=>{if(e.target.id==='shift-search')setFilter(e.target);});
document.addEventListener('change',e=>setFilter(e.target));
document.addEventListener('click',e=>{
  const size=e.target.closest('[data-page-size]');
  if(size){state.pageSize=Number(size.dataset.pageSize);rerender(true,document.body.classList.contains('shift-filters-open'));return;}
  if(e.target.closest('#mobile-filter-open')){document.body.classList.add('shift-filters-open');return;}
  if(e.target.closest('.shift-sheet-close,.shift-sheet-backdrop,.shift-sheet-done')){document.body.classList.remove('shift-filters-open');return;}
  if(e.target.closest('.shift-clear-filters')){state.query='';state.type='';state.depot='';state.dateFrom='';state.dateTo='';state.workOnly=false;rerender(true,false);return;}
  const more=e.target.closest('#shift-load-more');
  if(more){state.visibleCount+=state.pageSize;sessionStorage.setItem('tramstats-shifts-visible',String(state.visibleCount));render();return;}
  const card=e.target.closest('.shift-list-card');
  if(card){sessionStorage.setItem('tramstats-shifts-scroll',String(window.scrollY));sessionStorage.setItem('tramstats-shifts-visible',String(state.visibleCount));}
});
window.addEventListener('load',()=>{
  const y=Number(sessionStorage.getItem('tramstats-shifts-scroll'));
  if(y>0){requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));sessionStorage.removeItem('tramstats-shifts-scroll');}
});

if(state.shifts?.length)render();
})();
