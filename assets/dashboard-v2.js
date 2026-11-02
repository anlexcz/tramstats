(()=>{
'use strict';

const Domain=window.TramStatsShiftDomain;
const dashIcon=kind=>({
  km:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c4-8 8-8 16-10M16 5l4 2-2 4"/></svg>',
  time:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  shifts:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
  vehicles:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="16" rx="2"/><path d="M6 11h12M9 19l-2 3M15 19l2 3M9 15h.01M15 15h.01"/></svg>'
}[kind]||'');

function isoDay(value){return new Date(value+'T12:00:00');}
function dashWindow(){
  const dated=state.shifts.filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s.date)).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(!dated.length)return {from:null,to:null,shifts:[]};
  const to=isoDay(dated.at(-1).date),from=new Date(to);
  from.setDate(from.getDate()-29);
  return {from,to,shifts:dated.filter(s=>isoDay(s.date)>=from&&isoDay(s.date)<=to)};
}
function dashPair(line,order,course,{alias=false}={}){
  if(!line)return'';
  return `<span class="dash-performance"><span class="dash-line${alias?' dash-line-alias':''}">${esc(line)}</span>${order!=null&&order!==''?`<span class="dash-order">${esc(order)}</span>`:''}${course!=null&&course!==''?`<span class="dash-course">${esc(course)}</span>`:''}</span>`;
}
function dashBadge(badge){
  if(badge.kind==='special')return dashPair(badge.label,null,null,{alias:true});
  const line=(badge.lines||[]).join('+')||badge.label;
  if(badge.kind==='course')return dashPair(line,null,badge.course,{alias:line.includes('+')});
  return dashPair(line,badge.order,null,{alias:line.includes('+')});
}
function dashPerformances(shift){
  return Domain.performanceRows(shift).flatMap(row=>row.badges||[]).map(dashBadge).join('');
}
function dashVehicleBadges(parts){
  const seen=new Set(),out=[];
  for(const part of parts){
    if(part.frontVehicle){
      const key='f'+part.frontVehicle;
      if(!seen.has(key)){seen.add(key);out.push(`<span class="dash-vehicle dash-front">${esc(part.frontVehicle)}</span>`);}
    }
    if(part.rearVehicle){
      const key='r'+part.rearVehicle;
      if(!seen.has(key)){seen.add(key);out.push(`<span class="dash-vehicle dash-rear">${esc(part.rearVehicle)}</span>`);}
    }
  }
  return out.join('');
}
function shiftDuration(shift){return Domain.durationMinutes(shift)||0;}
function dashRecent(shift){
  const ps=shift.parts||[];
  const kmKnown=ps.some(p=>p.km!=null),km=kmKnown?sumKm(ps):null,duration=shiftDuration(shift);
  return `<a class="dash-shift" href="shifts/detail/?date=${encodeURIComponent(shift.date)}"><div class="dash-shift-top"><span class="dash-date">${date(shift.date)}</span><span class="dash-measures">${km!=null?`<span>${dashIcon('km')}<b>${fmt(km)} km</b></span>`:''}${duration?`<span>${dashIcon('time')}<b>${hm(duration)}</b></span>`:''}</span></div><div class="dash-shift-bottom"><span class="dash-duty">${shift.actualShift?`<b class="dash-ss">${esc(shift.actualShift)}</b>`:''}<span class="dash-performances">${dashPerformances(shift)}</span></span><span class="dash-vehicles">${dashVehicleBadges(ps)}</span></div></a>`;
}
function dashBars(entries,kind,metric='km',limit=5){
  const normalized=entries.map(([label,x])=>[label,typeof x==='number'?{[metric]:x}:x]).filter(([,x])=>x&&x[metric]>0);
  const top=normalized.sort((a,b)=>b[1][metric]-a[1][metric]).slice(0,limit),max=Math.max(1,...top.map(([,x])=>x[metric]));
  return top.map(([label,x])=>`<div class="dash-bar-row ${kind}"><span class="dash-stat-badge">${esc(label)}</span><span class="dash-track"><i style="width:${x[metric]/max*100}%"></i></span><strong>${metric==='km'?fmt(x[metric])+' km':fmt(x[metric],0)+' '+(x[metric]===1?'směna':x[metric]>=2&&x[metric]<=4?'směny':'směn')}</strong></div>`).join('');
}
function dashExtremes(workShifts){
  const timed=workShifts.map(s=>({s,value:shiftDuration(s)})).filter(x=>x.value>0);
  const kilometric=workShifts.map(s=>({s,value:s.parts?.some(p=>p.km!=null)?sumKm(s.parts):null})).filter(x=>x.value>0);
  if(!timed.length&&!kilometric.length)return'';
  const min=a=>a.reduce((x,y)=>y.value<x.value?y:x),max=a=>a.reduce((x,y)=>y.value>x.value?y:x),cards=[];
  if(timed.length){cards.push(['Nejkratší směna',min(timed),x=>hm(x)]);cards.push(['Nejdelší směna',max(timed),x=>hm(x)]);}
  if(kilometric.length){cards.push(['Nejméně km',min(kilometric),x=>fmt(x)+' km']);cards.push(['Nejvíce km',max(kilometric),x=>fmt(x)+' km']);}
  return `<section class="dash-extremes"><div class="dash-section-head"><h2>Extrémy</h2></div><div class="dash-extreme-grid">${cards.map(([label,x,format])=>`<a href="shifts/detail/?date=${encodeURIComponent(x.s.date)}" class="dash-extreme"><span>${label}</span><strong>${format(x.value)}</strong><small>${date(x.s.date)}</small></a>`).join('')}</div></section>`;
}
function dashboardV2(){
  const win=dashWindow(),ss=win.shifts,p=parts(ss),g=groups(ss),w=ss.filter(worked),recent=w.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6),types=Object.entries(g.types||{}),depots={};
  for(const shift of w){
    const code=shift.depot||'';
    if(code)depots[code]=(depots[code]||0)+1;
  }
  const totalDuration=w.reduce((sum,shift)=>sum+shiftDuration(shift),0);
  return `<div class="dash-context">Posledních 30 dní</div><section class="dash-kpis"><div class="kpi-km"><span>${dashIcon('km')}Kilometry</span><strong>${fmt(sumKm(p))} <small>km</small></strong></div><div class="kpi-time"><span>${dashIcon('time')}Čas</span><strong>${hm(totalDuration)}</strong></div><div><span>${dashIcon('shifts')}Počet směn</span><strong>${fmt(w.length,0)}</strong></div><div><span>${dashIcon('vehicles')}Počet vozů</span><strong>${Object.keys(g.vehicles).length}</strong></div></section><section class="dash-layout"><div class="dash-analytics"><section><div class="dash-section-head"><h2>Linky</h2><a href="stats/">Statistiky →</a></div><div class="dash-bars">${dashBars(Object.entries(g.lines),'lines')}</div></section><section class="dash-types"><div class="dash-section-head"><h2>Vozy</h2></div><div class="dash-bars">${dashBars(types,'types')}</div></section><section class="dash-depots"><div class="dash-section-head"><h2>Vozovny</h2></div><div class="dash-bars">${dashBars(Object.entries(depots),'depots','count')}</div></section></div><section class="dash-main"><div class="dash-section-head"><h2>Poslední směny</h2><a href="shifts/">Všechny směny →</a></div><div class="dash-shifts">${recent.map(dashRecent).join('')||'<p class="hint">V posledních 30 dnech není pracovní směna.</p>'}</div></section>${dashExtremes(w)}</section>`;
}

window.dashboard=dashboardV2;
if(typeof state!=='undefined'&&state.shifts?.length&&state.view==='overview'&&typeof render==='function')render();
})();
