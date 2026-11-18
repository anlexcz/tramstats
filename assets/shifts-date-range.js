(()=>{
const MONTHS=['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
const DAYS=['Po','Út','St','Čt','Pá','So','Ne'];
let draftFrom='',draftTo='',viewDate=null,target='desktop';
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parse=s=>{if(!s)return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const fmtDate=s=>{const d=parse(s);return d?`${d.getDate()}. ${d.getMonth()+1}. ${d.getFullYear()}`:''};
function label(values=state){if(values.dateFrom&&values.dateTo&&values.dateFrom!==values.dateTo)return `${fmtDate(values.dateFrom)} – ${fmtDate(values.dateTo)}`;return fmtDate(values.dateFrom||values.dateTo)||'Libovolné datum / období';}
function pickerField(prefix='',values=state){return `<div class="range-filter"><span>DATUM</span><button type="button" class="range-field ui-control" aria-haspopup="dialog" aria-expanded="false" data-range-open="${prefix||'desktop'}"><span>${esc(label(values))}</span><b aria-hidden="true">▾</b></button></div>`;}
window.TramStatsDateRange={field:pickerField,label};
function sourceValues(){return target.startsWith('mobile-')&&window.TramStatsMobileFilterDraft?.get?window.TramStatsMobileFilterDraft.get():state;}
function monthHTML(){const y=viewDate.getFullYear(),m=viewDate.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();let cells='';for(let i=0;i<offset;i++)cells+='<span class="cal-empty"></span>';for(let d=1;d<=last;d++){const value=iso(new Date(y,m,d)),from=draftFrom,to=draftTo||draftFrom,inRange=from&&to&&value>=from&&value<=to;const cls=[value===draftFrom?'range-start':'',value===draftTo&&draftTo!==draftFrom?'range-end':'',inRange?'in-range':''].filter(Boolean).join(' ');cells+=`<button type="button" class="cal-day ${cls}" data-cal-date="${value}">${d}</button>`;}return `<div class="range-popover" role="dialog" aria-label="Výběr data"><div class="cal-head"><button type="button" data-cal-nav="-1" aria-label="Předchozí měsíc">‹</button><strong>${MONTHS[m].toUpperCase()} ${y}</strong><button type="button" data-cal-nav="1" aria-label="Další měsíc">›</button></div><div class="cal-week">${DAYS.map(x=>`<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div><div class="cal-actions"><button type="button" data-cal-clear>VYMAZAT</button><button type="button" data-cal-cancel>ZRUŠIT</button><button type="button" data-cal-ok>OK</button></div></div>`;}
function closePicker({restoreFocus=true}={}){
 const picker=document.querySelector('.range-popover');
 if(!picker)return;
 const field=picker.parentElement.querySelector('.range-field');
 picker.remove();
 field.setAttribute('aria-expanded','false');
 if(restoreFocus)field.focus();
}
function openPicker(button){
 const same=button.getAttribute('aria-expanded')==='true';
 closePicker({restoreFocus:false});
 if(same)return;
 target=button.dataset.rangeOpen||'desktop';
 const values=sourceValues();
 draftFrom=values.dateFrom||'';
 draftTo=values.dateTo||'';
 viewDate=parse(draftFrom)||parse(state.dataMaxDate)||new Date();
 button.setAttribute('aria-expanded','true');
 button.closest('.range-filter').insertAdjacentHTML('beforeend',monthHTML());
 const picker=document.querySelector('.range-popover');
 (picker.querySelector('.range-start')||picker.querySelector('.cal-day'))?.focus();
}
function refreshPicker(focus){
 const picker=document.querySelector('.range-popover');
 if(!picker)return;
 const field=picker.parentElement;
 picker.outerHTML=monthHTML();
 field.querySelector(focus)?.focus({preventScroll:true});
}
function apply(){
 const to=draftTo||draftFrom;
 if(target.startsWith('mobile-')&&window.TramStatsMobileFilterDraft?.setDates){
   window.TramStatsMobileFilterDraft.setDates(draftFrom,to);
   closePicker();
   return;
 }
 state.dateFrom=draftFrom;
 state.dateTo=to;
 state.visibleCount=state.pageSize||25;
 closePicker({restoreFocus:false});
 render();
 document.querySelector('.range-field[data-range-open="desktop"]')?.focus();
}
document.addEventListener('click',e=>{
 const open=e.target.closest('[data-range-open]');
 if(open){openPicker(open);return;}
 const nav=e.target.closest('[data-cal-nav]');
 if(nav){
   viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+Number(nav.dataset.calNav),1);
   refreshPicker('[data-cal-nav="'+nav.dataset.calNav+'"]');
   return;
 }
 const day=e.target.closest('[data-cal-date]');
 if(day){
   const value=day.dataset.calDate;
   if(!draftFrom||draftTo){draftFrom=value;draftTo='';}
   else if(value!==draftFrom){draftTo=value;if(draftTo<draftFrom)[draftFrom,draftTo]=[draftTo,draftFrom];}
   refreshPicker('[data-cal-date="'+value+'"]');
   return;
 }
 if(e.target.closest('[data-cal-ok]')){apply();return;}
 if(e.target.closest('[data-cal-clear]')){draftFrom='';draftTo='';apply();return;}
 if(e.target.closest('[data-cal-cancel]')){closePicker();return;}
 if(!e.target.closest('.range-popover'))closePicker({restoreFocus:false});
});
document.addEventListener('keydown',e=>{
 if(!document.querySelector('.range-popover')||e.key!=='Escape')return;
 e.preventDefault();
 e.stopImmediatePropagation();
 closePicker();
});
window.TramStatsDateRange.close=closePicker;
})();
