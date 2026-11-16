'use strict';
(()=>{
const SCOPE='https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const API='https://photospicker.googleapis.com/v1';
const CLIENT_KEY='tramstats-google-oauth-client-id';
const $=id=>document.getElementById(id);
let token='',expiresAt=0,client=null,clientId='',busy=false,session=null,authPending=null;
const message=t=>{$('picker-message').textContent=t};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const photoKey=date=>'tramstats-selected-photos-v1:'+date;
const selectedDate=()=>window.TramStatsPhotoReview?.selectedDate||'';
function selected(date){try{const a=JSON.parse(localStorage.getItem(photoKey(date))||'[]');return Array.isArray(a)?a:[]}catch{return []}}
function showSelected(){const date=selectedDate();$('picker-selected').textContent=date?selected(date).length+' položek přiřazených ke směně':'Nejdříve vyber směnu v tabulce.';updateButtons()}
function connected(){return Boolean(token&&Date.now()<expiresAt-60000)}
function updateButtons(){
 document.querySelectorAll('[data-pick]').forEach(button=>{button.disabled=busy});
 $('connect-google').disabled=busy;
 $('disconnect-google').hidden=!connected();
 $('connect-google').textContent=connected()?'Obnovit připojení':'Připojit Google Fotky';
 $('auth-state').textContent=connected()?'Google Fotky: připojeno':'Google Fotky: nepřipojeno';
}
async function api(path,options={}){
 if(!connected())throw Error('Přihlášení vypršelo. Připoj Google Fotky znovu.');
 const response=await fetch(API+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
 if(!response.ok)throw Error('Google Photos API '+response.status+': '+(await response.text()).slice(0,250));
 return response.status===204?{}:response.json();
}
function googleReady(){
 return new Promise((resolve,reject)=>{
  const start=Date.now();
  function tick(){
   if(window.google?.accounts?.oauth2)return resolve();
   if(Date.now()-start>10000)return reject(Error('Google přihlašovací knihovna se nenačetla. Zkontroluj blokátory a obnov stránku.'));
   setTimeout(tick,150);
  }
  tick();
 });
}
async function connect(){
 if(authPending)return authPending;
 const id=$('google-client-id').value.trim();
 if(!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('Vyplň platné OAuth Client ID v Nastavení.');
 await googleReady();
 clientId=id;
 client=window.google.accounts.oauth2.initTokenClient({
  client_id:id,scope:SCOPE,
  callback:reply=>{
   if(!authPending)return;
   const {resolve,reject}=authPending;authPending=null;
   if(reply.error||!reply.access_token){reject(Error(reply.error_description||reply.error||'Přihlášení nebylo dokončeno.'));return}
   token=reply.access_token;expiresAt=Date.now()+(Number(reply.expires_in)||3600)*1000;resolve();
  },
  error_callback:err=>{
   if(!authPending)return;const {reject}=authPending;authPending=null;
   reject(Error(err?.type==='popup_closed'?'Přihlašovací okno bylo zavřeno.':err?.type==='popup_failed_to_open'?'Prohlížeč zablokoval přihlašovací okno.':'Přihlášení Google selhalo: '+(err?.type||'neznámá chyba')));
  }
 });
 authPending={};
 const promise=new Promise((resolve,reject)=>{authPending={resolve,reject};});
 try{client.requestAccessToken({prompt:''});await Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Přihlášení neodpovědělo. Zkontroluj vyskakovací okno nebo blokování přihlášení.')),25000))]);}
 finally{authPending=null}
 localStorage.setItem(CLIENT_KEY,id);
 message('Google Fotky jsou připojené. Vyber směnu a klikni na Vybrat fotky.');
 updateButtons();
}
async function listItems(id){
 let next='',items=[],pages=0;
 do{
  const qs=new URLSearchParams({sessionId:id,pageSize:'100'});
  if(next)qs.set('pageToken',next);
  const data=await api('/mediaItems?'+qs.toString());
  items.push(...(data.mediaItems||[]));next=data.nextPageToken||'';
  if(++pages>100)throw Error('Výběr obsahuje příliš mnoho stránek.');
 }while(next);
 return items;
}
async function run(date){
 if(busy)return;
 date=date||selectedDate();
 if(!date){message('Nejdříve vyber směnu.');return}
 if(!connected()){message('Nejdříve klikni nahoře na Připojit Google Fotky.');return}
 const shift=window.TramStatsPhotoReview?.getShift(date);
 const range=shift?window.TramStatsPhotoReview.searchRange(shift):null;
 // Vyhledávací výraz zůstává na stránce a je dostupný ke kopírování.
 if(range){
  message('Pro datum '+date+(range.extra?' a následující den':'')+' vyhledej v Google Pickeru: '+range.query+'. Dotaz se pokusím zkopírovat do schránky.');
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(range.query).catch(()=>{});
 }
 busy=true;updateButtons();let popup=null;
 // Opening the window in the direct click handler avoids popup blockers.
 popup=window.open('about:blank','tramstats-photos-picker');
 try{
  message('Připravuji výběr…');
  session=await api('/sessions',{method:'POST',body:'{}'});
  if(!session.pickerUri)throw Error('Google nevrátil odkaz výběru.');
  if(popup)popup.location.href=session.pickerUri.replace(/\/$/,'')+'/autoclose';
  else{$('picker-link').href=session.pickerUri;$('picker-link').hidden=false}
  message('V Google Pickeru vyhledej '+(range?.query||date)+', vyber fotografie a potvrď. Datum nelze přednastavit automaticky.');
  const expires=Date.parse(session.expireTime)||Date.now()+15*60*1000;
  const timeoutSeconds=Number.parseFloat(session.pollingConfig?.timeoutIn)||0;
  let deadline=Math.min(expires,timeoutSeconds>0?Date.now()+timeoutSeconds*1000:expires);
  let info=session;
  while(!info.mediaItemsSet&&Date.now()<deadline){
   const interval=Math.max(1500,Math.min(15000,(Number.parseFloat(info.pollingConfig?.pollInterval)||3)*1000));
   await wait(interval);
   info=await api('/sessions/'+encodeURIComponent(session.id));
   const remaining=Number.parseFloat(info.pollingConfig?.timeoutIn);
   if(Number.isFinite(remaining)&&remaining>0)deadline=Math.min(expires,Date.now()+remaining*1000);
  }
  if(!info.mediaItemsSet)throw Error('Výběr vypršel nebo nebyl dokončen.');
  const items=(await listItems(session.id)).filter(p=>p.type==='PHOTO'||p.mediaFile?.mimeType?.startsWith('image/'));
  const map=new Map(selected(date).map(x=>[x.id,x]));
  for(const p of items)map.set(p.id,{
   id:p.id,filename:p.mediaFile?.filename||null,mimeType:p.mediaFile?.mimeType||null,
   createTime:p.mediaFile?.mediaFileMetadata?.creationTime||null,shiftDate:date
  });
  localStorage.setItem(photoKey(date),JSON.stringify([...map.values()]));
  if(items.length)window.TramStatsPhotoReview?.setStatus(date,'found');
  message('Vybráno '+items.length+' fotografií pro '+date+'. Metadata zůstávají v tomto prohlížeči; přenos obrázků na Disk zatím není hotový.');
  showSelected();
 }catch(err){if(popup&&!popup.closed)popup.close();message(err.message||String(err))}
 finally{
  const id=session?.id;session=null;
  if(id&&connected())api('/sessions/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{});
  busy=false;updateButtons();
 }
}
$('connect-google').addEventListener('click',async()=>{
 if(busy)return;busy=true;updateButtons();message('Připojuji účet Google…');
 try{await connect()}catch(err){message(err.message||String(err))}
 finally{busy=false;updateButtons()}
});
$('disconnect-google').addEventListener('click',()=>{
 // Disconnection drops the short-lived token locally; does not revoke other project permissions.
 token='';expiresAt=0;message('Google Fotky odpojeny v této záložce.');updateButtons();
});
window.TramStatsPhotoPicker={open:run};
$('toggle-settings').addEventListener('click',()=>{});
$('save-settings').addEventListener('click',()=>{
 const id=$('google-client-id').value.trim();
 if(!/^\d+-[\w-]+\.apps\.googleusercontent\.com$/.test(id)){message('Neplatné OAuth Client ID.');return}
 localStorage.setItem(CLIENT_KEY,id);
 if(clientId&&clientId!==id){token='';expiresAt=0}
 $('settings').hidden=true;message('Client ID uložené v prohlížeči.');updateButtons();
});
$('export-picked').addEventListener('click',()=>{
 const date=selectedDate();if(!date)return;
 window.TramStatsPhotoReview.download('tramstats-photos-'+date+'.json',{schema:'tramstats-picked-photos-v1',shiftDate:date,items:selected(date)});
});
document.addEventListener('tramstats:photo-shift-selected',showSelected);
document.addEventListener('tramstats:photo-shifts-ready',showSelected);
$('google-client-id').value=localStorage.getItem(CLIENT_KEY)||'';
updateButtons();showSelected();
})();