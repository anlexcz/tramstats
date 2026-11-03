import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const read=file=>fs.readFileSync(new URL(file,root),'utf8');
const exists=file=>fs.existsSync(new URL(file,root));

const sharedCtx=vm.createContext({window:{addEventListener(){}},document:{querySelector(){return null}},location:{pathname:'/tramstats/'},Intl,Date,Number,Math});
vm.runInContext(read('assets/shared.js'),sharedCtx);
const shared=sharedCtx.window.TramStatsShared;
assert.equal(shared.metricText(shared.measure([null,null])),'—');
assert.equal(shared.metricText(shared.measure([0,0])),'0 km');
assert.equal(shared.metricText(shared.measure([12,null])),'≥ 12 km');
assert.equal(shared.metricText(shared.measure([null]),'time'),'—');
assert.equal(shared.metricText(shared.measure([60,null]),'time'),'≥ 1:00');
const dataCtx=vm.createContext({window:{},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},fetch:async()=>{throw new Error('not used')},AbortController,Date,Set,Map,Number,String,Object,Math,JSON,Promise,setTimeout,clearTimeout});
vm.runInContext(read('assets/data.js'),dataCtx);
const dataApi=dataCtx.window.TramStatsData;
assert.equal(dataApi.TABLES.join(','),'shifts,shift_parts,shift_part_lines,vehicles,depots,lines,shift_types');
const raw={
  shifts:[{date:'2026-01-01',shift_type:'N',depot:'KO',split_seq:'',note:''}],
  shift_parts:[{shift_date:'2026-01-01',part_no:1,course:'109',order_no:'7',vehicle_type:'T3',front_vehicle:'8151',rear_vehicle:'8185',start_time:'23:00',end_time:'01:00',start_day_offset:0,km:'30',note:'Test'}],
  shift_part_lines:[{shift_date:'2026-01-01',part_no:1,seq:1,line:'6',km:'10'},{shift_date:'2026-01-01',part_no:1,seq:2,line:'34',km:'20'}],
  vehicles:[{id:'8151',type:'T3R.P',family:'T3'},{id:'8185',type:'T3R.P',family:'T3'}],
  depots:[{code:'KO',name:'Kobylisy'}],
  lines:[{code:'6',alias:'',name:''},{code:'34',alias:'',name:''}],
  shift_types:[{code:'N',name:'Noční'}]
};
const db=dataApi.normalize(raw);
assert.equal(db.shifts[0].parts[0].line,'6+34');
assert.equal(db.shifts[0].parts[0].lineParts.map(x=>x.km).join(','),'10,20');
assert.equal(db.shifts[0].parts[0].frontVehicleMeta.type,'T3R.P');
assert.equal(db.minDate,'2026-01-01');
assert.equal(db.maxDate,'2026-01-01');

const domainCtx=vm.createContext({window:{},Set,Map,Number,String,Object,Math});
vm.runInContext(read('assets/shift-domain.js'),domainCtx);
const domain=domainCtx.window.TramStatsShiftDomain;
const part=(partNo,start,end,line,{course=null,order=null,offset=0}={})=>({partNo:String(partNo),start,end,line,course,order,startDayOffset:offset});
assert.equal(domain.durationMinutes({actualShift:'R',parts:[part(1,'08:00','10:00','10'),part(2,'10:30','12:00','10')]}),240);
assert.equal(domain.durationMinutes({actualShift:'N',parts:[part(1,'23:00','01:00','10')]}),120);
const split={actualShift:'Š',splitSeq:2,parts:[part(1,'05:00','07:00','30',{course:'223'}),part(2,'07:20','09:00','30',{course:'223'}),part(3,'14:00','16:00','24',{course:'17'}),part(4,'16:30','18:00','24',{course:'17'})]};
assert.equal(domain.blocks(split).map(x=>x.key).join(','),'morning,afternoon');
assert.equal(domain.durationMinutes(split),480);
assert.equal(domain.durationMinutes({actualShift:'R',parts:[part(1,'08:00',null,'10'),part(2,'10:00','12:00','10')]}),120);
const reserve={actualShift:'R',parts:[part(1,'06:00','07:00','Z'),part(2,'07:00','09:00','10',{order:'7'}),part(3,'09:00','10:00','Z')]};
assert.equal(domain.performanceRows(reserve)[0].badges.map(x=>x.label).join(','),'Záloha,10/7');
const hidden={actualShift:'R',parts:[part(1,'05:00','06:00','MJ'),part(2,'06:00','10:00','16',{order:'12'}),part(3,'10:00','11:00','JP')]};
assert.equal(domain.performanceRows(hidden)[0].badges.map(x=>x.label).join(','),'16/12');
const multiLineCourse={actualShift:'R',parts:[part(1,'08:00','09:00','6',{course:'223'}),part(2,'09:00','10:00','34',{course:'223'})]};
assert.equal(domain.performanceRows(multiLineCourse)[0].badges.map(x=>x.label).join(','),'6+34/223');

