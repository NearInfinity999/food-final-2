"""Our own storage: users, the dishes they SAVE, follows and likes. RecipeDB cannot store these, so this is our unique value."""
import json, os, sqlite3
from datetime import date

PATH = os.getenv("DB_PATH", "echo.db")

def _conn():
    c = sqlite3.connect(PATH)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c

def init(seed_names=()):
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS saved(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, ingredients TEXT, steps TEXT,
            taste TEXT, region TEXT, method TEXT, kind TEXT, note TEXT, parent TEXT, created TEXT)""")
        have = [r[1] for r in c.execute("PRAGMA table_info(saved)")]
        for col in ("story", "privacy", "sensory"):
            if col not in have:
                c.execute(f"ALTER TABLE saved ADD COLUMN {col} TEXT DEFAULT ''")
        if "user_id" not in have:
            c.execute("ALTER TABLE saved ADD COLUMN user_id INTEGER")
        c.execute("""CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE,
            pw_hash TEXT NOT NULL DEFAULT '', bio TEXT DEFAULT '', is_seed INTEGER DEFAULT 0, created TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS follows(
            follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY(follower_id, followee_id))""")
        c.execute("""CREATE TABLE IF NOT EXISTS likes(
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rid TEXT NOT NULL, PRIMARY KEY(user_id, rid))""")
        # Seed authors (Echo Archive, Priya S. ...) become followable cooks. They have no password, so nobody can log in as them.
        for n in seed_names:
            if n and not c.execute("SELECT 1 FROM users WHERE is_seed=1 AND name=?", (n,)).fetchone():
                c.execute("INSERT INTO users(name,email,pw_hash,bio,is_seed,created) VALUES(?,NULL,'',?,1,?)",
                          (n, f"Recipes shared by {n}.", date.today().isoformat()))

# ---------- users ----------
def _user(r):
    return {"id": r["id"], "name": r["name"], "bio": r["bio"] or "", "is_seed": bool(r["is_seed"])} if r else None

def create_user(name, email, pw_hash):
    with _conn() as c:
        cur = c.execute("INSERT INTO users(name,email,pw_hash,bio,created) VALUES(?,?,?,'',?)",
                        (name, email, pw_hash, date.today().isoformat()))
        return cur.lastrowid

def user_by_email(email):
    with _conn() as c:
        return c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()

def user(uid):
    with _conn() as c:
        return _user(c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())

def seed_user_id(name):
    with _conn() as c:
        r = c.execute("SELECT id FROM users WHERE is_seed=1 AND name=?", (name,)).fetchone()
        return r["id"] if r else None

def seed_ids():
    with _conn() as c:
        return {r["name"]: r["id"] for r in c.execute("SELECT id,name FROM users WHERE is_seed=1")}

def update_user(uid, name=None, bio=None):
    with _conn() as c:
        if name is not None:
            c.execute("UPDATE users SET name=? WHERE id=?", (name, uid))
        if bio is not None:
            c.execute("UPDATE users SET bio=? WHERE id=?", (bio, uid))

def delete_user(uid):
    """Delete-my-account: the person, their dishes, follows and likes all go."""
    with _conn() as c:
        c.execute("DELETE FROM saved WHERE user_id=?", (uid,))
        c.execute("DELETE FROM follows WHERE follower_id=? OR followee_id=?", (uid, uid))
        c.execute("DELETE FROM likes WHERE user_id=?", (uid,))
        c.execute("DELETE FROM users WHERE id=?", (uid,))

# ---------- follows ----------
def follow(a, b, on=True):
    with _conn() as c:
        if on:
            c.execute("INSERT OR IGNORE INTO follows VALUES(?,?)", (a, b))
        else:
            c.execute("DELETE FROM follows WHERE follower_id=? AND followee_id=?", (a, b))

def following_ids(uid):
    with _conn() as c:
        return [r[0] for r in c.execute("SELECT followee_id FROM follows WHERE follower_id=?", (uid,))]

def follower_count(uid):
    with _conn() as c:
        return c.execute("SELECT COUNT(*) FROM follows WHERE followee_id=?", (uid,)).fetchone()[0]

def following_count(uid):
    with _conn() as c:
        return c.execute("SELECT COUNT(*) FROM follows WHERE follower_id=?", (uid,)).fetchone()[0]

# ---------- likes ----------
def toggle_like(uid, rid):
    with _conn() as c:
        if c.execute("SELECT 1 FROM likes WHERE user_id=? AND rid=?", (uid, rid)).fetchone():
            c.execute("DELETE FROM likes WHERE user_id=? AND rid=?", (uid, rid)); return False
        c.execute("INSERT INTO likes VALUES(?,?)", (uid, rid)); return True

def like_counts():
    with _conn() as c:
        return {r[0]: r[1] for r in c.execute("SELECT rid, COUNT(*) FROM likes GROUP BY rid")}

def liked_by(uid):
    with _conn() as c:
        return {r[0] for r in c.execute("SELECT rid FROM likes WHERE user_id=?", (uid,))}

# ---------- saved dishes ----------
def add(rec, uid):
    with _conn() as c:
        cur = c.execute(
            "INSERT INTO saved(name,ingredients,steps,taste,region,method,kind,note,parent,created,story,privacy,sensory,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (rec["name"], json.dumps(rec["ingredients"]), json.dumps(rec.get("steps", [])),
             json.dumps(rec.get("taste", [])), rec.get("region", "Any"), rec.get("method", "my version"),
             rec.get("kind", "Experiment"), rec.get("note", ""), rec.get("parent", ""), date.today().isoformat(),
             rec.get("story", ""), rec.get("privacy", "Private"), json.dumps(rec.get("sensory", [])), uid))
        return cur.lastrowid

def all_saved():
    """Every saved dish with its author. Who may SEE each one is decided in recipes.py, on the server."""
    with _conn() as c:
        rows = c.execute("SELECT s.*, u.name AS author FROM saved s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.id DESC").fetchall()
    return [{"id": f"saved-{r['id']}", "name": r["name"], "ingredients": json.loads(r["ingredients"]),
             "steps": json.loads(r["steps"]), "taste": json.loads(r["taste"]), "region": r["region"],
             "method": r["method"], "kind": r["kind"], "note": r["note"], "parent": r["parent"],
             "created": r["created"], "source": "My recipe", "by": r["author"] or "Echo cook", "user_id": r["user_id"],
             "story": r["story"] or r["note"], "privacy": r["privacy"] or "Private",
             "sensory": json.loads(r["sensory"] or "[]")} for r in rows]

def delete(rid, uid):
    with _conn() as c:
        c.execute("DELETE FROM saved WHERE id=? AND user_id=?", (rid, uid))
