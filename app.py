"""Web server. Run: python app.py  then open http://localhost:5000"""
import os, re, secrets, time
from collections import Counter, defaultdict
from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash
try:
    from dotenv import load_dotenv; load_dotenv()
except ImportError:
    pass
import db, flavor, recipes, engine

app = Flask(__name__, static_folder="static")
db.init(recipes.SEED_AUTHORS)

# ---------- security settings ----------
# SECRET_KEY lives in .env (never in git). Without one we make a throwaway key, so logins reset whenever the server restarts.
if not os.getenv("SECRET_KEY"):
    print("WARNING: SECRET_KEY is not set in .env, using a temporary one. Run: python -c \"import secrets;print(secrets.token_hex(32))\"")
app.config.update(SECRET_KEY=os.getenv("SECRET_KEY") or secrets.token_hex(32),
                  SESSION_COOKIE_HTTPONLY=True,                       # JavaScript cannot read the cookie
                  SESSION_COOKIE_SAMESITE="Lax",                      # other sites cannot make the browser send it on a POST
                  SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE") == "1",   # set COOKIE_SECURE=1 once the site is on https
                  PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 14)

@app.before_request
def csrf_guard():
    """Changing requests must come from our own page (it sends this header; a plain cross-site form cannot)."""
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.path.startswith("/api/") \
            and request.headers.get("X-Requested-With") != "echo":
        return jsonify(error="Blocked request"), 403

@app.after_request
def headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Cache-Control"] = "no-store" if request.path.startswith("/api/") else resp.headers.get("Cache-Control", "")
    return resp

FAILS = defaultdict(list)          # login attempt limits: (ip, email) -> times of recent failures
MAX_FAILS, WINDOW = 5, 15 * 60

def locked(key):
    FAILS[key] = [t for t in FAILS[key] if time.time() - t < WINDOW]
    return len(FAILS[key]) >= MAX_FAILS

def me():
    uid = session.get("uid")
    u = db.user(uid) if uid else None
    if uid and not u:
        session.clear()
    return u

def viewer():
    u = me()
    return u["id"] if u else None

def need_login():
    return jsonify(error="Please log in first"), 401

def clean(items):
    return [flavor.norm(i) for i in items if str(i).strip()]

def R():
    return recipes.all_recipes(viewer())

@app.get("/")
def index():
    return send_from_directory("static", "index.html")

# ---------- accounts ----------
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def public_me(u):
    return {**u, "following": db.following_count(u["id"]), "followers": db.follower_count(u["id"])} if u else None

@app.post("/api/signup")
def signup():
    d = request.get_json(force=True)
    name, email, pw = str(d.get("name", "")).strip()[:40], str(d.get("email", "")).strip().lower(), str(d.get("password", ""))
    if not name or not EMAIL.match(email):
        return jsonify(error="Enter your name and a valid email"), 400
    if len(pw) < 8:
        return jsonify(error="Password needs at least 8 characters"), 400
    if db.user_by_email(email):
        return jsonify(error="That email already has an account. Try logging in."), 409
    uid = db.create_user(name, email, generate_password_hash(pw))     # hashed: the password itself is never stored
    session.clear(); session["uid"] = uid; session.permanent = True
    return jsonify(public_me(db.user(uid)))

@app.post("/api/login")
def login():
    d = request.get_json(force=True)
    email, pw = str(d.get("email", "")).strip().lower(), str(d.get("password", ""))
    key = (request.remote_addr, email)
    if locked(key):
        return jsonify(error="Too many attempts. Try again in 15 minutes."), 429
    row = db.user_by_email(email)
    if not row or not row["pw_hash"] or not check_password_hash(row["pw_hash"], pw):
        FAILS[key].append(time.time())
        return jsonify(error="Email or password is not right"), 401
    FAILS.pop(key, None)
    session.clear(); session["uid"] = row["id"]; session.permanent = True
    return jsonify(public_me(db.user(row["id"])))

