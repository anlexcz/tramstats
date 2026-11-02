(()=>{
'use strict';

const HIDDEN_OVERVIEW_LINES=new Set(['MJ','JP']);

function minutes(value){
  if(!value)return null;
  const [h,m]=String(value).split(':').map(Number);
  return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;
}

function blocks(shift){
  const parts=shift?.parts||[];
  const split=Number(shift?.splitSeq);
  if(shift?.actualShift==='Š'&&Number.isFinite(split)&&split>0){
    return [
      {key:'morning',parts:parts.filter(p=>Number(p.partNo)<=split)},
      {key:'afternoon',parts:parts.filter(p=>Number(p.partNo)>split)}
    ].filter(block=>block.parts.length);
  }
  return [{key:'main',parts}];
}

function blockRange(parts){
  let first=null,last=null;
  for(const part of parts||[]){
    if(!part.start||!part.end)continue;
    const startBase=minutes(part.start);
    let endBase=minutes(part.end);
    if(startBase==null||endBase==null)continue;
    const offset=(Number(part.startDayOffset)||0)*1440;
    const start=startBase+offset;
    let end=endBase+offset;
    if(end<start)end+=1440;
    if(first==null||start<first)first=start;
    if(last==null||end>last)last=end;
  }
  if(first==null||last==null||last<first)return null;
  return {start:first,end:last,duration:last-first};
}

function durationMinutes(shift){
  const ranges=blocks(shift).map(block=>blockRange(block.parts)).filter(Boolean);
  return ranges.length?ranges.reduce((sum,range)=>sum+range.duration,0):null;
}

function lineTokens(line){
  return String(line||'').split('+').map(x=>x.trim()).filter(Boolean);
}

function performanceRows(shift){
  const hasValue=value=>value!=null&&value!=='';
  return blocks(shift).map((block,index)=>{
    const badges=[];
    const seen=new Set();
    const courseBadges=new Map();
    let start='',end='';

    for(const part of block.parts){
      if(!start&&part.start)start=part.start;
      if(part.end)end=part.end;
      const line=String(part.line||'').trim();
      if(!line||HIDDEN_OVERVIEW_LINES.has(line))continue;

      if(line==='Z'){
        if(!seen.has('Z')){
          badges.push({key:'Z',kind:'special',code:'Z',lines:['Z'],label:'Záloha'});
          seen.add('Z');
        }
        continue;
      }
      if(line==='73'){
        if(!seen.has('73')){
          badges.push({key:'73',kind:'special',code:'73',lines:['73'],label:'Cvičná jízda'});
          seen.add('73');
        }
        continue;
      }

      if(hasValue(part.course)){
        const key=`course|${part.course}`;
        const tokens=lineTokens(line);
        let badge=courseBadges.get(key);
        if(!badge){
          badge={key,kind:'course',lines:[],course:part.course,order:null,label:''};
          courseBadges.set(key,badge);
          badges.push(badge);
        }
        for(const token of tokens)if(!badge.lines.includes(token))badge.lines.push(token);
        badge.label=`${badge.lines.join('+')}/${part.course}`;
        continue;
      }

      const order=part.order??'';
      const key=`order|${line}|${order}`;
      if(seen.has(key))continue;
      seen.add(key);
      badges.push({
        key,
        kind:'order',
        lines:lineTokens(line),
        order:hasValue(order)?order:null,
        course:null,
        label:hasValue(order)?`${line}/${order}`:line
      });
    }

    return {
      key:block.key||`block-${index+1}`,
      parts:block.parts,
      badges,
      start,
      end,
      interval:start&&end?`${start}–${end}`:''
    };
  }).filter(row=>row.badges.length||row.interval);
}

window.TramStatsShiftDomain={blocks,blockRange,durationMinutes,performanceRows};
})();
