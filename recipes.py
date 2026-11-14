"""Recipe source: sample dishes + recipes pulled once from RecipeDB + what users saved. No live API calls (tokens are limited).
Privacy is enforced HERE, on the server: Private = only the author, Community = signed-in people, Public = everyone."""
import json
from pathlib import Path
import db, flavor

_BASE = json.loads((Path(__file__).parent / "data" / "recipes.json").read_text(encoding="utf-8"))
for _i, _r in enumerate(_BASE):
    _r["id"] = f"base-{_i}"

_API_FILE = Path(__file__).parent / "data" / "recipes_api.json"
_API = json.loads(_API_FILE.read_text(encoding="utf-8")) if _API_FILE.exists() else []   # pulled once by scripts/seed_from_api.py
for _j, _r in enumerate(_API):
    _r.update(id=f"api-{_r.get('api_id', _j)}")
    _r["ingredients"] = list(dict.fromkeys(flavor.norm(i) for i in _r["ingredients"]))

SEED_AUTHORS = sorted({r.get("by") for r in _BASE + _API if r.get("by")})

def can_see(r, viewer):
    p = r.get("privacy", "Public")
    if p == "Public" or r.get("user_id") is None and p != "Private":
        return True
    if p == "Private":
        return viewer is not None and r.get("user_id") == viewer
    return viewer is not None          # Community

def all_recipes(viewer=None):
    seeded, ids = _BASE + _API, db.seed_ids()
    for r in seeded:
        r["user_id"] = ids.get(r.get("by"))
    return seeded + [r for r in db.all_saved() if can_see(r, viewer)]

def get(rid, viewer=None):
    return next((r for r in all_recipes(viewer) if r["id"] == rid), None)