@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)

@app.get("/api/me")
def whoami():
    return jsonify(public_me(me()))

@app.patch("/api/me")
def edit_me():
    u = me()
    if not u:
        return need_login()
    d = request.get_json(force=True)
    name = str(d["name"]).strip()[:40] if "name" in d else None
    if name == "":
        return jsonify(error="Name cannot be empty"), 400
    db.update_user(u["id"], name, str(d["bio"]).strip()[:160] if "bio" in d else None)
    return jsonify(public_me(db.user(u["id"])))

@app.delete("/api/account")
def delete_account():
    u = me()
    if not u:
        return need_login()
    d = request.get_json(silent=True) or {}
    full = db.user_by_email(str(d.get("email", "")).strip().lower())
    if not full or full["id"] != u["id"] or not check_password_hash(full["pw_hash"], str(d.get("password", ""))):
        return jsonify(error="Enter your email and password to confirm"), 403
    db.delete_user(u["id"])
    session.clear()
    return jsonify(ok=True)

# ---------- cook / save / recreate ----------
@app.post("/api/suggest")
def suggest():
    d = request.get_json(force=True)
    have, soon = clean(d.get("ingredients", [])), clean(d.get("soon", []))
    return jsonify(engine.rank(R(), have, soon, d.get("note", ""), d.get("region", "")))

@app.post("/api/kitchen")                      # My Kitchen: recipes from what you have, no API tokens used
def kitchen():
    d = request.get_json(force=True)
    have, soon = clean(d.get("ingredients", [])), clean(d.get("soon", []))
    if not have:
        return jsonify([])
    try:
        mx = int(d.get("max_min") or 0)
    except (TypeError, ValueError):
        mx = 0
    return jsonify(engine.kitchen(R(), have, soon, d.get("region", ""), mx))

@app.post("/api/save")
def save():
    u = me()
    if not u:
        return need_login()
    d = request.get_json(force=True)
    d["ingredients"] = clean(d.get("ingredients", []))
    if not str(d.get("name", "")).strip():
        return jsonify(error="Please say what you are sharing"), 400
    if d.get("privacy") not in ("Private", "Community", "Public"):
        d["privacy"] = "Community"
    return jsonify(id=db.add(d, u["id"]))

@app.get("/api/saved")                         # the signed-in person's own dishes, any privacy
def saved():
    uid = viewer()
    return jsonify([r for r in db.all_saved() if r["user_id"] == uid] if uid else [])

@app.delete("/api/saved/<int:rid>")
def remove(rid):
    uid = viewer()
    if not uid:
        return need_login()
    db.delete(rid, uid)
    return jsonify(ok=True)

@app.post("/api/recreate")
def recreate():
    d = request.get_json(force=True)
    if d.get("recipe_id"):
        r = recipes.get(d["recipe_id"], viewer())
        return jsonify([engine.adapt(r, clean(d.get("ingredients", [])), d.get("simple", True))] if r else [])
    return jsonify(engine.search_and_adapt(R(), d.get("query", ""), clean(d.get("ingredients", [])),
                                           d.get("region", ""), d.get("simple", True)))

COMMUNITIES = [
    {"id": "c1", "name": "Smoky Flavour Seekers", "members": 1240, "tag": "Sensory", "exp": "Can we recreate smoky flavour with household ingredients?"},
    {"id": "c2", "name": "Tadka & Tempering Circle", "members": 860, "tag": "Technique", "exp": "Ghee vs mustard oil: whose tadka wins?"},
    {"id": "c3", "name": "South Indian Home Kitchens", "members": 2100, "tag": "Regional", "exp": "Rasam without tamarind: what works?"},
    {"id": "c4", "name": "Students Cooking Away From Home", "members": 3400, "tag": "Interest", "exp": "One-pot meals from a hostel shelf."}]

