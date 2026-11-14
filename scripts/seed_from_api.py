"""ONE-TIME data pull from the FoodoScope APIs (run on the event network).
Our key has only 100 tokens (1 per successful call), so we pull once, save to data/*.json, and the app serves from files.
    python scripts/seed_from_api.py
Responses are cached on disk by the starter client, so re-running costs nothing."""
import json, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from foodoscope import Foodoscope, FoodoscopeError
import apiparse

BUDGET = 80                       # safety cap on calls in this script
ALIAS = {"lentil": "dal"}         # RecipeDB name -> the name our app uses
CORE = ["onion", "garlic", "ginger", "cumin", "turmeric", "tomato", "potato", "rice", "lentil", "spinach", "coriander", "lemon"]
TITLES = ["dal", "rice", "potato", "spinach"]
REGIONS = ["Indian Subcontinent", "Thai", "Italian", "Mexican", "Middle Eastern", "Japanese", "Scandinavian", "Northern Africa"]   # regions chips on Discover
PER_REGION = 2                    # recipes per region: 1 list call + PER_REGION detail calls each (about 24 tokens in all)
fs, calls = Foodoscope(), 0

def call(path, **p):
    global calls
    if calls >= BUDGET:
        raise SystemExit("Call budget reached, stopping to protect tokens.")
    calls += 1
    return fs.get(path, **p)

notes, raw = {}, ROOT / "data" / "raw"
raw.mkdir(exist_ok=True)
for ing in CORE:
    try:
        fid = apiparse.flavordb_id(call("/recipe2-api/connections/links", ingredient=ing, page=1, limit=1))
        if not fid:
            continue
        mol = call(f"/flavordb/entities/by-id/{fid}/molecules-compact")
        (raw / f"flavor_{ing}.json").write_text(json.dumps(mol)[:20000])      # kept to inspect the real shape
        n = apiparse.extract_notes(mol)
        if n:
            notes[ALIAS.get(ing, ing)] = n
        print(ing, "->", n)
    except FoodoscopeError as e:
        print("skip", ing, e)
(ROOT / "data" / "flavor_cache.json").write_text(json.dumps(notes, indent=1))

recipes, seen = [], set()
for t in TITLES:
    try:
        lst = call("/recipe2-api/recipe-bytitle/recipeByTitle", title=t, page=1, limit=3)
        for item in lst.get("data", []):
            rid = item["Recipe_id"]
            if rid in seen:
                continue
            seen.add(rid)
            rec = apiparse.recipe_from_api(call(f"/recipe2-api/search-recipe/{rid}"))
            if len(rec["ingredients"]) >= 3:
                recipes.append(rec)
    except FoodoscopeError as e:
        print("skip", t, e)
# Regions: a few recipes from each region, so Discover can filter by region, cuisine and diet
for reg in REGIONS:
    try:
        lst = call("/recipe2-api/recipe/region-diet/region-diet", region=reg, diet="vegetarian", page=1, limit=PER_REGION)
        for item in lst.get("data", [])[:PER_REGION]:
            rid = item["Recipe_id"]
            if rid in seen:
                continue
            seen.add(rid)
            rec = apiparse.recipe_from_api(call(f"/recipe2-api/search-recipe/{rid}"))
            if len(rec["ingredients"]) >= 3:
                rec["region"] = rec["cuisine"] = reg
                recipes.append(rec)
    except (FoodoscopeError, KeyError, TypeError, ValueError) as e:
        print("skip region", reg, repr(e))
(ROOT / "data" / "recipes_api.json").write_text(json.dumps(recipes, indent=1))

# Pairings: what FlavorDB says goes well with our core ingredients (1 call each, about 12 tokens)
pairs = {}
for ing in CORE:
    try:
        res = call("/flavordb/food/by-alias", food_pair=ing)
        (raw / f"pairs_{ing}.json").write_text(json.dumps(res)[:20000])
        p = apiparse.extract_pairs(res, ing)
        if p:
            pairs[ALIAS.get(ing, ing)] = p
        print(ing, "pairs with", p)
    except (FoodoscopeError, KeyError, TypeError, ValueError) as e:
        print("skip pairs", ing, repr(e))
(ROOT / "data" / "pairings.json").write_text(json.dumps(pairs, indent=1))
print(f"Saved {len(notes)} flavour profiles, {len(recipes)} recipes and {len(pairs)} pairing lists using about {calls} calls.")
