(()=>{
'use strict';

const Domain=window.TramStatsVehicleDomain;
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
  const match=location.pathname.match(/\/vozy\/([^/]+)(?:\/|$)/);
  return match?decodeURIComponent(match[1]):null;
}
function dayText(days){
  if(days==null)return'';
  if(days===0)return'dnes';
  if(days===1)return'před 1 dnem';
  return `před ${days} dny`;
}
function shiftHref(iso){return `smeny/${String(iso).replaceAll('-','')}/`;}
function galleryHTML(rows){
  const photos=rows.flatMap(row=>row.photos||[]);
  if(!photos.length)return'';
  return `<section class="vehicle-gallery" aria-label="Fotografie vozu"></section>`;
}
function summaryTable(rows){
  const total=Domain.summary(rows),years=Domain.yearly(rows);
  const metric=(value,type)=>type==='km'?(value!=null?`${fmt(value)} km`:'—'):type==='time'?hm(value):String(value);
  return `<section class="vehicle-summary" aria-label="Souhrn vozu">
    <div class="vehicle-summary-head"><span>Rok</span><span>${icon('rides')}</span><span>${icon('km')}</span><span>${icon('time')}</span></div>
    <div class="vehicle-summary-row total"><strong>Celkem</strong><b>${total.count}</b><b>${metric(total.km,'km')}</b><b>${metric(total.duration,'time')}</b></div>
    ${years.map(item=>`<div class="vehicle-summary-row"><strong>${esc(item.year)}</strong><span>${item.count}</span><span>${metric(item.km,'km')}</span><span>${metric(item.duration,'time')}</span></div>`).join('')}
  </section>`;
}
function occurrenceMeta(rows){
  if(!rows.length)return'';
  const newest=rows[0],oldest=rows.at(-1);
  return `<section class="vehicle-occurrence-meta">
    <p><span>První výskyt:</span> <a href="${shiftHref(oldest.date)}">${date(oldest.date)}</a> <small>· ${esc(dayText(Domain.daysAgo(oldest.date)))}</small></p>
    <p><span>Poslední výskyt:</span> <a href="${shiftHref(newest.date)}">${date(newest.date)}</a> <small>· ${esc(dayText(Domain.daysAgo(newest.date)))}</small></p>
  </section>`;
}
function historyRow(row,{yearStart=false,year=null}={}){
  const hasPhoto=(row.photos||[]).length>0;
  return `<article class="vehicle-history-row${yearStart?' vehicle-history-year-start':''}" role="link" tabindex="0" data-href="${shiftHref(row.date)}" aria-label="Otevřít směnu ${date(row.date)}">
    ${yearStart?`<span class="vehicle-history-year-label">${esc(year)}</span>`:''}
    <strong class="vehicle-history-date">${date(row.date)}</strong>
    <strong class="vehicle-history-performance">${esc(row.performance)}</strong>
    <span class="vehicle-history-metric">${icon('time')}<b>${row.duration!=null?hm(row.duration):'—'}</b></span>
    <span class="vehicle-history-metric">${icon('km')}<b>${row.km!=null?`${fmt(row.km)} km`:'—'}</b></span>
    ${hasPhoto?`<button class="vehicle-history-photo" type="button" aria-label="Zobrazit fotografii z ${date(row.date)}">${icon('camera')}</button>`:'<span class="vehicle-history-photo-space"></span>'}
  </article>`;
}
function history(rows){
  const years=Domain.yearly(rows);
  return `<section class="vehicle-history" aria-label="Historie jízd">${years.map(group=>
    group.rows.map((row,index)=>historyRow(row,{yearStart:index===0,year:group.year})).join('')
  ).join('')}</section>`;
}
function render(vehicle,rows){
  root.innerHTML=`
    <div class="vehicle-detail-heading"><div class="vehicle-detail-title"><span>${esc(vehicle.family||vehicle.type||'Vůz')}</span><strong>${esc(vehicle.id)}</strong></div><a class="vehicle-detail-back" href="vozy/">← Zpět</a></div>
    ${summaryTable(rows)}
    ${occurrenceMeta(rows)}
    ${galleryHTML(rows)}
    ${history(rows)}`;
}
function openRow(row){const href=row?.dataset?.href;if(href)location.href=href;}
document.addEventListener('click',event=>{
  if(event.target.closest('button,a'))return;
  const row=event.target.closest('.vehicle-history-row');
  if(row)openRow(row);
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
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
    render(vehicle,rows);
  }catch(error){status.textContent='Data vozu se nepodařilo načíst. '+String(error?.message||error);}
}
boot();
})();