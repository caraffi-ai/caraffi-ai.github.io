(()=>{
'use strict';

const $=q=>document.querySelector(q);
const $$=q=>[...document.querySelectorAll(q)];
const numberFrom=s=>Number(String(s||'').replace(/[^0-9.-]/g,''))||0;
const fmt=n=>Math.round(Number(n)||0).toLocaleString();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function initials(name){
  const words=String(name||'DD').trim().split(/\s+/).filter(Boolean);
  if(!words.length)return'DD';
  if(words.length===1)return words[0].slice(0,2).toUpperCase();
  return (words[0][0]+words[words.length-1][0]).toUpperCase();
}

function enhanceRace(){
  const board=$('#raceTrack');
  if(!board||board.dataset.raceV2==='1')return;
  const rows=$$('#raceTrack .racer');
  if(!rows.length)return;
  board.dataset.raceV2='1';
  board.classList.add('raceBoard');

  rows.forEach(r=>{
    const rank=Number(r.dataset.rank)||12;
    const power=Number(r.dataset.power)||0;
    const name=r.querySelector('.rname b')?.textContent?.trim()||`Team ${rank}`;
    const target=clamp(18+74*(power/100),18,92);
    r.dataset.target=target.toFixed(2);
    r.classList.add(`race-place-${rank}`);
    r.innerHTML=`
      <div class="rname">
        <span class="raceRank">#${rank}</span>
        <b>${name}</b>
        <small>${power.toFixed(1)} PWR</small>
      </div>
      <div class="raceLane">
        <span class="laneStart">START</span>
        <span class="finishLine" aria-hidden="true"></span>
        <span class="raceMarker" title="${name}">
          <span class="raceInitials">${initials(name)}</span>
          <small>#${rank}</small>
        </span>
        <b class="finishLabel"></b>
      </div>`;
  });

  const oldBtn=$('#raceBtn');
  if(!oldBtn)return;
  const btn=oldBtn.cloneNode(true);
  oldBtn.replaceWith(btn);
  btn.textContent='🏁 Run the Race';
  btn.addEventListener('click',()=>runRaceV2(btn));
}

function runRaceV2(btn){
  const rows=$$('#raceTrack .racer');
  btn.disabled=true;
  btn.textContent='🏎️ Racing…';
  rows.forEach(r=>{
    r.classList.remove('winner','finished');
    const marker=r.querySelector('.raceMarker');
    const label=r.querySelector('.finishLabel');
    if(marker)marker.style.left='3%';
    if(label)label.textContent='';
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    [...rows].sort((a,b)=>Number(b.dataset.rank)-Number(a.dataset.rank)).forEach((r,i)=>{
      setTimeout(()=>{
        const marker=r.querySelector('.raceMarker');
        const label=r.querySelector('.finishLabel');
        if(marker)marker.style.left=`${r.dataset.target}%`;
        r.classList.add('finished');
        if(Number(r.dataset.rank)===1)r.classList.add('winner');
        if(label)label.textContent=Number(r.dataset.rank)<=3?['','🥇','🥈','🥉'][Number(r.dataset.rank)]:`#${r.dataset.rank}`;
      },i*55);
    });
    setTimeout(()=>{
      btn.disabled=false;
      btn.textContent='↻ Race Again';
    },1900);
  }));
}

function tradeDate(article){
  const txt=article.querySelector(':scope > .line .muted.small')?.textContent?.trim();
  if(!txt)return null;
  const d=new Date(txt);
  return Number.isNaN(d.getTime())?null:d;
}

function enhanceThenNow(){
  $$('#trades .tradeAudit').forEach(article=>{
    if(article.dataset.thenNowV2==='1')return;
    const when=tradeDate(article);
    const ageDays=when?Math.max(0,(Date.now()-when.getTime())/86400000):Infinity;

    article.querySelectorAll('.tradeTeam').forEach(team=>{
      const thenBadge=[...team.querySelectorAll(':scope > .line .badge')].find(x=>/^Then:/i.test(x.textContent.trim()));
      if(!thenBadge)return;
      const received=[...team.querySelectorAll('.ledger')].find(x=>x.querySelector('h4')?.textContent.trim().toUpperCase()==='RECEIVED');
      const total=received?.querySelector('.total');
      if(!total||/Priced today\*/i.test(total.textContent))return;

      const thenVal=numberFrom(thenBadge.textContent);
      const nowVal=numberFrom(total.textContent);
      if(!thenVal||!nowVal)return;
      const diff=nowVal-thenVal;
      const pct=Math.abs(diff)/Math.max(thenVal,1);
      const effectivelySame=(ageDays<=3&&pct<0.05)||pct<0.01||Math.abs(diff)<35;

      thenBadge.classList.add('thenNowBadge');
      if(effectivelySame){
        thenBadge.textContent=`Then = Now: ${fmt(nowVal)}`;
        thenBadge.classList.add('same');
        thenBadge.title=`Historical source value ${fmt(thenVal)}; current ${fmt(nowVal)}. Collapsed because the movement is not meaningful.`;
        total.innerHTML=`Priced today: ${fmt(nowVal)} <span class="flatMove">UNCHANGED</span>`;
      }else{
        const arrow=diff>0?'▲':'▼';
        const sign=diff>0?'+':'';
        thenBadge.textContent=`Then ${fmt(thenVal)} → Now ${fmt(nowVal)}`;
        thenBadge.classList.add(diff>0?'up':'down');
        thenBadge.title=`${arrow} ${sign}${fmt(diff)} (${sign}${(diff/thenVal*100).toFixed(1)}%) since the trade snapshot`;
      }
    });
    article.dataset.thenNowV2='1';
  });
}

function apply(){
  enhanceRace();
  enhanceThenNow();
}

const observer=new MutationObserver(apply);
observer.observe(document.documentElement,{childList:true,subtree:true});
apply();
})();