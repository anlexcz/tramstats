(()=>{
'use strict';

const Domain=window.TramStatsShiftDomain;
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
const SEARCH_CACHE=new WeakMap();
const RETURN_KEY='tramstats-shifts-return-state';
let mobileDraft=null;

function readReturnState(){
  if(history.state?.tramstatsShiftList!==true)return null;
  let saved=null;
  try{saved=JSON.parse(sessionStorage.getItem(RETURN_KEY)||'null');}catch{}
  sessionStorage.removeItem(RETURN_KEY);
  const next={...(history.state||{})};
  delete next.tramstatsShiftList;
  history.replaceState(next,'');
  return saved&&typeof saved==='object'?saved:null;
}
const restored=readReturnState();

state.year='all';
state.query=restored?.query??state.query??'';
state.type=restored?.type??state.type??'';
state.depot=restored?.depot??state.depot??'';
state.dateFrom=restored?.dateFrom??'';
state.dateTo=restored?.dateTo??'';
state.workOnly=restored?.workOnly??false;
state.pageSize=Number(restored?.pageSize)||state.pageSize||25;
state.visibleCount=Number(restored?.visibleCount)||state.pageSize;

const norm=value=>String(value??'').toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const fullDay=iso=>DAY_NAMES[new Date(iso+'T12:00:00').getDay()]||'';
const typeLabel=s=>s.shiftType?.name||s.actualShift||'';
const depotLabel=s=>s.depotMeta?.name||s.depot||'';
const hasTimedPart=s=>(s.parts||[]).some(p=>p.start&&p.end);
const durationLabel=s=>{const minutes=Domain.durationMinutes(s);return minutes!=null?hm(minutes):'';};
const performanceRows=s=>Domain.performanceRows(s);

function workMetrics(s){
  const ps=s.parts||[];
  return {
    type:typeLabel(s),
    depot:depotLabel(s),
    km:ps.some(p=>p.km!=null)?`${fmt(sumKm(ps))} km`:'',
    duration:durationLabel(s),
    performances:performanceRows(s)
  };
}
function performancesHTML(rows){
  if(!rows.length)return '<span class="shift-list-empty">Bez výkonu</span>';
  return rows.map(row=>`<span class="shift-list-performance">${(row.badges||[]).map(b=>`<b>${esc(b.label||'—')}</b>`).join('')}${row.interval?`<span class="shift-list-range">${iconInterval}<span>${esc(row.interval)}</span></span>`:''}</span>`).join('');
}
function metaItem(icon,label,cls=''){return label?`<span class="shift-list-meta ${cls}">${icon}<span>${esc(label)}</span></span>`:'';}
function shiftCard(s){
  const absence=ABSENCES[s.actualShift];
  if(absence){
    return `<a class="shift-list-card shift-list-absence shift-list-absence-${absence.tone}" href="shifts/detail/?date=${encodeURIComponent(s.date)}" data-shift-date="${esc(s.date)}"><span class="shift-list-date"><small>${esc(fullDay(s.date))}</small><strong>${date(s.date)}</strong></span><span class="shift-list-absence-badge">${esc(absence.label)}</span></a>`;
  }
  const m=workMetrics(s),performance=performancesHTML(m.performances);
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

function addSearchValue(index,value,{exact=false}={}){
  if(value==null||value==='')return;
  const normalized=norm(value);
  if(!normalized)return;
  index.text.push(normalized);
  if(exact)index.exact.add(normalized);
}
function addDateValues(index,iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return;
  const [y,m,d]=iso.split('-');
  for(const value of [iso,`${d}.${m}.${y}`,`${d}.${m}.`,`${d}/${m}/${y}`,`${d}/${m}`])addSearchValue(index,value,{exact:true});
}
function searchIndex(s){
  const cached=SEARCH_CACHE.get(s);
  if(cached)return cached;
  const index={text:[],exact:new Set()};
  addDateValues(index,s.date);
  addSearchValue(index,s.actualShift,{exact:true});
  addSearchValue(index,typeLabel(s));
  addSearchValue(index,s.depot,{exact:true});
  addSearchValue(index,depotLabel(s));
  addSearchValue(index,s.note);
  const absence=ABSENCES[s.actualShift];
  if(absence)addSearchValue(index,absence.label);
  for(const p of s.parts||[]){
    addSearchValue(index,p.course,{exact:true});
    addSearchValue(index,p.order,{exact:true});
    addSearchValue(index,p.vehicleType);
    addSearchValue(index,p.frontVehicle,{exact:true});
    addSearchValue(index,p.rearVehicle,{exact:true});
    addSearchValue(index,p.frontVehicleMeta?.type);
    addSearchValue(index,p.frontVehicleMeta?.family);
    addSearchValue(index,p.rearVehicleMeta?.type);
    addSearchValue(index,p.rearVehicleMeta?.family);
    addSearchValue(index,p.note);
    for(const lp of p.lineParts||[]){
      const code=String(lp.line??'').trim();
      if(!code)continue;
      addSearchValue(index,code,{exact:true});
      addSearchValue(index,lp.lineMeta?.alias,{exact:true});
      addSearchValue(index,lp.lineMeta?.name);
      if(code==='Z')addSearchValue(index,'Záloha');
      if(code==='73'){
        addSearchValue(index,'L',{exact:true});
        addSearchValue(index,'Cvičná jízda');
      }
      if(p.course!=null&&p.course!=='')addSearchValue(index,`${code}/${p.course}`,{exact:true});
      if(p.order!=null&&p.order!=='')addSearchValue(index,`${code}/${p.order}`,{exact:true});
    }
  }
  index.blob=` ${index.text.join(' ')} `;
  SEARCH_CACHE.set(s,index);
  return index;
}
function matchesSearch(s,query){
  const tokens=norm(query).split(/\s+/).filter(Boolean);
  if(!tokens.length)return true;
  const index=searchIndex(s);
  return tokens.every(token=>/^\d+$/.test(token)?index.exact.has(token):index.exact.has(token)||index.blob.includes(token));
}
function filterRowsWith(ss,values){
  return ss.filter(s=>{
    if(values.type&&s.actualShift!==values.type)return false;
    if(values.depot&&s.depot!==values.depot)return false;
    if(values.dateFrom&&s.date<values.dateFrom)return false;
    if(values.dateTo&&s.date>values.dateTo)return false;
    if(values.workOnly&&!hasTimedPart(s))return false;
    if(values.query&&!matchesSearch(s,values.query))return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
function filterRows(ss){return filterRowsWith(ss,state);}
filtered=filterRows;
shiftHTML=shiftCard;

function optionRows(items,selected,labelFn=x=>x){
  return items.map(x=>`<option value="${esc(x)}" ${selected===x?'selected':''}>${esc(labelFn(x))}</option>`).join('');
}
function controls(ss,prefix='',values=state){
  const id=x=>prefix+x;
  const types=[...new Set(ss.map(s=>s.actualShift).filter(Boolean))].sort();
  const depots=[...new Set(ss.map(s=>s.depot).filter(Boolean))].sort();
  const typeNames=new Map(ss.map(s=>[s.actualShift,typeLabel(s)]));
  const depotNames=new Map(ss.map(s=>[s.depot,depotLabel(s)]));
  const dateField=window.TramStatsDateRange?.field(prefix,values)||'';
  return `<label>TYP SMĚNY<select id="${id('shift-type-filter')}"><option value="">Všechny typy směn</option>${optionRows(types,values.type,x=>typeNames.get(x)||x)}</select></label>
    <label>VOZOVNA<select id="${id('depot-filter')}"><option value="">Všechny vozovny</option>${optionRows(depots,values.depot,x=>depotNames.get(x)||x)}</select></label>
    ${dateField}
    <label class="shift-work-only"><input id="${id('work-only-filter')}" type="checkbox" ${values.workOnly?'checked':''}><span>Jen pracovní záznamy</span></label>
    <div class="shift-page-size"><span>NAČÍST PO</span><div>${[25,50,100,200].map(n=>`<button type="button" data-page-size="${n}" class="${Number(values.pageSize)===n?'active':''}">${n}</button>`).join('')}</div></div>`;
}
function shiftPage(ss){
  const list=filterRows(ss);
  const shown=Math.min(Math.max(state.visibleCount,state.pageSize),list.length);
  const active=[state.type,state.depot,state.dateFrom||state.dateTo,state.workOnly].filter(Boolean).length;
  const filterBody=controls(ss),mobileBody=controls(ss,'mobile-',state);
  return `<div class="shift-filters">
      <div class="shift-search"><span>⌕</span><input id="shift-search" type="search" placeholder="KO 15T, 17 9170, 95/64, 25.4.…" value="${esc(state.query)}" aria-label="Hledat ve směnách"><button type="button" id="mobile-filter-open" aria-expanded="false" aria-controls="mobile-filter-sheet">FILTRY${active?` <b>${active}</b>`:''}</button></div>
      <div class="shift-desktop-controls">${filterBody}<button type="button" class="shift-clear-filters">ZRUŠIT FILTRY</button></div>
      <div class="shift-count">Zobrazeno ${shown} z ${list.length} evidovaných dnů</div>
      <div class="shift-mobile-sheet" id="mobile-filter-sheet" aria-hidden="true"><button class="shift-sheet-backdrop" type="button" aria-label="Zavřít filtry"></button><div class="shift-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title"><div class="shift-sheet-head"><strong id="mobile-filter-title">FILTRY</strong><button class="shift-sheet-close" type="button" aria-label="Zavřít filtry">×</button></div>${mobileBody}<button type="button" class="shift-clear-filters">ZRUŠIT FILTRY</button><button type="button" class="shift-sheet-done">ZOBRAZIT ${list.length} SMĚN</button></div></div>
    </div>
    <div id="shift-results">${list.slice(0,shown).map(shiftCard).join('')||'<div class="empty">Žádný odpovídající záznam.</div>'}</div>
    ${shown<list.length?`<div class="shift-load-more"><button type="button" id="shift-load-more">NAČÍST DALŠÍCH ${Math.min(state.pageSize,list.length-shown)}</button><span>${shown} / ${list.length}</span></div>`:''}`;
}
shiftList=shiftPage;

function rerender(reset=true){if(reset)state.visibleCount=state.pageSize;render();}
function setFilter(target){
  const id=target.id;
  if(id==='shift-search'){
    state.query=target.value;rerender(true);
    requestAnimationFrame(()=>{const x=document.querySelector('#shift-search');if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length);}});
    return true;
  }
  if(id==='shift-type-filter'){state.type=target.value;rerender(true);return true;}
  if(id==='depot-filter'){state.depot=target.value;rerender(true);return true;}
  if(id==='work-only-filter'){state.workOnly=target.checked;rerender(true);return true;}
  return false;
}
function makeMobileDraft(){return {query:state.query||'',type:state.type||'',depot:state.depot||'',dateFrom:state.dateFrom||'',dateTo:state.dateTo||'',workOnly:!!state.workOnly,pageSize:state.pageSize||25};}
function mobileResultCount(){return mobileDraft?filterRowsWith(state.shifts||[],mobileDraft).length:filterRows(state.shifts||[]).length;}
function refreshMobileDraftUI(){
  if(!mobileDraft)return;
  const type=document.querySelector('#mobile-shift-type-filter'),depot=document.querySelector('#mobile-depot-filter'),work=document.querySelector('#mobile-work-only-filter');
  if(type)type.value=mobileDraft.type||'';
  if(depot)depot.value=mobileDraft.depot||'';
  if(work)work.checked=!!mobileDraft.workOnly;
  document.querySelectorAll('.shift-sheet-panel [data-page-size]').forEach(b=>b.classList.toggle('active',Number(b.dataset.pageSize)===Number(mobileDraft.pageSize)));
  const range=document.querySelector('.shift-sheet-panel .range-field>span');
  if(range&&window.TramStatsDateRange?.label)range.textContent=window.TramStatsDateRange.label(mobileDraft);
  const done=document.querySelector('.shift-sheet-done');
  if(done)done.textContent=`ZOBRAZIT ${mobileResultCount()} SMĚN`;
}
window.TramStatsMobileFilterDraft={
  get:()=>mobileDraft||makeMobileDraft(),
  setDates:(dateFrom,dateTo)=>{if(!mobileDraft)mobileDraft=makeMobileDraft();mobileDraft.dateFrom=dateFrom||'';mobileDraft.dateTo=dateTo||'';refreshMobileDraftUI();}
};
function openMobileFilters(){
  mobileDraft=makeMobileDraft();
  const sheet=document.querySelector('.shift-mobile-sheet'),opener=document.querySelector('#mobile-filter-open');
  document.body.classList.add('shift-filters-open');
  sheet?.setAttribute('aria-hidden','false');
  opener?.setAttribute('aria-expanded','true');
  refreshMobileDraftUI();
  requestAnimationFrame(()=>document.querySelector('#mobile-shift-type-filter')?.focus());
}
function closeMobileFilters({restoreFocus=true}={}){
  document.querySelector('.range-popover')?.remove();
  document.body.classList.remove('shift-filters-open');
  document.querySelector('.shift-mobile-sheet')?.setAttribute('aria-hidden','true');
  document.querySelector('#mobile-filter-open')?.setAttribute('aria-expanded','false');
  mobileDraft=null;
  if(restoreFocus)requestAnimationFrame(()=>document.querySelector('#mobile-filter-open')?.focus());
}
function applyMobileFilters(){
  if(!mobileDraft){closeMobileFilters();return;}
  state.type=mobileDraft.type||'';
  state.depot=mobileDraft.depot||'';
  state.dateFrom=mobileDraft.dateFrom||'';
  state.dateTo=mobileDraft.dateTo||'';
  state.workOnly=!!mobileDraft.workOnly;
  state.pageSize=Number(mobileDraft.pageSize)||25;
  state.visibleCount=state.pageSize;
  closeMobileFilters({restoreFocus:false});
  render();
  requestAnimationFrame(()=>document.querySelector('#mobile-filter-open')?.focus());
}
function clearMobileDraft(){mobileDraft={query:state.query||'',type:'',depot:'',dateFrom:'',dateTo:'',workOnly:false,pageSize:state.pageSize||25};refreshMobileDraftUI();}
function saveReturnState(){
  sessionStorage.setItem(RETURN_KEY,JSON.stringify({query:state.query||'',type:state.type||'',depot:state.depot||'',dateFrom:state.dateFrom||'',dateTo:state.dateTo||'',workOnly:!!state.workOnly,pageSize:state.pageSize||25,visibleCount:state.visibleCount||state.pageSize||25,scrollY:window.scrollY||0}));
  history.replaceState({...history.state,tramstatsShiftList:true},'');
}

document.addEventListener('input',e=>{if(e.target.id==='shift-search')setFilter(e.target);});
document.addEventListener('change',e=>{
  if(e.target.id==='mobile-shift-type-filter'){if(mobileDraft){mobileDraft.type=e.target.value;refreshMobileDraftUI();}return;}
  if(e.target.id==='mobile-depot-filter'){if(mobileDraft){mobileDraft.depot=e.target.value;refreshMobileDraftUI();}return;}
  if(e.target.id==='mobile-work-only-filter'){if(mobileDraft){mobileDraft.workOnly=e.target.checked;refreshMobileDraftUI();}return;}
  setFilter(e.target);
});
document.addEventListener('click',e=>{
  const size=e.target.closest('[data-page-size]');
  if(size){
    if(size.closest('.shift-sheet-panel')){if(mobileDraft){mobileDraft.pageSize=Number(size.dataset.pageSize);refreshMobileDraftUI();}return;}
    state.pageSize=Number(size.dataset.pageSize);rerender(true);return;
  }
  if(e.target.closest('#mobile-filter-open')){openMobileFilters();return;}
  if(e.target.closest('.shift-sheet-close,.shift-sheet-backdrop')){closeMobileFilters();return;}
  if(e.target.closest('.shift-sheet-done')){applyMobileFilters();return;}
  const clear=e.target.closest('.shift-clear-filters');
  if(clear){
    if(clear.closest('.shift-sheet-panel')){clearMobileDraft();return;}
    state.query='';state.type='';state.depot='';state.dateFrom='';state.dateTo='';state.workOnly=false;rerender(true);return;
  }
  const more=e.target.closest('#shift-load-more');
  if(more){state.visibleCount+=state.pageSize;render();return;}
  if(e.target.closest('.shift-list-card'))saveReturnState();
});
document.addEventListener('keydown',e=>{
  if(!document.body.classList.contains('shift-filters-open'))return;
  if(document.querySelector('.range-popover'))return;
  if(e.key==='Escape'){e.preventDefault();closeMobileFilters();return;}
  if(e.key!=='Tab')return;
  const panel=document.querySelector('.shift-sheet-panel');
  if(!panel)return;
  const focusables=[...panel.querySelectorAll('button:not([disabled]),select:not([disabled]),input:not([disabled]),[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
  if(!focusables.length)return;
  const first=focusables[0],last=focusables.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
window.addEventListener('load',()=>{
  if(Number(restored?.scrollY)>0)requestAnimationFrame(()=>window.scrollTo({top:Number(restored.scrollY),behavior:'instant'}));
});

if(state.shifts?.length)render();
})();
