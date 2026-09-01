import json, os, urllib.request
from datetime import datetime, timezone

START="1311852361739694080"
SL="https://api.sleeper.app/v1"
SG="https://api.statsguyfantasy.com/api/v1"
OUT="dawg-dynasty/data/league.json"
HIST="2025-09-01"

def get(url):
    req=urllib.request.Request(url,headers={"User-Agent":"DAWG-DYNASTY/2.0"})
    with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read())

def post(url,data):
    req=urllib.request.Request(url,data=json.dumps(data).encode(),method="POST",headers={"User-Agent":"DAWG-DYNASTY/2.0","Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read())

def current(lid):
    seen=set()
    while lid and lid!="0" and lid not in seen:
        seen.add(lid); l=get(f"{SL}/league/{lid}"); nxt=str(l.get("next_league_id") or "0")
        if nxt=="0": return lid,l
        lid=nxt
    return lid,l

def chain(lid,l,n=6):
    out=[(lid,l)]; p=str(l.get("previous_league_id") or "0")
    while p!="0" and len(out)<n:
        try:x=get(f"{SL}/league/{p}")
        except:break
        out.append((p,x)); p=str(x.get("previous_league_id") or "0")
    return out

def users(rows):
    return [{"user_id":str(x.get("user_id") or ""),"display_name":x.get("display_name") or "","team_name":(x.get("metadata") or {}).get("team_name") or "","avatar":x.get("avatar")} for x in rows or []]

def rosters(rows):
    return [{"roster_id":int(x.get("roster_id") or 0),"owner_id":str(x.get("owner_id") or ""),"players":[str(v) for v in x.get("players") or []],"starters":[str(v) for v in x.get("starters") or []],"reserve":[str(v) for v in x.get("reserve") or []],"taxi":[str(v) for v in x.get("taxi") or []],"settings":x.get("settings") or {}} for x in rows or []]

def league(l):
    keys=["league_id","name","status","season","season_type","previous_league_id","next_league_id","total_rosters","roster_positions","settings","scoring_settings"]
    return {k:l.get(k) for k in keys}

def transactions(lid):
    seen=set(); out=[]
    for w in range(19):
        try: rows=get(f"{SL}/league/{lid}/transactions/{w}") or []
        except: rows=[]
        for t in rows:
            tid=t.get("transaction_id")
            if tid in seen: continue
            if tid: seen.add(tid)
            out.append(t)
    return out

def teammap(us,rs):
    um={u["user_id"]:u for u in us}; out={}
    for r in rs:
        u=um.get(r["owner_id"],{}); out[str(r["roster_id"])]={"manager":u.get("display_name") or f"Roster {r['roster_id']}","team_name":u.get("team_name") or u.get("display_name") or f"Roster {r['roster_id']}"}
    return out

def ledger(t,tm):
    ids=set(int(x) for x in t.get("roster_ids") or []); s={}
    def side(rid):
        rid=int(rid); ids.add(rid); k=str(rid); z=tm.get(k,{})
        return s.setdefault(k,{"team_name":z.get("team_name") or f"Roster {rid}","manager":z.get("manager") or "","received":{"players":[],"picks":[],"faab":0},"sent":{"players":[],"picks":[],"faab":0}})
    for pid,rid in (t.get("adds") or {}).items(): side(rid)["received"]["players"].append(str(pid))
    for pid,rid in (t.get("drops") or {}).items(): side(rid)["sent"]["players"].append(str(pid))
    for p in t.get("draft_picks") or []:
        q={k:int(p.get(k) or 0) for k in ["season","round","roster_id","owner_id","previous_owner_id"]}
        if p.get("owner_id") is not None: side(p["owner_id"])["received"]["picks"].append(q)
        if p.get("previous_owner_id") is not None: side(p["previous_owner_id"])["sent"]["picks"].append(q)
    for w in t.get("waiver_budget") or []:
        a=int(w.get("amount") or 0)
        if w.get("sender") is not None: side(w["sender"])["sent"]["faab"]+=a
        if w.get("receiver") is not None: side(w["receiver"])["received"]["faab"]+=a
    return {"transaction_id":t.get("transaction_id"),"created":t.get("created"),"status":t.get("status"),"roster_ids":sorted(ids),"sides":s,"historical_value":None}

def vals(raw):
    out={}
    for p in raw.get("players",[]):
        i=str(p.get("id") or ""); v=p.get("value") or {}; rk=p.get("rank") or {}; pr=p.get("positionRank") or {}; ch=p.get("valueChange") or {}
        if i:out[i]={"id":i,"name":p.get("name") or f"Player {i}","team":p.get("team") or "FA","position":p.get("position") or "","age":p.get("age"),"sf_dynasty":int(v.get("sf_dynasty") or 0),"sf_redraft":int(v.get("sf_redraft") or 0),"rank":rk.get("sf_dynasty"),"position_rank":pr.get("sf_dynasty"),"change_7d":(ch.get("sf_dynasty") or {}).get("days7"),"change_30d":(ch.get("sf_dynasty") or {}).get("days30")}
    return {"as_of":(raw.get("valuesAsOf") or {}).get("sf_dynasty"),"players":out}

def pickvals(raw):
    out={}
    for p in raw.get("picks",[]):
        y=int(p.get("year") or 0); r=int(p.get("round") or 0); v=int((p.get("value") or {}).get("sf_dynasty") or 0)
        if not y or not r:continue
        key=f"{y}:{r}:"+(str(p["slot"]) if p.get("slot") else (p.get("variant") or "generic")); out[key]=v
    return {"as_of":(raw.get("valuesAsOf") or {}).get("sf_dynasty"),"picks":out}

def assetids(rec):
    a=[str(x) for x in rec.get("players",[])]
    a += [f"pick:{int(p['season'])}:{int(p['round'])}" for p in rec.get("picks",[]) if p.get("season") and p.get("round")]
    return a

def history(trades):
    req=[]; refs=[]
    for t in trades:
        if len(t["roster_ids"])!=2 or not t.get("created"):continue
        d=datetime.fromtimestamp(t["created"]/1000,tz=timezone.utc).date().isoformat()
        if d<HIST:continue
        a,b=map(str,t["roster_ids"]); A=assetids(t["sides"][a]["received"]); B=assetids(t["sides"][b]["received"])
        if not A and not B:continue
        req.append({"format":"sf_dynasty","date":d,"sideA":A,"sideB":B}); refs.append(t)
    for i in range(0,len(req),25):
        try: rows=post(f"{SG}/trades/evaluate/batch",{"trades":req[i:i+25]}).get("results",[])
        except Exception as e: print("history batch failed",e); continue
        for t,x in zip(refs[i:i+25],rows):
            t["historical_value"]={"date":x.get("date"),"as_of":x.get("asOf"),"side_a_total":(x.get("sideA") or {}).get("totalValue"),"side_b_total":(x.get("sideB") or {}).get("totalValue"),"side_a_assets":(x.get("sideA") or {}).get("assets") or [],"side_b_assets":(x.get("sideB") or {}).get("assets") or []}

def main():
    lid,lr=current(START); us=users(get(f"{SL}/league/{lid}/users")); rs=rosters(get(f"{SL}/league/{lid}/rosters"))
    try: pv=vals(get(f"{SG}/players"))
    except Exception as e:pv={"as_of":None,"players":{},"error":str(e)}
    try: pk=pickvals(get(f"{SG}/picks"))
    except Exception as e:pk={"as_of":None,"picks":{},"error":str(e)}
    seasons=[]; trades=[]
    for sid,slr in chain(lid,lr):
        su=users(get(f"{SL}/league/{sid}/users")); sr=rosters(get(f"{SL}/league/{sid}/rosters")); tm=teammap(su,sr)
        led=[ledger(t,tm) for t in transactions(sid) if t.get("type")=="trade" and t.get("status")=="complete"]
        for t in led:t["league_id"]=sid;t["season"]=slr.get("season");trades.append(t)
        seasons.append({"league_id":sid,"season":slr.get("season"),"name":slr.get("name"),"users":su,"rosters":sr,"trades":led})
    trades.sort(key=lambda x:x.get("created") or 0,reverse=True); history(trades)
    data={"schema_version":2,"generated_at":datetime.now(timezone.utc).isoformat(),"source":{"sleeper":"public read-only API","values":"Stats Guy Fantasy documented public API"},"start_league_id":START,"current_league_id":lid,"league":league(lr),"users":us,"rosters":rs,"traded_picks":get(f"{SL}/league/{lid}/traded_picks") or [],"drafts":get(f"{SL}/league/{lid}/drafts") or [],"seasons":seasons,"trades":trades,"player_values":pv,"pick_values":pk}
    os.makedirs(os.path.dirname(OUT),exist_ok=True)
    with open(OUT,"w",encoding="utf-8") as f:json.dump(data,f,separators=(",",":"),ensure_ascii=False)
    print("wrote",OUT,len(rs),"rosters",len(trades),"trades",len(pv.get("players",{})),"players")

if __name__=="__main__":main()
