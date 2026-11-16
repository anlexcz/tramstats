'use strict';
(()=>{
 const SCOPE='https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
 const API='https://photospicker.googleapis.com/v1';
 const $=id=>document.getElementById(id);
 let token=null,client=null,session=null,busy=false;
 const msg=text=>{$('picker-message').textContent=text};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const photoKey=date=>'tramstats-selected-photos-v1:'+date;
 function selectedShift(){return $('photo-shift').value;}
 function refreshShiftOptions(){
  const current=selectedShift();
  const matching=window.TramStatsPhotoReview?.shifts||[];
  $('photo-shift').replaceChildren(...matching.map(s=>{const o=document.createElement('option');o.value=s.date;o.textContent=s.date;return o}));
  if(matching.some(s=>s.date===current))$('photo-shift').value=current;
  showSelection();
 }
 function showSelection(){
  const date=selectedShift(),stored=JSON.parse(localStorage.getItem(photoKey(date))||'[]');
  $('picker-selected').textContent=date?date+': '+stored.length+' vybraných položek v místní evidenci':'Nejdříve vyber směnu';
 }
 async function api(path,options={}){
  const response=await fetch(API+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
  if(!response.ok)throw Error('Google Photos API: '+response.status+' '+(await response.text()).slice(0,350));
  return response.status===204?{}:response.json();
 }
 async function authorize(){
  const id=$('google-client-id').value.trim();
  if(!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('Nejprve vyplň platné OAuth Client ID.');
  if(!window.google?.accounts?.oauth2)throw Error('Přihlašovací knihovna Google se nenačetla.');
  return new Promise((resolve,reject)=>{
   client=window.google.accounts.oauth2.initTokenClient({
    client_id:id,scope:SCOPE,
    callback:reply=>reply.error?reject(Error(reply.error)):((token=reply.access_token),resolve())
   });
   client.requestAccessToken({prompt:token?'':'consent'});
  });
 }
 async function listItems(id){
  const results=[];let next='';
  do{
   const qs=new URLSearchParams({sessionId:id,pageSize:'100'});
   if(next)qs.set('pageToken',next);
   const page=await api('/mediaItems?'+qs);
   results.push(...(page.mediaItems||[]));next=page.nextPageToken||'';
  }while(next);
  return results;
 }
 async function start(){
  if(busy)return;
  const date=selectedShift();
  if(!date){msg('Nejdříve vyber směnu.');return;}
  busy=true;$('open-picker').disabled=true;
  const win=window.open('about:blank','tramstats-google-photos-picker');
  try{
   msg('Přihlašování ke Google Fotkám…');
   await authorize();
   msg('Vytvářím výběr fotografií…');
   session=await api('/sessions',{method:'POST',body:'{}'});
   const uri=session.pickerUri;
   if(!uri)throw Error('Google nevrátil odkaz pro výběr fotografií.');
   if(win)win.location.href=uri+'/autoclose';
   if(!win){$('picker-link').href=uri;$('picker-link').hidden=false;msg('Prohlížeč zablokoval nové okno. Otevři odkaz ručně.');}
   else{msg('Vyber fotografie v otevřeném okně Google Fotek.');}
   const expires=Date.parse(session.expireTime||'')||Date.now()+15*60*1000;
   while(Date.now()<expires){
    const info=await api('/sessions/'+encodeURIComponent(session.id));
    if(info.mediaItemsSet)break;
    const interval=Math.max(1500,Math.min(15000,Number(info.pollingConfig?.pollInterval?.replace('s',''))*1000||3000));
    await wait(interval);
   }
   if(Date.now()>=expires)throw Error('Výběr vypršel, spusť ho znovu.');
   const items=await listItems(session.id);
   const photos=items.filter(p=>p.type==='PHOTO'||p.mediaFile?.mimeType?.startsWith('image/'));
   const old=JSON.parse(localStorage.getItem(photoKey(date))||'[]');
   const map=new Map(old.map(p=>[p.id,p]));
   for(const p of photos)map.set(p.id,{id:p.id,filename:p.mediaFile?.filename||null,mimeType:p.mediaFile?.mimeType||null,createTime:p.mediaFile?.mediaFileMetadata?.creationTime||null,shiftDate:date});
   localStorage.setItem(photoKey(date),JSON.stringify([...map.values()]));
   msg('Vybráno '+photos.length+' fotografií. Vazby jsou zatím uloženy pouze v prohlížeči, nikoli na Disku. Pro přenos originálů je potřeba doplnit ukládací službu.');
   showSelection();
  }catch(error){if(win&&!win.closed)win.close();msg(error.message||String(error))}
  finally{
   if(session?.id&&token){try{await api('/sessions/'+encodeURIComponent(session.id),{method:'DELETE'})}catch{}}
   session=null;busy=false;$('open-picker').disabled=false;
  }
 }
 $('open-picker').addEventListener('click',start);
 $('photo-shift').addEventListener('change',showSelection);
 $('export-picked').addEventListener('click',()=>{
  const date=selectedShift();if(!date)return;
  const items=JSON.parse(localStorage.getItem(photoKey(date))||'[]');
  const blob=new Blob([JSON.stringify({schema:'tramstats-picked-photos-v1',shiftDate:date,items},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tramstats-photos-'+date+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('google-client-id').value=localStorage.getItem('tramstats-google-oauth-client-id')||'';
 $('google-client-id').addEventListener('change',()=>localStorage.setItem('tramstats-google-oauth-client-id',$('google-client-id').value.trim()));
 document.addEventListener('tramstats:photo-shifts-ready',refreshShiftOptions);
})();