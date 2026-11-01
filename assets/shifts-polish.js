(()=>{
const homeIcon='<svg class="shift-metric-icon shift-home-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10M10 20v-6h4v6"/></svg>';
function shiftTypeLabel(s){return s?.shiftType?.name||s?.actualShift||'';}
function depotLabel(s){return s?.depotMeta?.name||s?.depot||'';}
function polishShiftCards(){
  document.querySelectorAll('.shift-link[data-shift-date]').forEach(card=>{
    const s=state.shifts.find(x=>x.date===card.dataset.shiftDate);if(!s)return;
    const type=shiftTypeLabel(s),depot=depotLabel(s);
    const desktopType=card.querySelector('.shift-summary-desktop .shift-ss');
    if(desktopType){desktopType.textContent=type;desktopType.title=s.actualShift||type;}
    const mobileType=card.querySelector('.shift-summary-mobile .shift-ss-inline');
    if(mobileType){mobileType.textContent=type;mobileType.title=s.actualShift||type;}
    const desktopDepot=card.querySelector('.shift-summary-desktop .shift-depot-v3');
    if(desktopDepot&&depot)desktopDepot.innerHTML=`${homeIcon}<span>${esc(depot)}</span>`;
    const mobileDepot=card.querySelector('.shift-summary-mobile .shift-depot-measure span');
    if(mobileDepot&&depot)mobileDepot.textContent=depot;
  });
  const filters=document.querySelector('#app>.filters'),count=document.querySelector('#shift-count');
  if(filters&&count&&count.parentElement!==filters)filters.append(count);
}
const baseRender=window.render;
if(typeof baseRender==='function')window.render=function(){baseRender();polishShiftCards();};
if(typeof state!=='undefined'&&state.shifts?.length)polishShiftCards();
})();
