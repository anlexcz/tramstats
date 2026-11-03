(()=>{
'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:1}).format(value);
const hm=value=>`${Math.floor(value/60)}:${String(Math.round(value%60)).padStart(2,'0')}`;
function measure(values){
  const known=values.filter(value=>typeof value==='number'&&Number.isFinite(value));
  return {value:known.length?known.reduce((a,b)=>a+b,0):null,complete:values.length>0&&known.length===values.length,known:known.length,total:values.length};
}
function metricText(metric,kind='km'){
  if(metric.value==null)return '—';
  return `${metric.complete?'':'≥ '}${kind==='time'?hm(metric.value):fmt(metric.value)+' km'}`;
}
function metricHTML(metric,kind='km'){
  const title=metric.value==null?'Údaj není známý':metric.complete?'':'Neúplné údaje: zobrazený součet je nejméně tato hodnota';
  return `<output role="presentation" class="metric-value"${title?` title="${title}"`:''}>${metricText(metric,kind)}</output>`;
}
function route(){
  const path=location.pathname;
  return /\/shifts\/?$|\/smeny\/\d{8}\/?$/.test(path)?'shifts':/\/vozy(?:\/[^/]+)?\/?$/.test(path)?'vehicles':'overview';
}
const icons={overview:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',shifts:'<rect x="3" y="5" width="18" height="16"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',vehicles:'<rect x="6" y="3" width="12" height="16" rx="2"/><path d="M6 11h12M9 19l-2 3M15 19l2 3M9 15h.01M15 15h.01"/>'};
const pages=[['overview','Přehled','./'],['shifts','Směny','shifts/'],['vehicles','Vozy','vozy/']];
function mount(){
  const header=document.querySelector('header');
  if(header)header.innerHTML='<a class="brand" href="./">TRAMSTATS</a><nav id="desktop-nav" aria-label="Hlavní navigace"></nav><span class="sandbox">OSOBNÍ EVIDENCE <b> / SANDBOX</b></span>';
  for(const id of ['desktop-nav','mobile-nav']){
    const node=document.querySelector('#'+id);if(!node)continue;
    node.innerHTML=pages.map(([key,label,url])=>`<a href="${url}" aria-label="${label}" title="${label}" ${route()===key?'class="active" aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[key]}</svg>${id==='desktop-nav'?`<span>${label}</span>`:''}</a>`).join('');
  }
  footer();
}
function footer(db){
  const node=document.querySelector('#footer');if(!node)return;
  const date=value=>new Date(value+'T12:00:00').toLocaleDateString('cs-CZ');
  const range=db?.minDate&&db?.maxDate?`${date(db.minDate)} – ${date(db.maxDate)}`:'';
  const source=db?'Živá data z TramStats – databáze':window.TramStatsData?.status.mode==='error'?'Databáze momentálně nedostupná':'Načítám evidenci…';
  node.innerHTML=`<div class="site-footer"><div class="footer-brand"><strong>TRAMSTATS</strong><span>Osobní evidence tramvajových směn, vozů a kilometrů.</span></div><div class="footer-meta"><span>ANLEX / TRAMVAJOVÁNÍ</span><span>${source}</span>${range?`<span>${esc(range)}</span>`:''}<a href="https://github.com/anlexcz/tramstats" target="_blank" rel="noopener">GitHub ↗</a></div><div class="footer-note">Zdroj pravdy: Google Sheets · web je pouze pro čtení · ≥ označuje neúplný součet · — neznámý údaj</div></div>`;
}
window.TramStatsShared={measure,metricText,metricHTML,mount,footer};
window.addEventListener('tramstats:data',event=>footer(event.detail));
mount();
})();
