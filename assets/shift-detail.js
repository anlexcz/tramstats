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
  vehicle:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="16" rx="2"/><path d="M6 11h12M9 19l-2 3M15 19l2 3M9 15h.01M15 15h.01"/></svg>',
  camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
}[kind]||'');

function routeDate(){
  const match=location.pathname.match(/\/smena\/(\d{8})(?:\/|$)/);
  if(!match)return null;
  const raw=match[1];
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
}
function dateParts(iso){
  const d=new Date(`${iso}T12:00:00`);
  return {day:dayNames[d.getDay()],date:d.toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'})};
}
function dateLong(iso){const parts=dateParts(iso);return `${parts.day} ${parts.date}`;}
const Shared=window.TramStatsShared;
const partDuration=part=>Domain.blockRange([part])?.duration??null;
const kmHTML=parts=>Shared.metricHTML(Shared.measure((parts||[]).map(part=>part.km)));
function blockRange(block){
  const complete=(block?.parts||[]).filter(part=>part.start&&part.end);
  if(!complete.length)return {start:'—',end:'—'};
  return {start:complete[0].start,end:complete.at(-1).end};
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
function lineLinks(part){
  const codes=[...new Set((part.lineParts||[]).map(x=>x.line).filter(Boolean).concat(String(part.line||'').split('+')).filter(x=>x&&!['Z','MJ','JP','73'].includes(x)))];
  return codes.map(code=>'<a class="inline-link" href="statistiky/?tab=lines&period=all&line='+encodeURIComponent(code)+'">Linka '+esc(code)+'</a>').join('');
}
function vehicleText(part){
  const ids=[part.frontVehicle,part.rearVehicle].filter(Boolean);
  const family=part.frontVehicleMeta?.family||part.rearVehicleMeta?.family||part.vehicleType||'';
  if(!ids.length&&!family)return'';
  const linked=ids.map(id=>`<a class="inline-link" href="vuz/${encodeURIComponent(id)}/">${esc(id)}</a>`).join(' + ');
  return `${family?`<span class="detail-vehicle-type">${esc(family)}</span>`:''}${ids.length?`<span class="detail-vehicle-ids">${linked}</span>`:''}`;
}
function galleryHTML(shift){
  const photos=[...(shift.photos||[]),...(shift.parts||[]).flatMap(p=>p.photos||[])];
  return window.TramStatsPhotos?.markup(photos,{label:'Fotografie směny',scope:'shift-photo'})||'';
}
function assignment(part){
  const course=courseLabel(part);
  const vehicle=vehicleText(part);
  const lines=lineLinks(part);
  return `<div class="shift-assignment">
    <div class="shift-assignment-main">
      <strong class="shift-performance">${esc(performanceLabel(part))}</strong>
      ${course?`<small>${esc(course)}</small>`:''}
    </div>
    ${vehicle?`<div class="shift-assignment-vehicle">${detailIcon('vehicle')}${vehicle}</div>`:''}
    ${lines?`<div class="shift-line-links">${lines}</div>`:''}
    ${part.photos?.length?`<button class="detail-photo-mark ui-control" type="button" data-part-photo="${esc(part.partNo)}" aria-label="Fotografie části ${esc(part.partNo)}">${detailIcon('camera')}</button>`:''}
  </div>`;
}
function intervalHTML(start,end){
  if((!start&&!end)||(start==='—'&&end==='—'))return '—';
  return `${esc(start||'—')}–${esc(end||'—')}`;
}
function partRow(part){
  const duration=partDuration(part);
  return `<li class="shift-part">
    ${assignment(part)}
    <div class="shift-part-metrics">
      <span>${intervalHTML(part.start,part.end)}</span>
      <span>${kmHTML([part])}</span>
      ${duration!=null?`<span aria-label="Délka ${hm(duration)}">${hm(duration)}</span>`:''}
    </div>
    ${part.note?`<p class="shift-note">${esc(part.note)}</p>`:''}
  </li>`;
}
function partsCard(blocks,parts){
  if(parts.length<2)return '';
  return `<section class="shift-detail-section">
    <h2>Průběh směny</h2>
    ${blocks.map((block,index)=>`
      ${index===1?'<p class="shift-block-divider">Šejdrpauza</p>':''}
      <ol class="shift-part-list data-panel">${block.parts.map(partRow).join('')}</ol>
    `).join('')}
  </section>`;
}
function notes(shift,single){
  const entries=[...new Set([shift.note,single?.note].filter(Boolean))];
  if(!entries.length)return '';
  return `<section class="shift-detail-section shift-notes">
    <h2>Poznámky</h2>
    ${entries.map(note=>`<p class="shift-note">${esc(note)}</p>`).join('')}
  </section>`;
}
function renderShift(shift){
  const parts=shift.parts||[];
  const single=parts.length===1?parts[0]:null;
  const blocks=Domain.blocks(shift);
  const date=dateParts(shift.date);
  const range=single||blockRange({parts});
  const type=shift.shiftType?.name||shift.actualShift;
  const depot=shift.depotMeta?.name||shift.depot;
  const meta=[type,depot].filter(Boolean).map(esc).join(' · ');
  const year=encodeURIComponent(shift.date.slice(0,4));
  const gallery=galleryHTML(shift);
  const incompletePhotos=window.TramStatsData?.status?.photoErrors?.length;
  root.innerHTML=`
    <div class="shift-title-group">
      <a class="shift-detail-back" href="smeny/">← Všechny směny</a>
      <h1><time datetime="${esc(shift.date)}">${esc(date.date)}</time></h1>
      <p>${esc(date.day)}${meta?` <span aria-hidden="true">·</span> ${meta}`:''}</p>
    </div>
    <section class="shift-overview data-panel" aria-label="Souhrn směny">
      <dl class="shift-stat-grid">
        <div class="shift-stat-interval"><dt>Čas směny</dt><dd>${intervalHTML(range.start,range.end)}</dd></div>
        <div><dt>Délka</dt><dd>${Shared.metricHTML(Domain.durationMetric(shift),'time')}</dd></div>
        <div><dt>Kilometry</dt><dd>${kmHTML(parts)}</dd></div>
      </dl>
      ${single?assignment(single):''}
    </section>
    ${partsCard(blocks,parts)}
    ${notes(shift,single)}
    ${gallery?`<div class="shift-detail-section">${gallery}${incompletePhotos?'<p class="shift-photo-note">Některé fotografie mohou chybět.</p>':''}</div>`:''}
    <nav class="shift-reference-links" aria-label="Související statistiky">
      <a href="statistiky/?tab=shifts&year=${year}">Statistiky směn</a>
      <a href="statistiky/?tab=depots&year=${year}">Vozovny</a>
      <a href="statistiky/?tab=distance&year=${year}">Kilometry</a>
    </nav>`;
}
document.addEventListener('click',event=>{
  const btn=event.target.closest('[data-part-photo]');
  if(!btn)return;
  const partNo=btn.dataset.partPhoto;
  const detail=document.querySelector('#shift-detail');
  const shift=detail?._shift;
  const part=shift?.parts.find(p=>String(p.partNo)===partNo);
  const first=part?.photos?.[0];
  if(!first)return;
  const node=document.getElementById('shift-photo-'+first.id.replace(/[^a-zA-Z0-9_-]/g,'_'));
  if(node){node.scrollIntoView({behavior:'smooth',block:'center'});node.querySelector('a')?.focus();}
});
async function boot(){
  const wanted=routeDate();
  if(!wanted){status.textContent='Neplatná adresa směny.';return;}
  try{
    const db=await window.TramStatsData.load();
    const shift=db.shifts.find(item=>item.date===wanted);
    if(!shift){status.textContent='Směna pro toto datum nebyla v databázi nalezena.';return;}
    status.textContent='';
    document.title=`${dateLong(shift.date)} — TramStats`;
    root._shift=shift;
    renderShift(shift);
  }catch(error){
    Shared.reportError(status,'Data směny se nepodařilo načíst.',error);
  }
}

boot();
})();
