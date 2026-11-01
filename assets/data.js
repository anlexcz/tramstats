'use strict';
(function(){
  const API_URL='https://script.google.com/macros/s/AKfycbwVDu4SCysr91opTkdaluTYvoOXXdvFHz26ZfzlaYwn8VJ1GWZzeCg_-PDtYZi23gBiQw/exec';
  const TABLES=['shifts','shift_parts','shift_part_lines','breaks','vehicles','depots','lines','shift_types','shift_courses','tags','shift_part_tags'];
  const CACHE_KEY='tramstats-db-v3';
  const CACHE_TTL=5*60*1000;
  let loadPromise=null;
  const status={mode:'idle',error:null,apiUrl:API_URL,loadedAt:null,source:'TramStats – databáze'};

  const num=value=>{
    if(value==null||value==='') return null;
    const n=Number(String(value).replace(',','.'));
    return Number.isFinite(n)?n:null;
  };
  const bool=value=>value===true||String(value).toLowerCase()==='true';
  const text=value=>value==null||value===''?null:String(value);
  const dayLabel=iso=>{
    const d=new Date(`${iso}T12:00:00`);
    return ['Ne','Po','Út','St','Čt','Pá','So'][d.getDay()]||null;
  };
  const timeMinutes=value=>{
    if(!value) return null;
    const [h,m]=String(value).split(':').map(Number);
    return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;
  };
  const duration=(start,end,startDayOffset=0)=>{
    let a=timeMinutes(start),b=timeMinutes(end);
    if(a==null||b==null) return null;
    a+=Number(startDayOffset||0)*1440;
    b+=Number(startDayOffset||0)*1440;
    if(b<a) b+=1440;
    const minutes=b-a;
    return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;
  };
  const key=(date,partNo)=>`${date}|${partNo}`;
  const courseKey=(date,course)=>`${date}|${course}`;

  async function fetchTable(name){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),30000);
    try{
      const url=`${API_URL}?table=${encodeURIComponent(name)}`;
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
      const payload=await response.json();
      if(!payload||payload.ok!==true||!Array.isArray(payload.rows)) throw new Error(`${name}: neplatná odpověď API`);
      return payload.rows;
    } finally {
      clearTimeout(timeout);
    }
  }

  function readCache(){
    try{
      const raw=sessionStorage.getItem(CACHE_KEY);
      if(!raw) return null;
      const cached=JSON.parse(raw);
      if(!cached||Date.now()-cached.savedAt>CACHE_TTL||!cached.tables) return null;
      return cached.tables;
    }catch{return null;}
  }
  function writeCache(tables){
    try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),tables}));}catch{}
  }

  function normalize(raw){
    const vehicleById=new Map(raw.vehicles.map(v=>[String(v.id),{
      id:String(v.id),
      type:text(v.type),
      family:text(v.family)
    }]));
    const depotByCode=new Map(raw.depots.map(d=>[String(d.code),{code:String(d.code),name:text(d.name)}]));
    const lineByCode=new Map(raw.lines.map(l=>[String(l.code),{code:String(l.code),alias:text(l.alias),name:text(l.name)}]));
    const shiftTypeByCode=new Map(raw.shift_types.map(t=>[String(t.code),{code:String(t.code),name:text(t.name)}]));
    const tagById=new Map(raw.tags.map(t=>[String(t.id),{
      id:String(t.id),code:text(t.code),name:text(t.name)
    }]));
    const tagsByPart=new Map();
    for(const row of raw.shift_part_tags){
      const k=key(row.shift_date,row.part_no);
      if(!tagsByPart.has(k)) tagsByPart.set(k,[]);
      const tag=tagById.get(String(row.tag_id));
      if(tag) tagsByPart.get(k).push(tag);
    }
    const courseByKey=new Map(raw.shift_courses.map(c=>[courseKey(c.shift_date,c.course),{
      shiftDate:c.shift_date,
      course:text(c.course),
      isSnack:bool(c.is_snack)
    }]));
    const linesByPart=new Map();
    const lineRows=raw.shift_part_lines.map(row=>({
      shiftDate:row.shift_date,
      partNo:String(row.part_no),
      seq:num(row.seq),
      line:text(row.line),
      lineMeta:row.line!=null?lineByCode.get(String(row.line))||null:null,
      km:num(row.km)
    }));
    for(const row of lineRows){
      const k=key(row.shiftDate,row.partNo);
      if(!linesByPart.has(k)) linesByPart.set(k,[]);
      linesByPart.get(k).push(row);
    }
    for(const rows of linesByPart.values()) rows.sort((a,b)=>(a.seq??0)-(b.seq??0));

    const partsByDate=new Map();
    const partRows=raw.shift_parts.map(row=>{
      const partNo=String(row.part_no);
      const lineParts=linesByPart.get(key(row.shift_date,partNo))||[];
      const frontVehicle=row.front_vehicle?vehicleById.get(String(row.front_vehicle))||null:null;
      const rearVehicle=row.rear_vehicle?vehicleById.get(String(row.rear_vehicle))||null:null;
      const course=text(row.course);
      const courseMeta=course?courseByKey.get(courseKey(row.shift_date,course))||null:null;
      const masterType=frontVehicle&&(!rearVehicle||rearVehicle.type===frontVehicle.type)?frontVehicle.type:null;
      return {
        shiftDate:row.shift_date,
        partNo,
        course,
        order:text(row.order_no),
        vehicleType:masterType||text(row.vehicle_type),
        frontVehicle:row.front_vehicle?String(row.front_vehicle):null,
        rearVehicle:row.rear_vehicle?String(row.rear_vehicle):null,
        frontVehicleMeta:frontVehicle,
        rearVehicleMeta:rearVehicle,
        start:text(row.start_time),
        end:text(row.end_time),
        startDayOffset:num(row.start_day_offset)??0,
        duration:duration(row.start_time,row.end_time,row.start_day_offset),
        km:num(row.km),
        note:text(row.note),
        lineParts,
        line:lineParts.map(x=>x.line).filter(Boolean).join('+')||null,
        isSnack:courseMeta?.isSnack===true,
        tags:tagsByPart.get(key(row.shift_date,partNo))||[]
      };
    });
    for(const part of partRows){
      if(!partsByDate.has(part.shiftDate)) partsByDate.set(part.shiftDate,[]);
      partsByDate.get(part.shiftDate).push(part);
    }
    for(const rows of partsByDate.values()) rows.sort((a,b)=>Number(a.partNo)-Number(b.partNo));

    const shifts=raw.shifts.map(row=>({
      date:row.date,
      day:dayLabel(row.date),
      actualShift:text(row.shift_type),
      shiftType:row.shift_type?shiftTypeByCode.get(String(row.shift_type))||null:null,
      depot:text(row.depot),
      depotMeta:row.depot?depotByCode.get(String(row.depot))||null:null,
      splitSeq:num(row.split_seq),
      note:text(row.note),
      parts:partsByDate.get(row.date)||[]
    })).sort((a,b)=>a.date.localeCompare(b.date));

    for(const shift of shifts) for(const part of shift.parts) part.depot=shift.depot;

    const breaks=raw.breaks.map(row=>({
      date:row.shift_date,
      breakNo:String(row.break_no),
      start:text(row.start_time),
      end:text(row.end_time),
      startDayOffset:num(row.start_day_offset)??0,
      duration:duration(row.start_time,row.end_time,row.start_day_offset),
      fromPlace:text(row.from_place),
      toPlace:text(row.to_place),
      note:text(row.note)
    })).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.breakNo)-Number(b.breakNo));

    const years=[...new Set(shifts.map(s=>s.date?.slice(0,4)).filter(Boolean))].sort();
    return {
      tables:{
        shifts:raw.shifts,
        shiftParts:partRows,
        shiftPartLines:lineRows,
        breaks,
        vehicles:[...vehicleById.values()],
        depots:[...depotByCode.values()],
        lines:[...lineByCode.values()],
        shiftTypes:[...shiftTypeByCode.values()],
        shiftCourses:[...courseByKey.values()],
        tags:[...tagById.values()],
        shiftPartTags:raw.shift_part_tags
      },
      indexes:{vehicleById,depotByCode,lineByCode,shiftTypeByCode,tagById,courseByKey,linesByPart,tagsByPart},
      shifts,breaks,years,
      minDate:shifts[0]?.date||null,
      maxDate:shifts.at(-1)?.date||null
    };
  }

  async function load(options={}){
    if(loadPromise&&!options.force) return loadPromise;
    loadPromise=(async()=>{
      status.mode='loading';status.error=null;
      let raw=!options.force?readCache():null;
      if(!raw){
        const rows=await Promise.all(TABLES.map(fetchTable));
        raw=Object.fromEntries(TABLES.map((name,i)=>[name,rows[i]]));
        writeCache(raw);
      }
      const db=normalize(raw);
      status.mode='live';status.loadedAt=new Date().toISOString();
      return db;
    })().catch(error=>{
      status.mode='error';status.error=String(error?.message||error);loadPromise=null;throw error;
    });
    return loadPromise;
  }

  window.TramStatsData={API_URL,TABLES,status,load,normalize,duration,num};
})();
