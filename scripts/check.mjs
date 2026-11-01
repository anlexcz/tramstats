import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
const dataCode=fs.readFileSync(new URL('assets/data.js',root),'utf8');
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

let appCode=fs.readFileSync(new URL('assets/app.js',root),'utf8');
appCode=appCode.slice(0,appCode.indexOf('async function boot()'));
appCode+='\nglobalThis.api={groups,range,worked,stats,vehicleList,state};';
const appCtx=vm.createContext({Intl,Date,Set,Map,Number,String,Object,Math,JSON,console,window:{},document:{querySelector(){return null}}});
vm.runInContext(appCode,appCtx);
const {api}=appCtx;
const s=db.shifts[0];
api.state.shifts=[s];api.state.breaks=db.breaks;
const g=api.groups([s]);
assert.equal(g.lines['6'].km,10);
assert.equal(g.lines['34'].km,20);
assert.equal(g.lines['6'].count,1);
assert.equal(g.unresolved,0);
assert.equal(g.types['T3R.P'],30);
assert.equal(g.vehicles['8151'].km,30);
assert.equal(g.vehicles['8185'].count,1);
assert.equal(api.range(s),120);
assert.equal(api.worked({actualShift:'V',parts:[]}),false);
assert.ok(api.stats([s]).includes('Rozsah každého roku'));
assert.ok(api.vehicleList([s]).includes('master tabulky vehicles'));

const runtimeFiles=['assets/data.js','assets/app.js','assets/footer-v2.js','assets/shifts-page.js','assets/shifts-date-range.js','index.html','shifts/index.html','stats/index.html','vehicles/index.html','shifts/detail/index.html'];
for(const file of runtimeFiles){
  assert.equal(fs.existsSync(new URL(file,root)),true,`Missing runtime file: ${file}`);
  const src=fs.readFileSync(new URL(file,root),'utf8');
  assert.doesNotMatch(src,/data\/manifest\.json/);
  assert.doesNotMatch(src,/shifts-(?:\d{4}|\$\{)/);
  assert.doesNotMatch(src,/kmFormula/);
  assert.doesNotMatch(src,/plannedShift/);
  if(file.endsWith('.js'))new Function(src);
}

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

const shiftsHtml=fs.readFileSync(new URL('shifts/index.html',root),'utf8');
assert.match(shiftsHtml,/assets\/shifts-page\.js/);
assert.match(shiftsHtml,/assets\/shifts-page\.css/);
assert.match(shiftsHtml,/assets\/shifts-date-range\.js/);
assert.doesNotMatch(shiftsHtml,/shifts-v\d|shifts-polish/);

console.log('PASS: relational TramStats frontend and unified shifts page');