def card(r, counts, likes=None, mine=()):
    ing = r["ingredients"]
    likes = likes or {}
    return {"id": r["id"], "name": r["name"], "region": r["region"], "cuisine": flavor.cuisine(r), "by": r.get("by") or "You",
            "author_id": r.get("user_id"), "story": (r.get("story") or r.get("note") or "")[:140],
            "tags": flavor.top_notes(ing), "chips": flavor.chips_for(ing), "echoes": counts.get(r["name"], 0),
            "likes": likes.get(r["id"], 0), "liked": r["id"] in mine, "diets": flavor.diets(ing), "minutes": flavor.minutes(r),
            "method": r["method"], "source": r["source"], "ingredients": ing, "parent": r.get("parent", ""),
            "privacy": r.get("privacy", "Public")}

def ctx(rs):
    uid = viewer()
    return Counter(r.get("parent", "") for r in rs), db.like_counts(), (db.liked_by(uid) if uid else set())

@app.get("/api/dishes")                        # Home feed + Discover, with filters
def dishes():
    rs = R()
    counts, likes, mine = ctx(rs)
    a = request.args
    chip, q, region, cuisine, diet, method = (a.get(k, "") for k in ("chip", "q", "region", "cuisine", "diet", "method"))
    q = q.lower()
    try:
        max_min = int(a.get("time") or 0)
    except ValueError:
        max_min = 0
    follow = set(db.following_ids(viewer())) if a.get("tab") == "following" and viewer() else None
    if a.get("tab") == "following" and follow is None:
        return jsonify([])
    out = []
    for r in rs:
        if r.get("privacy", "Community") == "Private" and r.get("user_id") != viewer():
            continue
        if follow is not None and r.get("user_id") not in follow:
            continue
        c = card(r, counts, likes, mine)
        if chip and chip not in c["chips"]: continue
        if region and r["region"] != region: continue
        if cuisine and c["cuisine"] != cuisine: continue
        if diet and diet not in c["diets"]: continue
        if method and r["method"] != method: continue
        if max_min and c["minutes"] > max_min: continue
        if q and q not in (r["name"] + " " + " ".join(r["ingredients"]) + " " + c["story"]).lower(): continue
        out.append(c)
    if a.get("sort") == "new":
        out.sort(key=lambda c: (c["id"].startswith("saved-"), int(c["id"].split("-")[-1]) if c["id"].split("-")[-1].isdigit() else 0), reverse=True)
    return jsonify(out)

@app.get("/api/filters")                       # what the Discover filter chips offer
def filters():
    rs = [r for r in R() if r.get("privacy", "Public") != "Private"]
    hide = {"Any", "seed", "my version", "mixed"}      # internal placeholders, not worth a filter chip
    cnt = lambda f: [k for k, _ in Counter(f(r) for r in rs).most_common() if k and k not in hide]
    return jsonify({"regions": cnt(lambda r: r["region"]), "cuisines": cnt(flavor.cuisine), "methods": cnt(lambda r: r["method"]),
                    "diets": ["vegan", "vegetarian", "pescetarian"], "times": [15, 30, 45], "tastes": list(flavor.CHIPS)})

@app.post("/api/like/<rid>")
def like(rid):
    uid = viewer()
    if not uid:
        return need_login()
    if not recipes.get(rid, uid):
        return jsonify(error="not found"), 404
    on = db.toggle_like(uid, rid)
    return jsonify(liked=on, likes=db.like_counts().get(rid, 0))

@app.get("/api/dish/<rid>")                    # Dish detail
def dish(rid):
    rs = R()
    r = next((x for x in rs if x["id"] == rid), None)
    if not r:
        return jsonify(error="not found"), 404
    counts, likes, mine = ctx(rs)
    badge = "From RecipeDB" if r["source"].startswith("RecipeDB") else "Community-reported"
    ings = [{"name": i, "badge": badge, "notes": sorted(flavor.notes(i))} for i in r["ingredients"]]
    pool = [x for x in rs if x.get("privacy", "Public") != "Private"]
    return jsonify({**card(r, counts, likes, mine), "steps": r["steps"], "note": r.get("note", ""),
                    "method": r["method"], "ingredient_details": ings,
                    "pairs": engine.pairs(r, pool),
                    "variations": [card(v, Counter(), likes, mine) for v in engine.descendants(r["name"], rs)]})

