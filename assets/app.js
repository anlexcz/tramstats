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

const labels={overview:'Přehled',shifts:'Směny',vehicles:'Vozy'};

const parts=shifts=>shifts.flatMap(shift=>(shift.parts||[]).map(part=>({...part,date:shift.date})));
const sumKm=partRows=>window.TramStatsShared.measure(partRows.map(part=>part.km)).value;
const worked=shift=>(shift.parts||[]).length>0&&!['V','VVS','KS','D','PN','SD','P16','MD'].includes(shift.actualShift);

function groups(shifts){
  const lines={},types={},vehicles={};
  for(const shift of shifts){
    const seenVehicles=new Set();
    for(const part of shift.parts||[]){
      if(part.vehicleType){
        types[part.vehicleType]??={values:[]};
        types[part.vehicleType].values.push(part.km);
      }
      for(const linePart of Array.isArray(part.lineParts)?part.lineParts:[]){
        if(!linePart.line)continue;
        lines[linePart.line]??={values:[]};
        lines[linePart.line].values.push(linePart.km);
      }
      for(const vehicle of [part.frontVehicleMeta,part.rearVehicleMeta].filter(vehicle=>vehicle?.id)){
        vehicles[vehicle.id]??={count:0};
        seenVehicles.add(vehicle.id);
      }
    }
    for(const vehicleId of seenVehicles)vehicles[vehicleId].count++;
  }
  for(const group of [lines,types])for(const item of Object.values(group)){
    const metric=window.TramStatsShared.measure(item.values);
    item.km=metric.value;item.complete=metric.complete;delete item.values;
  }
  return {lines,types,vehicles};
}

let shiftList=()=>'<div class="empty">Načítám seznam směn…</div>';
let vehicleList=()=>'<div class="empty">Načítám seznam vozů…</div>';
const loadingShiftList=shiftList,loadingVehicleList=vehicleList;
let listPositionRestored=false;
const dashboardFallback=()=>'<div class="empty">Načítám přehled…</div>';

function currentView(){
  const path=location.pathname.replace(/\/+$/,'').split('/').filter(Boolean).at(-1)||'';
  if(path==='shifts')return'shifts';
  if(path==='vozy')return'vehicles';
  return'overview';
}

function render(){
  state.view=currentView();
  const title=$('#title'),app=$('#app');
  if(title)title.textContent=labels[state.view].toLocaleUpperCase('cs');
  if(!app)return;
  app.innerHTML=state.view==='overview'
    ?(typeof window.dashboard==='function'?window.dashboard(state.shifts):dashboardFallback())
    :state.view==='shifts'?shiftList(state.shifts):vehicleList(state.db);
  if(state.view==='overview'&&typeof window.dashboardMounted==='function')window.dashboardMounted();
  if(state.view==='vehicles'&&typeof window.vehiclesMounted==='function')window.vehiclesMounted();
  if(!listPositionRestored&&state.db&&((state.view==='shifts'&&shiftList!==loadingShiftList)||(state.view==='vehicles'&&vehicleList!==loadingVehicleList))){
    listPositionRestored=true;
    requestAnimationFrame(()=>window.scrollTo(0,returnScroll));
  }
}

const LIST_FIELDS={shifts:['query','type','depot','dateFrom','dateTo','workOnly','pageSize','visibleCount'],vehicles:['vehicleQuery','vehicleFamily','vehiclePeriod']};
const listKey=()=>`tramstats-list-v1:${currentView()}`;
let returnScroll=0;
function restoreList(){
  try{
    const saved=JSON.parse(sessionStorage.getItem(listKey())||'null');
    if(!saved)return;
    for(const key of LIST_FIELDS[currentView()]||[]){
      const value=saved.values?.[key];
      if(['pageSize','visibleCount'].includes(key)){
        if(Number.isInteger(value)&&value>0&&value<=100000&&(key!=='pageSize'||[25,50,100,200].includes(value)))state[key]=value;
      }else if(key==='workOnly'){if(typeof value==='boolean')state[key]=value;}
      else if(typeof value==='string')state[key]=value;
    }
    returnScroll=Number.isFinite(saved.scroll)&&saved.scroll>=0?saved.scroll:0;
  }catch{}
}
function saveList(){
  const fields=LIST_FIELDS[currentView()];if(!fields)return;
  try{sessionStorage.setItem(listKey(),JSON.stringify({values:Object.fromEntries(fields.map(key=>[key,state[key]])),scroll:window.scrollY}));}catch{}
}
restoreList();
window.addEventListener('pagehide',saveList);
document.addEventListener('click',event=>{if(event.target.closest('a,[data-detail-href]'))saveList();},true);

async function boot(){
  if(!window.TramStatsData?.load)throw new Error('Datová vrstva TramStats není dostupná.');
  try{
    const db=await window.TramStatsData.load();
    state.db=db;
    state.shifts=db.shifts;
    state.dataMinDate=db.minDate;state.dataMaxDate=db.maxDate;
    const status=$('#status');
    if(status){
      status.textContent='';
      status.classList.remove('status-error');
    }
    render();
  }catch(error){
    const message=String(error?.message||error);
    const status=$('#status'),app=$('#app');
    if(status){
      status.textContent='Databáze TramStats není dostupná. '+message;
      status.classList.add('status-error');
    }
    if(app)app.innerHTML='<div class="empty error">Data se nepodařilo načíst z read-only API.</div>';
  }
}

if($('#app'))boot();
