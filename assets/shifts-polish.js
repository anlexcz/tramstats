(()=>{
const homeIcon='<svg class="shift-metric-icon shift-home-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10M10 20v-6h4v6"/></svg>';
const shiftIcon='<svg class="shift-metric-icon shift-type-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="1"/><path d="M8 8h8M8 12h5M8 16h3"/></svg>';
function shiftTypeLabel(s){return s?.shiftType?.name||s?.actualShift||'';}
function depotLabel(s){return s?.depotMeta?.name||s?.depot||'';}
function polishShiftCards(){
  document.querySelectorAll('.shift-link[data-shift-date]').forEach(card=>{
    const s=state.shifts.find(x=>x.date===card.dataset.shiftDate);if(!s)return;
    const type=shiftTypeLabel(s),depot=depotLabel(s);

    const desktopType=card.querySelector('.shift-summary-desktop .shift-ss');
    if(desktopType){desktopType.textContent=type;desktopType.title=s.actualShift||type;}
    const desktopDepot=card.querySelector('.shift-summary-desktop .shift-depot-v3');
    if(desktopDepot&&depot)desktopDepot.innerHTML=`${homeIcon}<span>${esc(depot)}</span>`;

    const mobile=card.querySelector('.shift-summary-mobile');
    const mobileType=mobile?.querySelector('.shift-ss-inline');
    const mobileMeasures=mobile?.querySelector('.shift-measures');
    if(mobileType&&mobileMeasures){
      mobileType.classList.add('shift-type-measure');
      mobileType.innerHTML=`${shiftIcon}<span>${esc(type)}</span>`;
      mobileType.title=s.actualShift||type;
      mobileMeasures.prepend(mobileType);
    }
    const mobileDepot=mobile?.querySelector('.shift-depot-measure span');
    if(mobileDepot&&depot)mobileDepot.textContent=depot;
  });

  const filters=document.querySelector('#app>.filters'),count=document.querySelector('#shift-count');
  if(filters&&count&&count.parentElement!==filters)filters.append(count);
}
const baseRender=window.render;
if(typeof baseRender==='function')window.render=function(){baseRender();polishShiftCards();};
if(typeof state!=='undefined'&&state.shifts?.length)polishShiftCards();
})();
