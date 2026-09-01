(()=>{
'use strict';
const $=q=>document.querySelector(q);
const $$=q=>Array.from(document.querySelectorAll(q));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fmt=n=>Math.round(Number(n)||0).toLocaleString();
const numberFrom=s=>Number(String(s||'').replace(/[^0-9.-]/g,''))||0;
let frameId=null;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function bezier(a,b,c,d,t){const m=1-t;return m*m*m*a+3*m*m*t*b+3*m*t*t*c+t*t*t*d;}

const START_X=[13,21,16,24,11,19,27,14,23,17,29,12];
const START_Y=[13,87,58,28,74,43,8,93,20,66,38,82];
const FINISH_Y=[13,80,30,91,48,19,69,37,85,57,24,95];

function routeFor(team){
  const i=team.rank-1;
  const sx=START_X[i],sy=START_Y[i],ex=team.finishX,ey=FINISH_Y[i];
  const crossTarget=FINISH_Y[(i+6)%12];
  const c1x=clamp(37+(i%3)*4,35,47);
  const c2x=clamp(61+(i%4)*4,60,74);
  const c1y=clamp(crossTarget+(i%2?8:-8),5,96);
  const c2y=clamp(START_Y[(i+5)%12]+(i%2?-5:5),5,96);
  return{sx,sy,ex,ey,c1x,c1y,c2x,c2y};
}

function buildRace(){
  const old=$('#raceTrack');
  if(!old||old.classList.contains('dd7-race'))return;
  const teams=$$('#raceTrack .racer').map(r=>({
    rank:Number(r.dataset.rank)||12,
    power:Number(r.dataset.power)||0,
    name:r.querySelector('.rname b')?.textContent?.trim()||`Team ${r.dataset.rank||''}`
  })).sort((a,b)=>a.rank-b.rank);
  if(!teams.length)return;

  const lo=Math.min(...teams.map(t=>t.power)),hi=Math.max(...teams.map(t=>t.power));
  teams.forEach(t=>{
    const norm=hi===lo?.5:(t.power-lo)/(hi-lo);
    t.finishX=clamp(34+52*norm,34,86);
    if(t.rank===1)t.finishX=95.5;
    if(t.rank===2)t.finishX=Math.min(t.finishX,86.5);
    t.route=routeFor(t);
  });

  const card=old.closest('.raceCard');
  const title=card?.querySelector('.raceHeader h2');
  const desc=card?.querySelector('.raceHeader p');
  if(title)title.textContent='The DAWG Dynasty Drive';
  if(desc)desc.textContent='All 12 franchises begin from staggered spots, cut across one another on different routes, and finish according to the actual power rankings.';

  const board=document.createElement('div');
  board.id='raceTrack';
  board.className='dd7-race';
  board.innerHTML=`
    <div class="dd7-scoreboard">
      <div class="dd7-title"><span>DAWG DYNASTY</span><b id="dd7Status">PRE-RACE</b></div>
      <div class="dd7-podium">${teams.slice(0,3).map((t,i)=>`<div class="dd7-podium-card"><span>${['🥇','🥈','🥉'][i]}</span><div><b>${esc(t.name)}</b><small>${t.power.toFixed(1)} POWER</small></div></div>`).join('')}</div>
    </div>
    <div class="dd7-field" id="dd7Field">
      <div class="dd7-endzone dd7-start"><span>START</span></div>
      <div class="dd7-endzone dd7-champ"><span>DYNASTY CHAMP</span></div>
      ${[16.4,24.8,33.2,41.6,50,58.4,66.8,75.2,83.6].map((x,i)=>`<div class="dd7-yard" style="left:${x}%"><span>${i<5?(i+1)*10:(9-i)*10}</span></div>`).join('')}
      <div class="dd7-midlogo">DD</div>
      <svg class="dd7-routes" viewBox="0 0 1000 720" preserveAspectRatio="none" aria-label="Crossing projected dynasty race paths">
        ${teams.map(t=>{const r=t.route;return`<path data-rank="${t.rank}" d="M ${r.sx*10} ${r.sy*7.2} C ${r.c1x*10} ${r.c1y*7.2}, ${r.c2x*10} ${r.c2y*7.2}, ${r.ex*10} ${r.ey*7.2}"/>`;}).join('')}
      </svg>
      <div class="dd7-racers">${teams.map(t=>`<button type="button" class="dd7-racer" data-rank="${t.rank}" data-name="${esc(t.name)}" data-power="${t.power.toFixed(2)}" data-sx="${t.route.sx}" data-sy="${t.route.sy}" data-ex="${t.route.ex}" data-ey="${t.route.ey}" data-c1x="${t.route.c1x}" data-c1y="${t.route.c1y}" data-c2x="${t.route.c2x}" data-c2y="${t.route.c2y}" style="left:${t.route.sx}%;top:${t.route.sy}%" aria-label="${esc(t.name)}, rank ${t.rank}"><span class="dd7-name">${esc(t.name)}</span><span class="dd7-rank">#${t.rank}</span>${t.rank===1?'<span class="dd7-crown">👑</span>':''}</button>`).join('')}</div>
      <div class="dd7-call" id="dd7Call">Staggered start. Every franchise has a different route to the finish.</div>
    </div>`;
  old.replaceWith(board);

  const oldBtn=$('#raceBtn');
  if(oldBtn){
    const btn=oldBtn.cloneNode(true);oldBtn.replaceWith(btn);
    btn.textContent='🏁 Run the Dynasty Race';
    btn.addEventListener('click',()=>runRace(btn));
  }
  $$('.dd7-racer').forEach(r=>r.addEventListener('click',()=>spotlight(Number(r.dataset.rank))));
}

function place(r,t){
  const sx=+r.dataset.sx,sy=+r.dataset.sy,ex=+r.dataset.ex,ey=+r.dataset.ey;
  const c1x=+r.dataset.c1x,c1y=+r.dataset.c1y,c2x=+r.dataset.c2x,c2y=+r.dataset.c2y;
  r.style.left=`${bezier(sx,c1x,c2x,ex,t)}%`;
  r.style.top=`${bezier(sy,c1y,c2y,ey,t)}%`;
}

function spotlight(rank){
  $$('.dd7-racer').forEach(r=>r.classList.toggle('dd7-selected',+r.dataset.rank===rank));
  $$('.dd7-routes path').forEach(p=>p.classList.toggle('dd7-route-selected',+p.dataset.rank===rank));
  const r=$(`.dd7-racer[data-rank="${rank}"]`),call=$('#dd7Call');
  if(r&&call)call.textContent=`${r.dataset.name} • #${rank} • ${(+r.dataset.power).toFixed(1)} power`;
}

function resetRace(){
  $$('.dd7-racer').forEach(r=>{r.classList.remove('dd7-winner','dd7-selected');place(r,0);});
  $$('.dd7-routes path').forEach(p=>p.classList.remove('dd7-route-selected'));
  const s=$('#dd7Status'),c=$('#dd7Call');if(s)s.textContent='PRE-RACE';if(c)c.textContent='Staggered start. Every franchise has a different route to the finish.';
}

function runRace(btn){
  if(frameId)cancelAnimationFrame(frameId);
  resetRace();
  const racers=$$('.dd7-racer'),status=$('#dd7Status'),call=$('#dd7Call');
  if(status)status.textContent='LIVE';if(call)call.textContent='🏁 Off they go — watch the routes cross through midfield.';
  btn.disabled=true;btn.textContent='🏃 Race Live…';
  const start=performance.now(),duration=4600;
  const ease=t=>1-Math.pow(1-t,3);
  function tick(now){
    const raw=clamp((now-start)/duration,0,1);
    racers.forEach((r,i)=>{
      const delay=(i%5)*.025;
      const local=clamp((raw-delay)/(1-delay),0,1);
      const pulse=Math.sin(local*15+i)*.012*(1-local);
      place(r,clamp(ease(local)+pulse,0,1));
    });
    if(call){
      if(raw>.78)call.textContent='🔥 Final stretch — #1 is breaking into the championship end zone.';
      else if(raw>.45)call.textContent='⚡ Midfield traffic — multiple franchises are crossing paths.';
      else if(raw>.15)call.textContent='📈 The pack is cutting across the field from different starts.';
    }
    if(raw<1)frameId=requestAnimationFrame(tick);else finish(btn);
  }
  frameId=requestAnimationFrame(tick);
}

function finish(btn){
  frameId=null;
  const champ=$('.dd7-racer[data-rank="1"]');
  if(champ)champ.classList.add('dd7-winner');
  const status=$('#dd7Status'),call=$('#dd7Call');
  if(status)status.textContent='FINAL';
  if(call)call.textContent=`🏆 ${champ?.dataset.name||'The #1 team'} finishes inside the Dynasty Champ end zone.`;
  btn.disabled=false;btn.textContent='↻ Race Again';
}

function tradeDate(article){const txt=article.querySelector(':scope > .line .muted.small')?.textContent?.trim();if(!txt)return null;const d=new Date(txt);return Number.isNaN(d.getTime())?null:d;}
function fixTrades(){
  const head=$('#trades .sectionHead p');
  if(head&&!head.dataset.dd7){head.textContent='Audited Sleeper ledger. Trades less than 7 days old stay in a NEW / no-regrade window so tiny daily value-feed changes do not create fake Then vs Now movement.';head.dataset.dd7='1';}
  $$('#trades .tradeAudit').forEach(article=>{
    if(article.dataset.dd7==='1')return;
    const when=tradeDate(article),ageDays=when?Math.max(0,(Date.now()-when.getTime())/86400000):Infinity;
    article.querySelectorAll('.tradeTeam').forEach(team=>{
      const badge=[...team.querySelectorAll(':scope > .line .badge')].find(x=>/^Then:/i.test(x.textContent.trim()));if(!badge)return;
      const received=[...team.querySelectorAll('.ledger')].find(x=>x.querySelector('h4')?.textContent.trim().toUpperCase()==='RECEIVED');
      const total=received?.querySelector('.total');if(!total||/Priced today\*/i.test(total.textContent))return;
      const thenVal=numberFrom(badge.textContent),nowVal=numberFrom(total.textContent);if(!nowVal)return;
      if(ageDays<7){badge.textContent=`NEW • ${fmt(nowVal)}`;badge.classList.add('dd7-new-trade');total.innerHTML=`Priced today: ${fmt(nowVal)} <span class="dd7-flat">NO REGRADE</span>`;}
      else if(thenVal){const diff=nowVal-thenVal,pct=Math.abs(diff)/Math.max(thenVal,1);if(pct<.01||Math.abs(diff)<35)badge.textContent=`Then ≈ Now: ${fmt(nowVal)}`;else badge.textContent=`Then ${fmt(thenVal)} → Now ${fmt(nowVal)}`;}
    });article.dataset.dd7='1';
  });
}

function apply(){buildRace();fixTrades();}
const observer=new MutationObserver(apply);observer.observe(document.documentElement,{childList:true,subtree:true});
const timer=setInterval(apply,250);setTimeout(()=>clearInterval(timer),12000);apply();
})();