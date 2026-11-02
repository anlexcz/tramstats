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
  const label=`${dayNames[d.getDay()]} ${d.toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'})}`;
  return label.charAt(0).toUpperCase()+label.slice(1);
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
  const complete=(parts||[]).filter(part=>part.start&&part.end);
  if(!complete.length)return'';
  return `${complete[0].start}–${complete.at(-1).end}`;
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
function vehicleText(part){
  const pair=[part.frontVehicle,part.rearVehicle].filter(Boolean).join(' + ');
  if(!pair&&!part.vehicleType)return'';
  return `${part.vehicleType?`<span class="detail-vehicle-type">${esc(part.vehicleType)}</span>`:''}${pair?`<span class="detail-vehicle-ids">${esc(pair)}</span>`:''}`;
}
function cameraIcon(){
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
}
function galleryPlaceholder(){
  return `<section class="detail-gallery" aria-label="Fotografie směny">
    <div class="detail-gallery-stage">
      <div class="detail-gallery-empty">${cameraIcon()}<strong>Fotografie směny</strong><span>Galerie je připravená pro fotografie navázané na jednotlivé části směny.</span></div>
      <button class="detail-gallery-arrow prev" type="button" aria-label="Předchozí fotografie" disabled>‹</button>
      <button class="detail-gallery-arrow next" type="button" aria-label="Další fotografie" disabled>›</button>
      <div class="detail-gallery-counter">0 / 0</div>
    </div>
  </section>`;
}
function partRow(part){
  const duration=partDuration(part);
  return `<article class="detail-part">
    <div class="detail-part-top">
      <span class="detail-performance-badge">${esc(performanceLabel(part))}</span>
      <span class="detail-part-time">${esc(part.start||'—')}–${esc(part.end||'—')}</span>
      <strong class="detail-part-km">${part.km!=null?`${fmt(part.km)} km`:'—'}</strong>
    </div>
    <div class="detail-part-bottom">
      <div class="detail-part-vehicle">${vehicleText(part)||'<span class="detail-muted">Bez vozu</span>'}</div>
      ${duration!=null?`<span class="detail-part-duration">${hm(duration)}</span>`:''}
    </div>
    ${part.note?`<div class="detail-part-note">${esc(part.note)}</div>`:''}
  </article>`;
}
function summaryRow(label,value){
  return `<div class="detail-summary-row"><span>${label}</span><strong>${value}</strong></div>`;
}
function blockSummary(block,label){
  const km=sumKm(block.parts),duration=Domain.blockRange(block.parts)?.duration??null;
  return `<div class="detail-split-card"><span>${label}</span><strong>${esc(range(block.parts)||'—')}</strong><small>${duration!=null?hm(duration):'—'}${km!=null?` · ${fmt(km)} km`:''}</small></div>`;
}
function blockSection(block,label){
  return `<section class="detail-flow-block">
    <div class="detail-section-head"><h2>${label}</h2></div>
    <div class="detail-parts-card">${block.parts.map(partRow).join('')}</div>
  </section>`;
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
  const totalKm=sumKm(shift.parts),totalDuration=Domain.durationMinutes(shift),fullRange=overallRange(shift);
  const [start='—',end='—']=fullRange?fullRange.split('–'):[];
  const typeName=shift.shiftType?.name||shift.actualShift||'Směna';
  const depotName=shift.depotMeta?.name||shift.depot||'—';
  const splitCards=split?`<div class="detail-split-grid">${blocks.map((block,index)=>blockSummary(block,index===0?'Ranní část':'Odpolední část')).join('')}</div>`:'';
  const flow=blocks.map((block,index)=>blockSection(block,split?(index===0?'Ranní část':'Odpolední část'):'Průběh směny')).join('');
  root.innerHTML=`
    <a class="detail-back" href="shifts/">← Směny</a>
    <div class="detail-date">${esc(dateLong(shift.date))}</div>
    <section class="detail-summary-card">
      <div class="detail-summary-head">
        <div><span class="detail-shift-type">${esc(typeName)}</span><span class="detail-depot">${esc(depotName)}</span></div>
        <span class="detail-summary-range">${esc(fullRange||'')}</span>
      </div>
      <div class="detail-summary-grid">
        ${summaryRow('Začátek',esc(start))}
        ${summaryRow('Konec',esc(end))}
        ${summaryRow('Délka',totalDuration!=null?hm(totalDuration):'—')}
        ${summaryRow('Kilometry',totalKm!=null?`${fmt(totalKm)} km`:'—')}
      </div>
      ${splitCards}
    </section>
    ${galleryPlaceholder()}
    ${flow}
    ${shift.note?`<section class="detail-note"><div class="detail-section-head"><h2>Poznámka</h2></div><div class="detail-note-card">${esc(shift.note)}</div></section>`:''}
    <section class="detail-breaks" hidden><div class="detail-section-head"><h2>Bezpečnostní přestávky</h2></div></section>`;
}
async function boot(){
  const wanted=routeDate();
  if(!wanted){status.textContent='Neplatná adresa směny.';return;}
  try{
    const db=await window.TramStatsData.load();
    const shift=db.shifts.find(item=>item.date===wanted);
    if(!shift){status.textContent='Směna pro toto datum nebyla v databázi nalezena.';return;}
    status.textContent='';
    document.title=`${dateLong(shift.date)} — TramStats`;
    renderShift(shift);
  }catch(error){
    status.textContent='Data směny se nepodařilo načíst. '+String(error?.message||error);
  }
}

boot();
})();
