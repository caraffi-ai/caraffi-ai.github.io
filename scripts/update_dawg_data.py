import json, os, urllib.request, urllib.error, time
from datetime import datetime, timezone

START_LEAGUE = "1311852361739694080"
SLEEPER = "https://api.sleeper.app/v1"
STATS_GUY = "https://api.statsguyfantasy.com/api/v1"
OUT = "dawg-dynasty/data/league.json"


def get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "DAWG-DYNASTY/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def resolve_current(league_id):
    seen = set()
    cur = str(league_id)
    league = None
    while cur and cur != "0" and cur not in seen:
        seen.add(cur)
        league = get_json(f"{SLEEPER}/league/{cur}")
        nxt = str(league.get("next_league_id") or "0")
        if nxt == "0":
            return cur, league
        cur = nxt
    return cur, league


def previous_chain(current_id, current_league, max_years=6):
    chain = [(current_id, current_league)]
    lid = str(current_league.get("previous_league_id") or "0")
    for _ in range(max_years - 1):
        if not lid or lid == "0":
            break
        try:
            league = get_json(f"{SLEEPER}/league/{lid}")
        except Exception:
            break
        chain.append((lid, league))
        lid = str(league.get("previous_league_id") or "0")
    return chain


def all_transactions(league_id):
    out = []
    seen = set()
    for week in range(0, 19):
        try:
            rows = get_json(f"{SLEEPER}/league/{league_id}/transactions/{week}") or []
        except Exception:
            rows = []
        for t in rows:
            tid = t.get("transaction_id")
            if tid and tid in seen:
                continue
            if tid:
                seen.add(tid)
            out.append(t)
    return out


def build_trade_ledger(t):
    roster_ids = set(int(x) for x in (t.get("roster_ids") or []))
    sides = {}

    def side(rid):
        rid = int(rid)
        roster_ids.add(rid)
        return sides.setdefault(str(rid), {
            "received": {"players": [], "picks": [], "faab": 0},
            "sent": {"players": [], "picks": [], "faab": 0}
        })

    for pid, rid in (t.get("adds") or {}).items():
        side(rid)["received"]["players"].append(str(pid))
    for pid, rid in (t.get("drops") or {}).items():
        side(rid)["sent"]["players"].append(str(pid))

    for p in (t.get("draft_picks") or []):
        rec = dict(p)
        new_owner = p.get("owner_id")
        prev_owner = p.get("previous_owner_id")
        if new_owner is not None:
            side(new_owner)["received"]["picks"].append(rec)
        if prev_owner is not None:
            side(prev_owner)["sent"]["picks"].append(rec)

    for w in (t.get("waiver_budget") or []):
        sender = w.get("sender")
        receiver = w.get("receiver")
        amount = int(w.get("amount") or 0)
        if sender is not None:
            side(sender)["sent"]["faab"] += amount
        if receiver is not None:
            side(receiver)["received"]["faab"] += amount

    return {
        "transaction_id": t.get("transaction_id"),
        "created": t.get("created"),
        "status": t.get("status"),
        "roster_ids": sorted(roster_ids),
        "sides": sides,
        "raw_draft_picks": t.get("draft_picks") or []
    }


def main():
    current_id, current_league = resolve_current(START_LEAGUE)
    chain = previous_chain(current_id, current_league)

    users = get_json(f"{SLEEPER}/league/{current_id}/users") or []
    rosters = get_json(f"{SLEEPER}/league/{current_id}/rosters") or []
    traded_picks = get_json(f"{SLEEPER}/league/{current_id}/traded_picks") or []
    drafts = get_json(f"{SLEEPER}/league/{current_id}/drafts") or []

    # Documented open API keyed to Sleeper player IDs. One bulk call gives all four value formats.
    try:
        values = get_json(f"{STATS_GUY}/players")
    except Exception as e:
        values = {"error": str(e), "players": []}
    try:
        pick_values = get_json(f"{STATS_GUY}/picks")
    except Exception as e:
        pick_values = {"error": str(e), "picks": []}

    seasons = []
    all_trades = []
    for lid, league in chain:
        tx = all_transactions(lid)
        trades = [t for t in tx if t.get("type") == "trade" and t.get("status") == "complete"]
        ledgers = [build_trade_ledger(t) for t in trades]
        seasons.append({
            "league_id": lid,
            "season": league.get("season"),
            "name": league.get("name"),
            "users": get_json(f"{SLEEPER}/league/{lid}/users") or [],
            "trades": ledgers
        })
        for tr in ledgers:
            tr["league_id"] = lid
            tr["season"] = league.get("season")
            all_trades.append(tr)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "sleeper": "public read-only API",
            "values": "Stats Guy Fantasy documented public API"
        },
        "start_league_id": START_LEAGUE,
        "current_league_id": current_id,
        "league": current_league,
        "users": users,
        "rosters": rosters,
        "traded_picks": traded_picks,
        "drafts": drafts,
        "seasons": seasons,
        "trades": sorted(all_trades, key=lambda x: x.get("created") or 0, reverse=True),
        "values": values,
        "pick_values": pick_values
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {OUT}: {len(rosters)} rosters, {len(all_trades)} completed trades")


if __name__ == "__main__":
    main()
