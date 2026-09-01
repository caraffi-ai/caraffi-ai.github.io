(()=>{
'use strict';

const DATA='./data/league.json';
const S={data:null,league:null,users:[],rosters:[],picks:[],values:{},pickValues:{},trades:[],teams:[],filter:'all'};
const $=q=>document.querySelector(q);
const $$=q=>[...document.querySelectorAll(q)];
const fmt=n=>Math.round(Number(n)||0).toLocaleString();
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

async function getJSON(url,ms=15000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
  try{
    const r=await fetch(`${url}?t=${Date.now()}`,{signal:c.signal,cache:'no-store'});
    if(!r.ok) throw Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function player(id){
  id=String(id);
  const p=S.values[id]||{};
  return {id,name:p.name||`Player ${id}`,pos:p.position||'',team:p.team||'FA',age:Number(p.age)||null,dv:Number(p.sf_dynasty)||0,rv:Number(p.sf_redraft)||0,rank:p.rank??null,pr:p.position_rank??null,ch7:p.change_7d??null,ch30:p.change_30d??null};
}

function genericPickValue(y,r){
  const exact=S.pickValues[`${y}:${r}:generic`];
  if(exact) return Number(exact);
  const vals=['early','mid','late'].map(v=>Number(S.pickValues[`${y}:${r}:${v}`]||0)).filter(Boolean);
  if(vals.length) return vals.reduce((a,b)=>a+b,0)/vals.length;
  const slotVals=Object.entries(S.pickValues).filter(([k])=>k.startsWith(`${y}:${r}:`) && /^\d+$/.test(k.split(':')[2])).map(([,v])=>Number(v)||0).filter(Boolean);
  if(slotVals.length) return slotVals.reduce((a,b)=>a+b,0)/slotVals.length;
  const fallback={1:4200,2:1900,3:800,4:300,5:120}[Number(r)]||100;
  const now=Number(S.league?.season||2026);
  return fallback*Math.pow(.9,Math.max(0,Number(y)-now));
}

function ownedPicks(rid){
  const now=Number(S.league?.season||2026), rounds=Number(S.league?.settings?.draft_rounds||4), out=[];
  for(let y=now+1;y<=now+3;y++) for(let r=1;r<=rounds;r++){
    const move=S.picks.find(x=>Number(x.season)===y&&Number(x.round)===r&&Number(x.roster_id)===rid);
    const owner=move?Number(move.owner_id):rid;
    if(owner===rid) out.push({y,r,from:rid,v:genericPickValue(y,r)});
  }
  for(const p of S.picks){
    const y=Number(p.season),r=Number(p.round),owner=Number(p.owner_id),from=Number(p.roster_id);
    if(owner===rid&&from!==rid&&y>=now+1&&y<=now+3&&!out.some(x=>x.y===y&&x.r===r&&x.from===from)) out.push({y,r,from,v:genericPickValue(y,r)});
  }
  return out.sort((a,b)=>a.y-b.y||a.r-b.r);
}

function norm(a){if(!a.length)return[];const lo=Math.min(...a),hi=Math.max(...a);return a.map(v=>hi===lo?50:(v-lo)/(hi-lo)*100);}
function bestLine(ps,key){
  const slots=S.league?.roster_positions||['QB','RB','RB','WR','WR','TE','FLEX','FLEX','SUPER_FLEX'],used=new Set();let total=0;
  const take=eligible=>{let best=null,bi=-1;ps.forEach((p,i)=>{if(used.has(i)||!eligible.includes(p.pos))return;if(!best||(p[key]||0)>(best[key]||0)){best=p;bi=i;}});if(best){used.add(bi);total+=best[key]||0;}};
  for(const slot of slots){if(slot==='QB')take(['QB']);else if(slot==='RB')take(['RB']);else if(slot==='WR')take(['WR']);else if(slot==='TE')take(['TE']);else if(slot==='FLEX')take(['RB','WR','TE']);else if(slot.includes('SUPER'))take(['QB','RB','WR','TE']);}
  return total;
}
function coreValue(ps,pos){const w={QB:[1,.9,.3],RB:[1,.82,.52,.25],WR:[1,.9,.78,.6,.35],TE:[1,.48]}[pos];return ps.filter(p=>p.pos===pos).sort((a,b)=>b.dv-a.dv).slice(0,w.length).reduce((s,p,i)=>s+p.dv*w[i],0);}

function buildTeams(){
  const um=new Map(S.users.map(u=>[String(u.user_id),u]));
  S.teams=S.rosters.map(r=>{
    const u=um.get(String(r.owner_id))||{},ps=(r.players||[]).map(player).sort((a,b)=>b.dv-a.dv),op=ownedPicks(Number(r.roster_id));
    const pc=op.reduce((s,p)=>s+p.v,0),dynasty=ps.slice(0,16).reduce((s,p,i)=>s+p.dv*(i<10?1:.45),0),contender=bestLine(ps,'rv')||bestLine(ps,'dv'),pos={},core={};
    for(const k of ['QB','RB','WR','TE']){pos[k]=ps.filter(p=>p.pos===k).reduce((s,p)=>s+p.dv,0);core[k]=coreValue(ps,k);}
    const topAge=ps.filter(p=>p.age&&p.dv>0).slice(0,10),den=topAge.reduce((s,p)=>s+p.dv,0),age=den?topAge.reduce((s,p)=>s+p.age*p.dv,0)/den:null;
    return{id:Number(r.roster_id),ownerId:String(r.owner_id||''),name:u.team_name||u.display_name||`Roster ${r.roster_id}`,owner:u.display_name||'',ps,op,pc,dynasty,contender,pos,core,age};
  });
  const cn=norm(S.teams.map(t=>t.contender)),dn=norm(S.teams.map(t=>t.dynasty)),pn=norm(S.teams.map(t=>t.pc));
  S.teams.forEach((t,i)=>t.power=.45*cn[i]+.40*dn[i]+.15*pn[i]);
  S.teams.sort((a,b)=>b.power-a.power).forEach((t,i)=>t.rank=i+1);
  for(const k of ['QB','RB','WR','TE']){[...S.teams].sort((a,b)=>b.pos[k]-a.pos[k]).forEach((t,i)=>t[k+'r']=i+1);[...S.teams].sort((a,b)=>b.core[k]-a.core[k]).forEach((t,i)=>t[k+'c']=i+1);}
  [...S.teams].sort((a,b)=>b.contender-a.contender).forEach((t,i)=>t.cont=i+1);
  [...S.teams].sort((a,b)=>b.dynasty-a.dynasty).forEach((t,i)=>t.dynr=i+1);
  [...S.teams].sort((a,b)=>b.pc-a.pc).forEach((t,i)=>t.pickr=i+1);
}

function mode(t){if(t.cont<=4&&t.dynr<=7)return['Contender','good'];if(t.cont>=8&&t.pickr<=5)return['Rebuilder','warn'];if(t.cont<=6||t.dynr<=6)return['In the Mix','good'];return['Retooling','warn'];}
function posBars(t){return ['QB','RB','WR','TE'].map(k=>`<div class="posrow"><b>${k}</b><div class="bar"><i style="width:${(13-t[k+'r'])/12*100}%"></i></div><span>#${t[k+'r']}</span></div>`).join('');}

function raceHTML(){return `<div class="raceCard"><div class="line raceHeader"><div><div class="eyebrow">DYNASTY RACE</div><h2>Run the Franchise Race</h2><p>Same rankings, turned into a little race. This is a visualization — not a simulation.</p></div><button id="raceBtn" class="raceBtn">🏁 Run the Race</button></div><div id="raceTrack" class="raceTrack">${[...S.teams].reverse().map(t=>`<div class="racer" data-rank="${t.rank}" data-power="${t.power.toFixed(2)}"><div class="rname"><span class="raceRank">#${t.rank}</span><b>${esc(t.name)}</b></div><div class="track"><i></i><b class="finishLabel"></b></div></div>`).join('')}</div></div>`;}

function renderPower(){
  const a=S.teams[0],win=[...S.teams].sort((x,y)=>y.contender-x.contender)[0],pk=[...S.teams].sort((x,y)=>y.pc-x.pc)[0];
  $('#power').innerHTML=`<div class="hero"><div class="card"><div class="eyebrow">#1 Franchise</div><div class="big">${esc(a.name)}</div><div class="muted">Power ${a.power.toFixed(1)} / 100</div></div><div class="card"><div class="eyebrow">Best Win-Now</div><div class="big">${esc(win.name)}</div><div class="muted">Highest optimal-lineup SF redraft value</div></div><div class="card"><div class="eyebrow">Draft Capital King</div><div class="big">${esc(pk.name)}</div><div class="muted">Highest future-pick value</div></div></div><div class="section">${raceHTML()}</div><div class="section"><div class="sectionHead"><div><h2>League Power Rankings</h2><p>45% win-now • 40% dynasty core • 15% future picks. Current Superflex values.</p></div><span class="badge">Click team → War Room</span></div><div class="panel"><table><thead><tr><th>#</th><th>Team</th><th>Power</th><th>Win Now</th><th>Dynasty</th><th>Picks</th><th>Mode</th></tr></thead><tbody>${S.teams.map(t=>{const m=mode(t);return`<tr data-team="${t.id}"><td class="rank">#${t.rank}</td><td><b>${esc(t.name)}</b><br><small class="muted">${esc(t.owner)}</small></td><td><div class="scorebar"><b>${t.power.toFixed(1)}</b><div class="bar"><i style="width:${t.power}%"></i></div></div></td><td>#${t.cont}</td><td>#${t.dynr}</td><td>#${t.pickr}</td><td><span class="badge ${m[1]}">${m[0]}</span></td></tr>`}).join('')}</tbody></table></div></div>`;
  bindTeams('#power');$('#raceBtn').onclick=runRace;
}
function runRace(){const rows=$$('#raceTrack .racer');rows.forEach(r=>{r.classList.remove('winner');r.querySelector('.track i').style.width='0%';r.querySelector('.finishLabel').textContent='';});const btn=$('#raceBtn');btn.disabled=true;btn.textContent='🏎️ Racing…';requestAnimationFrame(()=>setTimeout(()=>{rows.forEach((r,i)=>{const power=Number(r.dataset.power),rank=Number(r.dataset.rank),width=38+62*(power/100);setTimeout(()=>{r.querySelector('.track i').style.width=`${width}%`;if(rank===1)r.classList.add('winner');r.querySelector('.finishLabel').textContent=`#${rank}`;},i*70);});setTimeout(()=>{btn.disabled=false;btn.textContent='↻ Race Again';},1800);},80));}

function renderTeams(){$('#teams').innerHTML=`<div class="sectionHead"><div><h2>Team War Rooms</h2><p>Current franchise strength, positions, roster and future picks.</p></div></div><div class="grid">${S.teams.map(t=>{const m=mode(t);return`<article class="team" data-team="${t.id}"><div class="line"><div><b>${esc(t.name)}</b><div class="muted small">Power #${t.rank}</div></div><span class="badge ${m[1]}">${m[0]}</span></div><div class="mini"><div><b>#${t.cont}</b><small>WIN NOW</small></div><div><b>#${t.dynr}</b><small>DYNASTY</small></div><div><b>#${t.pickr}</b><small>PICKS</small></div></div><div class="posbars">${posBars(t)}</div></article>`}).join('')}</div>`;bindTeams('#teams');}

function viableQBs(t){return t.ps.filter(p=>p.pos==='QB'&&p.dv>=1200).sort((a,b)=>b.dv-a.dv);}
function needScore(t,k){let s=t[k+'c']||12;if(k==='QB'){const n=viableQBs(t).length;if(n<2)s+=9;else if(n===2)s+=3;}if(k==='TE')s-=1;if(mode(t)[0]==='Contender'&&(k==='RB'||k==='WR'))s+=1;return s;}
function needs(t){return['QB','RB','WR','TE'].map(k=>({k,s:needScore(t,k),rank:t[k+'c']})).sort((a,b)=>b.s-a.s);}
function tradeable(t,k){const arr=t.ps.filter(p=>p.pos===k&&p.dv>=850).sort((a,b)=>b.dv-a.dv),m=mode(t)[0];if(k==='QB')return viableQBs(t).length>=3?arr.slice(2,5):[];if(k==='WR')return arr.slice(m==='Contender'?3:2,7);if(k==='RB')return arr.slice(m==='Contender'?2:1,6);if(k==='TE')return arr.slice(1,4);return[];}
function playerAsset(p){return{type:'player',p,v:p.dv};}
function pickAsset(p){return{type:'pick',...p,v:p.v||genericPickValue(p.y,p.r)};}
function pkgValue(a){return a.reduce((s,x)=>s+x.v,0);}
function pkgGap(a,b){const av=pkgValue(a),bv=pkgValue(b);return{av,bv,g:Math.abs(av-bv)/Math.max(av,bv,1)};}
function pickBundle(t,target){if(target<250)return[];const pool=t.op.map(pickAsset).sort((a,b)=>a.v-b.v),combos=[];for(const x of pool)combos.push([x]);for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++)combos.push([pool[i],pool[j]]);let best=[],err=Infinity;for(const b of combos){if(target<1800&&b.some(x=>x.r===1))continue;const v=pkgValue(b),e=Math.abs(v-target);if(e<err&&v<=target*1.4+250){best=b;err=e;}}return best;}
function timelineFit(team,p){const m=mode(team)[0];if(!p.age)return 0;if(m==='Rebuilder'){if(p.pos==='QB'&&p.age>28)return-3;if(p.pos==='RB'&&p.age>25)return-4;if((p.pos==='WR'||p.pos==='TE')&&p.age>27)return-3;}if(m==='Contender'&&p.rv>0)return Math.min(3,p.rv/2500);return 0;}

function allSuggestions(){
  const out=[];
  for(let i=0;i<S.teams.length;i++)for(let j=i+1;j<S.teams.length;j++){
    const A=S.teams[i],B=S.teams[j];
    for(const an of needs(A).slice(0,2))for(const bn of needs(B).slice(0,2)){
      if(an.k===bn.k)continue;if((B[an.k+'c']||12)>6||(A[bn.k+'c']||12)>6)continue;
      for(const pa of tradeable(A,bn.k))for(const pb of tradeable(B,an.k)){
        let ag=[playerAsset(pb)],bg=[playerAsset(pa)],g=pkgGap(ag,bg);
        if(g.g>.10){if(g.av<g.bv)ag.push(...pickBundle(B,g.bv-g.av));else bg.push(...pickBundle(A,g.av-g.bv));g=pkgGap(ag,bg);}
        if(g.g>.18)continue;
        let score=an.s+bn.s-g.g*20+timelineFit(A,pb)+timelineFit(B,pa);if(pb.pos==='QB'&&viableQBs(A).length<2)score+=5;if(pa.pos==='QB'&&viableQBs(B).length<2)score+=5;if(score<11)continue;
        out.push({A,B,ag,bg,g,score,pa,pb,why:`${A.name} targets ${pb.pos} (core rank #${A[pb.pos+'c']}); ${B.name} targets ${pa.pos} (core rank #${B[pa.pos+'c']}). ${pa.pos==='QB'||pb.pos==='QB'?'Superflex scarcity is applied and each team’s top two viable QBs are protected. ':''}${ag.some(x=>x.type==='pick')||bg.some(x=>x.type==='pick')?'The pick only balances the value gap.':''}`});
      }
    }
  }
  return out.sort((a,b)=>b.score-a.score||a.g.g-b.g.g);
}
function selectSuggestions(filter='all'){
  const src=allSuggestions(),teamCount=new Map(),playerSeen=new Set(),pairSeen=new Set(),out=[],filtered=filter==='all'?src:src.filter(s=>s.A.id===Number(filter)||s.B.id===Number(filter)),limit=filter==='all'?8:5;
  for(const s of filtered){const pair=[s.A.id,s.B.id].sort((a,b)=>a-b).join('-'),pids=[...s.ag,...s.bg].filter(a=>a.type==='player').map(a=>a.p.id);if(pairSeen.has(pair)||pids.some(id=>playerSeen.has(id)))continue;if(filter==='all'&&((teamCount.get(s.A.id)||0)>=2||(teamCount.get(s.B.id)||0)>=2))continue;out.push(s);pairSeen.add(pair);pids.forEach(id=>playerSeen.add(id));teamCount.set(s.A.id,(teamCount.get(s.A.id)||0)+1);teamCount.set(s.B.id,(teamCount.get(s.B.id)||0)+1);if(out.length>=limit)break;}
  return out;
}
function assetHTML(a){if(a.type==='player')return`<div class="asset"><span>${esc(a.p.name)} <small>${a.p.pos} • ${esc(a.p.team)}</small></span><small>${fmt(a.v)}</small></div>`;return`<div class="asset"><span>${a.y} R${a.r}${a.from?` <small>from #${a.from}</small>`:''}</span><small>${fmt(a.v)}</small></div>`;}
function renderIdeas(){const options=`<option value="all">League-wide best fits</option>${S.teams.map(t=>`<option value="${t.id}" ${String(S.filter)===String(t.id)?'selected':''}>${esc(t.name)}</option>`).join('')}`,x=selectSuggestions(S.filter);$('#ideas').innerHTML=`<div class="sectionHead"><div><h2>Trades That Should Be Made</h2><p>Need + surplus + timeline + Superflex scarcity. League-wide results cap teams at two appearances.</p></div><select id="teamTradeFilter" class="select">${options}</select></div>${x.length?`<div class="twocol">${x.map(s=>`<article class="trade"><div class="line"><b>${esc(s.A.name)} × ${esc(s.B.name)}</b><span class="badge good">Fit ${Math.round(s.score)}</span></div><div class="tradeSides"><div class="sidebox"><b>${esc(s.A.name)} gets</b>${s.ag.map(assetHTML).join('')}<div class="total">${fmt(s.g.av)}</div></div><div class="arrow">⇄</div><div class="sidebox"><b>${esc(s.B.name)} gets</b>${s.bg.map(assetHTML).join('')}<div class="total">${fmt(s.g.bv)}</div></div></div><div class="why"><b>Why it fits:</b> ${esc(s.why)} <b>Market gap:</b> ${Math.round(s.g.g*100)}%.</div></article>`).join('')}</div>`:`<div class="card"><b>No deal cleared the quality filters.</b><p>That is intentional. Pick another team or check again after rosters/values change.</p></div>`}<div class="notice tradeNote"><b>Recommendation rules:</b> no QB1/QB2 dumping, no same player repeated, no same matchup repeated, and no team can dominate the league-wide list.</div>`;$('#teamTradeFilter').onchange=e=>{S.filter=e.target.value;renderIdeas();};}

function tradePlayerRows(ids){return(ids||[]).map(id=>{const p=player(id);return`<div class="asset"><span>${esc(p.name)} <small>${p.pos} • ${esc(p.team)}</small></span><small>${fmt(p.dv)}</small></div>`}).join('');}
function currentPickValue(p){const now=Number(S.league?.season||2026);if(Number(p.season)<=now)return null;return genericPickValue(p.season,p.round);}
function tradePickRows(ps){return(ps||[]).map(p=>{const v=currentPickValue(p);return`<div class="asset"><span>${p.season} R${p.round}${p.roster_id?` <small>orig #${p.roster_id}</small>`:''}</span><small>${v==null?'exercised':fmt(v)}</small></div>`}).join('');}
function recCurrent(rec){let total=(rec.players||[]).reduce((s,id)=>s+player(id).dv,0),complete=true;for(const p of rec.picks||[]){const v=currentPickValue(p);if(v==null)complete=false;else total+=v;}return{total,complete};}
function ledgerSide(title,rec){const cv=recCurrent(rec);return`<div class="ledger"><h4>${title}</h4>${tradePlayerRows(rec.players)}${tradePickRows(rec.picks)}${rec.faab?`<div class="asset"><span>FAAB</span><small>$${fmt(rec.faab)}</small></div>`:''}${!(rec.players||[]).length&&!(rec.picks||[]).length&&!rec.faab?'<div class="muted small">Nothing recorded</div>':''}<div class="total">${cv.complete?`Priced today: ${fmt(cv.total)}`:`Priced today*: ${fmt(cv.total)}`}</div></div>`;}
function historicalFor(tr,id){const h=tr.historical_value;if(!h||tr.roster_ids.length!==2)return null;const idx=tr.roster_ids.map(Number).indexOf(Number(id));if(idx===0)return Number(h.side_a_total);if(idx===1)return Number(h.side_b_total);return null;}
function renderTrades(){
  const trades=(S.trades||[]).slice(0,40);
  $('#trades').innerHTML=`<div class="sectionHead"><div><h2>Trade Center / Fleece Meter</h2><p>Audited Sleeper ledger: exact sent/received players, original picks and FAAB. “Then” values shown when historical data exists.</p></div><span class="badge">Then vs Now</span></div>${trades.length?`<div class="twocol">${trades.map(tr=>{const ids=tr.roster_ids||[],sides=ids.map(id=>({id,side:tr.sides?.[String(id)]||{team_name:`Roster ${id}`,sent:{players:[],picks:[],faab:0},received:{players:[],picks:[],faab:0}}})),curr=sides.map(x=>recCurrent(x.side.received)),two=sides.length===2,complete=two&&curr.every(x=>x.complete),gap=complete?Math.abs(curr[0].total-curr[1].total)/Math.max(curr[0].total,curr[1].total,1):null,verdict=!two?'MULTI-TEAM':gap==null?'AUDIT ONLY':gap<.10?'EVEN NOW':gap<.22?'EDGE NOW':'FLEECE NOW',cls=gap==null?'':gap>=.22?'bad':gap>=.10?'warn':'good';return`<article class="trade tradeAudit"><div class="line"><div><b>${tr.season||''} Trade</b><div class="muted small">${new Date(tr.created).toLocaleDateString()}</div></div><span class="badge ${cls}">${verdict}</span></div>${sides.map(x=>`<div class="tradeTeam"><div class="line"><h3>${esc(x.side.team_name||`Roster ${x.id}`)}</h3>${historicalFor(tr,x.id)!=null?`<span class="badge">Then: ${fmt(historicalFor(tr,x.id))}</span>`:''}</div><div class="ledgerCols">${ledgerSide('SENT',x.side.sent)}${ledgerSide('RECEIVED',x.side.received)}</div></div>`).join('')}${gap!=null?`<div class="meter"><i class="dot" style="left:${clamp(curr[0].total/Math.max(curr[0].total+curr[1].total,1)*100,3,97)}%"></i></div><div class="muted small center">Current priced-asset gap ${Math.round(gap*100)}%</div>`:''}${!complete&&two?`<div class="why">*A past draft pick has already been exercised, so the site will not pretend that old pick still has a current pick value. Use the historical “Then” valuation for that trade until drafted-player resolution is added.</div>`:''}</article>`;}).join('')}</div>`:`<div class="card">No completed trades were found in the cached league history.</div>`}`;
}

function renderAwards(){const by=f=>[...S.teams].sort(f)[0],list=[['👑','Dynasty Alpha',S.teams[0],'#1 overall franchise'],['🔥','Win-Now Maniac',by((a,b)=>b.contender-a.contender),'Best current starting lineup'],['🧾','Draft Capital Hoarder',by((a,b)=>b.pc-a.pc),'Most future pick value'],['🚀','QB Factory',by((a,b)=>b.pos.QB-a.pos.QB),'Best QB room'],['🐎','RB Stable',by((a,b)=>b.pos.RB-a.pos.RB),'Best RB room'],['🎯','WR Arms Dealer',by((a,b)=>b.pos.WR-a.pos.WR),'Best WR room'],['🧱','TE University',by((a,b)=>b.pos.TE-a.pos.TE),'Best TE room'],['🍼','Young Core',by((a,b)=>(a.age||99)-(b.age||99)),'Youngest value-weighted core']];$('#awards').innerHTML=`<div class="sectionHead"><div><h2>Awards Center</h2><p>Live awards from the cached league snapshot.</p></div></div><div class="awardGrid">${list.map(x=>`<article class="award"><div class="awardIcon">${x[0]}</div><b>${x[1]}</b><div class="winner">${esc(x[2]?.name||'—')}</div><small class="muted">${x[3]}</small></article>`).join('')}</div>`;}
function bindTeams(root){$$(`${root} [data-team]`).forEach(x=>x.onclick=()=>openTeam(Number(x.dataset.team)));}
function openTeam(id){const t=S.teams.find(x=>x.id===id);if(!t)return;const best=['QB','RB','WR','TE'].sort((a,b)=>t[a+'r']-t[b+'r'])[0],worst=['QB','RB','WR','TE'].sort((a,b)=>t[b+'r']-t[a+'r'])[0];$('#modalBody').innerHTML=`<div class="eyebrow">Team War Room</div><h1>${esc(t.name)}</h1><p>Power #${t.rank} • Win-now #${t.cont} • Dynasty #${t.dynr} • Picks #${t.pickr}</p><div class="hero"><div class="card"><div class="eyebrow">Best Unit</div><div class="big">${best} #${t[best+'r']}</div></div><div class="card"><div class="eyebrow">Biggest Need</div><div class="big">${worst} #${t[worst+'r']}</div></div><div class="card"><div class="eyebrow">Future Picks</div><div class="big">${t.op.length}</div></div></div><div class="rosterGrid">${['QB','RB','WR','TE'].map(k=>`<div class="rosterBox"><b>${k} • League #${t[k+'r']}</b>${t.ps.filter(p=>p.pos===k).slice(0,10).map(p=>`<div class="prow"><span>${esc(p.name)}<br><small class="muted">${esc(p.team)}${p.age?' • Age '+p.age:''}</small></span><b>${fmt(p.dv)}</b></div>`).join('')}</div>`).join('')}</div><div class="section"><h2>Future Pick Chest</h2><div class="pillRow">${t.op.map(p=>`<span class="badge">${p.y} R${p.r}${p.from!==t.id?' from #'+p.from:''}</span>`).join('')||'<span class="muted">No tracked future picks</span>'}</div></div>`;$('#modal').classList.add('on');}
function renderAll(){renderPower();renderTeams();renderIdeas();renderTrades();renderAwards();}

async function load(){const notice=$('#notice'),status=$('#status');try{const d=await getJSON(DATA);S.data=d;S.league=d.league||{};S.users=d.users||[];S.rosters=d.rosters||[];S.picks=d.traded_picks||[];S.values=d.player_values?.players||{};S.pickValues=d.pick_values?.picks||{};S.trades=d.trades||[];if(S.rosters.length!==12)throw Error(`snapshot contains ${S.rosters.length} rosters, expected 12`);if(!Object.keys(S.values).length)throw Error('snapshot contains no Superflex player values');buildTeams();renderAll();$('#leagueIdLabel').textContent=d.current_league_id||S.league.league_id||'';const stamp=d.generated_at?new Date(d.generated_at):null;status.textContent=`Cached • ${S.league.season||'current'}`;status.className='status good';notice.className='notice good';notice.textContent=`Validated snapshot loaded${stamp?` • refreshed ${stamp.toLocaleString()}`:''}. Sleeper facts + Superflex dynasty values; the cache refreshes automatically.`;}catch(e){console.error(e);status.textContent='Data unavailable';status.className='status';notice.className='notice bad';notice.innerHTML=`<b>Validated snapshot failed to load.</b> ${esc(e.message)}`;}}
const names={power:['DAWG DYNASTY','League Power Rankings'],teams:['FRANCHISE INTELLIGENCE','Team War Rooms'],ideas:['TRADE LAB','Trades That Should Be Made'],trades:['LEAGUE TRANSACTIONS','Trade Center / Fleece Meter'],awards:['BRAGGING RIGHTS','Awards Center']};
$$('.nav').forEach(b=>b.onclick=()=>{$$('.nav').forEach(x=>x.classList.toggle('on',x===b));$$('.page').forEach(x=>x.classList.toggle('on',x.id===b.dataset.page));$('#eyebrow').textContent=names[b.dataset.page][0];$('#title').textContent=names[b.dataset.page][1];});
$$('[data-close]').forEach(x=>x.onclick=()=>$('#modal').classList.remove('on'));document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#modal').classList.remove('on');});load();
})();