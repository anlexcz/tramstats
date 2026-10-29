(()=>{
const DRIVE='https://drive.google.com/thumbnail?sz=w512&id=';
const PNG={
 T3:DRIVE+'1TgZW-FlmAZcDcXIGOKzQ7qw_-c0Q88nt',
 T3_VINOVA:DRIVE+'12BPiQFlhcNQEh5-AuI_4JBSGoUj4bkr2',
 T3_DVC:DRIVE+'1DLmCexisXouAF2l3r8EDIzR33h6tdGih',
 KT:DRIVE+'1ZY2G0BnD-2ZVDMcOaWhzQMWwjrU93sG7',
 '14T':DRIVE+'1PxjkP-fhQnbknj8r3chsyMm1XWv-iMcj',
 '14T_PID':DRIVE+'1xIS7_6OryG_-NZ8XiXzHjufbAyJKKy_I',
 '15T':DRIVE+'1g5x7kAR3IzELVEs45RCJwlXggXgdM4ka',
 '15T_FACELIFT':DRIVE+'1eWFp3uI4bfWuctCfhqWYXjQ_sOq7_bKB',
 '52T':DRIVE+'1sQi4k-mh5pqyUfe6PuHlaF9IXHKWzIs9'
};
function typeFor(n){n=Number(n);if(n>=8000&&n<9000)return'T3';if(n>=9051&&n<=9100)return'KT';if(n>=9111&&n<=9199)return'14T';if(n>=9201&&n<=9325)return'15T';if(n>=9326&&n<9500)return'15T_FACELIFT';if(n>=9500)return'52T';return null}
function img(type,title){const src=PNG[type]||PNG[type?.replace('_FACELIFT','')]||PNG[type?.replace('_PID','')];return src?`<span class="tram-thumb" title="${title||type}"><img src="${src}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`:''}
function decorateSummaries(){document.querySelectorAll('.summary-vehicles:not([data-tram-icon])').forEach(el=>{const nums=el.textContent.match(/\d{4}/g)||[];if(!nums.length)return;const t=typeFor(nums[0]);if(!t||!PNG[t])return;el.dataset.tramIcon=t;el.insertAdjacentHTML('afterbegin',img(t,t.replace('_FACELIFT','')));});}
function decorateVehicles(){document.querySelectorAll('.vehicle:not([data-tram-icon])').forEach(el=>{const id=el.dataset.vehicle;const shown=(el.querySelector('.type')?.textContent||'').trim();let t=typeFor(id);if(/^52T/i.test(shown))t='52T';else if(/^15T/i.test(shown)&&t!=='15T_FACELIFT')t='15T';else if(/^14T/i.test(shown))t='14T';else if(/^KT/i.test(shown))t='KT';else if(/^T3/i.test(shown))t='T3';if(!t||!PNG[t])return;el.dataset.tramIcon=t;el.insertAdjacentHTML('afterbegin',img(t,shown||t));});}
function decorate(){decorateSummaries();decorateVehicles();}
new MutationObserver(decorate).observe(document.documentElement,{subtree:true,childList:true});decorate();
})();