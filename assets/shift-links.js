(()=>{
'use strict';

function detailHref(card){
  const iso=card.dataset.shiftDate;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso||'')?`smeny/${iso.replaceAll('-','')}/`:null;
}
function markCards(){
  document.querySelectorAll('.shift-list-work[data-shift-date], .dash-shift').forEach(card=>{
    const href=detailHref(card);
    if(!href)return;
    card.dataset.detailHref=href;
    card.classList.add('shift-detail-link');
    card.style.cursor='pointer';
    card.setAttribute('role','link');
    if(!card.hasAttribute('tabindex'))card.tabIndex=0;
    card.setAttribute('aria-label',card.getAttribute('aria-label')||'Otevřít detail směny');
  });
}
function openCard(card){
  const href=card?.dataset?.detailHref;
  if(href)location.href=href;
}
document.addEventListener('click',event=>{
  if(event.target.closest('a,button,input,select,label'))return;
  const card=event.target.closest('.shift-detail-link');
  if(card)openCard(card);
});
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  if(event.target.closest('a,button,input,select'))return;
  const card=event.target.closest?.('.shift-detail-link');
  if(!card)return;
  event.preventDefault();
  openCard(card);
});

const observer=new MutationObserver(markCards);
observer.observe(document.documentElement,{subtree:true,childList:true});
markCards();
})();

