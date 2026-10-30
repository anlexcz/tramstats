import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);

// Core calculation tests. app.js is cut before browser event wiring so it can run in Node.
let code=fs.readFileSync(new URL('assets/app.js',root),'utf8');
code=code.slice(0,code.indexOf("window.addEventListener('hashchange'"));
code+='\nglobalThis.api={groups,range,worked,dashboard,shiftList,stats,vehicleList,state};';
const ctx=vm.createContext({Intl,Date,Set,Number,String,Object,Math,console});
vm.runInContext(code,ctx);const {api}=ctx;
const solo={partNo:'1',line:'6+34',km:30,kmFormula:'=10+20',frontVehicle:'8151',rearVehicle:'8185',vehicleType:'T3',start:'23:00',end:'01:00'};
const shifts=[{date:'2026-01-01',actualShift:'N',parts:[solo,{...solo,partNo:'2',start:'01:00',end:'02:00',km:15,kmFormula:null}]}];
const g=api.groups(shifts);
assert.equal(g.lines['6'].km,10);assert.equal(g.lines['34'].km,20);assert.equal(g.lines['6'].count,1);assert.equal(g.unresolved,15);assert.equal(g.types.T3,45);assert.equal(g.vehicles['8151'].km,45);assert.equal(g.vehicles['8185'].count,1);assert.equal(api.range(shifts[0]),180);assert.equal(api.worked({actualShift:'V',parts:[]}),false);

// Validate the complete exported data snapshot against manifest totals.
const manifest=JSON.parse(fs.readFileSync(new URL('data/manifest.json',root)));
let days=0,parts=0,bps=0;
for(const y of manifest.years){const ss=JSON.parse(fs.readFileSync(new URL('data/'+y.shifts,root))),bb=JSON.parse(fs.readFileSync(new URL('data/'+y.breaks,root)));assert.equal(new Set(ss.map(s=>s.date)).size,ss.length);assert.equal(ss.length,y.days);assert.equal(bb.length,y.breakCount);const ps=ss.flatMap(s=>s.parts);assert.equal(ps.length,y.parts);assert.ok(Math.abs(ps.reduce((n,p)=>n+(p.km??0),0)-y.km)<.001);api.state.shifts.push(...ss);api.state.breaks.push(...bb);days+=ss.length;parts+=ps.length;bps+=bb.length;}
for(const view of ['dashboard','shiftList','stats','vehicleList'])assert.ok(api[view](api.state.shifts).length>100);

// Compile every production JS asset. This catches syntax errors in the real override layers,
// not only in app.js as the original check did.
const productionJs=['assets/app.js','assets/shifts-v2.js','assets/shifts-v4-list.js','assets/shifts-v6-date-range.js','assets/dashboard-v2.js','assets/vehicle-icons.js','assets/footer-v2.js'];
for(const file of productionJs){const source=fs.readFileSync(new URL(file,root),'utf8');assert.doesNotThrow(()=>new vm.Script(source,{filename:file}),`${file} must parse`);}

// Every local JS/CSS reference used by a real page must exist. Query-string cache keys are ignored.
const pages=['index.html','shifts/index.html','shifts/detail/index.html','stats/index.html','vehicles/index.html'];
for(const page of pages){const html=fs.readFileSync(new URL(page,root),'utf8');for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){const ref=m[1].split('?')[0];if(!ref.startsWith('assets/'))continue;assert.ok(fs.existsSync(new URL(ref,root)),`${page}: missing ${ref}`);}}
const shiftsPage=fs.readFileSync(new URL('shifts/index.html',root),'utf8');
assert.ok(!shiftsPage.includes('shifts-v3-controls.js'),'removed v3 JS must not be referenced');

console.log(`PASS: calculations, data manifest, production JS syntax and page assets; ${days} days, ${parts} parts, ${bps} breaks`);
