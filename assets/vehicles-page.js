(()=>{
'use strict';

const Domain=window.TramStatsVehicleDomain;
state.vehicleQuery=state.vehicleQuery||'';
state.vehicleFamily=state.vehicleFamily||'';
state.vehiclePeriod=state.vehiclePeriod||'';

const norm=value=>String(value??'').toLocaleLowerCase('cs').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const icon=kind=>({
  rides:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 6h13M7 12h13M7 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  km:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c4-8 8-8 16-10M16 5l4 2-2 4"/></svg>',
  time:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>'
}[kind]||'');

function metricsFor(record,period){
  if(!period||period==='all')return record.summary;
  return record.years.find(item=>item.year===period)||{count:0,km:null,duration:0};
}
function vehicleRows(db){
  const map=Domain.byVehicle(db);
  const years=[...new Set([...map.values()].flatMap(record=>record.years.map(item=>item.year)))].sort((a,b)=>b.localeCompare(a));
  if(!state.vehiclePeriod)state.vehiclePeriod=years[0]||'all';
  const query=norm(state.vehicleQuery),family=state.vehicleFamily;
  const rows=[...map.values()].map(record=>({record,metrics:metricsFor(record,state.vehiclePeriod)})).filter(({record,metrics})=>{
    if(metrics.count<=0)return false;
    if(family&&record.vehicle.family!==family)return false;
    if(query&&!norm(`${record.vehicle.id} ${record.vehicle.family||''} ${record.vehicle.type||''}`).includes(query))return false;
    return true;
  }).sort((a,b)=>Number(a.record.vehicle.id)-Number(b.record.vehicle.id));
  return {map,years,rows};
}
function familyChips(map){
  const families=[...new Set([...map.values()].map(record=>record.vehicle.family).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'cs',{numeric:true}));
  return `<div class="vehicles-families"><button type="button" data-family="" class="${!state.vehicleFamily?'active':''}">Vše</button>${families.map(f=>`<button type="button" data-family="${esc(f)}" class="${state.vehicleFamily===f?'active':''}">${esc(f)}</button>`).join('')}</div>`;
}
function periodChips(years){
  return `<div class="vehicles-periods">${years.slice(0,4).map(year=>`<button type="button" data-period="${year}" class="${state.vehiclePeriod===year?'active':''}">${year}</button>`).join('')}<button type="button" data-period="all" class="${state.vehiclePeriod==='all'?'active':''}">Celkem</button></div>`;
}
function vehicleRow(record,metrics){
  const vehicle=record.vehicle;
  return `<a class="vehicles-row" href="vozy/${encodeURIComponent(vehicle.id)}/">
    <span class="vehicles-id"><small>${esc(vehicle.family||vehicle.type||'Vůz')}</small><strong>${esc(vehicle.id)}</strong></span>
    <span class="vehicles-metric">${icon('rides')}<b>${metrics.count}</b></span>
    <span class="vehicles-metric">${icon('km')}<b>${window.TramStatsShared.metricHTML(metrics.kmMetric)}</b></span>
    <span class="vehicles-metric">${icon('time')}<b>${window.TramStatsShared.metricHTML(metrics.durationMetric,'time')}</b></span>
  </a>`;
}
function renderVehicles(db){
  if(!db)return'<div class="empty">Načítám vozy…</div>';
  const {map,years,rows}=vehicleRows(db);
  return `<section class="vehicles-controls">
      ${familyChips(map)}
      <label class="vehicles-search"><input id="vehicle-search" type="search" placeholder="Hledat EV nebo typ…" value="${esc(state.vehicleQuery)}" aria-label="Hledat vůz"></label>
      ${periodChips(years)}
      <div class="vehicles-count">${rows.length} vozů</div>
    </section>
    <section class="vehicles-table" aria-label="Seznam vozů">
      <div class="vehicles-head"><span>Vůz</span><span title="Počet částí výkonu" aria-label="Počet částí výkonu">${icon('rides')}</span><span>${icon('km')}</span><span>${icon('time')}</span></div>
      ${rows.map(({record,metrics})=>vehicleRow(record,metrics)).join('')||'<div class="empty">Žádný odpovídající vůz.</div>'}
    </section>`;
}
vehicleList=renderVehicles;
window.vehiclesMounted=()=>{};

document.addEventListener('input',event=>{
  if(event.target.id!=='vehicle-search')return;
  state.vehicleQuery=event.target.value;
  render();
  requestAnimationFrame(()=>{const input=document.querySelector('#vehicle-search');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}});
});
document.addEventListener('click',event=>{
  const family=event.target.closest('[data-family]');
  if(family){state.vehicleFamily=family.dataset.family||'';render();return;}
  const period=event.target.closest('[data-period]');
  if(period){state.vehiclePeriod=period.dataset.period||'all';render();}
});

if(state.db&&state.view==='vehicles')render();
})();
