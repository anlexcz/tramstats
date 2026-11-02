import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const read=file=>fs.readFileSync(new URL(file,root),'utf8');

const dataCode=read('assets/data.js');
const dataCtx=vm.createContext({window:{},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},fetch:async()=>{throw new Error('not used')},AbortController,Date,Set,Map,Number,String,Object,Math,JSON,Promise,setTimeout,clearTimeout});
vm.runInContext(dataCode,dataCtx);
const normalize=dataCtx.window.TramStatsData.normalize;
const raw={
  shifts:[{date:'2026-01-01',shift_type:'N',depot:'KO',split_seq:'',note:''}],
  shift_parts:[{shift_date:'2026-01-01',part_no:1,course:'109',order_no:'7',vehicle_type:'T3',front_vehicle:'8151',rear_vehicle:'8185',start_time:'23:00',end_time:'01:00',start_day_offset:0,km:'30',note:'Test'}],
  shift_part_lines:[{shift_date:'2026-01-01',part_no:1,seq:1,line:'6',km:'10'},{shift_date:'2026-01-01',part_no:1,seq:2,line:'34',km:'20'}],
  breaks:[{shift_date:'2026-01-01',break_no:1,start_time:'00:10',end_time:'00:40',start_day_offset:1,from_place:'A',to_place:'B',note:''}],
  vehicles:[{id:'8151',type:'T3R.P',family:'T3'},{id:'8185',type:'T3R.P',family:'T3'}],
  depots:[{code:'KO',name:'Kobylisy'}],
  lines:[{code:'6',alias:'',name:''},{code:'34',alias:'',name:''}],
  shift_types:[{code:'N',name:'Noční'}],
  shift_courses:[{shift_date:'2026-01-01',course:'109',is_snack:true}],
  tags:[{id:1,code:'training',name:'Zácvik'}],
  shift_part_tags:[{shift_date:'2026-01-01',part_no:1,tag_id:1}]
};
const db=normalize(raw);
assert.equal(db.shifts.length,1);
assert.equal(db.shifts[0].parts[0].line,'6+34');
assert.equal(db.shifts[0].parts[0].lineParts.map(x=>x.km).join(','),'10,20');
assert.equal(db.shifts[0].parts[0].isSnack,true);
assert.equal(db.shifts[0].parts[0].frontVehicleMeta.type,'T3R.P');
assert.equal(db.shifts[0].parts[0].tags[0].code,'training');
assert.equal(db.breaks[0].startDayOffset,1);
assert.equal(db.minDate,'2026-01-01');
assert.equal(db.maxDate,'2026-01-01');

const domainCtx=vm.createContext({window:{},Set,Map,Number,String,Object,Math});
vm.runInContext(read('assets/shift-domain.js'),domainCtx);
const domain=domainCtx.window.TramStatsShiftDomain;
const part=(partNo,start,end,line,{course=null,order=null,offset=0}={})=>({partNo:String(partNo),start,end,line,course,order,startDayOffset:offset});

const normal={actualShift:'R',splitSeq:null,parts:[part(1,'08:00','10:00','10',{course:'100'}),part(2,'10:30','12:00','10',{course:'100'})]};
assert.equal(domain.blocks(normal).length,1);
assert.equal(domain.durationMinutes(normal),240,'Běžná směna musí být rozsah bloku včetně mezery.');

const overnight={actualShift:'N',splitSeq:null,parts:[part(1,'23:00','01:00','10')]};
assert.equal(domain.durationMinutes(overnight),120,'Půlnoc musí být započítána jako následující den.');

const split={actualShift:'Š',splitSeq:2,parts:[part(1,'05:00','07:00','30',{course:'223'}),part(2,'07:20','09:00','30',{course:'223'}),part(3,'14:00','16:00','24',{course:'17'}),part(4,'16:30','18:00','24',{course:'17'})]};
assert.deepEqual(domain.blocks(split).map(x=>x.key),['morning','afternoon']);
assert.equal(domain.durationMinutes(split),480,'Šejdr musí sečíst rozsah ranního a odpoledního bloku bez dlouhé mezery.');

const incomplete={actualShift:'R',parts:[part(1,'08:00',null,'10'),part(2,'10:00','12:00','10')]};
assert.equal(domain.durationMinutes(incomplete),120,'Neúplná část se při délce ignoruje.');

const reserve={actualShift:'R',parts:[part(1,'06:00','07:00','Z'),part(2,'07:00','09:00','10',{order:'7'}),part(3,'09:00','10:00','Z')]};
const reserveRow=domain.performanceRows(reserve)[0];
assert.deepEqual(reserveRow.badges.map(x=>x.label),['Záloha','10/7']);
assert.equal(reserveRow.interval,'06:00–10:00');

