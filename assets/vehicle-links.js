(()=>{
'use strict';
function linkDashboardVehicles(){
  document.querySelectorAll('.dash-vehicle-item:not([data-vehicle-linked])').forEach(item=>{
    item.dataset.vehicleLinked='1';
    const text=item.textContent||'';
    const prefix=text.startsWith(', ')?', ':'';
    const ids=text.replace(/^,\s*/,'').split(/\s*\+\s*/).map(x=>x.trim()).filter(Boolean);
    if(!ids.length)return;
    item.textContent='';
    if(prefix)item.append(document.createTextNode(prefix));
    ids.forEach((id,index)=>{
      if(index)item.append(document.createTextNode(' + '));
      const a=document.createElement('a');
      a.href=`vozy/${encodeURIComponent(id)}/`;
      a.textContent=id;
      a.className='dash-vehicle-link';
      item.append(a);
    });
  });
}
const observer=new MutationObserver(linkDashboardVehicles);
observer.observe(document.documentElement,{subtree:true,childList:true});
linkDashboardVehicles();
})();