(()=>{
'use strict';

const minutes=value=>{
  if(!value)return null;
  const [h,m]=String(value).split(':').map(Number);
  return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;
};
const partDuration=part=>{
  let start=minutes(part.start),end=minutes(part.end);
  if(start==null||end==null)return null;
  start+=(Number(part.startDayOffset)||0)*1440;
  end+=(Number(part.startDayOffset)||0)*1440;
  if(end<start)end+=1440;
  return end-start;
};
const performanceLabel=part=>{
  const line=part.line||'';
  if(part.order)return `${line||'—'}/${part.order}`;
  return line||'—';
};
function occurrences(db,vehicleId){
  const id=String(vehicleId);
  const out=[];
  for(const shift of db.shifts||[]){
    for(const part of shift.parts||[]){
      if(part.frontVehicle!==id&&part.rearVehicle!==id)continue;
      out.push({
        vehicleId:id,
        date:shift.date,
        year:String(shift.date||'').slice(0,4),
        shift,
        part,
        performance:performanceLabel(part),
        duration:partDuration(part),
        km:part.km,
        photos:Array.isArray(part.photos)?part.photos:[]
      });
    }
  }
  return out.sort((a,b)=>b.date.localeCompare(a.date)||Number(b.part.partNo)-Number(a.part.partNo));
}
function summary(rows){
  const kmKnown=rows.some(row=>row.km!=null);
  return {
    count:rows.length,
    km:kmKnown?rows.reduce((sum,row)=>sum+(row.km??0),0):null,
    duration:rows.reduce((sum,row)=>sum+(row.duration??0),0)
  };
}
function yearly(rows){
  const grouped=new Map();
  for(const row of rows){
    if(!row.year)continue;
    if(!grouped.has(row.year))grouped.set(row.year,[]);
    grouped.get(row.year).push(row);
  }
  return [...grouped.entries()]
    .map(([year,items])=>({year,rows:items,...summary(items)}))
    .filter(item=>item.count>0)
    .sort((a,b)=>b.year.localeCompare(a.year));
}
function byVehicle(db){
  const map=new Map();
  for(const vehicle of db.tables?.vehicles||[]){
    const rows=occurrences(db,vehicle.id);
    if(!rows.length)continue;
    map.set(vehicle.id,{vehicle,rows,summary:summary(rows),years:yearly(rows)});
  }
  return map;
}
function daysAgo(iso,now=new Date()){
  if(!iso)return null;
  const date=new Date(`${iso}T12:00:00`);
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  return Math.round((today-date)/86400000);
}
window.TramStatsVehicleDomain={occurrences,summary,yearly,byVehicle,partDuration,performanceLabel,daysAgo};
})();