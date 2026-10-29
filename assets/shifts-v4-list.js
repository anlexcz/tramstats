(()=>{
state.visibleCount=state.pageSize||25;
const oldShiftHTML=shiftHTML;
function linkedShiftHTML(s){
  const html=oldShiftHTML(s);
  const m=html.match(/^<details class="([^"]+)"><summary>([\s\S]*?)<\/summary><div class="parts">[\s\S]*<\/div><\/details>$/);
  if(!m)return html;
  return `<a class="shift shift-v2 shift-link ${m[1].replace(/^shift\s+shift-v2\s*/, '')}" href="shifts/detail/?date=${encodeURIComponent(s.date)}" data-shift-date="${esc(s.date)}">${m[2]}</a>`;
}
shiftHTML=linkedShiftHTML;
function listCountText(shown,total){return `Zobrazeno ${shown} z ${total} evidovaných dnů`;}
function shiftListV4(ss){
  const list=filtered(ss),batch=state.pageSize||25;
  state.visibleCount=Math.max(batch,Math.min(state.visibleCount||batch,list.length||batch));
  const shown=Math.min(state.visibleCount,list.length),active=[state.type,state.depot,state.dateFrom,state.dateTo,state.workOnly].filter(Boolean).length;
  const types=[...new Set(ss.map(s=>s.actualShift).filter(Boolean))].sort(),depots=[...new Set(ss.map(s=>s.depot).filter(Boolean))].sort();
  const controls=(prefix='')=>{const id=x=>prefix+x;return `<label>TYP SMĚNY<select id="${id('shift-type')}" aria-label="Typ směny"><option value="">Všechny typy směn</option>${options(types,state.type)}</select></label><label>VOZOVNA<select id="${id('depot')}" aria-label="Vozovna"><option value="">Všechny vozovny</option>${options(depots,state.depot)}</select></label><div class="date-filter"><span>DATUM</span><div><label>OD<input id="${id('date-from')}" type="date" value="${esc(state.dateFrom)}"></label><label>DO<input id="${id('date-to')}" type="date" value="${esc(state.dateTo)}"></label></div></div><label class="work-only"><input id="${id('work-only')}" type="checkbox" ${state.workOnly?'checked':''}><span>Jen pracovní záznamy</span></label><div class="page-size-wrap"><span>NAČÍTAT PO</span><div class="page-size" role="group" aria-label="Počet načítaných směn">${[25,50,100,200].map(n=>`<button type="button" data-page-size="${n}" class="${state.pageSize===n?'active':''}">${n}</button>`).join('')}</div></div>`};
  return `<div class="filters smart-filters"><div class="smart-search"><span class="search-icon">⌕</span><input id="search" type="search" placeholder="KO 15T, 3 9118, 95/64, 25.4.…" aria-label="Hledat ve směnách" value="${esc(state.query)}"><button type="button" id="mobile-filter-open" aria-label="Otevřít filtry">FILTRY<span class="filter-count">${active||''}</span></button></div>${searchChips()}<div class="desktop-filter-controls">${controls()}<button type="button" class="clear-filters">ZRUŠIT FILTRY</button></div><div class="mobile-filter-sheet" aria-hidden="true"><button type="button" class="sheet-backdrop" aria-label="Zavřít filtry"></button><div class="sheet-panel"><div class="sheet-head"><strong>FILTRY</strong><button type="button" class="sheet-close">×</button></div>${controls('mobile-')}<button type="button" class="clear-filters">ZRUŠIT FILTRY</button><button type="button" class="sheet-done">ZOBRAZIT ${list.length} SMĚN</button></div></div></div><div class="count" id="shift-count">${listCountText(shown,list.length)}</div><div id="shift-results">${list.slice(0,shown).map(shiftHTML).join('')||'<div class="empty">Žádný odpovídající záznam.</div>'}</div>${shown<list.length?`<div class="load-more-wrap"><button type="button" id="load-more">NAČÍST DALŠÍCH ${Math.min(batch,list.length-shown)}</button><span>${shown} / ${list.length}</span></div>`:''}`;
}
shiftList=shiftListV4;
function resetVisible(){state.visibleCount=state.pageSize||25;}
document.addEventListener('input',e=>{if(e.target.id==='search')resetVisible();},true);
document.addEventListener('change',e=>{if(['shift-type','depot','mobile-shift-type','mobile-depot','date-from','date-to','mobile-date-from','mobile-date-to','work-only','mobile-work-only'].includes(e.target.id))resetVisible();},true);
document.addEventListener('click',e=>{
  const size=e.target.closest('[data-page-size]');if(size)state.visibleCount=Number(size.dataset.pageSize);
  if(e.target.closest('.clear-filters'))resetVisible();
  const more=e.target.closest('#load-more');if(more){e.preventDefault();const list=filtered(state.shifts),old=Math.min(state.visibleCount,list.length),batch=state.pageSize||25,next=Math.min(old+batch,list.length),box=document.querySelector('#shift-results');box.insertAdjacentHTML('beforeend',list.slice(old,next).map(shiftHTML).join(''));state.visibleCount=next;box.querySelectorAll('.shift-link').forEach((el,i)=>{if(i>=old){el.classList.add('shift-enter');requestAnimationFrame(()=>el.classList.add('shift-enter-active'));}});const count=document.querySelector('#shift-count');if(count)count.textContent=listCountText(next,list.length);const wrap=more.closest('.load-more-wrap');if(next>=list.length)wrap.remove();else{more.textContent=`NAČÍST DALŠÍCH ${Math.min(batch,list.length-next)}`;wrap.querySelector('span').textContent=`${next} / ${list.length}`;}return;}
  const link=e.target.closest('.shift-link');if(link){sessionStorage.setItem('tramstats-shifts-scroll',String(window.scrollY));sessionStorage.setItem('tramstats-shifts-visible',String(state.visibleCount));}
});
const savedVisible=Number(sessionStorage.getItem('tramstats-shifts-visible'));if(savedVisible>0)state.visibleCount=savedVisible;
window.addEventListener('load',()=>{const y=Number(sessionStorage.getItem('tramstats-shifts-scroll'));if(y>0){requestAnimationFrame(()=>window.scrollTo({top:y,behavior:'instant'}));sessionStorage.removeItem('tramstats-shifts-scroll');}});
})();