const hidden={actualShift:'R',parts:[part(1,'05:00','06:00','MJ'),part(2,'06:00','10:00','16',{order:'12'}),part(3,'10:00','11:00','JP')]};
assert.deepEqual(domain.performanceRows(hidden)[0].badges.map(x=>x.label),['16/12'],'MJ a JP se v kompaktním přehledu nezobrazují.');

const multiLineCourse={actualShift:'R',parts:[part(1,'08:00','09:00','6',{course:'223'}),part(2,'09:00','10:00','34',{course:'223'})]};
assert.deepEqual(domain.performanceRows(multiLineCourse)[0].badges.map(x=>x.label),['6+34/223']);

let appCode=read('assets/app.js');
appCode+='\nglobalThis.api={groups,worked,stats,vehicleList,state};';
const appCtx=vm.createContext({Intl,Date,Set,Map,Number,String,Object,Math,JSON,console,window:{addEventListener(){}},document:{querySelector(){return null},querySelectorAll(){return[]}},location:{pathname:'/tramstats/stats/',hash:''}});
vm.runInContext(appCode,appCtx);
const {api}=appCtx;
const s=db.shifts[0];
api.state.shifts=[s];api.state.breaks=db.breaks;
const grouped=api.groups([s]);
assert.equal(grouped.lines['6'].km,10);
assert.equal(grouped.lines['34'].km,20);
assert.equal(grouped.lines['6'].count,1);
assert.equal(grouped.unresolved,0);
assert.equal(grouped.types['T3R.P'],30);
assert.equal(grouped.vehicles['8151'].km,30);
assert.equal(grouped.vehicles['8185'].count,1);
assert.equal(api.worked({actualShift:'V',parts:[]}),false);
assert.ok(api.stats([s]).includes('Rozsah každého roku'));
assert.ok(api.vehicleList([s]).includes('master tabulky vehicles'));

const runtimeFiles=['assets/data.js','assets/shift-domain.js','assets/app.js','assets/dashboard-v2.js','assets/footer-v2.js','assets/shifts-page.js','assets/shifts-date-range.js','index.html','shifts/index.html','stats/index.html','vehicles/index.html','shifts/detail/index.html'];
for(const file of runtimeFiles){
  assert.equal(fs.existsSync(new URL(file,root)),true,`Missing runtime file: ${file}`);
  const src=read(file);
  assert.doesNotMatch(src,/data\/manifest\.json/);
  assert.doesNotMatch(src,/shifts-(?:\d{4}|\$\{)/);
  assert.doesNotMatch(src,/kmFormula/);
  assert.doesNotMatch(src,/plannedShift/);
  if(file.endsWith('.js'))new Function(src);
}

const dashboardCode=read('assets/dashboard-v2.js');
assert.doesNotMatch(dashboardCode,/Záloha\(\?:\\s\|\$\)/,'Dashboard nesmí odvozovat zálohu z poznámky.');
assert.doesNotMatch(dashboardCode,/data-detail=/,'Dashboard nesmí používat legacy modal detail.');
assert.match(dashboardCode,/TramStatsShiftDomain/);
assert.match(dashboardCode,/durationMinutes/);

const shiftsCode=read('assets/shifts-page.js');
assert.match(shiftsCode,/TramStatsShiftDomain/);
assert.doesNotMatch(shiftsCode,/function shiftBlocks\(/,'Bloková logika nesmí být znovu implementovaná ve stránce Směny.');

const coreCode=read('assets/app.js');
assert.doesNotMatch(coreCode,/function timeline\(/);
assert.doesNotMatch(coreCode,/JSON\.stringify\(s\)/);
assert.doesNotMatch(coreCode,/function shiftHTML\(/);

const removedLegacyFiles=[
  'assets/live-source.js',
  'assets/shifts-v2.js','assets/shifts-v2.css',
  'assets/shifts-v3-controls.js','assets/shifts-v3-controls.css',
  'assets/shifts-v4-list.js','assets/shifts-v4-list.css',
  'assets/shifts-v5-layout.css',
  'assets/shifts-v6-date-range.js','assets/shifts-v6-date-range.css',
  'assets/shifts-polish.js','assets/shifts-polish.css'
];
for(const file of removedLegacyFiles)assert.equal(fs.existsSync(new URL(file,root)),false,`Legacy file still exists: ${file}`);

const overviewHtml=read('index.html'),shiftsHtml=read('shifts/index.html');
assert.match(overviewHtml,/assets\/shift-domain\.js/);
assert.match(shiftsHtml,/assets\/shift-domain\.js/);
assert.match(shiftsHtml,/assets\/shifts-page\.js/);
assert.match(shiftsHtml,/assets\/shifts-page\.css/);
assert.match(shiftsHtml,/assets\/shifts-date-range\.js/);
assert.doesNotMatch(shiftsHtml,/shifts-v\d|shifts-polish/);

console.log('PASS: relational data, shared shift domain, dashboard and unified shifts page');