@app.get("/api/explore/<rid>")                 # Explore lenses
def explore(rid):
    r = recipes.get(rid, viewer())
    return jsonify(engine.related(r, [x for x in R() if x.get("privacy", "Public") != "Private"], request.args.get("lens", "flavour")) if r else [])

@app.get("/api/lineage/<rid>")                 # Lineage tree
def lineage(rid):
    rs = R()
    r = next((x for x in rs if x["id"] == rid), None)
    if not r:
        return jsonify(error="not found"), 404
    root = engine.root_of(r, rs)
    counts, likes, mine = ctx(rs)
    nodes = []
    for v in engine.descendants(root["name"], rs):
        par = next((o for o in rs if o["name"] == v.get("parent")), root)
        stayed = sorted(set(v["ingredients"]) & set(par["ingredients"]))
        gone, new = sorted(set(par["ingredients"]) - set(v["ingredients"])), sorted(set(v["ingredients"]) - set(par["ingredients"]))
        changed, used = [], set()
        for g in gone:
            sw = flavor.best_swap(g, [n for n in new if n not in used])
            if sw:
                changed.append(f"{g} → {sw['to']}"); used.add(sw["to"])
            else:
                changed.append(f"− {g}")
        changed += [f"+ {n}" for n in new if n not in used]
        nodes.append({"id": v["id"], "name": v["name"], "by": v.get("by") or "You", "region": v["region"], "note": v.get("note", ""),
                      "stayed": stayed, "changed": changed, "parent": v.get("parent", "")})
    return jsonify({"root": card(root, Counter(), likes, mine), "nodes": nodes})

@app.get("/api/communities")
def communities():
    return jsonify(COMMUNITIES)

@app.get("/api/profile")
def profile():
    uid = viewer()
    mine = [r for r in db.all_saved() if r["user_id"] == uid] if uid else []
    names = {m["name"] for m in mine}
    inspired = sum(1 for r in R() if r.get("parent") in names)
    return jsonify({"saved": mine, "inspired": inspired})

# ---------- people: profile pages, follow, stories ----------
@app.get("/api/user/<int:uid>")
def person(uid):
    u = db.user(uid)
    if not u:
        return jsonify(error="not found"), 404
    rs = R()
    counts, likes, mine = ctx(rs)
    posts = [card(r, counts, likes, mine) for r in rs if r.get("user_id") == uid]
    v = viewer()
    return jsonify({**u, "followers": db.follower_count(uid), "following": db.following_count(uid), "posts": posts,
                    "is_following": bool(v and uid in db.following_ids(v)), "is_me": v == uid})

@app.post("/api/follow/<int:uid>")
def follow(uid):
    v = viewer()
    if not v:
        return need_login()
    if uid == v or not db.user(uid):
        return jsonify(error="You cannot follow this person"), 400
    on = bool((request.get_json(silent=True) or {}).get("on", True))
    db.follow(v, uid, on)
    return jsonify(is_following=on, followers=db.follower_count(uid))

@app.get("/api/stories")                       # the round row at the top of Home
def stories():
    v = viewer()
    follow = db.following_ids(v) if v else []
    cooks = []
    ids = follow or [i for _, i in sorted(db.seed_ids().items())][:6]
    for i in ids:
        u = db.user(i)
        if u:
            cooks.append({"id": u["id"], "name": u["name"]})
    cs = [k for k, _ in Counter(flavor.cuisine(r) for r in R()).most_common(6)]
    return jsonify({"cuisines": cs, "cooks": cooks, "following": bool(follow)})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
