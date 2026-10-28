import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
let code=fs.readFileSync(new URL('assets/app.js',root),'utf8');
code=code.slice(0,code.indexOf("window.addEventListener('hashchange'"));
code+='\nglobalThis.api={groups,range,worked,dashboard,shiftList,stats,vehicleList,state};';
const ctx=vm.createContext({Intl,Date,Set,Number,String,Object,Math,console});
vm.runInContext(code,ctx);const {api}=ctx;
const solo={partNo:'1',line:'6+34',km:30,kmFormula:'=10+20',frontVehicle:'8151',rearVehicle:'8185',vehicleType:'T3',start:'23:00',end:'01:00'};
const shifts=[{date:'2026-01-01',actualShift:'N',parts:[solo,{...solo,partNo:'2',start:'01:00',end:'02:00',km:15,kmFormula:null}]}];
const g=api.groups(shifts);
assert.equal(g.lines['6'].km,10);assert.equal(g.lines['34'].km,20);assert.equal(g.lines['6'].count,1);assert.equal(g.unresolved,15);assert.equal(g.types.T3,45);assert.equal(g.vehicles['8151'].km,45);assert.equal(g.vehicles['8185'].count,1);assert.equal(api.range(shifts[0]),180);assert.equal(api.worked({actualShift:'V',parts:[]}),false);
const manifest=JSON.parse(fs.readFileSync(new URL('data/manifest.json',root)));
let days=0,parts=0,bps=0;
for(const y of manifest.years){const ss=JSON.parse(fs.readFileSync(new URL('data/'+y.shifts,root))),bb=JSON.parse(fs.readFileSync(new URL('data/'+y.breaks,root)));assert.equal(new Set(ss.map(s=>s.date)).size,ss.length);assert.equal(ss.length,y.days);assert.equal(bb.length,y.breakCount);const ps=ss.flatMap(s=>s.parts);assert.equal(ps.length,y.parts);assert.ok(Math.abs(ps.reduce((n,p)=>n+(p.km??0),0)-y.km)<.001);api.state.shifts.push(...ss);api.state.breaks.push(...bb);days+=ss.length;parts+=ps.length;bps+=bb.length;}
for(const view of ['dashboard','shiftList','stats','vehicleList'])assert.ok(api[view](api.state.shifts).length>100);
console.log(`PASS: formula allocation, unique usage, consist km, midnight timeline, all four renderers; ${days} days, ${parts} parts, ${bps} breaks`);
