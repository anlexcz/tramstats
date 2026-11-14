(()=>{
'use strict';
const root=document.querySelector('#statistics'),status=document.querySelector('#status');
const Shared=window.TramStatsShared,Domain=window.TramStatsShiftDomain;
const tabs=[['overview','Přehled'],['shifts','Směny'],['lines','Linky'],['vehicles','Vozy'],['distance','Kilometry'],['time','Čas'],['depots','Vozovny'],['records','Rekordy']];
const absences=new Set(['V','VVS','KS','D','PN','SD','P16','MD']);
const nonLines=new Set(['Z','MJ','JP','73']);
const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
const isoDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dayAdd=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return isoDate(d)};
const dateLabel=iso=>new Date(iso+'T12:00:00').toLocaleDateString('cs-CZ');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(n,digits=1)=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:digits}).format(n);
const duration=v=>v==null?'—':Math.floor(v/60)+':'+String(Math.round(v%60)).padStart(2,'0');
const yearEnd=y=>y+'-12-31';
const monthEnd=m=>dayAdd(m+'-01',new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate()-1);
const state={db:null,tab:'overview',period:'year',year:String(now.getFullYear()),month:String(now.getMonth()+1).padStart(2,'0'),from:'',to:'',compare:false,manual:false,compareFrom:'',compareTo:'',drill:null,selectedLine:null};
const params=new URLSearchParams(location.search);
if(new Set(tabs.map(x=>x[0])).has(params.get('tab')))state.tab=params.get('tab');
if(/^\d{4}$/.test(params.get('year')||''))state.year=params.get('year');
if(/^\d{2}$/.test(params.get('month')||''))state.month=params.get('month');
if(['year','month','all','custom'].includes(params.get('period')))state.period=params.get('period');
if(/^\d{4}-\d{2}-\d{2}$/.test(params.get('from')||''))state.from=params.get('from');
if(/^\d{4}-\d{2}-\d{2}$/.test(params.get('to')||''))state.to=params.get('to');
if(params.get('line')){state.tab='lines';state.selectedLine=params.get('line')}
const statHref=(tab,extra={})=>'statistiky/?'+new URLSearchParams({tab,...extra});
const shiftHref=date=>'smeny/'+date.replaceAll('-','')+'/';
const metric=values=>Shared.measure(values);
const work=s=>(s.parts||[]).length>0&&!absences.has(s.actualShift);
const workShifts=rows=>rows.filter(work);
const parts=rows=>rows.flatMap(s=>(s.parts||[]).map(p=>({...p,shift:s})));
const kmOf=s=>metric((s.parts||[]).map(p=>p.km));
const timeOf=s=>Domain.durationMetric(s);
const range=(a,b)=>state.db.shifts.filter(s=>s.date>=a&&s.date<=b);
function interval(){
  let from,to;
  if(state.period==='all'){from=state.db.minDate||today;to=state.db.maxDate||today}
  else if(state.period==='custom'){from=state.from||state.db.minDate||today;to=state.to||today}
  else if(state.period==='month'){from=state.year+'-'+state.month+'-01';to=monthEnd(state.year+'-'+state.month)}
  else{from=state.year+'-01-01';to=yearEnd(state.year)}
  // Today is not a closed observation; future scheduled shifts must not affect actual statistics.
  to=to>=today?dayAdd(today,-1):to;
  if(state.drill){from=state.drill.from;to=state.drill.to>=today?dayAdd(today,-1):state.drill.to}
  return {from,to};
}
function previousInterval(from,to){
  if(state.manual)return {from:state.compareFrom||from,to:state.compareTo||to};
  const year=Number(from.slice(0,4)),start=from.slice(5),end=to.slice(5);
  // Calendar periods compare to the same calendar days one year earlier.
  if(state.period==='all')return {from:dayAdd(from,-(Math.round((new Date(to+'T12:00:00')-new Date(from+'T12:00:00'))/86400000)+1)),to:dayAdd(from,-1)};
  if(state.period==='year'||state.period==='month'||state.drill)return {from:(year-1)+'-'+start,to:(Number(to.slice(0,4))-1)+'-'+end};
  const days=Math.round((new Date(to+'T12:00:00')-new Date(from+'T12:00:00'))/86400000)+1;
  return {from:dayAdd(from,-days),to:dayAdd(from,-1)};
}
function aggregate(rows){
  const w=workShifts(rows),p=parts(w),lineMap=new Map(),vehicleMap=new Map(),familyMap=new Map(),depotMap=new Map(),typeMap=new Map(),daily=new Map();
  const kmMetric=metric(p.map(x=>x.km));
  const timeMetric=metric(w.map(s=>timeOf(s).complete?timeOf(s).value:null));
  timeMetric.complete=timeMetric.complete&&w.every(s=>timeOf(s).complete);
  for(const s of w){
    const d=daily.get(s.date)||{date:s.date,shifts:0,kmItems:[],timeItems:[]};
    d.shifts++;d.kmItems.push(...s.parts.map(x=>x.km));d.timeItems.push(timeOf(s).complete?timeOf(s).value:null);daily.set(s.date,d);
    const ty=s.actualShift||'—';const t=typeMap.get(ty)||{name:ty,shifts:0,kmItems:[],timeItems:[]};
    t.shifts++;t.kmItems.push(...s.parts.map(x=>x.km));t.timeItems.push(timeOf(s).complete?timeOf(s).value:null);typeMap.set(ty,t);
    if(s.depot){
      const d=depotMap.get(s.depot)||{name:s.depot,shifts:0,kmItems:[],timeItems:[],lines:new Set()};
      d.shifts++;d.kmItems.push(...s.parts.map(x=>x.km));d.timeItems.push(timeOf(s).complete?timeOf(s).value:null);depotMap.set(s.depot,d);
    }
    const dayLines=new Set();
    for(const part of s.parts){
      const distinct=[...new Set([part.frontVehicle,part.rearVehicle].filter(Boolean))];
      for(const id of distinct){
        const v=vehicleMap.get(id)||{name:id,count:0,days:new Set(),kmItems:[],timeItems:[],type:part.frontVehicle===id?part.frontVehicleMeta?.family:part.rearVehicleMeta?.family};
        v.count++;v.days.add(s.date);v.kmItems.push(part.km);v.timeItems.push(window.TramStatsVehicleDomain.partDuration(part));
        vehicleMap.set(id,v);
      }
      const family=part.frontVehicleMeta?.family||part.rearVehicleMeta?.family||part.vehicleType;
      if(family&&distinct.length){
        const t=familyMap.get(family)||{name:family,shifts:new Set(),vehicles:new Set(),kmItems:[],timeItems:[]};
        t.shifts.add(s.date);distinct.forEach(id=>t.vehicles.add(id));t.kmItems.push(part.km);t.timeItems.push(window.TramStatsVehicleDomain.partDuration(part));familyMap.set(family,t);
      }
      const entries=part.lineParts||[];
      const valid=entries.filter(x=>x.line&&!nonLines.has(x.line));
      const hasSplit=valid.length>0;
      for(const e of valid){
        dayLines.add(e.line);
        const l=lineMap.get(e.line)||{name:e.line,shifts:new Set(),parts:new Set(),kmItems:[],vehicles:new Set(),depots:new Set(),first:null,last:null};
        l.shifts.add(s.date);l.parts.add(s.date+'|'+part.partNo);
        // Missing line-level km is unknown, even when the part has a known combined total.
        l.kmItems.push(e.km);
        distinct.forEach(id=>l.vehicles.add(id));if(s.depot)l.depots.add(s.depot);
        if(!l.first||s.date<l.first)l.first=s.date;if(!l.last||s.date>l.last)l.last=s.date;
        lineMap.set(e.line,l);
      }
      if(!hasSplit&&part.line){
        // Do not invent line splits when no line association is available.
        for(const line of part.line.split('+').filter(x=>x&&!nonLines.has(x))){
          dayLines.add(line);
          const l=lineMap.get(line)||{name:line,shifts:new Set(),parts:new Set(),kmItems:[],vehicles:new Set(),depots:new Set(),first:null,last:null};
          l.shifts.add(s.date);l.parts.add(s.date+'|'+part.partNo);
          l.kmItems.push(part.line.includes('+')?null:part.km);
          distinct.forEach(id=>l.vehicles.add(id));if(s.depot)l.depots.add(s.depot);
          if(!l.first||s.date<l.first)l.first=s.date;if(!l.last||s.date>l.last)l.last=s.date;
          lineMap.set(line,l);
        }
      }
    }
    if(s.depot&&depotMap.has(s.depot))dayLines.forEach(l=>depotMap.get(s.depot).lines.add(l));
  }
  return {rows,w,p,lineMap,vehicleMap,familyMap,depotMap,typeMap,daily,
    shifts:w.length,km:kmMetric,time:timeMetric,
    lines:lineMap.size,vehicles:vehicleMap.size};
}
function kpi(name,value,change=''){
 return '<div class="stats-kpi"><span>'+esc(name)+'</span><strong>'+value+'</strong>'+(change?'<small>'+change+'</small>':'')+'</div>';
}
function shown(m,kind='km'){return esc(Shared.metricText(m,kind))}
function delta(current,prior,unit='',prec=1){
 if(current==null||prior==null)return 'Srovnání není úplné';
 const diff=current-prior,sign=diff>0?'+':'',percent=prior===0?'':(' · '+(diff>0?'+':'')+format(diff/prior*100,1)+' %');
 return '<span class="'+(diff>0?'stats-up':diff<0?'stats-down':'')+'">'+sign+format(diff,prec)+' '+esc(unit)+percent+'</span>';
}
function panel(title,inner,note='',wide=false){
 return '<section class="stats-panel'+(wide?' wide':'')+'"><h2>'+esc(title)+'</h2>'+(note?'<p>'+esc(note)+'</p>':'')+inner+'</section>';
}
function bars(map,value,label,limit=12,drill=false){
 const rows=[...map.values()].map(x=>({x,v:value(x)})).filter(({v})=>v!=null&&Number.isFinite(v)).sort((a,b)=>b.v-a.v).slice(0,limit);
 if(!rows.length)return '<div class="stats-empty">Pro zvolené období nejsou dostupné hodnoty.</div>';
 const max=Math.max(1,...rows.map(r=>r.v));
 return '<div class="stats-bars">'+rows.map(({x,v})=>'<div class="stats-bar">'+(drill==='vehicle'?'<a class="stats-bar-label" href="vozy/'+encodeURIComponent(x.name)+'/">'+esc(label(x))+'</a>':drill?'<button class="stats-bar-label" data-line="'+esc(x.name)+'">'+esc(label(x))+'</button>':'<span class="stats-bar-label" title="'+esc(label(x))+'">'+esc(label(x))+'</span>')+'<div class="stats-bar-track"><div class="stats-bar-fill" style="width:'+Math.max(0,v/max*100)+'%"></div></div><span class="stats-bar-value">'+format(v,1)+'</span></div>').join('')+'</div>';
}
function monthly(a,field='km'){
 const out=new Map();
 for(const [date,row] of a.daily){
   const key=date.slice(0,7),item=out.get(key)||{name:key,shifts:0,kmItems:[],timeItems:[]};
   item.shifts+=row.shifts;item.kmItems.push(...row.kmItems);item.timeItems.push(...row.timeItems);out.set(key,item);
 }
 return [...out.values()].sort((x,y)=>x.name.localeCompare(y.name));
}
function timeline(a,field='km'){
 const daily=Boolean(state.drill);
 const items=daily?[...a.daily.values()].sort((x,y)=>x.date.localeCompare(y.date)).map(row=>({name:row.date,shifts:row.shifts,kmItems:row.kmItems,timeItems:row.timeItems})):monthly(a);
 if(!items.length)return '<div class="stats-empty">Žádné pracovní směny v období.</div>';
 const all=new Map(items.map(x=>[x.name,x]));
 let start=interval().from.slice(0,daily?10:7),end=interval().to.slice(0,daily?10:7);
 if(start>end)return '<div class="stats-empty">Neplatný rozsah.</div>';
 let months=[],d=new Date((daily?start:start+'-01')+'T12:00:00');
 while(isoDate(d).slice(0,daily?10:7)<=end&&months.length<240){
   const key=isoDate(d).slice(0,daily?10:7);months.push(all.get(key)||{name:key,shifts:0,kmItems:[],timeItems:[]});
   if(daily)d.setDate(d.getDate()+1);else d.setMonth(d.getMonth()+1);
 }
 const selected=months.map(x=>({name:x.name,metric:field==='shifts'?{value:x.shifts,complete:true}:metric(field==='time'?x.timeItems:x.kmItems)}));
 const known=selected.filter(x=>x.metric.value!=null),max=Math.max(1,...known.map(x=>x.metric.value));
 return '<div class="stats-bars">'+selected.map(x=>{
   const label=daily?dateLabel(x.name):(x.name.slice(5)+'. '+x.name.slice(0,4));
   const value=x.metric.value;
   return '<div class="stats-bar">'+(daily?'<a class="stats-bar-label" href="'+shiftHref(x.name)+'">'+esc(label)+'</a>':'<button class="stats-bar-label" data-month="'+esc(x.name)+'" title="Otevřít podrobnosti za '+esc(label)+'">'+esc(label)+'</button>')+'<div class="stats-bar-track"><div class="stats-bar-fill" style="width:'+(value==null?0:Math.max(0,value/max*100))+'%"></div></div><span class="stats-bar-value">'+(field==='shifts'?format(value??0,0):field==='time'?shown(x.metric,'time'):shown(x.metric))+'</span></div>';
 }).join('')+'</div>';
}
function record(label,s,value,formatter){return '<div class="stats-record"><span>'+esc(label)+'</span><strong>'+formatter(value)+'</strong><a href="smeny/'+s.date.replaceAll('-','')+'/">'+esc(dateLabel(s.date))+'</a></div>'}
function records(a){
 const fullKm=a.w.map(s=>({s,m:kmOf(s)})).filter(x=>x.m.complete&&x.m.value!=null);
 const fullTime=a.w.map(s=>({s,m:timeOf(s)})).filter(x=>x.m.complete&&x.m.value!=null);
 const order=(arr,dir)=>arr.slice().sort((x,y)=>dir*(x.m.value-y.m.value));
 const list=[];
 if(fullKm.length){const hi=order(fullKm,-1)[0],lo=order(fullKm,1)[0];list.push(record('Nejvíce km za směnu',hi.s,hi.m.value,x=>format(x)+' km'),record('Nejméně km za směnu',lo.s,lo.m.value,x=>format(x)+' km'))}
 if(fullTime.length){const hi=order(fullTime,-1)[0],lo=order(fullTime,1)[0];list.push(record('Nejdelší směna',hi.s,hi.m.value,duration),record('Nejkratší směna',lo.s,lo.m.value,duration))}
 return list.length?'<div class="stats-records">'+list.join('')+'</div>':'<div class="stats-empty">Žádné úplné záznamy pro rekordy.</div>';
}
function breakdownTable(map,fields){
 const arr=[...map.values()].sort((a,b)=>((b.shifts instanceof Set?b.shifts.size:b.shifts||0)-(a.shifts instanceof Set?a.shifts.size:a.shifts||0)));
 if(!arr.length)return '<div class="stats-empty">V období nejsou evidované výkony.</div>';
 return '<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Skupina</th><th>Směny</th><th>Km</th></tr></thead><tbody>'+
 arr.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+format(x.shifts instanceof Set?x.shifts.size:x.shifts||0,0)+'</td><td>'+shown(metric(x.kmItems))+'</td></tr>').join('')+'</tbody></table></div>';
}
function summary(a,b){
 const kpis=[
   ['Odjeté směny',format(a.shifts,0),state.compare?delta(a.shifts,b.shifts,'',0):''],
   ['Osobní kilometry',shown(a.km),state.compare?(a.km.complete&&b.km.complete?delta(a.km.value,b.km.value,'km'):'Srovnání není úplné'):''],
   ['Odpracovaný čas',shown(a.time,'time'),state.compare?(a.time.complete&&b.time.complete?delta(a.time.value,b.time.value,'min',0):'Srovnání není úplné'):''],
   ['Různé linky',format(a.lines,0),state.compare?delta(a.lines,b.lines,'',0):''],
   ['Různé vozy',format(a.vehicles,0),state.compare?delta(a.vehicles,b.vehicles,'',0):'']
 ];
 return '<div class="stats-kpis">'+kpis.map(x=>kpi(...x)).join('')+'</div>';
}
function shiftStats(a){
 const lengths=a.w.map(s=>timeOf(s)).filter(x=>x.complete).map(x=>x.value);
 const avg=lengths.length?lengths.reduce((x,y)=>x+y,0)/lengths.length:null;
 const weekday=new Map(['Ne','Po','Út','St','Čt','Pá','So'].map((name,i)=>[i,{name,count:0}]));
 a.w.forEach(s=>{const i=new Date(s.date+'T12:00:00').getDay();weekday.get(i).count++});
 const sorted=a.w.map(x=>x.date).sort(),set=new Set(sorted);let best=0;
 for(const day of set){if(set.has(dayAdd(day,-1)))continue;let n=0,c=day;while(set.has(c)){n++;c=dayAdd(c,1)}best=Math.max(best,n)}
 return panel('Typy směn',breakdownTable(a.typeMap))+
 panel('Počet směn podle dnů v týdnu',bars(weekday,x=>x.count,x=>x.name,7))+
 panel('Délky a série','<div class="stats-records"><div class="stats-record"><span>Průměrná délka úplných směn</span><strong>'+duration(avg)+'</strong></div><div class="stats-record"><span>Nejdelší doložená série pracovních dnů</span><strong>'+best+' dnů</strong></div></div>','Série se počítají pouze z evidovaných pracovních dat; neúplná evidence nemusí dokládat nepřerušenou řadu.',true)+
 panel('Vývoj počtu směn',timeline(a,'shifts'),'Kliknutím na měsíc zobrazíš podrobnější období.',true);
}
function lineStats(a){
 const lines=[...a.lineMap.values()].sort((x,y)=>y.shifts.size-x.shifts.size);
 const selection=state.selectedLine&&a.lineMap.get(state.selectedLine);
 const list=panel('Nejčastější linky',bars(a.lineMap,x=>x.shifts.size,x=>x.name,30,true),'Počet směn, ve kterých se linka vyskytuje. Klikni na linku pro detail.')+
 panel('Kilometry podle linek',bars(a.lineMap,x=>metric(x.kmItems).value,x=>x.name,30,true),'Nedoložený rozpad kilometrů není odhadován.');
 let details='';
 if(selection){
   const m=metric(selection.kmItems);
   const days=[...selection.shifts].sort().reverse().slice(0,25);
   details=panel('Linka '+selection.name,
    '<div class="stats-actions"><a class="stats-detail-link" href="'+statHref('lines',{line:selection.name})+'">Odkaz na detail</a><a class="stats-detail-link" href="shifts/">Všechny směny</a></div><div class="stats-records">'+
    '<div class="stats-record"><span>Směny</span><strong>'+selection.shifts.size+'</strong></div>'+
    '<div class="stats-record"><span>Části výkonu</span><strong>'+selection.parts.size+'</strong></div>'+
    '<div class="stats-record"><span>Kilometry</span><strong>'+shown(m)+'</strong></div>'+
    '<div class="stats-record"><span>Různé vozy</span><strong>'+selection.vehicles.size+'</strong></div>'+
    '<div class="stats-record"><span>Vozovny</span><strong>'+esc([...selection.depots].sort().join(', ')||'—')+'</strong></div>'+
    '<div class="stats-record"><span>První / poslední výskyt</span><strong>'+dateLabel(selection.first)+' / '+dateLabel(selection.last)+'</strong></div></div>',
   'Kilometry jsou osobní, pouze podle doloženého rozdělení po linkách.',true)+panel('Poslední směny na lince '+selection.name,
    '<div class="stats-history">'+days.map(d=>'<a href="'+shiftHref(d)+'">'+esc(dateLabel(d))+'</a>').join('')+'</div>',
    'Maximálně 25 posledních doložených směn.',true);
 }
 return details+list;
}
function vehicleStats(a){
 const vehicleList=new Map([...a.vehicleMap].map(([k,v])=>[k,{...v,name:k}]));
 return panel('Typy tramvají',bars(a.familyMap,x=>x.shifts.size,x=>x.name,30),'Počet směn s výskytem typu, nikoliv součet vozokilometrů.')+
 panel('Nejčastější jednotlivé vozy',bars(vehicleList,x=>x.days.size,x=>x.name,20,'vehicle'),'Počet různých pracovních dnů s vozem.')+
 panel('Souhrn podle typů', '<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Typ</th><th>Vozů</th><th>Směn</th></tr></thead><tbody>'+
 [...a.familyMap.values()].sort((x,y)=>y.shifts.size-x.shifts.size).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+x.vehicles.size+'</td><td>'+x.shifts.size+'</td></tr>').join('')+'</tbody></table></div>',
 'U souprav nesčítáme stejné osobní kilometry dvakrát do celkového nájezdu.',true);
}
function distanceStats(a){
 const complete=a.w.map(s=>({s,m:kmOf(s)})).filter(x=>x.m.complete&&x.m.value!=null);
 const avg=complete.length?complete.reduce((v,x)=>v+x.m.value,0)/complete.length:null;
 let running=0;
 const months=monthly(a);
 const cumulative=months.map(x=>{const m=metric(x.kmItems);if(m.value!=null)running+=m.value;return {name:x.name,value:running,complete:m.complete}});
 return panel('Kilometry po měsících',timeline(a,'km'),'Přiblížení kliknutím na konkrétní měsíc.',true)+
 panel('Průměr a úplnost','<div class="stats-records"><div class="stats-record"><span>Průměr na úplnou směnu</span><strong>'+(avg==null?'—':format(avg)+' km')+'</strong></div><div class="stats-record"><span>Směny s úplnými km</span><strong>'+complete.length+' / '+a.shifts+'</strong></div></div>')+
 panel('Doložená kumulativní kilometráž',bars(new Map(cumulative.map(x=>[x.name,x])),x=>x.value,x=>x.name,240),'Kumulativní součet zahrnuje jen známé hodnoty, proto může být pouze dolní hranicí.',true);
}
function timeStats(a){
 const starts=new Map(),hours=new Map(),weekday=new Map(['Ne','Po','Út','St','Čt','Pá','So'].map((x,i)=>[i,{name:x,count:0}]));
 for(const s of a.w){
  const first=s.parts.find(p=>p.start);
  if(first){const h=Number(first.start.split(':')[0]);const bucket=String(h).padStart(2,'0')+':00';const item=starts.get(bucket)||{name:bucket,count:0};item.count++;starts.set(bucket,item)}
  const day=new Date(s.date+'T12:00:00').getDay();weekday.get(day).count++;
 }
 return panel('Začátky směn podle hodiny',bars(starts,x=>x.count,x=>x.name,24),'Vychází z prvního doloženého času směny.')+
 panel('Pracovní dny týdne',bars(weekday,x=>x.count,x=>x.name,7))+
 panel('Odpracovaný čas po měsících',timeline(a,'time'),'Délka směny včetně BP, u šejdrů bez mezery mezi bloky.',true);
}
function depotStats(a){
 return panel('Počet směn podle vozoven',bars(a.depotMap,x=>x.shifts,x=>x.name,25))+
 panel('Kilometráž podle vozoven',bars(a.depotMap,x=>metric(x.kmItems).value,x=>x.name,25),'Při neúplných km jde pouze o součet známých hodnot.')+
 panel('Souhrn vozoven',breakdownTable(a.depotMap),'Vozovna je převzata z doloženého přiřazení směny.',true);
}
function recordStats(a){return panel('Rekordní směny',records(a),'Do extrémů vstupují pouze směny s úplnými odpovídajícími hodnotami.',true)}
function render(){
 const {from,to}=interval(),valid=from<=to;
 const a=aggregate(valid?range(from,to):[]);
 const prev=previousInterval(from,to),b=aggregate(state.compare&&valid&&prev.from<=prev.to?range(prev.from,prev.to):[]);
 const years=[...new Set(state.db.shifts.map(s=>s.date.slice(0,4)))].sort().reverse();
 if(!years.includes(state.year))years.unshift(state.year);
 root.innerHTML='<div class="stats-tabs" role="tablist" aria-label="Oblasti statistik">'+tabs.map(([id,label])=>'<button type="button" role="tab" aria-selected="'+(state.tab===id)+'" data-tab="'+id+'">'+label+'</button>').join('')+'</div>'+
 '<div class="stats-toolbar"><label class="stats-field">Období<select id="stats-period"><option value="year">Rok</option><option value="month">Měsíc</option><option value="all">Celá historie</option><option value="custom">Vlastní období</option></select></label>'+
 ((state.period==='year'||state.period==='month')?'<label class="stats-field">Rok<select id="stats-year">'+years.map(y=>'<option value="'+y+'">'+y+'</option>').join('')+'</select></label>':'')+
 (state.period==='month'?'<label class="stats-field">Měsíc<select id="stats-month">'+Array.from({length:12},(_,i)=>{const n=String(i+1).padStart(2,'0');return '<option value="'+n+'">'+n+'</option>'}).join('')+'</select></label>':'')+
 (state.period==='custom'?'<label class="stats-field">Od<input type="date" id="stats-from" value="'+esc(state.from)+'"></label><label class="stats-field">Do<input type="date" id="stats-to" value="'+esc(state.to)+'"></label>':'')+
 '<div class="stats-actions"><button id="stats-compare" aria-pressed="'+state.compare+'">Srovnání '+(state.compare?'zapnuto':'vypnuto')+'</button>'+(state.compare?'<button id="stats-manual" aria-pressed="'+state.manual+'">Vlastní srovnání</button>':'')+'</div>'+
 (state.compare&&state.manual?'<label class="stats-field">Srovnat od<input type="date" id="stats-compare-from" value="'+esc(state.compareFrom)+'"></label><label class="stats-field">Srovnat do<input type="date" id="stats-compare-to" value="'+esc(state.compareTo)+'"></label>':'')+'</div>'+
 (state.drill?'<div class="stats-selected"><span>Detail: '+esc(dateLabel(state.drill.from))+' – '+esc(dateLabel(state.drill.to))+'</span><button id="stats-back">Zpět na období</button></div>':'')+
 '<p class="stats-caption">Období: '+esc(valid?dateLabel(from)+' – '+dateLabel(to):'Neplatný rozsah')+(state.compare?' · Srovnání: '+esc(dateLabel(prev.from)+' – '+dateLabel(prev.to)):'')+' · Dnešní neuzavřený den a budoucí směny nejsou započteny.</p>'+
 summary(a,b)+
 '<div class="stats-grid">'+(
 state.tab==='overview'
 ? panel('Vývoj kilometrů',timeline(a,'km'),'Osobní kilometry za jednotlivé měsíce.',true)+panel('Nejčastější linky',bars(a.lineMap,x=>x.shifts.size,x=>x.name,8,true))+panel('Typy tramvají',bars(a.familyMap,x=>x.shifts.size,x=>x.name,8))+panel('Rekordy',records(a),'Pouze úplné záznamy.',true)
 :state.tab==='shifts'?shiftStats(a)
 :state.tab==='lines'?lineStats(a)
 :state.tab==='vehicles'?vehicleStats(a)
 :state.tab==='distance'?distanceStats(a)
 :state.tab==='time'?timeStats(a)
 :state.tab==='depots'?depotStats(a)
 :recordStats(a)
 )+'</div><nav class="stats-crossnav" aria-label="Související přehledy"><a href="shifts/">Evidence směn</a><a href="vozy/">Katalog vozů</a><a href="'+statHref('lines')+'">Statistiky linek</a><a href="'+statHref('depots')+'">Statistiky vozoven</a></nav><p class="stats-note">Zdroj: živá databáze TramStats (Google Sheets). „≥“ znamená neúplný součet, „—“ chybějící údaj. Statistiky evidují osobní kilometry; při soupravách nedochází k jejich násobení počtem vozů. Zobrazené období vždy končí nejpozději včerejškem.</p>';
 root.querySelector('#stats-period').value=state.period;
 if(root.querySelector('#stats-year'))root.querySelector('#stats-year').value=state.year;
 if(root.querySelector('#stats-month'))root.querySelector('#stats-month').value=state.month;
}
root.addEventListener('change',e=>{
 const id=e.target.id,value=e.target.value;
 const changes={'stats-period':'period','stats-year':'year','stats-month':'month','stats-from':'from','stats-to':'to','stats-compare-from':'compareFrom','stats-compare-to':'compareTo'};
 if(changes[id]){state[changes[id]]=value;state.drill=null;render()}
});
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]'),month=e.target.closest('[data-month]'),line=e.target.closest('[data-line]');
 if(tab){state.tab=tab.dataset.tab;state.selectedLine=null;render();return}
 if(month){const m=month.dataset.month;state.drill={from:m+'-01',to:monthEnd(m)};render();return}
 if(line){state.tab='lines';state.selectedLine=line.dataset.line;render();return}
 if(e.target.closest('#stats-back')){state.drill=null;render();return}
 if(e.target.closest('#stats-compare')){state.compare=!state.compare;render();return}
 if(e.target.closest('#stats-manual')){state.manual=!state.manual;render()}
});
window.TramStatsData.load().then(db=>{state.db=db;status.textContent='';render()}).catch(err=>{status.textContent='Statistiky nelze načíst: '+String(err?.message||err);status.classList.add('status-error')});
})();