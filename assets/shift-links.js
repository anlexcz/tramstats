(()=>{
'use strict';

function compactDateFromText(value){
  const match=String(value||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if(!match)return null;
  return `${match[3]}${String(match[2]).padStart(2,'0')}${String(match[1]).padStart(2,'0')}`;
}
function detailHref(card){
  const iso=card.dataset.shiftDate;
  if(/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return `smeny/${iso.replaceAll('-','')}/`;
  const compact=compactDateFromText(card.querySelector('.dash-date')?.textContent);
  return compact?`smeny/${compact}/`:null;
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
  const card=event.target.closest?.('.shift-detail-link');
  if(!card)return;
  event.preventDefault();
  openCard(card);
});

const observer=new MutationObserver(markCards);
observer.observe(document.documentElement,{subtree:true,childList:true});
markCards();
})();
