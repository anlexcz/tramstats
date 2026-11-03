(()=>{
'use strict';

const Domain=window.TramStatsShiftDomain;
let vehicleOverflowObserver=null;
const dashIcon=kind=>({
  km:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c4-8 8-8 16-10M16 5l4 2-2 4"/></svg>',
  time:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  shifts:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
  vehicles:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="16" rx="2"/><path d="M6 11h12M9 19l-2 3M15 19l2 3M9 15h.01M15 15h.01"/></svg>'
}[kind]||'');

function isoDay(value){return new Date(value+'T12:00:00');}
function dayShift(value,days){const out=new Date(value);out.setDate(out.getDate()+days);return out;}
function shiftsBetween(shifts,from,to){return shifts.filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&isoDay(s.date)>=from&&isoDay(s.date)<=to);}
function lastClosedDay(){
  const today=new Date();
  today.setHours(12,0,0,0);
  return dayShift(today,-1);
}
function dashWindows(){
  const dated=state.shifts.filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s.date)).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!dated.length)return {current:{from:null,to:null,shifts:[]},previous:{from:null,to:null,shifts:[]}};
  const currentTo=lastClosedDay(),currentFrom=dayShift(currentTo,-29);
  const previousTo=dayShift(currentFrom,-1),previousFrom=dayShift(previousTo,-29);
  return {
    current:{from:currentFrom,to:currentTo,shifts:shiftsBetween(dated,currentFrom,currentTo)},
    previous:{from:previousFrom,to:previousTo,shifts:shiftsBetween(dated,previousFrom,previousTo)}
  };
}
function dashBadge(badge){
  const label=badge?.label||'';
  if(!label)return'';
  return `<span class="dash-performance-badge${badge.kind==='special'?' special':''}">${esc(label)}</span>`;
}
function vehicleSets(parts){
  const seen=new Set(),sets=[];
  for(const part of parts||[]){
    const vehicles=[part.frontVehicle,part.rearVehicle].filter(Boolean);
    if(!vehicles.length)continue;
    const label=vehicles.join(' + '),count=vehicles.length;
    if(seen.has(label))continue;
    seen.add(label);
    sets.push({label,count});
  }
  return sets;
}
function vehicleList(parts){
  const values=vehicleSets(parts);
  if(!values.length)return'';
  return `<span class="dash-vehicle-list" data-vehicle-count="${values.reduce((sum,item)=>sum+item.count,0)}">${values.map((item,index)=>`<span class="dash-vehicle-item" data-count="${item.count}">${index?', ':''}${esc(item.label)}</span>`).join('')}<span class="dash-vehicle-more" hidden></span></span>`;
}
function dashShiftRows(shift){
  const rows=Domain.performanceRows(shift);
  if(!rows.length)return'';
  return rows.map(row=>`<div class="dash-shift-row"><span class="dash-performances">${(row.badges||[]).map(dashBadge).join('')}</span><span class="dash-row-vehicles">${vehicleList(row.parts)}</span></div>`).join('');
}
function shiftDuration(shift){return Domain.durationMinutes(shift)||0;}
function dashRecent(shift){
  const ps=shift.parts||[];
  const kmKnown=ps.some(p=>p.km!=null),km=kmKnown?sumKm(ps):null,duration=shiftDuration(shift);
  return `<div class="dash-shift"><div class="dash-shift-top"><span class="dash-date-line"><span class="dash-date">${date(shift.date)}</span>${shift.actualShift?`<b class="dash-shift-code">${esc(shift.actualShift)}</b>`:''}</span><span class="dash-measures">${km!=null?`<span>${dashIcon('km')}<b>${fmt(km)} km</b></span>`:''}${duration?`<span>${dashIcon('time')}<b>${hm(duration)}</b></span>`:''}</span></div><div class="dash-shift-rows">${dashShiftRows(shift)}</div></div>`;
}
function trendDirection(current,previous,epsilon=0){
  const diff=current-previous;
  if(Math.abs(diff)<=epsilon)return 'flat';
  return diff>0?'up':'down';
}
function trendArrow(direction){return direction==='up'?'↗':direction==='down'?'↘':'→';}
function signedNumber(value,digits=1){
  if(value===0)return fmt(0,digits);
  return `${value>0?'+':'−'}${fmt(Math.abs(value),digits)}`;
}
function signedTime(value){
  if(value===0)return '0:00';
  return `${value>0?'+':'−'}${hm(Math.abs(value))}`;
}
function kpiTrend(current,previous,format,epsilon=0){
  const diff=current-previous,direction=trendDirection(current,previous,epsilon),text=format(diff);
  return `<small class="dash-trend ${direction}" title="Oproti předchozím 30 dnům"><span aria-hidden="true">${trendArrow(direction)}</span> ${esc(text)}</small>`;
}
function miniTrend(current,previous,epsilon=0){
  const direction=trendDirection(current,previous,epsilon);
  return `<span class="dash-mini-trend ${direction}" title="Oproti předchozím 30 dnům" aria-label="Trend ${direction==='up'?'nahoru':direction==='down'?'dolů':'beze změny'}">${trendArrow(direction)}</span>`;
}
function depotCounts(shifts){
  const out={};
  for(const shift of shifts.filter(worked)){
    const code=shift.depot||'';
    if(code)out[code]=(out[code]||0)+1;
  }
  return out;
}
function dashBars(entries,previousEntries,kind,metric='km',limit=5){
  const previous=new Map(previousEntries.map(([label,x])=>[label,typeof x==='number'?{[metric]:x}:x]));
  const normalized=entries.map(([label,x])=>[label,typeof x==='number'?{[metric]:x}:x]).filter(([,x])=>x&&x[metric]>0);
  const top=normalized.sort((a,b)=>b[1][metric]-a[1][metric]).slice(0,limit),max=Math.max(1,...top.map(([,x])=>x[metric]));
  return top.map(([label,x])=>{
    const previousValue=previous.get(label)?.[metric]??0;
    return `<div class="dash-bar-row ${kind}"><span class="dash-stat-badge">${esc(label)}</span><span class="dash-track"><i style="width:${x[metric]/max*100}%"></i></span><strong>${metric==='km'?fmt(x[metric])+' km':fmt(x[metric],0)+' '+(x[metric]===1?'směna':x[metric]>=2&&x[metric]<=4?'směny':'směn')}</strong>${miniTrend(x[metric],previousValue,metric==='km'?0.05:0)}</div>`;
  }).join('');
}
function dashExtremes(workShifts){
  const timed=workShifts.map(s=>({s,value:shiftDuration(s)})).filter(x=>x.value>0);
  const kilometric=workShifts.map(s=>({s,value:s.parts?.some(p=>p.km!=null)?sumKm(s.parts):null})).filter(x=>x.value>0);
  if(!timed.length&&!kilometric.length)return'';
  const min=a=>a.reduce((x,y)=>y.value<x.value?y:x),max=a=>a.reduce((x,y)=>y.value>x.value?y:x),cards=[];
  if(timed.length){cards.push(['Nejkratší směna',min(timed),x=>hm(x)]);cards.push(['Nejdelší směna',max(timed),x=>hm(x)]);}
  if(kilometric.length){cards.push(['Nejméně km',min(kilometric),x=>fmt(x)+' km']);cards.push(['Nejvíce km',max(kilometric),x=>fmt(x)+' km']);}
  return `<section class="dash-extremes"><div class="dash-section-head"><h2>Extrémy</h2></div><div class="dash-extreme-grid">${cards.map(([label,x,format])=>`<div class="dash-extreme"><span>${label}</span><strong>${format(x.value)}</strong><small>${date(x.s.date)}</small></div>`).join('')}</div></section>`;
}
function summary(shifts){
  const work=shifts.filter(worked),partRows=parts(shifts),grouped=groups(shifts);
  return {
    shifts,
    work,
    parts:partRows,
    groups:grouped,
    km:sumKm(partRows),
    duration:work.reduce((sum,shift)=>sum+shiftDuration(shift),0),
    shiftCount:work.length,
    vehicleCount:Object.keys(grouped.vehicles).length,
    depots:depotCounts(shifts)
  };
}
function dashboardV2(){
  const windows=dashWindows(),current=summary(windows.current.shifts),previous=summary(windows.previous.shifts);
  const recent=current.work.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  const currentTypes=Object.entries(current.groups.types||{}),previousTypes=Object.entries(previous.groups.types||{});
  return `<div class="dash-context">Posledních 30 dní <span>· srovnání s předchozími 30 dny</span></div><section class="dash-kpis"><div class="kpi-km"><span>${dashIcon('km')}Kilometry</span><strong>${fmt(current.km)} <small>km</small></strong>${kpiTrend(current.km,previous.km,diff=>signedNumber(diff)+' km',0.05)}</div><div class="kpi-time"><span>${dashIcon('time')}Čas</span><strong>${hm(current.duration)}</strong>${kpiTrend(current.duration,previous.duration,signedTime)}</div><div><span>${dashIcon('shifts')}Počet směn</span><strong>${fmt(current.shiftCount,0)}</strong>${kpiTrend(current.shiftCount,previous.shiftCount,diff=>signedNumber(diff,0))}</div><div><span>${dashIcon('vehicles')}Počet vozů</span><strong>${current.vehicleCount}</strong>${kpiTrend(current.vehicleCount,previous.vehicleCount,diff=>signedNumber(diff,0))}</div></section><section class="dash-layout"><div class="dash-analytics"><section><div class="dash-section-head"><h2>Linky</h2></div><div class="dash-bars">${dashBars(Object.entries(current.groups.lines),Object.entries(previous.groups.lines),'lines')}</div></section><section class="dash-types"><div class="dash-section-head"><h2>Vozy</h2></div><div class="dash-bars">${dashBars(currentTypes,previousTypes,'types')}</div></section><section class="dash-depots"><div class="dash-section-head"><h2>Vozovny</h2></div><div class="dash-bars">${dashBars(Object.entries(current.depots),Object.entries(previous.depots),'depots','count')}</div></section></div><section class="dash-main"><div class="dash-section-head"><h2>Poslední směny</h2><a href="shifts/">Všechny směny →</a></div><div class="dash-shifts">${recent.map(dashRecent).join('')||'<p class="hint">V posledních 30 dnech není pracovní směna.</p>'}</div></section>${dashExtremes(current.work)}</section>`;
}
function fitVehicleLists(){
  document.querySelectorAll('.dash-vehicle-list').forEach(list=>{
    const items=[...list.querySelectorAll('.dash-vehicle-item')],more=list.querySelector('.dash-vehicle-more');
    if(!more)return;
    items.forEach(item=>item.hidden=false);
    more.hidden=true;more.textContent='';
    if(list.scrollWidth<=list.clientWidth+1)return;
    let hiddenVehicles=0;
    for(let i=items.length-1;i>=0;i--){
      hiddenVehicles+=Number(items[i].dataset.count)||1;
      items[i].hidden=true;
      more.hidden=false;
      more.textContent=`${items.slice(0,i).some(item=>!item.hidden)?', ':''}+${hiddenVehicles} vozů`;
      if(list.scrollWidth<=list.clientWidth+1)return;
    }
  });
}
function mountVehicleLists(){
  if(vehicleOverflowObserver)vehicleOverflowObserver.disconnect();
  fitVehicleLists();
  if(typeof ResizeObserver==='function'){
    vehicleOverflowObserver=new ResizeObserver(fitVehicleLists);
    document.querySelectorAll('.dash-row-vehicles').forEach(el=>vehicleOverflowObserver.observe(el));
  }
}

window.dashboard=dashboardV2;
window.dashboardMounted=mountVehicleLists;
if(typeof state!=='undefined'&&state.shifts?.length&&state.view==='overview'&&typeof render==='function')render();
})();
