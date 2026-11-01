'use strict';
(function(){
  const nativeFetch=window.fetch.bind(window);
  let configPromise=null;
  let databasePromise=null;
  const state={mode:'static',error:null,apiUrl:null};
  window.TramStatsLiveSource=state;

  const num=value=>{
    if(value==null||value==='') return null;
    const n=Number(String(value).replace(',','.'));
    return Number.isFinite(n)?n:null;
  };
  const dayLabel=iso=>{
    const d=new Date(iso+'T12:00:00');
    return ['Ne','Po','Út','St','Čt','Pá','So'][d.getDay()]||null;
  };
  const duration=(start,end,offset=0)=>{
    if(!start||!end) return null;
    const toMin=t=>{const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
    let a=toMin(start),b=toMin(end);
    if(a==null||b==null) return null;
    a+=Number(offset||0)*1440;
    b+=Number(offset||0)*1440;
    if(b<a) b+=1440;
    const m=b-a;
    return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`;
  };
  const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

  async function config(){
    if(!configPromise) configPromise=nativeFetch('data/api-config.json?v=live-source-1',{cache:'no-store',signal:AbortSignal.timeout(10000)})
      .then(r=>{if(!r.ok) throw Error(`api-config ${r.status}`);return r.json();})
      .catch(()=>({apiUrl:''}));
    return configPromise;
  }

  async function table(apiUrl,name){
    const sep=apiUrl.includes('?')?'&':'?';
    const r=await nativeFetch(`${apiUrl}${sep}table=${encodeURIComponent(name)}&_=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!r.ok) throw Error(`${name}: HTTP ${r.status}`);
    const data=await r.json();
    if(!data||data.ok!==true||!Array.isArray(data.rows)) throw Error(`${name}: neplatná odpověď API`);
    return data.rows;
  }

  async function database(){
    if(databasePromise) return databasePromise;
    databasePromise=(async()=>{
      const cfg=await config();
      const apiUrl=String(cfg.apiUrl||'').trim();
      if(!apiUrl) throw Error('API URL není nastavené');
      state.apiUrl=apiUrl;
      const [shiftsRaw,partsRaw,linesRaw,breaksRaw,vehiclesRaw]=await Promise.all([
        table(apiUrl,'shifts'),table(apiUrl,'shift_parts'),table(apiUrl,'shift_part_lines'),table(apiUrl,'breaks'),table(apiUrl,'vehicles')
      ]);

      const vehicleById=new Map(vehiclesRaw.map(v=>[String(v.id),v]));
      const linesByPart=new Map();
      for(const row of linesRaw){
        const key=`${row.shift_date}|${row.part_no}`;
        if(!linesByPart.has(key)) linesByPart.set(key,[]);
        linesByPart.get(key).push(row);
      }
      for(const rows of linesByPart.values()) rows.sort((a,b)=>Number(a.seq||0)-Number(b.seq||0));

      const partsByDate=new Map();
      for(const p of partsRaw){
        const key=`${p.shift_date}|${p.part_no}`;
        const lr=linesByPart.get(key)||[];
        const line=lr.map(x=>x.line).filter(Boolean).join('+')||null;
        const lineKm=lr.map(x=>num(x.km));
        const hasExactSplit=lr.length>1&&lineKm.every(x=>x!=null);
        const masterFront=p.front_vehicle?vehicleById.get(String(p.front_vehicle)):null;
        const masterRear=p.rear_vehicle?vehicleById.get(String(p.rear_vehicle)):null;
        let vehicleType=p.vehicle_type||null;
        if(masterFront&&(!masterRear||masterRear.type===masterFront.type)) vehicleType=masterFront.type||vehicleType;
        const item={
          partNo:p.part_no==null?null:String(p.part_no),
          depot:null,
          course:p.course||null,
          line,
          order:p.order_no||null,
          vehicleType,
          frontVehicle:p.front_vehicle||null,
          rearVehicle:p.rear_vehicle||null,
          start:p.start_time||null,
          end:p.end_time||null,
          startDayOffset:Number(p.start_day_offset||0),
          duration:duration(p.start_time,p.end_time,p.start_day_offset),
          km:num(p.km),
          kmFormula:hasExactSplit?'='+lineKm.join('+'):null,
          note:p.note||null,
          lineParts:lr.map(x=>({line:x.line,km:num(x.km)}))
        };
        if(!partsByDate.has(p.shift_date)) partsByDate.set(p.shift_date,[]);
        partsByDate.get(p.shift_date).push(item);
      }
      for(const rows of partsByDate.values()) rows.sort((a,b)=>Number(a.partNo||0)-Number(b.partNo||0));

      const shifts=shiftsRaw.map(s=>{
        const ps=partsByDate.get(s.date)||[];
        for(const p of ps) p.depot=s.depot||null;
        return {
          date:s.date,
          day:dayLabel(s.date),
          plannedShift:null,
          actualShift:s.shift_type||null,
          depot:s.depot||null,
          splitSeq:s.split_seq===''||s.split_seq==null?null:Number(s.split_seq),
          note:s.note||null,
          parts:ps
        };
      }).sort((a,b)=>a.date.localeCompare(b.date));

      const breaks=breaksRaw.map(b=>({
        date:b.shift_date,
        breakNo:b.break_no==null?null:String(b.break_no),
        start:b.start_time||null,
        end:b.end_time||null,
        startDayOffset:Number(b.start_day_offset||0),
        duration:duration(b.start_time,b.end_time,b.start_day_offset),
        fromPlace:b.from_place||null,
        toPlace:b.to_place||null,
        note:b.note||null
      }));

      const years=[...new Set(shifts.map(s=>Number(String(s.date).slice(0,4))))].filter(Number.isFinite).sort((a,b)=>a-b);
      const byYear={};
      for(const y of years) byYear[y]={shifts:shifts.filter(s=>s.date.startsWith(String(y))),breaks:breaks.filter(b=>b.date.startsWith(String(y)))};
      state.mode='live'; state.error=null;
      return {years,byYear,shifts,breaks,vehicles:vehiclesRaw};
    })().catch(err=>{state.mode='static';state.error=String(err.message||err);databasePromise=null;throw err;});
    return databasePromise;
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const clean=url.split('?')[0];
    if(/(?:^|\/)data\/manifest\.json$/.test(clean)){
      const cfg=await config();
      if(!String(cfg.apiUrl||'').trim()) return nativeFetch(input,init);
      try{
        const db=await database();
        return response({schemaVersion:2,source:'TramStats – databáze / Google Sheets',live:true,years:db.years.map(year=>({year,shifts:`live-shifts-${year}.json`,breaks:`live-breaks-${year}.json`,days:db.byYear[year].shifts.length,parts:db.byYear[year].shifts.reduce((n,s)=>n+s.parts.length,0),breakCount:db.byYear[year].breaks.length}))});
      }catch(e){console.warn('TramStats live API unavailable, using static snapshot:',e);return nativeFetch(input,init);}
    }
    let m=clean.match(/(?:^|\/)data\/live-shifts-(\d{4})\.json$/);
    if(m){try{return response((await database()).byYear[Number(m[1])]?.shifts||[]);}catch(e){return response([]);}}
    m=clean.match(/(?:^|\/)data\/live-breaks-(\d{4})\.json$/);
    if(m){try{return response((await database()).byYear[Number(m[1])]?.breaks||[]);}catch(e){return response([]);}}
    return nativeFetch(input,init);
  };
})();
