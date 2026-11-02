import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const read=file=>fs.readFileSync(new URL(file,root),'utf8');
const exists=file=>fs.existsSync(new URL(file,root));

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

let appCode=read('assets/app.js');
appCode+='\nglobalThis.api={groups,worked,sumKm,state};';
const appCtx=vm.createContext({Intl,Date,Set,Map,Number,String,Object,Math,JSON,console,window:{},document:{querySelector(){return null}},location:{pathname:'/tramstats/'}});
vm.runInContext(appCode,appCtx);
const {api}=appCtx;
const grouped=api.groups(db.shifts);
assert.equal(grouped.lines['6'].km,10);
assert.equal(grouped.lines['34'].km,20);
assert.equal(grouped.types['T3R.P'],30);
assert.equal(Object.keys(grouped.vehicles).sort().join(','),'8151,8185');
assert.equal(api.sumKm(db.shifts[0].parts),30);
assert.equal(api.worked({actualShift:'V',parts:[]}),false);

const runtimeFiles=[
  'assets/data.js','assets/shift-domain.js','assets/app.js','assets/dashboard-v2.js',
  'assets/footer-v2.js','assets/shifts-page.js','assets/shifts-date-range.js',
  'assets/app.css','assets/components.css','assets/dashboard-v2.css','assets/shifts-page.css','assets/shifts-date-range.css',
  'index.html','shifts/index.html'
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
assert.doesNotMatch(coreCode,/\bstats\b|vehicleList|detailHTML|partHTML|modal\(|showModal|data-vehicle|vehicle-sort|vehicle-search|stats\/|vehicles\/|shifts\/detail\//);
const dashboardCode=read('assets/dashboard-v2.js');
assert.match(dashboardCode,/TramStatsShiftDomain/);
assert.match(dashboardCode,/durationMinutes/);
assert.match(dashboardCode,/currentFrom=dayShift\(currentTo,-29\)/,'Aktuální dashboard okno musí mít 30 kalendářních dní.');
assert.match(dashboardCode,/previousTo=dayShift\(currentFrom,-1\)/,'Srovnávací období musí bez mezery předcházet aktuálnímu oknu.');
assert.match(dashboardCode,/previousFrom=dayShift\(previousTo,-29\)/,'Srovnávací dashboard okno musí mít také 30 dní.');
assert.match(dashboardCode,/kpiTrend\(current\.km,previous\.km/);
assert.match(dashboardCode,/kpiTrend\(current\.duration,previous\.duration/);
assert.match(dashboardCode,/dash-mini-trend/);
assert.match(dashboardCode,/signedNumber/);
assert.match(dashboardCode,/signedTime/);
assert.doesNotMatch(dashboardCode,/percentage|percent|toFixed\([^)]*\).*%/i,'Trendová logika nemá používat procentní změny.');
assert.doesNotMatch(dashboardCode,/stats\/|vehicles\/|shifts\/detail\/|data-detail=/);
const dashboardCss=read('assets/dashboard-v2.css');
assert.match(dashboardCss,/\.dash-trend\.up.*var\(--cyan\)/s);
assert.match(dashboardCss,/\.dash-trend\.down.*var\(--red\)/s);
assert.match(dashboardCss,/\.dash-mini-trend/);
assert.match(dashboardCss,/@media\(max-width:650px\)/);
const shiftsCode=read('assets/shifts-page.js');
assert.match(shiftsCode,/TramStatsShiftDomain/);
assert.doesNotMatch(shiftsCode,/shifts\/detail\/|RETURN_KEY|saveReturnState|tramstats-shifts-return-state|function shiftBlocks\(/);
const sharedCss=read('assets/app.css');
assert.doesNotMatch(sharedCss,/\.grid\b|\.panel\b|\.chart-columns\b|\.vehicle\b|\.shift\b|\.part\b|\.bp\b|dialog\b|\.badge\b|\.line\b/);
const componentsCss=read('assets/components.css');
assert.doesNotMatch(componentsCss,/tram-thumb|vehicle|detail-|\.part\b|\.bp\b/);
for(const file of ['index.html','shifts/index.html']){
  const html=read(file);
  assert.doesNotMatch(html,/vehicle-icons|<dialog|stats\/|vehicles\/|shifts\/detail\//);
}

console.log('PASS: clean TramStats baseline — dashboard trends + shifts');
