(()=>{
'use strict';

const Domain=window.TramStatsShiftDomain;
const root=document.querySelector('#shift-detail');
const status=document.querySelector('#status');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=(value,digits=1)=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:digits}).format(value);
const hm=minutes=>`${Math.floor(minutes/60)}:${String(Math.round(minutes%60)).padStart(2,'0')}`;
const dayNames=['neděle','pondělí','úterý','středa','čtvrtek','pátek','sobota'];

function routeDate(){
  const match=location.pathname.match(/\/smeny\/(\d{8})(?:\/|$)/);
  if(!match)return null;
  const raw=match[1];
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
}
function dateLong(iso){
  const d=new Date(`${iso}T12:00:00`);
  return `${dayNames[d.getDay()]} ${d.toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'})}`;
}
function minutes(value){
  if(!value)return null;
  const [h,m]=String(value).split(':').map(Number);
  return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;
}
function partDuration(part){
  let start=minutes(part.start),end=minutes(part.end);
  if(start==null||end==null)return null;
  start+=(Number(part.startDayOffset)||0)*1440;
  end+=(Number(part.startDayOffset)||0)*1440;
  if(end<start)end+=1440;
  return end-start;
}
function sumKm(parts){
  const known=(parts||[]).filter(part=>part.km!=null);
  return known.length?known.reduce((sum,part)=>sum+part.km,0):null;
}
function range(parts){
  const r=Domain.blockRange(parts||[]);
  if(!r)return'';
  const source=(parts||[]).filter(part=>part.start&&part.end);
  if(!source.length)return'';
  return `${source[0].start}–${source[source.length-1].end}`;
}
function performanceLabel(part){
  const line=part.line||'';
  if(line==='Z')return 'Záloha';
  if(line==='MJ')return 'Manipulační jízda';
  if(line==='JP')return 'Jiné práce';
  if(line==='73')return 'Cvičná jízda';
  if(part.course)return `${line||'—'}/${part.course}`;
  if(part.order)return `${line||'—'}/${part.order}`;
  return line||'—';
}
function vehicleLabel(part){
  const pair=[part.frontVehicle,part.rearVehicle].filter(Boolean).join(' + ');
  if(!pair&&!part.vehicleType)return'';
  return `${part.vehicleType?`<span class="detail-vehicle-type">${esc(part.vehicleType)}</span>`:''}${pair?`<span class="detail-vehicle-ids">${esc(pair)}</span>`:''}`;
}
function photoButton(){return '';} // připraveno pro skutečný photo source; bez demo dat nic nevykreslujeme
function partRow(part){
  const duration=partDuration(part);
  return `<article class="detail-part">
    <div class="detail-part-main">
      <div class="detail-part-time"><strong>${esc(part.start||'—')}</strong><span>–</span><strong>${esc(part.end||'—')}</strong>${duration!=null?`<small>${hm(duration)}</small>`:''}</div>
      <div class="detail-part-performance"><span class="detail-performance-badge">${esc(performanceLabel(part))}</span></div>
      <div class="detail-part-km">${part.km!=null?`${fmt(part.km)} km`:'—'}</div>
    </div>
    <div class="detail-part-meta">${vehicleLabel(part)}${photoButton(part)}</div>
    ${part.note?`<div class="detail-part-note">${esc(part.note)}</div>`:''}
  </article>`;
}
function blockSummary(block,label){
  const km=sumKm(block.parts),duration=Domain.blockRange(block.parts)?.duration??null;
  return `<div class="detail-block-summary"><span>${label}</span><strong>${range(block.parts)||'—'}</strong><small>${duration!=null?hm(duration):'—'}${km!=null?` · ${fmt(km)} km`:''}</small></div>`;
}
function blockSection(block,label){
  return `<section class="detail-flow-block"><div class="detail-section-head"><h2>${label}</h2></div><div class="detail-parts">${block.parts.map(partRow).join('')}</div></section>`;
}
function overallRange(shift){
  const blocks=Domain.blocks(shift);
  const first=blocks[0]?.parts?.find(part=>part.start)?.start;
  const lastParts=blocks.at(-1)?.parts||[];
  const last=lastParts.slice().reverse().find(part=>part.end)?.end;
  return first&&last?`${first}–${last}`:'';
}
function renderShift(shift){
  const blocks=Domain.blocks(shift),split=blocks.length>1;
  const totalKm=sumKm(shift.parts),totalDuration=Domain.durationMinutes(shift);
  const typeName=shift.shiftType?.name||shift.actualShift||'Směna';
  const depotName=shift.depotMeta?.name||shift.depot||'—';
  const blockSummaries=split?`<div class="detail-block-summaries">${blocks.map((block,index)=>blockSummary(block,index===0?'Ranní část':'Odpolední část')).join('')}</div>`:'';
  const flow=blocks.map((block,index)=>blockSection(block,split?(index===0?'Ranní část':'Odpolední část'):'Průběh směny')).join('');
  root.innerHTML=`
    <a class="detail-back" href="../../shifts/">← Směny</a>
    <header class="detail-hero">
      <div class="detail-date">${esc(dateLong(shift.date))}</div>
      <div class="detail-hero-row"><span class="detail-shift-type">${esc(typeName)}</span><span class="detail-depot">${esc(depotName)}</span></div>
      <div class="detail-totals">
        <div><span>Kilometry</span><strong>${totalKm!=null?`${fmt(totalKm)} km`:'—'}</strong></div>
        <div><span>Délka směny</span><strong>${totalDuration!=null?hm(totalDuration):'—'}</strong></div>
        <div><span>Rozsah</span><strong>${esc(overallRange(shift)||'—')}</strong></div>
      </div>
      ${blockSummaries}
    </header>
    <div id="detail-gallery"></div>
    ${flow}
    ${shift.note?`<section class="detail-note"><div class="detail-section-head"><h2>Poznámka</h2></div><p>${esc(shift.note)}</p></section>`:''}
    <section class="detail-breaks detail-placeholder" hidden><div class="detail-section-head"><h2>Bezpečnostní přestávky</h2></div></section>`;
}
async function boot(){
  const wanted=routeDate();
  if(!wanted){
    status.textContent='Neplatná adresa směny.';
    return;
  }
  try{
    const db=await window.TramStatsData.load();
    const shift=db.shifts.find(item=>item.date===wanted);
    if(!shift){
      status.textContent='Směna pro toto datum nebyla v databázi nalezena.';
      return;
    }
    status.textContent='';
    document.title=`${dateLong(shift.date)} — TramStats`;
    renderShift(shift);
  }catch(error){
    status.textContent='Data směny se nepodařilo načíst. '+String(error?.message||error);
  }
}

boot();
})();
