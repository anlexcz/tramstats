(()=>{
'use strict';

const Domain=window.TramStatsShiftDomain;
const root=document.querySelector('#shift-detail');
const status=document.querySelector('#status');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=(value,digits=1)=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:digits}).format(value);
const hm=minutes=>`${Math.floor(minutes/60)}:${String(Math.round(minutes%60)).padStart(2,'0')}`;
const dayNames=['Neděle','Pondělí','Úterý','Středa','Čtvrtek','Pátek','Sobota'];
const detailIcon=kind=>({
  km:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c4-8 8-8 16-10M16 5l4 2-2 4"/></svg>',
  time:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  vehicle:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="16" rx="2"/><path d="M6 11h12M9 19l-2 3M15 19l2 3M9 15h.01M15 15h.01"/></svg>',
  camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
}[kind]||'');

function routeDate(){
  const match=location.pathname.match(/\/smeny\/(\d{8})(?:\/|$)/);
  if(!match)return null;
  const raw=match[1];
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
}
function dateParts(iso){
  const d=new Date(`${iso}T12:00:00`);
  return {day:dayNames[d.getDay()],date:d.toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'})};
}
function dateLong(iso){const parts=dateParts(iso);return `${parts.day} ${parts.date}`;}
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
function blockRange(block){
  const complete=(block?.parts||[]).filter(part=>part.start&&part.end);
  if(!complete.length)return {start:'—',end:'—',duration:null};
  const range=Domain.blockRange(block.parts);
  return {start:complete[0].start,end:complete.at(-1).end,duration:range?.duration??null};
}
function performanceLabel(part){
  const line=part.line||'';
  if(line==='Z')return 'Záloha';
  if(line==='MJ')return 'Manipulační jízda';
  if(line==='JP')return 'Jiné práce';
  if(line==='73')return 'Cvičná jízda';
  if(part.order)return `${line||'—'}/${part.order}`;
  return line||'—';
}
function courseLabel(part){return part.course?`K ${part.course}`:'';}
function blockPerformance(block){
  const fakeShift={actualShift:'',splitSeq:null,parts:block?.parts||[]};
  const badges=Domain.performanceRows(fakeShift).flatMap(row=>row.badges||[]);
  return badges.map(badge=>badge.label).filter(Boolean).join(' · ')||'—';
}
function vehicleText(part){
  const ids=[part.frontVehicle,part.rearVehicle].filter(Boolean);
  const family=part.frontVehicleMeta?.family||part.rearVehicleMeta?.family||part.vehicleType||'';
  if(!ids.length&&!family)return'';
  const linked=ids.map(id=>`<a class="detail-future-link" href="vozy/${encodeURIComponent(id)}/">${esc(id)}</a>`).join(' + ');
  return `${family?`<span class="detail-vehicle-type">${esc(family)}</span>`:''}${ids.length?`<span class="detail-vehicle-ids">${linked}</span>`:''}`;
}
function galleryHTML(shift){
  const photos=shift.photos||[];
  if(!photos.length)return'';
  return `<section class="detail-gallery" aria-label="Fotografie směny"></section>`;
}
function partRow(part,{splitStart=false}={}){
  const duration=partDuration(part);
  const hasPhoto=Array.isArray(part.photos)&&part.photos.length>0;
  return `<article class="detail-part${splitStart?' detail-part-split-start':''}">
    ${splitStart?'<span class="detail-split-label">Šejdrpauza</span>':''}
    <div class="detail-part-top">
      <span><strong class="detail-part-performance">${esc(performanceLabel(part))}</strong>${courseLabel(part)?` <small class="detail-muted">${esc(courseLabel(part))}</small>`:''}</span>
      <span class="detail-part-right">
        <strong class="detail-part-time">${detailIcon('time')}${esc(part.start||'—')}–${esc(part.end||'—')}</strong>
        <strong class="detail-part-km">${detailIcon('km')}${part.km!=null?`${fmt(part.km)} km`:'—'}</strong>
      </span>
    </div>
    <div class="detail-part-bottom">
      <div class="detail-part-vehicle">${detailIcon('vehicle')}${vehicleText(part)||'<span class="detail-muted">—</span>'}</div>
      <div class="detail-part-bottom-right">
        ${duration!=null?`<span class="detail-part-duration">${detailIcon('time')}${hm(duration)}</span>`:''}
        ${hasPhoto?`<button class="detail-photo-mark" type="button" aria-label="Fotografie této části směny">${detailIcon('camera')}</button>`:''}
      </div>
    </div>
    ${part.note?`<div class="detail-part-note">${esc(part.note)}</div>`:''}
  </article>`;
}
function summaryRow(label,values){
  return `<div class="detail-summary-row"><strong class="detail-summary-label">${label}</strong>${values.map(value=>`<span>${value}</span>`).join('')}</div>`;
}
function summaryWideRow(label,value){
  return `<div class="detail-summary-row detail-summary-wide"><strong class="detail-summary-label">${label}</strong><span>${value}</span></div>`;
}
function summaryTable(shift,blocks){
  const split=blocks.length>1;
  const all={parts:shift.parts};
  const allRange=blockRange(all),allKm=sumKm(shift.parts),allDuration=Domain.durationMinutes(shift);
  const typeName=shift.shiftType?.name||shift.actualShift||'Směna';
  const depotName=shift.depotMeta?.name||shift.depot||'—';
  if(!split){
    const block=blocks[0]||{parts:shift.parts};
    const r=blockRange(block),km=sumKm(block.parts);
    return `<section class="detail-summary-card detail-summary-normal">
      ${summaryRow('Vozovna',[`<a href="#" class="detail-future-link">${esc(depotName)}</a>`])}
      ${summaryRow('Typ',[esc(typeName)])}
      ${summaryRow('Výkon',[esc(blockPerformance(block))])}
      ${summaryRow('Začátek',[esc(r.start)])}
      ${summaryRow('Konec',[esc(r.end)])}
      ${summaryRow('Délka',[r.duration!=null?hm(r.duration):'—'])}
      ${summaryRow('Kilometry',[km!=null?`${fmt(km)} km`:'—'])}
    </section>`;
  }
  const morning=blocks[0],afternoon=blocks[1];
  const mr=blockRange(morning),ar=blockRange(afternoon),mKm=sumKm(morning.parts),aKm=sumKm(afternoon.parts);
  return `<section class="detail-summary-card detail-summary-split">
    ${summaryWideRow('Vozovna',`<a href="#" class="detail-future-link">${esc(depotName)}</a>`)}
    ${summaryWideRow('Typ',esc(typeName))}
    ${summaryRow('Výkon',['',esc(blockPerformance(morning)),esc(blockPerformance(afternoon))])}
    ${summaryRow('Začátek',[esc(allRange.start),esc(mr.start),esc(ar.start)])}
    ${summaryRow('Konec',[esc(allRange.end),esc(mr.end),esc(ar.end)])}
    ${summaryRow('Délka',[allDuration!=null?hm(allDuration):'—',mr.duration!=null?hm(mr.duration):'—',ar.duration!=null?hm(ar.duration):'—'])}
    ${summaryRow('Kilometry',[allKm!=null?`${fmt(allKm)} km`:'—',mKm!=null?`${fmt(mKm)} km`:'—',aKm!=null?`${fmt(aKm)} km`:'—'])}
  </section>`;
}
function partsCard(shift,blocks){
  const split=blocks.length>1;
  if(!split)return `<section class="detail-parts-card">${(blocks[0]?.parts||shift.parts).map(part=>partRow(part)).join('')}</section>`;
  return `<section class="detail-parts-card detail-parts-split">
    ${blocks[0].parts.map(part=>partRow(part)).join('')}
    ${blocks[1].parts.map((part,index)=>partRow(part,{splitStart:index===0})).join('')}
  </section>`;
}
function renderShift(shift){
  const blocks=Domain.blocks(shift),parts=dateParts(shift.date);
  root.innerHTML=`
    <div class="detail-heading">
      <div class="detail-heading-date"><span>${esc(parts.day)}</span><strong>${esc(parts.date)}</strong></div>
      <a class="detail-back" href="shifts/">← Zpět</a>
    </div>
    ${summaryTable(shift,blocks)}
    ${galleryHTML(shift)}
    ${partsCard(shift,blocks)}
    ${shift.note?`<section class="detail-note-card"><strong>Poznámka</strong><p>${esc(shift.note)}</p></section>`:''}
    <section class="detail-breaks" hidden></section>`;
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