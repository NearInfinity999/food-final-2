"""Turns FoodoScope API responses into our own simple formats. Pure functions, easy to test offline."""
import re
from collections import Counter

def walk(o):
    """Yield every (key, value) pair in nested JSON."""
    if isinstance(o, dict):
        for k, v in o.items():
            yield k, v
            yield from walk(v)
    elif isinstance(o, list):
        for i in o:
            yield from walk(i)

def extract_notes(payload, top=8):
    """Collect flavour/taste/aroma words from a FlavorDB response (shape-tolerant on purpose)."""
    c = Counter()
    for k, v in walk(payload):
        if isinstance(v, str) and re.search(r"flavou?r|taste|aroma", str(k), re.I):
            for w in re.split(r"[@|;,/]+", v):
                w = w.strip().lower()
                if 2 < len(w) < 24 and not re.search(r"\d", w):
                    c[w] += 1
    return [w for w, _ in c.most_common(top)]

def flavordb_id(links_payload):
    """From /recipe2-api/connections/links: the FlavorDB entity id of the ingredient."""
    for item in links_payload.get("data", []):
        i = (item.get("recipe") or {}).get("flavordb_id") or (item.get("entity") or {}).get("entity_id")
        if i:
            return str(i)
    return None

def recipe_from_api(detail):
    """From /recipe2-api/search-recipe/<id>: our recipe format."""
    d = detail["data"]
    r, ings = d["recipe"], d.get("ingredients", [])
    names = []
    for i in ings:
        n = str(i.get("ingredient", "")).strip().lower()
        if n and n not in ("water", "salt") and n not in names:
            names.append(n)
    text = " ".join(s.get("steps", "") for s in d.get("instructions", []))
    steps = [s.strip().capitalize() + "." for s in re.split(r"\s*[;.]\s*", text) if len(s.strip()) > 8][:6]
    procs = [p for p in str(r.get("Processes", "")).split("||") if p]
    mins = r.get("total_time") or r.get("Total_time") or r.get("cook_time")
    return {"name": r.get("Recipe_title", "").strip().title(), "region": r.get("Region") or "Any",
            "cuisine": r.get("Region") or "", "time": int(mins) if str(mins or "").isdigit() and int(mins) > 0 else None,
            "method": procs[0] if procs else "mixed", "taste": [], "ingredients": names, "steps": steps,
            "note": "", "story": f"A {r.get('Sub_region') or r.get('Region') or 'world'} recipe from RecipeDB.",
            "by": "RecipeDB", "source": "RecipeDB", "api_id": str(r.get("Recipe_id", ""))}

def extract_pairs(payload, query, top=8):
    """From /flavordb/food/by-alias: names of foods FlavorDB pairs with `query` (shape-tolerant, like extract_notes)."""
    c = Counter()
    for k, v in walk(payload):
        if isinstance(v, str) and re.search(r"alias|name|pair", str(k), re.I):
            w = v.strip().lower()
            if 2 < len(w) < 30 and not re.search(r"\d", w) and w != query.lower():
                c[w] += 1
    return [w for w, _ in c.most_common(top)]