const vehicleCtx=vm.createContext({window:{TramStatsShared:shared},Date,Set,Map,Number,String,Object,Math,Array});
vm.runInContext(read('assets/vehicle-domain.js'),vehicleCtx);
const vehicleDomain=vehicleCtx.window.TramStatsVehicleDomain;
const vehicleRows=vehicleDomain.occurrences(db,'8151');
assert.equal(vehicleRows.length,1);
assert.equal(vehicleRows[0].performance,'6+34/7'); // Individual part uses order; compact grouped overview uses course.
assert.equal(vehicleDomain.summary([{km:null,duration:null}]).duration,null);
assert.equal(vehicleDomain.summary([{km:20,duration:60},{km:null,duration:null}]).kmMetric.complete,false);
assert.equal(vehicleRows[0].duration,120);
assert.equal(vehicleRows[0].km,30);
assert.equal(vehicleDomain.summary(vehicleRows).count,1);
assert.equal(vehicleDomain.summary(vehicleRows).km,30);
assert.equal(vehicleDomain.yearly(vehicleRows)[0].year,'2026');

let appCode=read('assets/app.js');
appCode+='\nglobalThis.api={groups,worked,sumKm,state};';
const appCtx=vm.createContext({Intl,Date,Set,Map,Number,String,Object,Math,JSON,console,sessionStorage:{getItem(){return null}},window:{TramStatsShared:shared,addEventListener(){}},document:{querySelector(){return null},addEventListener(){}},location:{pathname:'/tramstats/'}});
vm.runInContext(appCode,appCtx);
const {api}=appCtx;
const grouped=api.groups(db.shifts);
assert.equal(grouped.lines['6'].km,10);
assert.equal(grouped.lines['34'].km,20);
assert.equal(grouped.types['T3R.P'].km,30);
assert.equal(api.sumKm([{km:null}]),null);
assert.equal(api.groups([{parts:[{vehicleType:'14T',km:null,lineParts:[{line:'17',km:null}]}]}]).lines['17'].km,null);
assert.equal(Object.keys(grouped.vehicles).sort().join(','),'8151,8185');
assert.equal(api.sumKm(db.shifts[0].parts),30);
assert.equal(api.worked({actualShift:'V',parts:[]}),false);
assert.equal(api.worked({actualShift:'SD',parts:[{}]}),false);

const runtimeFiles=[
  'assets/data.js','assets/shift-domain.js','assets/vehicle-domain.js','assets/app.js','assets/dashboard-v2.js',
  'assets/shared.js','assets/shifts-page.js','assets/shifts-date-range.js','assets/shift-detail.js',
  'assets/vehicles-page.js','assets/vehicle-detail.js','assets/vehicle-links.js',
  'assets/app.css','assets/components.css','assets/dashboard-v2.css','assets/shifts-page.css','assets/shifts-date-range.css',
  'assets/shift-detail.css','assets/vehicles-page.css','assets/vehicle-detail.css','assets/vehicle-links.css',
  'index.html','shifts/index.html','vozy/index.html','404.html'
];
for(const file of runtimeFiles){
  assert.equal(exists(file),true,`Missing runtime file: ${file}`);
  if(file.endsWith('.js'))new Function(read(file));
}

