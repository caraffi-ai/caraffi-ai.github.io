(()=>{
'use strict';

const $=q=>document.querySelector(q);
const $$=q=>[...document.querySelectorAll(q)];
const numberFrom=s=>Number(String(s||'').replace(/[^0-9.-]/g,''))||0;
const fmt=n=>Math.round(Number(n)||0).toLocaleString();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let raceFrame=null;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function initials(name){
  const words=String(name||'DD').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean);
  if(!words.length)return'DD';
  if(words.length===1)return words[0].slice(0,2).toUpperCase();
  return (words[0][0]+words[words.length-1][0]).toUpperCase();
}
function ordinal(n){return n===1?'1ST':n===2?'2ND':n===3?'3RD':`${n}TH`;}

function enhanceRace(){
  const oldBoard=$('#raceTrack');
  if(!oldBoard||oldBoard.dataset.raceV3==='1')return;
  const raw=$$('#raceTrack .racer').map(r=>({
    rank:Number(r.dataset.rank)||12,
    power:Number(r.dataset.power)||0,
    name:r.querySelector('.rname b')?.textContent?.trim()||`Team ${r.dataset.rank||''}`
  })).sort((a,b)=>a.rank-b.rank);
  if(!raw.length)return;

  const card=oldBoard.closest('.raceCard');
  const desc=card?.querySelector('.raceHeader p');
  if(desc)desc.textContent='Power rankings become field position. Run the dynasty drive, follow every franchise through the course, and click a team to spotlight it.';
  const title=card?.querySelector('.raceHeader h2');
  if(title)title.textContent='The DAWG Dynasty Drive';

  const board=document.createElement('div');
  board.id='raceTrack';
  board.className='raceStadium';
  board.dataset.raceV3='1';
  board.innerHTML=`
    <div class="stadiumTop">
      <div class="scoreBug"><span>DAWG DYNASTY</span><b id="raceStatus">PRE-RACE</b></div>
      <div class="driveLegend"><span><i></i> Dynasty course</span><span>🏈 Click a franchise</span></div>
    </div>
    <div class="fieldWrap">
      <div class="fieldStage" id="fieldStage">
        <div class="endzone endzoneLeft"><span>START</span></div>
        <div class="endzone endzoneRight"><span>DYNASTY<br>CHAMP</span></div>
        <div class="yardLines" aria-hidden="true">${[10,20,30,40,50,60,70,80,90].map((x,i)=>`<span style="left:${x}%"><b>${i<5?(i+1)*10:(9-i)*10}</b></span>`).join('')}</div>
        <div class="midLogo" aria-hidden="true"><strong>DD</strong><small>50</small></div>
        <svg class="courseSvg" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-label="Curving dynasty race course across a football field">
          <path class="courseShadow" d="M72 442 C180 468 246 420 246 340 C246 272 310 248 390 272 C482 300 530 260 522 198 C514 136 574 103 650 129 C736 158 790 116 810 72 C828 34 878 34 934 62"/>
          <path class="courseLine" id="dynastyCourse" d="M72 442 C180 468 246 420 246 340 C246 272 310 248 390 272 C482 300 530 260 522 198 C514 136 574 103 650 129 C736 158 790 116 810 72 C828 34 878 34 934 62"/>
          <path class="courseDash" d="M72 442 C180 468 246 420 246 340 C246 272 310 248 390 272 C482 300 530 260 522 198 C514 136 574 103 650 129 C736 158 790 116 810 72 C828 34 878 34 934 62"/>
        </svg>
        <div class="checkpoint cp1">OWN 20</div><div class="checkpoint cp2">MIDFIELD</div><div class="checkpoint cp3">RED ZONE</div>
        <div id="raceTokens">${raw.map(t=>`<button type="button" class="fieldToken" data-rank="${t.rank}" data-power="${t.power.toFixed(2)}" data-name="${esc(t.name)}" aria-label="${esc(t.name)}, rank ${t.rank}, power ${t.power.toFixed(1)}"><span class="footballIcon">${initials(t.name)}</span><small>#${t.rank}</small></button>`).join('')}</div>
        <div class="spotlight" id="raceSpotlight"><span>SELECT A FRANCHISE</span><b>Click any football to inspect the drive</b></div>
      </div>
      <aside class="raceLeaderboard">
        <div class="leaderHead"><span>LIVE BOARD</span><small>POWER</small></div>
        <div id="raceLeaders">${raw.map(t=>`<button type="button" class="leaderRow" data-rank="${t.rank}"><span class="place">${t.rank<=3?['🥇','🥈','🥉'][t.rank-1]:'#'+t.rank}</span><b>${esc(t.name)}</b><em>${t.power.toFixed(1)}</em></button>`).join('')}</div>
      </aside>
    </div>
    <div class="raceTicker"><span id="raceCall">Kickoff ready. Rankings determine how far each franchise drives downfield.</span></div>`;
  oldBoard.replaceWith(board);

  const oldBtn=$('#raceBtn');
  if(oldBtn){
    const btn=oldBtn.cloneNode(true);
    oldBtn.replaceWith(btn);
    btn.textContent='🏈 Run Dynasty Drive';
    btn.addEventListener('click',()=>runRaceV3(btn));
  }

  $$('#raceTrack .fieldToken, #raceTrack .leaderRow').forEach(el=>el.addEventListener('click',()=>spotlightTeam(Number(el.dataset.rank))));
  layoutTokens(0);
}

function pointAtProgress(progress,rank){
  const path=$('#dynastyCourse'),stage=$('#fieldStage');
  if(!path||!stage)return{x:0,y:0};
  const len=path.getTotalLength();
  const p=path.getPointAtLength(len*clamp(progress,0,1));
  const offset=((rank%2?1:-1)*Math.ceil(rank/2))*2.7;
  return{x:p.x/1000*100,y:(p.y+offset)/520*100};
}

function setTokenPosition(token,progress){
  const rank=Number(token.dataset.rank)||12;
  const p=pointAtProgress(progress,rank);
  token.style.left=`${p.x}%`;
  token.style.top=`${p.y}%`;
  token.dataset.progress=String(progress);
}

function layoutTokens(progressMode='target'){
  $$('#raceTrack .fieldToken').forEach(t=>{
    const power=Number(t.dataset.power)||0;
    const target=clamp(.08+.89*(power/100),.08,.97);
    t.dataset.target=target.toFixed(4);
    setTokenPosition(t,progressMode===0?0:target);
  });
}

function runRaceV3(btn){
  if(raceFrame)cancelAnimationFrame(raceFrame);
  const tokens=$$('#raceTrack .fieldToken');
  const status=$('#raceStatus'),call=$('#raceCall');
  tokens.forEach(t=>{t.classList.remove('selected','champ');setTokenPosition(t,0);});
  $$('#raceTrack .leaderRow').forEach(x=>x.classList.remove('selected'));
  if(status)status.textContent='LIVE';
  if(call)call.textContent='🏈 Kickoff! The league is on the move…';
  btn.disabled=true;btn.textContent='🏃 Drive in Progress';

  const start=performance.now(),duration=3300;
  const ease=x=>1-Math.pow(1-x,3);
  function frame(now){
    const raw=clamp((now-start)/duration,0,1),e=ease(raw);
    tokens.forEach(t=>{
      const target=Number(t.dataset.target)||0;
      const rank=Number(t.dataset.rank)||12;
      const wobble=Math.sin(raw*9+rank)*.012*(1-raw);
      setTokenPosition(t,clamp(target*e+wobble,0,target));
    });
    if(raw<1){
      if(call){
        if(raw>.76)call.textContent='🔥 Red zone! The contenders are separating from the pack…';
        else if(raw>.45)call.textContent='⚡ Midfield scramble — dynasty depth is starting to show.';
        else if(raw>.18)call.textContent='📈 First cut: win-now strength and young cores push teams forward.';
      }
      raceFrame=requestAnimationFrame(frame);
    }else{
      finishRace(btn);
    }
  }
  raceFrame=requestAnimationFrame(frame);
}

function finishRace(btn){
  raceFrame=null;
  const champ=$('#raceTrack .fieldToken[data-rank="1"]');
  if(champ)champ.classList.add('champ');
  const status=$('#raceStatus'),call=$('#raceCall');
  if(status)status.textContent='FINAL';
  if(call){const name=champ?.dataset.name||'The #1 franchise';call.textContent=`🏆 ${name} leads the Dynasty Drive. Click any team to see its field position.`;}
  btn.disabled=false;btn.textContent='↻ Run It Again';
  spotlightTeam(1);
}

function spotlightTeam(rank){
  const token=$(`#raceTrack .fieldToken[data-rank="${rank}"]`);
  const row=$(`#raceTrack .leaderRow[data-rank="${rank}"]`);
  if(!token)return;
  $$('#raceTrack .fieldToken,#raceTrack .leaderRow').forEach(x=>x.classList.remove('selected'));
  token.classList.add('selected');if(row)row.classList.add('selected');
  const box=$('#raceSpotlight'),power=Number(token.dataset.power)||0,target=Number(token.dataset.target)||0;
  const zone=target>=.88?'GOAL LINE':target>=.68?'RED ZONE':target>=.48?'MIDFIELD':target>=.28?'OWN TERRITORY':'BACKED UP';
  if(box)box.innerHTML=`<span>${ordinal(rank)} • ${zone}</span><b>${esc(token.dataset.name)}</b><small>${power.toFixed(1)} power score • dynasty field position ${(target*100).toFixed(0)}%</small>`;
}

function tradeDate(article){
  const txt=article.querySelector(':scope > .line .muted.small')?.textContent?.trim();
  if(!txt)return null;
  const d=new Date(txt);
  return Number.isNaN(d.getTime())?null:d;
}

function enhanceThenNow(){
  const head=$('#trades .sectionHead p');
  if(head&&!head.dataset.thenNowNote){
    head.textContent='Audited Sleeper ledger. Trades under 7 days old are treated as the same market snapshot; older trades show historical Then → Now movement.';
    head.dataset.thenNowNote='1';
  }

  $$('#trades .tradeAudit').forEach(article=>{
    if(article.dataset.thenNowV3==='1')return;
    const when=tradeDate(article);
    const ageDays=when?Math.max(0,(Date.now()-when.getTime())/86400000):Infinity;

    article.querySelectorAll('.tradeTeam').forEach(team=>{
      const thenBadge=[...team.querySelectorAll(':scope > .line .badge')].find(x=>/^Then:/i.test(x.textContent.trim()));
      if(!thenBadge)return;
      const received=[...team.querySelectorAll('.ledger')].find(x=>x.querySelector('h4')?.textContent.trim().toUpperCase()==='RECEIVED');
      const total=received?.querySelector('.total');
      if(!total||/Priced today\*/i.test(total.textContent))return;

      const thenVal=numberFrom(thenBadge.textContent),nowVal=numberFrom(total.textContent);
      if(!nowVal)return;
      thenBadge.classList.add('thenNowBadge');

      if(ageDays<=7){
        thenBadge.textContent=`Then = Now: ${fmt(nowVal)}`;
        thenBadge.classList.add('same');
        thenBadge.title='Trade is under 7 days old, so both sides use the same current market snapshot to avoid fake short-term movement.';
        total.innerHTML=`Priced today: ${fmt(nowVal)} <span class="flatMove">SAME MARKET</span>`;
        return;
      }
      if(!thenVal)return;
      const diff=nowVal-thenVal,pct=Math.abs(diff)/Math.max(thenVal,1);
      if(pct<.01||Math.abs(diff)<35){
        thenBadge.textContent=`Then ≈ Now: ${fmt(nowVal)}`;
        thenBadge.classList.add('same');
        total.innerHTML=`Priced today: ${fmt(nowVal)} <span class="flatMove">UNCHANGED</span>`;
      }else{
        const sign=diff>0?'+':'';
        thenBadge.textContent=`Then ${fmt(thenVal)} → Now ${fmt(nowVal)}`;
        thenBadge.classList.add(diff>0?'up':'down');
        thenBadge.title=`${sign}${fmt(diff)} (${sign}${(diff/thenVal*100).toFixed(1)}%) since the historical trade snapshot`;
      }
    });
    article.dataset.thenNowV3='1';
  });
}

function apply(){enhanceRace();enhanceThenNow();}
const observer=new MutationObserver(apply);
observer.observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('resize',()=>{if($('#raceTrack')?.dataset.raceV3==='1')$$('#raceTrack .fieldToken').forEach(t=>setTokenPosition(t,Number(t.dataset.progress)||0));});
apply();
})();