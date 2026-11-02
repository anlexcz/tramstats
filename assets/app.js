'use strict';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'—').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=(value,digits=1)=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:digits}).format(value);
const mins=value=>value==null?null:Number(value.split(':')[0])*60+Number(value.split(':')[1]);
const hm=minutes=>`${Math.floor(minutes/60)}:${String(Math.round(minutes%60)).padStart(2,'0')}`;
const date=value=>new Date(value+'T12:00:00').toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'});

const state={db:null,shifts:[],breaks:[],year:'all',dataMinDate:null,dataMaxDate:null,view:'overview',query:'',type:'',depot:'',page:0,sort:'count',errors:[]};
const icons={
  overview:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  shifts:'<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
  stats:'<path d="M3 3v18h18M7 16l4-5 4 2 6-8"/>',
  vehicles:'<rect x="6" y="3" width="12" height="16" rx="2"/><path d="M6 11h12M10 3v8M8 19l-2 3M16 19l2 3M9 15h.01M15 15h.01"/>',
  plus:'<path d="M12 5v14M5 12h14"/>'
};
const icon=key=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;
const labels={overview:'Přehled',shifts:'Směny',stats:'Statistiky',vehicles:'Vozy'};
const pageUrls={overview:'./',shifts:'shifts/',stats:'stats/',vehicles:'vehicles/'};

function nav(){
  const links=Object.keys(labels).map(key=>`<a href="${pageUrls[key]}" aria-label="${labels[key]}" title="${labels[key]}" ${state.view===key?'aria-current="page"':''} class="${state.view===key?'active':''}">${icon(key)}<span>${labels[key]}</span></a>`);
  $('#desktop-nav').innerHTML=links.join('');
  $('#mobile-nav').innerHTML=links.map((link,index)=>(index===2?`<button class="quick" aria-label="Rychlé akce" title="Rychlé akce">${icon('plus')}</button>`:'')+link.replace(/<span>.*?<\/span>/,'')).join('');
  const quick=$('.quick');
  if(quick)quick.onclick=()=>modal('<h2>Rychlé akce</h2><p class="hint">Tento sandbox je pouze pro čtení. Přidávání směn a fotografií přijde v další fázi.</p>');
}

const parts=shifts=>shifts.flatMap(shift=>(shift.parts||[]).map(part=>({...part,date:shift.date})));
const sumKm=partRows=>partRows.reduce((sum,part)=>sum+(part.km??0),0);
const worked=shift=>(shift.parts||[]).length>0&&!['V','VVS','KS','D','PN','P16','MD'].includes(shift.actualShift);

function groups(shifts){
  const lines={},types={},codes={},vehicles={},years={};
  let unresolved=0;
  for(const shift of shifts){
    const seenLines=new Set(),seenVehicles=new Set();
    if(worked(shift))codes[shift.actualShift??'Neznámé']=(codes[shift.actualShift??'Neznámé']||0)+1;
    for(const part of shift.parts||[]){
      const km=part.km??0;
      years[shift.date.slice(0,4)]=(years[shift.date.slice(0,4)]||0)+km;
      if(part.vehicleType)types[part.vehicleType]=(types[part.vehicleType]||0)+km;
      const lineParts=Array.isArray(part.lineParts)?part.lineParts:[];
      if(lineParts.length){
        for(const linePart of lineParts){
          if(!linePart.line)continue;
          lines[linePart.line]??={km:0,count:0,unknownKmParts:0};
          seenLines.add(linePart.line);
          if(linePart.km==null)lines[linePart.line].unknownKmParts++;
          else lines[linePart.line].km+=linePart.km;
        }
        if(lineParts.some(linePart=>linePart.km==null))unresolved+=km;
      }
      for(const [position,vehicle] of [['front',part.frontVehicleMeta],['rear',part.rearVehicleMeta]].filter(([,vehicle])=>vehicle?.id)){
        const id=vehicle.id;
        vehicles[id]??={km:0,count:0,time:0,type:new Set(),family:new Set(),front:0,rear:0,solo:0};
        const item=vehicles[id];
        item.km+=km;
        item.time+=part.start&&part.end?(mins(part.end)-mins(part.start)+1440)%1440:0;
        if(vehicle.type)item.type.add(vehicle.type);
        if(vehicle.family)item.family.add(vehicle.family);
        item[part.rearVehicle?(position==='front'?'front':'rear'):'solo']+=km;
        seenVehicles.add(id);
      }
    }
    for(const line of seenLines)lines[line].count++;
    for(const vehicle of seenVehicles)vehicles[vehicle].count++;
  }
  return {lines,types,codes,vehicles,years,unresolved};
}

function selected(){return state.shifts.filter(shift=>state.year==='all'||shift.date.startsWith(state.year));}
function bars(object,unit='km',limit=10){
  const entries=Object.entries(object).sort((a,b)=>b[1]-a[1]).slice(0,limit),max=Math.max(1,...entries.map(x=>x[1]));
  return entries.length?`<div class="bars">${entries.map(([key,value])=>`<div class="bar-row"><span>${esc(key)}</span><div class="track"><div class="fill" style="width:${value/max*100}%"></div></div><b>${fmt(value)} ${unit}</b></div>`).join('')}</div>`:'<p class="hint">Pro tento výběr nejsou data.</p>';
}
function panel(title,body,cls=''){return `<section class="panel ${cls}"><h2>${title}</h2>${body}</section>`;}

