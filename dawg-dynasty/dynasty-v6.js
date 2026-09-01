(()=>{
'use strict';

const $=q=>document.querySelector(q);
const $$=q=>Array.from(document.querySelectorAll(q));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fmt=n=>Math.round(Number(n)||0).toLocaleString();
const numberFrom=s=>Number(String(s||'').replace(/[^0-9.-]/g,''))||0;
let raceFrame=null;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function bezier(a,b,c,d,t){const m=1-t;return m*m*m*a+3*m*m*t*b+3*m*t*t*c+t*t*t*d;}

const START_X=[14,20,12,18,23,15,21,13,19,11,17,22];
const START_Y=[78,18,62,32,90,46,12,70,38,94,54,26];
const FINISH_Y=[12,76,28,88,44,18,64,36,82,54,24,94];

function routeFor(team){
  const i=team.rank-1;
  const sx=START_X[i],sy=START_Y[i],ex=team.target,ey=FINISH_Y[i];
  const swing=((team.rank%2===0)?1:-1)*(12+(team.rank%4)*4);
  const c1x=clamp(sx+27+(team.rank%3)*3,28,55);
  const c2x=clamp(ex-25-(team.rank%4)*2,48,78);
  const c1y=clamp(ey+swing,7,96);
  const c2y=clamp(sy-swing*.8,7,96);
  return{sx,sy,ex,ey,c1x,c1y,c2x,c2y};
}

function buildRace(){
  const old=$('#raceTrack');
  if(!old||old.classList.contains('dd-race-v6'))return;
  const teams=$$('#raceTrack .racer').map(r=>({
    rank:Number(r.dataset.rank)||12,
    power:Number(r.dataset.power)||0,
    name:r.querySelector('.rname b')?.textContent?.trim()||`Team ${r.dataset.rank||''}`
  })).sort((a,b)=>a.rank-b.rank);
  if(!teams.length)return;

  const lo=Math.min(...teams.map(t=>t.power)),hi=Math.max(...teams.map(t=>t.power));
  teams.forEach(t=>{
    const norm=hi===lo?.5:(t.power-lo)/(hi-lo);
    t.target=clamp(23+63*norm,23,86);
    if(t.rank===1)t.target=93.5;
    else if(t.rank===2)t.target=Math.min(t.target,86);
    t.route=routeFor(t);
  });

  const card=old.closest('.raceCard');
  const title=card?.querySelector('.raceHeader h2');
  const desc=card?.querySelector('.raceHeader p');
  if(title)title.textContent='The DAWG Dynasty Drive';
  if(desc)desc.textContent='A true dynasty race: staggered starts, crossing routes, and power-score finishes. The projected #1 actually reaches the Dynasty Champ end zone.';

  const board=document.createElement('div');
  board.id='raceTrack';
  board.className='dd-race-v6';
  board.innerHTML=`
    <div class="dd6-scoreboard">
      <div class="dd6-title"><span>DAWG DYNASTY</span><b id="dd6Status">FINAL</b></div>
      <div class="dd6-podium">${teams.slice(0,3).map((t,i)=>`<div class="dd6-podium-card"><span>${['🥇','🥈','🥉'][i]}</span><div><b>${esc(t.name)}</b><small>${t.power.toFixed(1)} POWER</small></div></div>`).join('')}</div>
    </div>
    <div class="dd6-field" id="dd6Field">
      <div class="dd6-endzone dd6-start"><span>START</span></div>
      <div class="dd6-endzone dd6-champ"><span>DYNASTY CHAMP</span></div>
      ${[16.4,24.8,33.2,41.6,50,58.4,66.8,75.2,83.6].map((x,i)=>`<div class="dd6-yard" style="left:${x}%"><span>${i<5?(i+1)*10:(9-i)*10}</span></div>`).join('')}
      <div class="dd6-midlogo">DD</div>
      <svg class="dd6-routes" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">
        ${teams.map(t=>{const r=t.route;return`<path data-rank="${t.rank}" d="M ${r.sx*10} ${r.sy*7} C ${r.c1x*10} ${r.c1y*7}, ${r.c2x*10} ${r.c2y*7}, ${r.ex*10} ${r.ey*7}"/>`;}).join('')}
      </svg>
      <div class="dd6-start-dots" aria-hidden="true">${teams.map(t=>`<i style="left:${t.route.sx}%;top:${t.route.sy}%"></i>`).join('')}</div>
      <div class="dd6-racers">
        ${teams.map(t=>`<button type="button" class="dd6-racer ${t.rank===1?'dd6-champ-racer':''}" data-rank="${t.rank}" data-name="${esc(t.name)}" data-power="${t.power.toFixed(2)}" data-target="${t.target.toFixed(2)}" data-sx="${t.route.sx}" data-sy="${t.route.sy}" data-ex="${t.route.ex}" data-ey="${t.route.ey}" data-c1x="${t.route.c1x}" data-c1y="${t.route.c1y}" data-c2x="${t.route.c2x}" data-c2y="${t.route.c2y}" style="left:${t.route.ex}%;top:${t.route.ey}%" aria-label="${esc(t.name)}, rank ${t.rank}, power ${t.power.toFixed(1)}">
          <span class="dd6-rank">#${t.rank}</span><span class="dd6-ball">🏈</span><span class="dd6-name">${esc(t.name)}</span>${t.rank===1?'<span class="dd6-crown">👑</span>':''}
        </button>`).join('')}
      </div>
      <div class="dd6-call" id="dd6Call">Final projected field position. Tap a team or run the race again.</div>
    </div>`;

  old.replaceWith(board);

  const oldBtn=$('#raceBtn');
  if(oldBtn){
    const btn=oldBtn.cloneNode(true);
    oldBtn.replaceWith(btn);
    btn.textContent='🏁 Run the Crossing Race';
    btn.addEventListener('click',()=>runRace(btn));
  }
  $$('.dd6-racer').forEach(r=>r.addEventListener('click',()=>spotlight(Number(r.dataset.rank))));
}

function spotlight(rank){
  $$('.dd6-racer').forEach(r=>r.classList.toggle('dd6-selected',Number(r.dataset.rank)===rank));
  $$('.dd6-routes path').forEach(p=>p.classList.toggle('dd6-route-selected',Number(p.dataset.rank)===rank));
  const racer=$(`.dd6-racer[data-rank="${rank}"]`),call=$('#dd6Call');
  if(racer&&call){
    const zone=rank===1?'DYNASTY CHAMP END ZONE':Number(racer.dataset.target)>=75?'RED ZONE':Number(racer.dataset.target)>=50?'PLUS TERRITORY':'BUILDING FROM DEEP';
    call.textContent=`${racer.dataset.name} • #${rank} • ${Number(racer.dataset.power).toFixed(1)} power • ${zone}`;
  }
}

function placeRacer(r,t){
  const sx=Number(r.dataset.sx),sy=Number(r.dataset.sy),ex=Number(r.dataset.ex),ey=Number(r.dataset.ey);
  const c1x=Number(r.dataset.c1x),c1y=Number(r.dataset.c1y),c2x=Number(r.dataset.c2x),c2y=Number(r.dataset.c2y);
  const x=bezier(sx,c1x,c2x,ex,t),y=bezier(sy,c1y,c2y,ey,t);
  r.style.left=`${x}%`;r.style.top=`${y}%`;
  const dx=bezier(sx,c1x,c2x,ex,Math.min(1,t+.01))-x;
  const dy=bezier(sy,c1y,c2y,ey,Math.min(1,t+.01))-y;
  const angle=Math.atan2(dy,dx)*180/Math.PI;
  r.style.setProperty('--race-angle',`${clamp(angle,-18,18)}deg`);
}

function runRace(btn){
  if(raceFrame)cancelAnimationFrame(raceFrame);
  const racers=$$('.dd6-racer'),status=$('#dd6Status'),call=$('#dd6Call');
  racers.forEach(r=>{r.classList.remove('dd6-selected','dd6-winner');placeRacer(r,0);});
  $$('.dd6-routes path').forEach(p=>p.classList.remove('dd6-route-selected'));
  if(status)status.textContent='LIVE';
  if(call)call.textContent='🏈 They are off — staggered starts and crossing routes are live.';
  btn.disabled=true;btn.textContent='🏃 Dynasty Race Live…';

  const start=performance.now(),duration=4200;
  const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  function frame(now){
    const raw=clamp((now-start)/duration,0,1);
    racers.forEach((r,i)=>{
      const delay=(i%4)*.035;
      const local=clamp((raw-delay)/(1-delay),0,1);
      const wobble=Math.sin(local*18+i)*.006*(1-local);
      placeRacer(r,clamp(ease(local)+wobble,0,1));
    });
    if(call){
      if(raw>.78)call.textContent='🔥 Final stretch — the favorite is breaking for the end zone.';
      else if(raw>.48)call.textContent='⚡ Routes are crossing at midfield. The dynasty pack is separating.';
      else if(raw>.18)call.textContent='📈 Early traffic — contenders are cutting across one another.';
    }
    if(raw<1)raceFrame=requestAnimationFrame(frame);
    else finishRace(btn);
  }
  raceFrame=requestAnimationFrame(frame);
}

function finishRace(btn){
  raceFrame=null;
  const champ=$('.dd6-racer[data-rank="1"]');
  if(champ)champ.classList.add('dd6-winner');
  const status=$('#dd6Status'),call=$('#dd6Call');
  if(status)status.textContent='FINAL';
  if(call)call.textContent=`🏆 ${champ?.dataset.name||'The #1 team'} finishes inside the Dynasty Champ end zone.`;
  btn.disabled=false;btn.textContent='↻ Race Again';
  spotlight(1);
}

function tradeDate(article){
  const txt=article.querySelector(':scope > .line .muted.small')?.textContent?.trim();
  if(!txt)return null;
  const d=new Date(txt);
  return Number.isNaN(d.getTime())?null:d;
}

function fixTrades(){
  const head=$('#trades .sectionHead p');
  if(head&&!head.dataset.ddV6){
    head.textContent='Audited Sleeper ledger. Trades less than 7 days old stay in a NEW / no-regrade window so tiny daily value-feed changes do not create fake Then vs Now movement.';
    head.dataset.ddV6='1';
  }
  $$('#trades .tradeAudit').forEach(article=>{
    if(article.dataset.ddV6==='1')return;
    const when=tradeDate(article);
    const ageDays=when?Math.max(0,(Date.now()-when.getTime())/86400000):Infinity;
    article.querySelectorAll('.tradeTeam').forEach(team=>{
      const badge=[...team.querySelectorAll(':scope > .line .badge')].find(x=>/^Then:/i.test(x.textContent.trim()));
      if(!badge)return;
      const received=[...team.querySelectorAll('.ledger')].find(x=>x.querySelector('h4')?.textContent.trim().toUpperCase()==='RECEIVED');
      const total=received?.querySelector('.total');
      if(!total||/Priced today\*/i.test(total.textContent))return;
      const thenVal=numberFrom(badge.textContent),nowVal=numberFrom(total.textContent);
      if(!nowVal)return;
      badge.classList.add('dd6-then-now');
      if(ageDays<7){
        badge.textContent=`NEW • ${fmt(nowVal)}`;
        badge.classList.add('dd6-new-trade');
        badge.title='No regrade for the first 7 days after a trade.';
        total.innerHTML=`Priced today: ${fmt(nowVal)} <span class="dd6-flat">NO REGRADE</span>`;
      }else if(thenVal){
        const diff=nowVal-thenVal,pct=Math.abs(diff)/Math.max(thenVal,1);
        if(pct<.01||Math.abs(diff)<35){badge.textContent=`Then ≈ Now: ${fmt(nowVal)}`;badge.classList.add('dd6-flat-badge');}
        else{badge.textContent=`Then ${fmt(thenVal)} → Now ${fmt(nowVal)}`;badge.classList.add(diff>0?'dd6-up':'dd6-down');}
      }
    });
    article.dataset.ddV6='1';
  });
}

function apply(){buildRace();fixTrades();}
const observer=new MutationObserver(apply);
observer.observe(document.documentElement,{childList:true,subtree:true});
const timer=setInterval(apply,250);
setTimeout(()=>clearInterval(timer),12000);
apply();
})();