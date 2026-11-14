"""Core brain: rank recipes (Cook), search and adapt them (Recreate)."""
import re
import flavor

STOP = set("want something like the that made with about use bad mother grandmother half remember dish and for you have going".split())

def words(text):
    return [flavor.norm(w) for w in re.split(r"[^a-z]+", text.lower()) if len(w) > 2 and w not in STOP]

def analyse(r, have, pool):
    ing = r["ingredients"]
    got = [i for i in ing if i in have]
    miss = [i for i in ing if i not in have]
    swaps = []
    for m in miss:
        s = flavor.best_swap(m, [p for p in pool if p not in ing])
        if s:
            swaps.append({"from": m, **s})
    return got, miss, swaps

def similar(r, recipes):
    out = [o["name"] for o in recipes if o["id"] != r["id"] and
           (o["method"] == r["method"] or len(set(o["ingredients"]) & set(r["ingredients"])) >= 2)]
    return out[:2]

def rank(recipes, have, soon, note, region, limit=4):
    ws = words(note)
    res = []
    for r in recipes:
        if region and r["region"] not in (region, "Any"):
            continue
        got, miss, swaps = analyse(r, have, have)
        if not got:
            continue
        hay = " ".join([r["name"], " ".join(r["taste"]), r.get("note", ""), " ".join(r["ingredients"])]).lower()
        hits = sum(1 for w in ws if w in hay)
        use_soon = [i for i in r["ingredients"] if i in soon]
        score = len(got) / len(r["ingredients"]) + 0.15 * len(use_soon) + 0.05 * len(swaps) + 0.1 * min(hits, 3)
        res.append((score, {"id": r["id"], "name": r["name"], "region": r["region"], "method": r["method"],
                            "source": r["source"], "by": r.get("by", ""), "note": r.get("note", ""),
                            "have": got, "missing": miss, "swaps": swaps, "uses_soon": use_soon,
                            "steps": r["steps"], "taste": r["taste"], "similar": similar(r, recipes),
                            "drink": flavor.pair_drink(r["ingredients"])}))
    res.sort(key=lambda x: -x[0])
    return [r for _, r in res[:limit]]

def label(c):
    return "Likely very close" if c >= 0.6 else "Likely close" if c >= 0.4 else "A looser echo of the original"

def adapt(r, have, simple=True):
    ing = r["ingredients"]
    pool = have + ([c for c in flavor.COMMON if c not in have] if simple else [])
    core = ing[:3]
    swaps, need, dropped = {}, [], []
    for m in [i for i in ing if i not in have]:
        s = flavor.best_swap(m, [p for p in pool if p not in ing])
        if s:
            swaps[m] = s
        elif m in core:
            need.append(m)
        else:
            dropped.append(m)
    new_ing = [i if i in have else swaps[i]["to"] for i in ing if i in have or i in swaps]
    steps = []
    for s in r["steps"]:
        for k, v in swaps.items():
            s = s.replace(k, v["to"])
        steps.append(s)
    if simple:
        steps = [s for s in steps if not any(d in s.lower() and len(s.split()) < 8 for d in dropped)]
        if len(steps) > 3:
            steps = [steps[0], " Then ".join(steps[1:-1]), steps[-1]]
    closeness = flavor.overlap(flavor.notes_of(ing), flavor.notes_of(new_ing))
    return {"id": r["id"], "name": r["name"], "by": r.get("by", ""), "kind": r.get("kind", ""),
            "created": r.get("created", ""), "note": r.get("note", ""), "source": r["source"],
            "have": [i for i in ing if i in have], "swaps": [{"from": k, **v} for k, v in swaps.items()],
            "need": need, "dropped": dropped, "steps": steps, "new_ingredients": new_ing,
            "closeness": label(closeness), "taste": r["taste"], "region": r["region"], "method": r["method"]}

def search_and_adapt(recipes, query, have, region, simple, limit=3):
    ws = words(query)
    scored = []
    for r in recipes:
        if region and r["region"] not in (region, "Any"):
            continue
        hay = " ".join([r["name"], " ".join(r["ingredients"]), " ".join(r["taste"]), r.get("note", "")]).lower()
        hits = sum(1 for w in ws if w in hay)
        if ws and not hits:
            continue
        scored.append((hits, 1 if r.get("by") else 0, r))
    scored.sort(key=lambda x: (-x[0], -x[1]))
    return [adapt(r, have, simple) for _, _, r in scored[:limit]]

