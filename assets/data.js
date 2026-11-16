'use strict';
(function(){
  const API_URL='https://script.google.com/macros/s/AKfycbwVDu4SCysr91opTkdaluTYvoOXXdvFHz26ZfzlaYwn8VJ1GWZzeCg_-PDtYZi23gBiQw/exec';
  const TABLES=['shifts','shift_parts','shift_part_lines','vehicles','depots','lines','shift_types'];
  const PHOTO_TABLES=['photos','photo_variants','shift_photos','shift_part_photos','vehicle_photos'];
  const CACHE_KEY='tramstats-db-v5-photos';
  const CACHE_TTL=5*60*1000;
  let loadPromise=null;
  const status={mode:'idle',error:null,apiUrl:API_URL,loadedAt:null,source:'TramStats – databáze'};

  const num=value=>{
    if(value==null||value==='')return null;
    const n=Number(String(value).replace(',','.'));
    return Number.isFinite(n)?n:null;
  };
  const text=value=>value==null||value===''?null:String(value);
  const dayLabel=iso=>{
    const d=new Date(`${iso}T12:00:00`);
    return ['Ne','Po','Út','St','Čt','Pá','So'][d.getDay()]||null;
  };
  const timeMinutes=value=>{
    if(!value)return null;
    const [h,m]=String(value).split(':').map(Number);
    return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;
  };
  const duration=(start,end,startDayOffset=0)=>{
    let a=timeMinutes(start),b=timeMinutes(end);
    if(a==null||b==null)return null;
    a+=Number(startDayOffset||0)*1440;
    b+=Number(startDayOffset||0)*1440;
    if(b<a)b+=1440;
    const minutes=b-a;
    return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;
  };
  const key=(date,partNo)=>`${date}|${partNo}`;

  async function fetchTable(name,{timeoutMs=30000}={}){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(`${API_URL}?table=${encodeURIComponent(name)}`,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);
      const payload=await response.json();
      if(!payload||payload.ok!==true||!Array.isArray(payload.rows))throw new Error(`${name}: neplatná odpověď API`);
      return payload.rows;
    }finally{
      clearTimeout(timeout);
    }
  }

  function readCache(){
    try{
      const raw=sessionStorage.getItem(CACHE_KEY);
      if(!raw)return null;
      const cached=JSON.parse(raw);
      if(!cached||Date.now()-cached.savedAt>CACHE_TTL||!cached.tables)return null;
      return cached.tables;
    }catch{return null;}
  }
  function writeCache(tables){
    try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),tables}));}catch{}
  }

  function normalize(raw){
    const photoById=new Map((raw.photos||[]).filter(p=>p.id).map(p=>[String(p.id),{
      id:String(p.id),originalFile:text(p.original_file),takenAt:text(p.taken_at),
      description:text(p.description),variants:[],shiftDates:[],partKeys:[],vehicleIds:[]
    }]));
    for(const v of raw.photo_variants||[]){
      const p=photoById.get(String(v.photo_id));
      if(p&&v.file)p.variants.push({kind:text(v.variant),file:String(v.file),width:num(v.width),height:num(v.height)});
    }
    const photoUrl=p=>{
      const v=p.variants.find(v=>v.kind==='web')||p.variants.find(v=>v.kind==='thumb');
      // Private Google Drive originals are links, never assumed to be public image sources.
      const url=v?.file||null;
      if(url&&(/^(https:\/\/|\/)/).test(url))return url;
      return null;
    };
    const linkedPhotos=rows=>{
      const seen=new Set();
      return (rows||[]).map(row=>photoById.get(String(row.photo_id))).filter(p=>{
        if(!p||seen.has(p.id))return false;
        seen.add(p.id);return true;
      }).map(p=>({...p,imageUrl:photoUrl(p)}));
    };
    const shiftPhotoRows=new Map(),partPhotoRows=new Map(),vehiclePhotoRows=new Map();
    for(const r of raw.shift_photos||[]){
      if(!r.shift_date||!photoById.has(String(r.photo_id)))continue;
      const date=String(r.shift_date);
      if(!shiftPhotoRows.has(date))shiftPhotoRows.set(date,[]);
      shiftPhotoRows.get(date).push(r);photoById.get(String(r.photo_id)).shiftDates.push(date);
    }
    for(const rows of shiftPhotoRows.values())rows.sort((a,b)=>(num(a.sort_order)??0)-(num(b.sort_order)??0));
    for(const r of raw.shift_part_photos||[]){
      if(!r.shift_date||r.part_no==null||!photoById.has(String(r.photo_id)))continue;
      const k=key(r.shift_date,String(r.part_no));
      if(!partPhotoRows.has(k))partPhotoRows.set(k,[]);
      partPhotoRows.get(k).push(r);photoById.get(String(r.photo_id)).partKeys.push(k);
    }
    for(const r of raw.vehicle_photos||[]){
      if(!r.vehicle_id||!photoById.has(String(r.photo_id)))continue;
      const id=String(r.vehicle_id);
      if(!vehiclePhotoRows.has(id))vehiclePhotoRows.set(id,[]);
      vehiclePhotoRows.get(id).push(r);photoById.get(String(r.photo_id)).vehicleIds.push(id);
    }

    const vehicleById=new Map(raw.vehicles.map(v=>[String(v.id),{
      id:String(v.id),
      type:text(v.type),
      family:text(v.family)
    }]));
    const depotByCode=new Map(raw.depots.map(d=>[String(d.code),{code:String(d.code),name:text(d.name)}]));
    const lineByCode=new Map(raw.lines.map(l=>[String(l.code),{code:String(l.code),alias:text(l.alias),name:text(l.name)}]));
    const shiftTypeByCode=new Map(raw.shift_types.map(t=>[String(t.code),{code:String(t.code),name:text(t.name)}]));

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
      if(!linesByPart.has(k))linesByPart.set(k,[]);
      linesByPart.get(k).push(row);
    }
    for(const rows of linesByPart.values())rows.sort((a,b)=>(a.seq??0)-(b.seq??0));

    const partsByDate=new Map();
    const partRows=raw.shift_parts.map(row=>{
      const partNo=String(row.part_no);
      const lineParts=linesByPart.get(key(row.shift_date,partNo))||[];
      const frontVehicle=row.front_vehicle?vehicleById.get(String(row.front_vehicle))||null:null;
      const rearVehicle=row.rear_vehicle?vehicleById.get(String(row.rear_vehicle))||null:null;
      const masterType=frontVehicle&&(!rearVehicle||rearVehicle.type===frontVehicle.type)?frontVehicle.type:null;
      return {
        shiftDate:row.shift_date,
        partNo,
        course:text(row.course),
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
        photos:linkedPhotos(partPhotoRows.get(key(row.shift_date,partNo)))
      };
    });
    for(const part of partRows){
      if(!partsByDate.has(part.shiftDate))partsByDate.set(part.shiftDate,[]);
      partsByDate.get(part.shiftDate).push(part);
    }
    for(const rows of partsByDate.values())rows.sort((a,b)=>Number(a.partNo)-Number(b.partNo));

    const shifts=raw.shifts.map(row=>({
      date:row.date,
      day:dayLabel(row.date),
      actualShift:text(row.shift_type),
      shiftType:row.shift_type?shiftTypeByCode.get(String(row.shift_type))||null:null,
      depot:text(row.depot),
      depotMeta:row.depot?depotByCode.get(String(row.depot))||null:null,
      splitSeq:num(row.split_seq),
      note:text(row.note),
      parts:partsByDate.get(row.date)||[],
      photos:linkedPhotos(shiftPhotoRows.get(row.date))
    })).sort((a,b)=>a.date.localeCompare(b.date));

    for(const shift of shifts)for(const part of shift.parts)part.depot=shift.depot;

    return {
      tables:{
        shifts:raw.shifts,
        shiftParts:partRows,
        shiftPartLines:lineRows,
        vehicles:[...vehicleById.values()],
        depots:[...depotByCode.values()],
        lines:[...lineByCode.values()],
        shiftTypes:[...shiftTypeByCode.values()],
        photos:[...photoById.values()],
        photoVariants:raw.photo_variants||[],shiftPhotos:raw.shift_photos||[],
        shiftPartPhotos:raw.shift_part_photos||[],vehiclePhotos:raw.vehicle_photos||[]
      },
      indexes:{vehicleById,depotByCode,lineByCode,shiftTypeByCode,linesByPart,photoById,vehiclePhotoRows},
      photosForVehicle(id){return linkedPhotos(vehiclePhotoRows.get(String(id)));},
      shifts,
      minDate:shifts[0]?.date||null,
      maxDate:shifts.at(-1)?.date||null
    };
  }

  async function load(options={}){
    if(loadPromise&&!options.force)return loadPromise;
    loadPromise=(async()=>{
      status.mode='loading';status.error=null;
      let raw=!options.force?readCache():null;
      if(!raw){
        const rows=await Promise.all(TABLES.map(fetchTable));
        raw=Object.fromEntries(TABLES.map((name,i)=>[name,rows[i]]));
        // A missing photo endpoint must not break the core shift and vehicle views.
        const photoResults=await Promise.allSettled(PHOTO_TABLES.map(name=>fetchTable(name,{timeoutMs:7000})));
        for(let i=0;i<PHOTO_TABLES.length;i++){
          raw[PHOTO_TABLES[i]]=photoResults[i].status==='fulfilled'?photoResults[i].value:[];
          if(photoResults[i].status==='rejected')console.warn('TramStats: photo table unavailable',PHOTO_TABLES[i],photoResults[i].reason);
        }
        writeCache(raw);
      }
      const db=normalize(raw);
      status.mode='live';status.loadedAt=new Date().toISOString();
      window.dispatchEvent(new CustomEvent('tramstats:data',{detail:db}));
      return db;
    })().catch(error=>{
      status.mode='error';status.error=String(error?.message||error);loadPromise=null;window.TramStatsShared?.footer();throw error;
    });
    return loadPromise;
  }

  window.TramStatsData={API_URL,TABLES,status,load,normalize,duration,num};
})();

