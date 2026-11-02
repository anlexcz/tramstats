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
const SEARCH_CACHE=new WeakMap();
const RETURN_KEY='tramstats-shifts-return-state';

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

function blockDuration(parts){
  let first=null,last=null;
  for(const p of parts){
    if(!p.start||!p.end)continue;
    const startBase=mins(p.start);
    let endBase=mins(p.end);
    if(startBase==null||endBase==null)continue;
    const offset=(Number(p.startDayOffset)||0)*1440;
    const start=startBase+offset;
    let end=endBase+offset;
    if(end<start)end+=1440;
    if(first==null||start<first)first=start;
    if(last==null||end>last)last=end;
  }
  return first!=null&&last!=null&&last>=first?last-first:null;
}
function durationLabel(s){
  const parts=s.parts||[];
  const split=Number(s.splitSeq);
  const blocks=s.actualShift==='Š'&&Number.isFinite(split)&&split>0
    ?[parts.filter(p=>Number(p.partNo)<=split),parts.filter(p=>Number(p.partNo)>split)].filter(x=>x.length)
    :[parts];
  const durations=blocks.map(blockDuration).filter(v=>v!=null);
  return durations.length?hm(durations.reduce((a,b)=>a+b,0)):'';
}
function performanceRows(s){
  const parts=s.parts||[];
  const split=Number(s.splitSeq);
  const blocks=s.actualShift==='Š'&&Number.isFinite(split)&&split>0
    ?[parts.filter(p=>Number(p.partNo)<=split),parts.filter(p=>Number(p.partNo)>split)].filter(x=>x.length)
    :[parts];
  const hasValue=v=>v!=null&&v!=='';
  const lineTokens=line=>String(line||'').split('+').map(x=>x.trim()).filter(Boolean);
  const isHidden=line=>line==='MJ'||line==='JP';

  return blocks.map((block,index)=>{
    const badges=[];
    const seen=new Set();
    const courseBadges=new Map();
    let start='',end='';

    for(const p of block){
      if(!start&&p.start)start=p.start;
      if(p.end)end=p.end;
      const line=String(p.line||'').trim();
      if(!line||isHidden(line))continue;

      if(line==='Z'){
        if(!seen.has('Z')){badges.push({key:'Z',label:'Záloha'});seen.add('Z');}
        continue;
      }
      if(line==='73'){
        if(!seen.has('73')){badges.push({key:'73',label:'Cvičná jízda'});seen.add('73');}
        continue;
      }

      if(hasValue(p.course)){
        const key=`course|${p.course}`;
        const tokens=lineTokens(line);
        let badge=courseBadges.get(key);
        if(!badge){
          badge={key,lines:[],label:''};
          courseBadges.set(key,badge);
          badges.push(badge);
        }
        for(const token of tokens)if(!badge.lines.includes(token))badge.lines.push(token);
        badge.label=`${badge.lines.join('+')}/${p.course}`;
        continue;
      }

      const ref=p.order??'';
      const key=`order|${line}|${ref}`;
      if(seen.has(key))continue;
      seen.add(key);
      badges.push({key,label:hasValue(ref)?`${line}/${ref}`:line});
    }

    return {
      key:`block-${index+1}`,
      badges,
      start,
      end,
      interval:start&&end?`${start}–${end}`:''
    };
  }).filter(r=>r.badges.length||r.interval);
}
function workMetrics(s){
  const ps=s.parts||[];
  const knownKm=ps.some(p=>p.km!=null);
  return {
    type:typeLabel(s),
    depot:depotLabel(s),
    km:knownKm?`${fmt(sumKm(ps))} km`:'',
    duration:durationLabel(s),
    performances:performanceRows(s)
  };
}
function performancesHTML(rows){
  if(!rows.length)return '<span class="shift-list-empty">Bez výkonu</span>';
  return rows.map(r=>`<span class="shift-list-performance">${(r.badges||[]).map(b=>`<b>${esc(b.label||'—')}</b>`).join('')}${r.interval?`<span class="shift-list-range">${iconInterval}<span>${esc(r.interval)}</span></span>`:''}</span>`).join('');
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
function queryTokens(query){
  return norm(query).split(/\s+/).filter(Boolean);
}
function tokenMatches(index,token){
  if(/^\d+$/.test(token))return index.exact.has(token);
  if(index.exact.has(token))return true;
  return index.blob.includes(token);
}
function matchesSearch(s,query){
  const tokens=queryTokens(query);
  if(!tokens.length)return true;
  const index=searchIndex(s);
  return tokens.every(token=>tokenMatches(index,token));
}
function filterRows(ss){
  return ss.filter(s=>{
    if(state.type&&s.actualShift!==state.type)return false;
    if(state.depot&&s.depot!==state.depot)return false;
    if(state.dateFrom&&s.date<state.dateFrom)return false;
    if(state.dateTo&&s.date>state.dateTo)return false;
    if(state.workOnly&&!hasTimedPart(s))return false;
    if(state.query&&!matchesSearch(s,state.query))return false;
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
      <div class="shift-search"><span>⌕</span><input id="shift-search" type="search" placeholder="KO 15T, 17 9170, 95/64, 25.4.…" value="${esc(state.query)}" aria-label="Hledat ve směnách"><button type="button" id="mobile-filter-open">FILTRY${active?` <b>${active}</b>`:''}</button></div>
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
function saveReturnState(){
  const snapshot={
    query:state.query||'',
    type:state.type||'',
    depot:state.depot||'',
    dateFrom:state.dateFrom||'',
    dateTo:state.dateTo||'',
    workOnly:!!state.workOnly,
    pageSize:state.pageSize||25,
    visibleCount:state.visibleCount||state.pageSize||25,
    scrollY:window.scrollY||0
  };
  sessionStorage.setItem(RETURN_KEY,JSON.stringify(snapshot));
  history.replaceState({...history.state,tramstatsShiftList:true},'');
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
  if(more){state.visibleCount+=state.pageSize;render();return;}
  const card=e.target.closest('.shift-list-card');
  if(card)saveReturnState();
});
window.addEventListener('load',()=>{
  if(Number(restored?.scrollY)>0)requestAnimationFrame(()=>window.scrollTo({top:Number(restored.scrollY),behavior:'instant'}));
});

if(state.shifts?.length)render();
})();