const removedFiles=[
  'stats/index.html','vehicles/index.html','shifts/detail/index.html','assets/vehicle-icons.js',
  'assets/live-source.js','assets/shifts-v2.js','assets/shifts-v2.css',
  'assets/shifts-v3-controls.js','assets/shifts-v3-controls.css',
  'assets/shifts-v4-list.js','assets/shifts-v4-list.css',
  'assets/shifts-v5-layout.css','assets/shifts-v6-date-range.js','assets/shifts-v6-date-range.css',
  'assets/shifts-polish.js','assets/shifts-polish.css'
];
for(const file of removedFiles)assert.equal(exists(file),false,`Legacy file still exists: ${file}`);

const coreCode=read('assets/app.js');
assert.doesNotMatch(coreCode,/\bstats\b|detailHTML|partHTML|modal\(|showModal|vehicle-sort|stats\/|shifts\/detail\//);
assert.match(coreCode,/vehicles:'Vozy'/);
assert.match(read('assets/shared.js'),/vehicles','Vozy','vozy\//);
const dashboardCode=read('assets/dashboard-v2.js');
assert.match(dashboardCode,/TramStatsShiftDomain/);
assert.match(dashboardCode,/durationMinutes/);
assert.match(dashboardCode,/currentFrom=dayShift\(currentTo,-29\)/,'Aktuální dashboard okno musí mít 30 kalendářních dní.');
assert.match(dashboardCode,/previousTo=dayShift\(currentFrom,-1\)/,'Srovnávací období musí bez mezery předcházet aktuálnímu oknu.');
assert.match(dashboardCode,/previousFrom=dayShift\(previousTo,-29\)/,'Srovnávací dashboard okno musí mít také 30 dní.');
assert.doesNotMatch(dashboardCode,/percentage|percent|toFixed\([^)]*\).*%/i,'Trendová logika nemá používat procentní změny.');
const shiftsCode=read('assets/shifts-page.js');
assert.match(shiftsCode,/TramStatsShiftDomain/);
assert.doesNotMatch(shiftsCode,/shifts\/detail\/|RETURN_KEY|saveReturnState|tramstats-shifts-return-state|function shiftBlocks\(/);
const vehiclePageCode=read('assets/vehicles-page.js');
assert.match(vehiclePageCode,/TramStatsVehicleDomain/);
assert.match(vehiclePageCode,/vozy\/\$\{encodeURIComponent\(vehicle\.id\)\}/);
const vehicleDetailCode=read('assets/vehicle-detail.js');
assert.match(vehicleDetailCode,/TramStatsVehicleDomain/);
assert.match(vehicleDetailCode,/vehicle-history-year-start/);
assert.match(vehicleDetailCode,/První výskyt/);
assert.match(vehicleDetailCode,/Poslední výskyt/);
const shiftDetailCode=read('assets/shift-detail.js');
assert.match(shiftDetailCode,/vozy\/\$\{encodeURIComponent\(id\)\}/);
const dynamicRouter=read('404.html');
assert.ok(dynamicRouter.includes('smeny'));
assert.ok(dynamicRouter.includes('vozy'));




// The dedicated static detail must use the same shell/router as dynamic dates.
assert.equal(read('smeny/20261023/index.html'),read('404.html'));
for(const file of ['index.html','shifts/index.html','vozy/index.html','404.html']){
  assert.match(read(file),/assets\/shared.js/);
  assert.doesNotMatch(read(file),/footer-v2.js/);
}
// Exercise dashboard rendering rather than relying only on source patterns.
appCtx.window.TramStatsShiftDomain=domain;
appCtx.document.querySelectorAll=()=>[];
vm.runInContext(read('assets/dashboard-v2.js'),appCtx);
const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
const iso=[yesterday.getFullYear(),String(yesterday.getMonth()+1).padStart(2,'0'),String(yesterday.getDate()).padStart(2,'0')].join('-');
api.state.shifts=[{date:iso,actualShift:'R',parts:[{start:'06:00',end:'08:00',km:12,line:'17',lineParts:[{line:'17',km:12}]},{start:null,end:null,km:null,line:'17',lineParts:[{line:'17',km:null}]}]}];
const dashboardHTML=appCtx.window.dashboard();
assert.ok(dashboardHTML.includes('data-shift-date="'+iso+'"'));
assert.ok(dashboardHTML.includes('≥ 12 km'));
assert.ok(dashboardHTML.includes('Srovnání není úplné'));
assert.equal(domain.durationMetric({parts:[part(1,'08:00',null,'10'),part(2,'10:00','12:00','10')]}).complete,false);
console.log('PASS: unknown/partial metrics, dashboard links, shared shell');

// Save/restore real list state through the app lifecycle with a fresh context.
function listContext(path,saved=null){
  const memory=new Map(saved?[[`tramstats-list-v1:${path==='shifts'?'shifts':'vehicles'}`,JSON.stringify(saved)]]:[]);
  const handlers={};
  const ctx=vm.createContext({Intl,Date,Set,Map,Number,String,Object,Math,JSON,console,
    sessionStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
    window:{TramStatsShared:shared,scrollY:640,addEventListener:(name,fn)=>handlers[name]=fn},
    document:{querySelector(){return null},addEventListener(){}},location:{pathname:`/tramstats/${path==='shifts'?'shifts':'vozy'}/`}});
  vm.runInContext(appCode,ctx);
  return {ctx,memory,handlers};
}
const savedList=listContext('shifts',{values:{query:'9170',type:'Š',pageSize:50,visibleCount:100,workOnly:true},scroll:640});
assert.equal(savedList.ctx.api.state.query,'9170');
assert.equal(savedList.ctx.api.state.visibleCount,100);
savedList.handlers.pagehide();
assert.equal(JSON.parse(savedList.memory.get('tramstats-list-v1:shifts')).scroll,640);
const savedVehicles=listContext('vehicles',{values:{vehicleQuery:'9170',vehicleFamily:'14T',vehiclePeriod:'2022'},scroll:300});
assert.equal(savedVehicles.ctx.api.state.vehiclePeriod,'2022');
const invalidList=listContext('shifts',{values:{query:{bad:true},pageSize:-1,visibleCount:1e10},scroll:'bad'});
assert.equal(invalidList.ctx.api.state.query,'');
assert.equal(invalidList.ctx.api.state.pageSize,25);
console.log('PASS: list filters, paging and scroll persistence');

// Render both detail pages against data fixtures, including split and unknown values.
async function detailHTML(file,path,fixture){
  const root={innerHTML:''},status={textContent:''};
  const ctx=vm.createContext({Intl,Date,Set,Map,Number,String,Object,Math,Array,
    window:{TramStatsShared:shared,TramStatsShiftDomain:domain,TramStatsVehicleDomain:vehicleDomain,TramStatsData:{load:async()=>fixture}},
    document:{querySelector:selector=>selector==='#status'?status:root,addEventListener(){},title:''},location:{pathname:path}});
  vm.runInContext(read(file),ctx);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(status.textContent,'');
  return root.innerHTML;
}
const splitDB={...db,shifts:[{...split,date:'2026-01-01'}]};
const splitHTML=await detailHTML('assets/shift-detail.js','/tramstats/smeny/20260101/',splitDB);
assert.ok(splitHTML.includes('8:00'));
assert.ok(splitHTML.includes('Šejdrpauza'));
assert.ok(splitHTML.includes('Údaj není známý'));
const vehicleHTML=await detailHTML('assets/vehicle-detail.js','/tramstats/vozy/8151/',db);
assert.ok(vehicleHTML.includes('30 km'));
assert.ok(vehicleHTML.includes('6+34/7'));
console.log('PASS: shift and vehicle detail rendering');
