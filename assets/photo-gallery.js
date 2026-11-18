'use strict';
(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=url=>{try{const p=new URL(url,document.baseURI||location.href);return ['https:','http:'].includes(p.protocol)?p.href:null;}catch{return null;}};
  const imageUrl=photo=>{
    const variant=(photo.variants||[]).find(v=>v.kind==='web')||(photo.variants||[]).find(v=>v.kind==='thumb');
    if(variant?.file){
      const url=safeUrl(variant.file);if(url)return url;
    }
    const fileId=String(photo.originalFile||'').match(/drive\.google\.com\/file\/d\/([\w-]+)/)?.[1];
    // Browser thumbnail is best-effort: a private Drive file may not load in a public website.
    return fileId?'https://drive.google.com/thumbnail?id='+encodeURIComponent(fileId)+'&sz=w720':null;
  };
  const normalize=photos=>{
    const seen=new Set();
    return (photos||[]).filter(p=>p?.id&&!seen.has(p.id)&&seen.add(p.id));
  };
  function markup(photos,{label='Fotografie',scope='photo'}={}){
    const items=normalize(photos);
    if(!items.length)return '';
    return '<section class="ts-photos data-panel panel-padded" aria-label="'+esc(label)+'">'+
      '<header class="ts-photos-head"><strong>'+esc(label)+'</strong><span>'+items.length+' '+(items.length===1?'fotografie':'fotografií')+'</span></header>'+
      '<div class="ts-photos-grid" tabindex="0" aria-label="Procházení fotografií">'+items.map((p,i)=>{
        const src=imageUrl(p),original=safeUrl(p.originalFile);
        const caption=p.takenAt?esc(p.takenAt.replace('T',' ')):'Čas neuveden';
        const title=esc(p.description||'Fotografie '+(i+1));
        return '<figure class="ts-photo-card" id="'+esc(scope+'-'+p.id.replace(/[^a-zA-Z0-9_-]/g,'_'))+'">'+
          (src?'<a href="'+esc(original||src)+'" target="_blank" rel="noopener noreferrer" class="ts-photo-frame" aria-label="Otevřít fotografii na Disku">'+
            '<img loading="lazy" decoding="async" src="'+esc(src)+'" alt="'+title+'" onerror="this.hidden=true;this.nextElementSibling.hidden=false">'+
            '<span class="ts-photo-unavailable" hidden>Náhled není dostupný<br>Otevřít na Disku</span></a>':
            '<a href="'+esc(original||'#')+'" target="_blank" rel="noopener noreferrer" class="ts-photo-frame ts-photo-unavailable">Otevřít na Disku</a>')+
          '<figcaption><span>'+caption+'</span>'+(p.description?'<small>'+title+'</small>':'')+'</figcaption></figure>';
      }).join('')+'</div>'+(items.length>1?'<div class="ts-photos-controls"><button type="button" class="ui-control" data-gallery-step="-1" aria-label="Předchozí fotografie">←</button><span class="ts-photos-counter" aria-live="polite">1 / '+items.length+'</span><button type="button" class="ui-control" data-gallery-step="1" aria-label="Další fotografie">→</button></div>':'')+'</section>';
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-gallery-step]');
    if(!button)return;
    const section=button.closest('.ts-photos');
    const track=section?.querySelector('.ts-photos-grid');
    const cards=[...(track?.querySelectorAll('.ts-photo-card')||[])];
    if(!cards.length)return;
    const current=Number(section.dataset.galleryIndex||0);
    const next=Math.min(cards.length-1,Math.max(0,current+Number(button.dataset.galleryStep)));
    section.dataset.galleryIndex=String(next);
    cards[next].scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    const counter=section.querySelector('.ts-photos-counter');
    if(counter)counter.textContent=(next+1)+' / '+cards.length;
  });
  function showPhoto(id){
    const node=document.getElementById(id);
    if(!node)return false;
    const section=node.closest('.ts-photos');
    const cards=[...(section?.querySelectorAll('.ts-photo-card')||[])];
    const index=cards.indexOf(node);
    if(index>=0){
      section.dataset.galleryIndex=String(index);
      const counter=section.querySelector('.ts-photos-counter');
      if(counter)counter.textContent=(index+1)+' / '+cards.length;
    }
    node.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    node.querySelector('a')?.focus({preventScroll:true});
    return true;
  }
  window.TramStatsPhotos={markup,imageUrl,showPhoto};
})();
