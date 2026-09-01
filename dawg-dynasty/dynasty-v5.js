(()=>{
'use strict';

const $=q=>document.querySelector(q);
const $$=q=>Array.from(document.querySelectorAll(q));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fmt=n=>Math.round(Number(n)||0).toLocaleString();
const numberFrom=s=>Number(String(s||'').replace(/[^0-9.-]/g,''))||0;

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function initials(name){
  const parts=String(name||'').replace(/[^A-Za-z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return'DD';
  if(parts.length===1)return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
}

function buildRace(){
  const old=$('#raceTrack');
  if(!old||old.classList.contains('dd-field-race'))return;
  const teams=$$('#raceTrack .racer').map(r=>({
    rank:Number(r.dataset.rank)||12,
    power:Number(r.dataset.power)||0,
    name:r.querySelector('.rname b')?.textContent?.trim()||`Team ${r.dataset.rank||''}`
  })).sort((a,b)=>a.rank-b.rank);
  if(!teams.length)return;

  const lo=Math.min(...teams.map(t=>t.power)),hi=Math.max(...teams.map(t=>t.power));
  teams.forEach(t=>{
    const norm=hi===lo?0.5:(t.power-lo)/(hi-lo);
    t.target=clamp(20+67*norm,20,87);
    if(t.rank===1)t.target=88.5;
  });

  const card=old.closest('.raceCard');
  const title=card?.querySelector('.raceHeader h2');
  const desc=card?.querySelector('.raceHeader p');
  if(title)title.textContent='The DAWG Dynasty Drive';
  if(desc)desc.textContent='Every franchise starts at its own goal line. Power score determines field position — run the drive to watch the league race toward the dynasty end zone.';

  const board=document.createElement('div');
  board.id='raceTrack';
  board.className='dd-field-race';
  board.innerHTML=`
    <div class="dd-scoreboard">
      <div class="dd-score-title"><span>DAWG DYNASTY</span><b id="ddRaceStatus">FIELD POSITION</b></div>
      <div class="dd-podium">
        ${teams.slice(0,3).map((t,i)=>`<div class="dd-podium-card"><span>${['🥇','🥈','🥉'][i]}</span><b>${esc(t.name)}</b><small>${t.power.toFixed(1)} POWER</small></div>`).join('')}
      </div>
    </div>
    <div class="dd-gridiron" id="ddGridiron">
      <div class="dd-endzone dd-start-zone"><span>START</span></div>
      <div class="dd-endzone dd-champ-zone"><span>DYNASTY CHAMP</span></div>
      <div class="dd-yardline dd-y10"><span>10</span></div>
      <div class="dd-yardline dd-y20"><span>20</span></div>
      <div class="dd-yardline dd-y30"><span>30</span></div>
      <div class="dd-yardline dd-y40"><span>40</span></div>
      <div class="dd-yardline dd-y50"><span>50</span></div>
      <div class="dd-yardline dd-y60"><span>40</span></div>
      <div class="dd-yardline dd-y70"><span>30</span></div>
      <div class="dd-yardline dd-y80"><span>20</span></div>
      <div class="dd-yardline dd-y90"><span>10</span></div>
      <div class="dd-midfield-logo">DD</div>
      <div class="dd-lanes">
        ${teams.map(t=>`<div class="dd-lane ${t.rank===1?'dd-leader':''}" data-rank="${t.rank}" data-target="${t.target.toFixed(2)}">
          <div class="dd-team-tag"><span>#${t.rank}</span><b>${esc(t.name)}</b></div>
          <button type="button" class="dd-football" style="left:${t.target}%" data-rank="${t.rank}" data-target="${t.target.toFixed(2)}" data-name="${esc(t.name)}" aria-label="${esc(t.name)}, rank ${t.rank}">
            <span>${initials(t.name)}</span><small>#${t.rank}</small>
          </button>
          <div class="dd-rank-finish">${t.rank===1?'👑':'#'+t.rank}</div>
        </div>`).join('')}
      </div>
      <div class="dd-callout" id="ddRaceCallout">Current power rankings are already positioned on the field.</div>
    </div>`;

  old.replaceWith(board);

  const oldBtn=$('#raceBtn');
  if(oldBtn){
    const btn=oldBtn.cloneNode(true);
    oldBtn.replaceWith(btn);
    btn.textContent='🏈 Run the Dynasty Race';
    btn.addEventListener('click',()=>runRace(btn));
  }

  $$('.dd-football').forEach(b=>b.addEventListener('click',()=>spotlight(Number(b.dataset.rank))));
}

function spotlight(rank){
  $$('.dd-lane').forEach(l=>l.classList.toggle('dd-selected',Number(l.dataset.rank)===rank));
  const ball=$(`.dd-football[data-rank="${rank}"]`);
  const call=$('#ddRaceCallout');
  if(ball&&call)call.textContent=`${ball.dataset.name} • Rank #${rank} • dynasty field position ${Math.round(Number(ball.dataset.target))}%`;
}

function runRace(btn){
  const balls=$$('.dd-football');
  const status=$('#ddRaceStatus'),call=$('#ddRaceCallout');
  btn.disabled=true;
  btn.textContent='🏃 Race in Progress…';
  if(status)status.textContent='LIVE';
  if(call)call.textContent='Kickoff — all 12 franchises are moving.';

  balls.forEach((b,i)=>{
    b.classList.remove('dd-winner');
    b.style.transition='none';
    b.style.left='11%';
    b.style.transform='translate(-50%,-50%) rotate(-12deg) scale(.96)';
    b.offsetHeight;
    b.style.transition=`left 2.2s cubic-bezier(.18,.78,.2,1) ${i*55}ms, transform .25s ease, filter .25s ease`;
  });

  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    balls.forEach(b=>{
      b.style.left=`${b.dataset.target}%`;
      b.style.transform='translate(-50%,-50%) rotate(-12deg) scale(1)';
    });
  }));

  setTimeout(()=>{
    const champ=$('.dd-football[data-rank="1"]');
    if(champ)champ.classList.add('dd-winner');
    if(status)status.textContent='FINAL';
    if(call)call.textContent=`🏆 ${champ?.dataset.name||'The #1 franchise'} reaches the dynasty end zone first.`;
    btn.disabled=false;
    btn.textContent='↻ Race Again';
  },3200);
}

function tradeDate(article){
  const txt=article.querySelector(':scope > .line .muted.small')?.textContent?.trim();
  if(!txt)return null;
  const d=new Date(txt);
  return Number.isNaN(d.getTime())?null:d;
}

function fixTrades(){
  const head=$('#trades .sectionHead p');
  if(head&&!head.dataset.ddV5){
    head.textContent='Audited Sleeper ledger. Trades less than 7 days old stay in a NEW / no-regrade window so tiny daily value-feed changes do not create fake Then vs Now movement.';
    head.dataset.ddV5='1';
  }

  $$('#trades .tradeAudit').forEach(article=>{
    if(article.dataset.ddV5==='1')return;
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
      badge.classList.add('dd-then-now');

      if(ageDays<7){
        badge.textContent=`NEW • ${fmt(nowVal)}`;
        badge.classList.add('dd-new-trade');
        badge.title='No regrade for the first 7 days after a trade.';
        total.innerHTML=`Priced today: ${fmt(nowVal)} <span class="dd-flat">NO REGRADE</span>`;
      }else if(thenVal){
        const diff=nowVal-thenVal;
        const pct=Math.abs(diff)/Math.max(thenVal,1);
        if(pct<.01||Math.abs(diff)<35){
          badge.textContent=`Then ≈ Now: ${fmt(nowVal)}`;
          badge.classList.add('dd-flat-badge');
        }else{
          badge.textContent=`Then ${fmt(thenVal)} → Now ${fmt(nowVal)}`;
          badge.classList.add(diff>0?'dd-up':'dd-down');
        }
      }
    });
    article.dataset.ddV5='1';
  });
}

function apply(){buildRace();fixTrades();}
const observer=new MutationObserver(apply);
observer.observe(document.documentElement,{childList:true,subtree:true});
const timer=setInterval(apply,300);
setTimeout(()=>clearInterval(timer),12000);
apply();
})();