function tagHTML(tags){return tags?.length?`<div class="part-meta">${tags.map(tag=>`#${esc(tag.name||tag.code)}`).join(' · ')}</div>`:'';}
function lineBreakdownHTML(part){
  if(!part.lineParts?.length)return'';
  if(part.lineParts.length===1)return part.lineParts[0].km==null?'<div class="part-meta">Km linky nejsou známé.</div>':'';
  return `<div class="part-meta">Linkové km: ${part.lineParts.map(linePart=>`${esc(linePart.line)} ${linePart.km==null?'—':fmt(linePart.km,3)+' km'}`).join(' · ')}</div>`;
}
function partHTML(part){
  const vehicleIds=[part.frontVehicle,part.rearVehicle].filter(Boolean).join(' + ')||null;
  const vehicleMeta=[part.frontVehicleMeta,part.rearVehicleMeta].filter(Boolean).map(vehicle=>vehicle.type&&vehicle.family&&vehicle.type!==vehicle.family?`${vehicle.type} (${vehicle.family})`:vehicle.type||vehicle.family).filter(Boolean);
  return `<div class="part"><span class="muted">${esc(part.partNo)}</span><div><span class="line">${esc(part.line)}</span><div class="part-meta">P ${esc(part.order)}</div>${lineBreakdownHTML(part)}</div><div>${esc(part.start)}–${esc(part.end)}<div class="part-meta">Délka ${esc(part.duration)}</div></div><div>${esc(vehicleIds)}<div class="part-meta">${esc(vehicleMeta.join(' + ')||part.vehicleType)} · ${esc(part.depot||'')} ${part.course?`· K ${esc(part.course)}${part.isSnack?' · Svačinář':''}`:''}</div>${tagHTML(part.tags)}</div><div>${part.km==null?'—':fmt(part.km,3)+' km'}</div>${part.note?`<div class="note">${esc(part.note)}</div>`:''}</div>`;
}
function detailHTML(shift){
  const bp=state.breaks.filter(item=>item.date===shift.date);
  return `<p class="hint">Směna ${esc(shift.actualShift)} · ${esc(shift.depot)}</p>${shift.note?'<p class="hint">'+esc(shift.note)+'</p>':''}${shift.parts.length?shift.parts.map(partHTML).join(''):'<p class="hint">Den bez evidované pracovní části.</p>'}${bp.length?'<h3>Bezpečnostní přestávky</h3>'+bp.map(item=>`<div class="bp"><b>${esc(item.start)}–${esc(item.end)}</b> · ${esc(item.duration)}${item.startDayOffset?` · +${item.startDayOffset} den`:''}<br>${esc(item.fromPlace)} → ${esc(item.toPlace)}${item.note?'<br>'+esc(item.note):''}</div>`).join(''):''}`;
}

function options(values,selectedValue){return values.map(value=>`<option value="${esc(value)}" ${selectedValue===value?'selected':''}>${esc(value)}</option>`).join('');}
function stats(shifts){
  const grouped=groups(shifts),all=groups(state.shifts),max=Math.max(1,...Object.values(all.years));
  return `<div class="grid">${panel('Osobní kilometry podle roku · všechna data',`<div class="chart-columns">${Object.entries(all.years).sort().map(([year,km])=>`<div class="column" style="height:${km/max*100}%"><b>${fmt(km,0)}</b><span>${year}</span></div>`).join('')}</div><p class="hint">Rozsah každého roku vychází ze skutečně dostupných záznamů v databázi.</p>`,'full')}${panel('Kilometry podle linek',bars(Object.fromEntries(Object.entries(grouped.lines).map(([key,value])=>[key,value.km])),'km',30)+`<p class="hint">Části s neznámými linkovými km se do konkrétní linky nedopočítávají.</p>`)}${panel('Kolikrát jsem jel linku',bars(Object.fromEntries(Object.entries(grouped.lines).map(([key,value])=>[key,value.count])),'směn',30))}${panel('Kilometry podle typu vozu',bars(grouped.types))}${panel('Pracovní směny podle typu',bars(grouped.codes,'směn'))}</div>`;
}
function vehicleList(shifts){
  const grouped=groups(shifts),query=state.query.toLowerCase();
  const vehicles=Object.entries(grouped.vehicles).filter(([id,item])=>(id+' '+[...item.type,...item.family].join(' ')).toLowerCase().includes(query)).sort((a,b)=>b[1][state.sort]-a[1][state.sort]||a[0].localeCompare(b[0]));
  return `<div class="filters"><input id="vehicle-search" type="search" aria-label="Hledat vůz" placeholder="Evidenční číslo nebo typ…" value="${esc(state.query)}"><select id="vehicle-sort" aria-label="Řazení vozů">${options(['count','km','time'],state.sort).replace('>count<','>Počet směn<').replace('>km<','>Kilometry<').replace('>time<','>Čas částí<')}</select></div><p class="hint">${vehicles.length} vozů. Typ a family jsou převzaté z master tabulky vehicles. Každý fyzický vůz dostává km své části; osobní km se tím nenásobí.</p><div class="vehicle-grid">${vehicles.map(([id,item])=>`<button class="vehicle" data-vehicle="${esc(id)}"><span class="type">${esc([...item.type].join(' / ')||[...item.family].join(' / '))}</span><strong>${esc(id)}</strong><span class="metrics"><span>${item.count} směn</span><span>${fmt(item.km)} km</span></span></button>`).join('')}</div>`;
}

let filtered=shifts=>shifts;
let shiftHTML=()=>'';
let shiftList=()=>'<div class="empty">Načítám seznam směn…</div>';
function dashboardFallback(){return '<div class="empty">Načítám přehled…</div>';}
function modal(html){$('#detail-content').innerHTML=html;$('#detail').showModal();}

function render(){
  const shifts=selected();
  nav();
  $('#title').textContent=labels[state.view].toLocaleUpperCase('cs');
  if(state.view==='overview')$('#app').innerHTML=typeof window.dashboard==='function'?window.dashboard(shifts):dashboardFallback();
  else if(state.view==='shifts')$('#app').innerHTML=shiftList(shifts);
  else if(state.view==='stats')$('#app').innerHTML=stats(shifts);
  else $('#app').innerHTML=vehicleList(shifts);

  for(const [id,key] of [['vehicle-search','query'],['vehicle-sort','sort']]){
    const element=$('#'+id);
    if(!element)continue;
    element.addEventListener(element.tagName==='INPUT'?'input':'change',()=>{
      const position=element.selectionStart;
      state[key]=element.value;
      render();
      const next=$('#'+id);
      next?.focus();
      if(position!=null)next?.setSelectionRange(position,position);
    });
  }
  document.querySelectorAll('[data-vehicle]').forEach(element=>element.onclick=()=>{
    const id=element.dataset.vehicle,item=groups(shifts).vehicles[id];
    if(!item)return;
    modal(`<h2>Vůz ${esc(id)}</h2><p>${item.count} směn · ${fmt(item.km,3)} km · ${hm(item.time)} h v částech</p>${[...item.type].some(type=>type.startsWith('T3'))?`<p class="hint">Přední: ${fmt(item.front,3)} km · zadní: ${fmt(item.rear,3)} km · sólo: ${fmt(item.solo,3)} km</p>`:''}${shifts.filter(shift=>shift.parts.some(part=>part.frontVehicle===id||part.rearVehicle===id)).sort((a,b)=>b.date.localeCompare(a.date)).map(shift=>`<details class="shift"><summary><strong>${date(shift.date)}</strong><span class="badge">${esc(shift.actualShift)}</span></summary><div class="parts">${detailHTML(shift)}</div></details>`).join('')}`);
  });
}

function currentView(){
  const path=location.pathname.replace(/\/+$/,'').split('/').filter(Boolean).at(-1)||'';
  return {shifts:'shifts',stats:'stats',vehicles:'vehicles'}[path]||'overview';
}
function route(){
  state.view=currentView();
  if(state.view==='shifts')state.year='all';
  if(state.shifts.length)render();
  window.scrollTo(0,0);
}
async function boot(){
  if(!window.TramStatsData?.load)throw new Error('Datová vrstva TramStats není dostupná.');
  try{
    const db=await window.TramStatsData.load();
    state.db=db;state.shifts=db.shifts;state.breaks=db.breaks;state.dataMinDate=db.minDate;state.dataMaxDate=db.maxDate;
    state.view=currentView();
    const yearSelect=$('#year'),years=db.years.slice().reverse();
    if(yearSelect){
      yearSelect.innerHTML=`<option value="all">${db.years.length?db.years[0]+'–'+db.years.at(-1):'Všechna data'}</option>`+years.map(year=>`<option value="${year}">${year}</option>`).join('');
      if(state.view!=='shifts'&&state.year==='all'&&years.length)state.year=years[0];
      if(state.view==='shifts')state.year='all';
      yearSelect.value=state.year;
      yearSelect.onchange=()=>{state.year=yearSelect.value;render();};
    }
    $('#status').textContent='';
    render();
  }catch(error){
    state.errors=[String(error?.message||error)];
    $('#status').textContent='Databáze TramStats není dostupná. Zobrazení zastaralých snapshotů je vypnuté. '+state.errors[0];
    $('#app').innerHTML='<div class="empty">Data se nepodařilo načíst z read-only API.</div>';
    nav();
  }
}

window.addEventListener('hashchange',route);
$('.close')?.addEventListener('click',()=>$('#detail').close());
$('#detail')?.addEventListener('click',event=>{
  if(event.target!==$('#detail'))return;
  const rect=event.target.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();
});
if($('#app'))boot();
