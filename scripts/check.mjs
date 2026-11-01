import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root=new URL('../',import.meta.url);
let code=fs.readFileSync(new URL('assets/app.js',root),'utf8');
code=code.slice(0,code.indexOf("window.addEventListener('hashchange'"));
code+='\nglobalThis.api={groups,range,worked,dashboard,shiftList,stats,vehicleList,state};';
const ctx=vm.createContext({Intl,Date,Set,Number,String,Object,Math,console});
vm.runInContext(code,ctx);
const {api}=ctx;

const part={partNo:'1',line:'6+34',km:30,kmFormula:'=10+20',frontVehicle:'8151',rearVehicle:'8185',vehicleType:'T3R.PV',start:'23:00',end:'01:00'};
const shifts=[{date:'2026-01-01',day:'Čt',actualShift:'N',depot:'KO',parts:[part,{...part,partNo:'2',start:'01:00',end:'02:00',km:15,kmFormula:null}]}];
const g=api.groups(shifts);
assert.equal(g.lines['6'].km,10);
assert.equal(g.lines['34'].km,20);
assert.equal(g.lines['6'].count,1);
assert.equal(g.unresolved,15);
assert.equal(g.types['T3R.PV'],45);
assert.equal(g.vehicles['8151'].km,45);
assert.equal(g.vehicles['8185'].count,1);
assert.equal(api.range(shifts[0]),180);
assert.equal(api.worked({actualShift:'V',parts:[]}),false);
api.state.shifts.push(...shifts);
for(const view of ['dashboard','shiftList','stats','vehicleList']) assert.ok(api[view](api.state.shifts).length>100);

const live=fs.readFileSync(new URL('assets/live-source.js',root),'utf8');
assert.match(live,/script\.google\.com\/macros\/s\//);
assert.match(live,/table\('shifts'\)/);
assert.match(live,/table\('shift_parts'\)/);
assert.match(live,/table\('shift_part_lines'\)/);
assert.match(live,/table\('breaks'\)/);
assert.match(live,/table\('vehicles'\)/);

console.log('PASS: frontend calculations and live Google Sheets data adapter');
