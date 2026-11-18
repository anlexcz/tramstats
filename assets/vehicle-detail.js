(()=>{
'use strict';

const Domain=window.TramStatsVehicleDomain;
const Shared=window.TramStatsShared;
const root=document.querySelector('#vehicle-detail');
const status=document.querySelector('#status');
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=(value,digits=1)=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:digits}).format(value);
const hm=minutes=>`${Math.floor((minutes||0)/60)}:${String(Math.round((minutes||0)%60)).padStart(2,'0')}`;
const date=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'});
const icon=kind=>({
  rides:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h13M7 12h13M7 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  km:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c4-8 8-8 16-10M16 5l4 2-2 4"/></svg>',
  time:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
}[kind]||'');

function routeVehicle(){
  const match=location.pathname.match(/\/vuz\/([^/]+)(?:\/|$)/);
  return match?decodeURIComponent(match[1]):null;
}
function dayText(days){
  if(days==null)return'';
  if(days===0)return'dnes';
  if(days===1)return'před 1 dnem';
  return `před ${days} dny`;
}
function shiftHref(iso){return `smena/${String(iso).replaceAll('-','')}/`;}
function galleryHTML(rows,photos){
  return window.TramStatsPhotos?.markup(photos,{label:'Fotografie vozu',scope:'vehicle-photo'})||'';
}
function summaryTable(rows){
  const total=Domain.summary(rows),years=Domain.yearly(rows);
  const metric=(record,type)=>window.TramStatsShared.metricHTML(type==='km'?record.kmMetric:record.durationMetric,type==='km'?'km':'time');
  return `<section class="vehicle-summary data-panel" aria-label="Souhrn vozu">
    <div class="vehicle-summary-head"><span>Rok</span><span title="Počet částí výkonu" aria-label="Počet částí výkonu">${icon('rides')}</span><span>${icon('km')}</span><span>${icon('time')}</span></div>
    <div class="vehicle-summary-row data-row total"><strong>Celkem</strong><b>${total.count}</b><b>${metric(total,'km')}</b><b>${metric(total,'time')}</b></div>
    ${years.map(item=>`<div class="vehicle-summary-row data-row"><strong>${esc(item.year)}</strong><span>${item.count}</span><span>${metric(item,'km')}</span><span>${metric(item,'time')}</span></div>`).join('')}
  </section>`;
}
function occurrenceMeta(rows){
  if(!rows.length)return'';
  const newest=rows[0],oldest=rows.at(-1);
  return `<section class="vehicle-occurrence-meta">
    <p><span>První výskyt:</span> <a class="inline-link" href="${shiftHref(oldest.date)}">${date(oldest.date)}</a> <small>· ${esc(dayText(Domain.daysAgo(oldest.date)))}</small></p>
    <p><span>Poslední výskyt:</span> <a class="inline-link" href="${shiftHref(newest.date)}">${date(newest.date)}</a> <small>· ${esc(dayText(Domain.daysAgo(newest.date)))}</small></p>
  </section>`;
}
function historyRow(row,{yearStart=false,year=null}={}){
  const hasPhoto=(row.photos||[]).length>0;
  return `<article class="vehicle-history-row data-row row-link${yearStart?' vehicle-history-year-start':''}" role="link" tabindex="0" data-href="${shiftHref(row.date)}" aria-label="Otevřít směnu ${date(row.date)}">
    ${yearStart?`<span class="vehicle-history-year-label">${esc(year)}</span>`:''}
    <strong class="vehicle-history-date">${date(row.date)}</strong>
    <strong class="vehicle-history-performance">${esc(row.performance)}</strong>
    <span class="vehicle-history-metric data-metric">${icon('time')}<b>${row.duration!=null?hm(row.duration):'—'}</b></span>
    <span class="vehicle-history-metric data-metric">${icon('km')}<b>${row.km!=null?`${fmt(row.km)} km`:'—'}</b></span>
    ${hasPhoto?`<button class="vehicle-history-photo" type="button" data-photo-id="${esc(row.photos[0].id)}" aria-label="Zobrazit fotografii z ${date(row.date)}">${icon('camera')}</button>`:'<span class="vehicle-history-photo-space"></span>'}
  </article>`;
}
function history(rows){
  const years=Domain.yearly(rows);
  return `<section class="vehicle-history data-panel" aria-label="Historie jízd">${years.map(group=>
    group.rows.map((row,index)=>historyRow(row,{yearStart:index===0,year:group.year})).join('')
  ).join('')}</section>`;
}
function render(vehicle,rows,photos){
  const photoErrors=window.TramStatsData?.status?.photoErrors||[];
  root.innerHTML=`
    <div class="detail-heading"><h1 class="detail-title"><span>${esc(vehicle.family||vehicle.type||'Vůz')}</span><strong>${esc(vehicle.id)}</strong></h1><a class="back-link" href="vozy/">← Zpět</a></div>
    <nav class="detail-context-links link-group" aria-label="Související statistiky">
      <a class="context-link" href="statistiky/?tab=vehicles">Statistiky vozů</a>
      <a class="context-link" href="statistiky/?tab=vehicles&period=all">Všechny roky</a>
      <a class="context-link" href="statistiky/?tab=records">Rekordy</a>
    </nav>
    <div class="entity-detail-top${photos.length?' has-gallery':''}">
      <div class="entity-detail-summary">${summaryTable(rows)}${occurrenceMeta(rows)}</div>
      ${photos.length?`<div class="entity-detail-gallery">${galleryHTML(rows,photos)}</div>`:''}
    </div>
    ${photoErrors.length?'<p class="status-message status-warning">Fotografická evidence není z API dostupná ('+esc(photoErrors.join(', '))+'). Galerie může být neúplná.</p>':''}
    ${history(rows)}`;
}
function openRow(row){const href=row?.dataset?.href;if(href)location.href=href;}
document.addEventListener('click',event=>{
  const photoButton=event.target.closest('[data-photo-id]');
  if(photoButton){
    const id=photoButton.dataset.photoId;
    const node=document.getElementById('vehicle-photo-'+id.replace(/[^a-zA-Z0-9_-]/g,'_'));
    if(node){node.scrollIntoView({behavior:'smooth',block:'center'});node.querySelector('a')?.focus();}
    return;
  }
  if(event.target.closest('button,a'))return;
  const row=event.target.closest('.vehicle-history-row');
  if(row)openRow(row);
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  if(event.target.closest('a,button'))return;
  const row=event.target.closest?.('.vehicle-history-row');
  if(!row)return;
  event.preventDefault();openRow(row);
});
async function boot(){
  const id=routeVehicle();
  if(!id){status.textContent='Neplatná adresa vozu.';return;}
  try{
    const db=await window.TramStatsData.load();
    const vehicle=db.indexes.vehicleById.get(String(id));
    if(!vehicle){status.textContent='Vůz nebyl v databázi nalezen.';return;}
    const rows=Domain.occurrences(db,id);
    if(!rows.length){status.textContent='Pro tento vůz nejsou evidované žádné jízdy.';return;}
    status.textContent='';
    document.title=`${vehicle.family||vehicle.type||'Vůz'} ${vehicle.id} — TramStats`;
    render(vehicle,rows,db.photosForVehicle?.(id)||[]);
  }catch(error){Shared.reportError(status,'Data vozu se nepodařilo načíst.',error);}
}
boot();
})();
