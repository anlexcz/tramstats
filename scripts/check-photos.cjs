#!/usr/bin/env node
'use strict';
// Audit photo snapshot against the files actually published with the site.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/photo-snapshot.js'),'utf8'),context);
const db=context.window.TramStatsPhotoSnapshot;
const ids=new Set(db.photos.map(p=>p.id));
const checks=['shift_photos','shift_part_photos','vehicle_photos'];
let errors=0;
for(const name of checks){
 const missing=db[name].filter(row=>!ids.has(row.photo_id));
 if(missing.length){console.error(name+': '+missing.length+' references to unknown photos');errors+=missing.length;}
}
const linked=new Set(db.shift_part_photos.map(x=>x.photo_id));
const withoutPart=db.photos.filter(x=>!linked.has(x.id));
if(withoutPart.length){console.error('Photos without part:',withoutPart.map(x=>x.id));errors+=withoutPart.length;}
const variants=db.photo_variants.filter(x=>x.file);
const missingFiles=variants.filter(v=>!fs.existsSync(path.join(root,v.file)));
if(missingFiles.length){console.error('Missing published variants:',missingFiles.map(x=>x.file));errors+=missingFiles.length;}
const withVariant=new Set(variants.filter(v=>fs.existsSync(path.join(root,v.file))).map(v=>v.photo_id));
console.log(JSON.stringify({photos:db.photos.length,shiftLinks:db.shift_photos.length,partLinks:db.shift_part_photos.length,vehicleLinks:db.vehicle_photos.length,publishedPhotos:withVariant.size,unpublishedPhotos:db.photos.length-withVariant.size,brokenReferences:errors},null,2));
process.exitCode=errors?1:0;
