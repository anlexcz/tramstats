'use strict';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'—').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=(value,digits=1)=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:digits}).format(value);
const hm=minutes=>`${Math.floor(minutes/60)}:${String(Math.round(minutes%60)).padStart(2,'0')}`;
const date=value=>new Date(value+'T12:00:00').toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'});

const state={
  db:null,
  shifts:[],
  view:'overview',
  query:'',
  type:'',
  depot:'',
  dateFrom:'',
  dateTo:'',
  workOnly:false,
  pageSize:25,
  visibleCount:25
};

const icons={
  overview:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  shifts:'<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>'
};
const labels={overview:'Přehled',shifts:'Směny'};
const pageUrls={overview:'./',shifts:'shifts/'};
const icon=key=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>`;

function nav(){
  const links=Object.keys(labels).map(key=>`<a href="${pageUrls[key]}" aria-label="${labels[key]}" title="${labels[key]}" ${state.view===key?'aria-current="page"':''} class="${state.view===key?'active':''}">${icon(key)}<span>${labels[key]}</span></a>`);
  const desktop=$('#desktop-nav'),mobile=$('#mobile-nav');
  if(desktop)desktop.innerHTML=links.join('');
  if(mobile)mobile.innerHTML=links.map(link=>link.replace(/<span>.*?<\/span>/,'')).join('');
}

const parts=shifts=>shifts.flatMap(shift=>(shift.parts||[]).map(part=>({...part,date:shift.date})));
const sumKm=partRows=>partRows.reduce((sum,part)=>sum+(part.km??0),0);
const worked=shift=>(shift.parts||[]).length>0&&!['V','VVS','KS','D','PN','P16','MD'].includes(shift.actualShift);

function groups(shifts){
  const lines={},types={},vehicles={};
  for(const shift of shifts){
    const seenVehicles=new Set();
    for(const part of shift.parts||[]){
      const km=part.km??0;
      if(part.vehicleType)types[part.vehicleType]=(types[part.vehicleType]||0)+km;
      for(const linePart of Array.isArray(part.lineParts)?part.lineParts:[]){
        if(!linePart.line)continue;
        lines[linePart.line]??={km:0,count:0};
        if(linePart.km!=null)lines[linePart.line].km+=linePart.km;
      }
      for(const vehicle of [part.frontVehicleMeta,part.rearVehicleMeta].filter(vehicle=>vehicle?.id)){
        vehicles[vehicle.id]??={count:0};
        seenVehicles.add(vehicle.id);
      }
    }
    for(const vehicleId of seenVehicles)vehicles[vehicleId].count++;
  }
  return {lines,types,vehicles};
}

let shiftList=()=>'<div class="empty">Načítám seznam směn…</div>';
const dashboardFallback=()=>'<div class="empty">Načítám přehled…</div>';

function currentView(){
  const path=location.pathname.replace(/\/+$/,'').split('/').filter(Boolean).at(-1)||'';
  return path==='shifts'?'shifts':'overview';
}

function render(){
  state.view=currentView();
  nav();
  const title=$('#title'),app=$('#app');
  if(title)title.textContent=labels[state.view].toLocaleUpperCase('cs');
  if(!app)return;
  app.innerHTML=state.view==='overview'
    ?(typeof window.dashboard==='function'?window.dashboard(state.shifts):dashboardFallback())
    :shiftList(state.shifts);
}

async function boot(){
  if(!window.TramStatsData?.load)throw new Error('Datová vrstva TramStats není dostupná.');
  try{
    const db=await window.TramStatsData.load();
    state.db=db;
    state.shifts=db.shifts;
    const status=$('#status');
    if(status)status.textContent='';
    render();
  }catch(error){
    const message=String(error?.message||error);
    const status=$('#status'),app=$('#app');
    if(status)status.textContent='Databáze TramStats není dostupná. '+message;
    if(app)app.innerHTML='<div class="empty">Data se nepodařilo načíst z read-only API.</div>';
    nav();
  }
}

if($('#app'))boot();