def related(r, recipes, lens="flavour", limit=3):
    """Dishes connected to r through shared flavour notes (or shared ingredients)."""
    allowed = flavor.LENS.get(lens)
    base = flavor.notes_of(r["ingredients"])
    out = []
    for o in recipes:
        if o["id"] == r["id"] or o["name"] == r["name"] or o.get("parent") == r["name"]:
            continue
        if lens == "ingredients":
            shared = sorted(set(r["ingredients"]) & set(o["ingredients"]))
            score = len(shared)
        else:
            a, b = flavor.notes_of(o["ingredients"]), base
            if allowed:
                a, b = a & allowed, b & allowed
            shared, score = sorted(a & b), flavor.overlap(a, b)
        if shared and score > 0:
            out.append((score, o, shared))
    out.sort(key=lambda x: -x[0])
    return [{"id": o["id"], "name": o["name"], "shared": s, "by": o.get("by", ""),
             "badge": "From RecipeDB" if lens == "ingredients" else "Flavour reference",
             "text": "Connected through shared " + ", ".join(s[:3]) + (" ingredients" if lens == "ingredients" else " notes")}
            for _, o, s in out[:limit]]

def descendants(root_name, recipes):
    out, queue = [], [root_name]
    while queue:
        n = queue.pop(0)
        for o in recipes:
            if o.get("parent") == n and o not in out:
                out.append(o); queue.append(o["name"])
    return out

def root_of(r, recipes):
    seen = set()
    while r.get("parent") and r["name"] not in seen:
        seen.add(r["name"])
        p = next((o for o in recipes if o["name"] == r["parent"]), None)
        if not p:
            break
        r = p
    return r

def kitchen(recipes, have, soon, region="", max_min=0, limit=8):
    """My Kitchen: what can I cook with what I have? Counts ingredients ("uses 5 of 7"), never percentages."""
    res = []
    for r in recipes:
        if region and r["region"] not in (region, "Any"):
            continue
        t = flavor.minutes(r)
        if max_min and t > max_min:
            continue
        got, miss, swaps = analyse(r, have, have)
        if not got:
            continue
        use_soon = [i for i in r["ingredients"] if i in soon]
        score = len(got) / len(r["ingredients"]) + 0.2 * len(use_soon) + 0.05 * len(swaps) - 0.02 * len(miss)
        res.append((score, {"id": r["id"], "name": r["name"], "region": r["region"], "cuisine": flavor.cuisine(r),
                            "minutes": t, "uses": len(got), "of": len(r["ingredients"]), "have": got, "missing": miss,
                            "swaps": swaps, "uses_soon": use_soon, "by": r.get("by", ""), "source": r["source"],
                            "taste": r.get("taste", []), "ingredients": r["ingredients"]}))
    res.sort(key=lambda x: -x[0])
    return [r for _, r in res[:limit]]

def pairs(r, pool, limit=3):
    """'Pairs well with': Echo pairs share flavour notes, Contrast pairs balance the dish. Each carries a reason and an evidence badge."""
    base = flavor.notes_of(r["ingredients"])
    cands = [o for o in pool if o["id"] != r["id"] and o["name"] != r["name"] and o.get("parent") != r["name"] and r.get("parent") != o["name"]]
    echo, contrast, used = [], [], set()
    for o in cands:
        on = flavor.notes_of(o["ingredients"])
        shared = sorted((on & base) - {"neutral"})
        if shared:
            echo.append((flavor.overlap(on, base), o, shared))
    echo.sort(key=lambda x: -x[0])
    for want_base, want_other, why in flavor.CONTRAST:
        if not (base & want_base):
            continue
        best = max(((len(flavor.notes_of(o["ingredients"]) & want_other), o) for o in cands if o["name"] not in used), key=lambda x: x[0], default=(0, None))
        if best[0]:
            contrast.append((best[1], why, sorted(flavor.notes_of(best[1]["ingredients"]) & want_other)))
            used.add(best[1]["name"])
    out = []
    for o, why, notes in contrast[:1]:
        out.append({"kind": "contrast", "id": o["id"], "name": o["name"], "text": why, "notes": notes,
                    "badge": "Our rule"})
    for _, o, shared in echo:
        if len(out) >= limit:
            break
        if o["name"] in used:
            continue
        used.add(o["name"])
        linked = flavor.flavordb_linked(r["ingredients"], o["ingredients"])
        out.append({"kind": "echo", "id": o["id"], "name": o["name"], "notes": shared,
                    "text": "Shares " + ", ".join(shared[:3]) + " notes",
                    "badge": "FlavorDB pairing" if linked else "Flavour reference"})
    for o, why, notes in contrast[1:]:
        if len(out) >= limit:
            break
        out.append({"kind": "contrast", "id": o["id"], "name": o["name"], "text": why, "notes": notes, "badge": "Our rule"})
    return out[:limit]
