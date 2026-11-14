# Culinary Echo

> A social hearth for food: share what you cook, trace how a dish changes from kitchen to kitchen, and recreate it with the ingredients you actually have, so less food is wasted today and more recipes survive tomorrow.

| | |
|---|---|
| **Team** | `t27` · Rogue Rebels |
| **Members** | Jatin, Sanjana, Shaurya, Vansh (TODO: add GitHub @handles) |
| **Track / problem statement** | TODO: write your track name |
| **FoodoScope APIs used** | ☑ RecipeDB · ☑ FlavorDB · ☐ CocktailDB *(not used)* |
| **Demo video** | TODO: paste the link (3 min or less, unlisted YouTube or Drive) |
| **Live demo (optional)** | TODO: paste the link or delete this row |

## The problem

Two problems are usually treated separately. Households waste food because they don't know what to cook with random ingredients. And family recipes disappear because they live in one or two people's memory, so the taste is remembered but the dish cannot be remade. Tools that fight waste ignore memory, and tools that save recipes ignore what is in a normal kitchen today.

## What we built

Culinary Echo connects both problems in one loop: **Cook → Save → Recreate → Adapt again.**

- **Discover** dishes by sensory chips (smoky, tangy, crunchy, fermented, fresh, sweet heat) and search.
- **Dish page** with story, ingredients labelled by evidence (*From RecipeDB*, *Flavour reference*, *Community-reported*, *Estimate*), and Explore lenses (whole dish, aroma, texture, ingredient links).
- **Recreate** wizard: choose what to recreate, say what you have, get a practical route with flavour-based swaps, optional items skipped and fewer steps.
- **Share** a dish or memory in seconds (only a name is required), with a privacy setting.
- **Lineage tree**: every version points to its parent, and each node shows *what stayed* and *what changed*.
- **My Kitchen**: type what you have, mark ⏳ *use soon*, optionally pick a region or time limit. Results say "uses 5 of 7 ingredients", list what is missing and suggest swaps. Counts, never percentages. Runs on the saved recipes, so it costs no API tokens.
- **Pairs well with** on every dish page and right after you share a dish: *Echo pairs* share flavour notes, *Contrast pairs* balance the dish (rich with tangy, spicy with cooling). Each shows its reason and an evidence badge.
- **Discover filters**: taste, region, cuisine, diet (vegan, vegetarian, pescetarian), cooking method and time.
- **Accounts, privacy and follow**: sign up and log in, Private / Community / Public posts enforced on the server, follow cooks, a *Following* feed, profile pages with a photo grid, and delete-my-account.
- **Insta-style layout**: bottom tab bar (Home, Discover, +, Communities, Profile), a feed of big photo cards with like and save, a stories row of cuisines and cooks.
- **Communities** and **Collections** for the social side.

![screenshot](docs/images/screenshot.png)

## How we use FoodoScope data

Our key has 100 tokens, so we pull data **once** with `scripts/seed_from_api.py` (cached, under 80 calls) and the app serves from the saved files. The live demo makes no API calls.

Token plan: about 40 for flavour notes and the first recipes, about 24 for 8 regions (1 list call + 2 recipes each), about 12 for pairings. That leaves about 20 spare.

| Endpoint | Why |
|---|---|
| `GET /recipe2-api/recipe-bytitle/recipeByTitle` | Find real recipes (dal, rice, potato, spinach) for the Discover feed |
| `GET /recipe2-api/search-recipe/{id}` | Full ingredients and instructions, converted to our recipe format |
| `GET /recipe2-api/connections/links` | Link a RecipeDB ingredient to its FlavorDB entity id |
| `GET /recipe2-api/recipe/region-diet/region-diet` | A few recipes per region, so Discover can filter by region, cuisine and diet |
| `GET /flavordb/food/by-alias` | Real pairings for about 12 core ingredients, behind the *FlavorDB pairing* badge |
| `GET /flavordb/entities/by-id/{id}/molecules-compact` | Flavour profile terms per ingredient, used to score swaps (shared notes ÷ all notes) and to explain connections |

We do not use CocktailDB. The drink suggestion in the app comes from a small non-alcoholic list of our own.

## Architecture

- **Frontend:** plain HTML, CSS and JavaScript in `static/` (single page, hash routes).
- **Backend:** Flask (`app.py`) with the logic in `engine.py` (ranking, adapting, related dishes, lineage) and `flavor.py` (flavour notes, swap scoring).
- **Data:** `data/` JSON seeded from the FoodoScope gateway, plus SQLite (`echo.db`) for what users share.
- **Flow:** browser → our Flask backend → local data files. The API key is used only by the seed script and never reaches the browser.

## Run it locally

```bash
git clone <this repo> && cd <this repo>
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # paste your API key (campus network only) and a SECRET_KEY
python scripts/seed_from_api.py   # one-time data pull, uses about 40 tokens
python app.py                     # open http://localhost:5000
```
Without the seed step the app still runs on its built-in sample dishes.

## Accounts and privacy

- Passwords are hashed (werkzeug), never stored as typed. We store only name, email and an optional bio.
- Sessions use a signed cookie (HttpOnly, SameSite=Lax; set `COOKIE_SECURE=1` on https). The signing key is `SECRET_KEY` in `.env`, never in git.
- Login is limited to 5 wrong tries per email and address every 15 minutes.
- Private, Community and Public are checked on the server for every dish, feed and profile request, not just hidden in the page.
- Changing requests must carry an `X-Requested-With` header that only our own page sends.
- *Delete my account* removes the profile, dishes, likes and follows.

## What's next

Photo recognition of ingredients, password reset by email, real community spaces, persistent hosted storage, and deeper regional focus.

## Acknowledgements

Data from the [FoodoScope](https://cosylab.iiitd.edu.in) APIs (RecipeDB, FlavorDB) by the Complex Systems Lab, IIIT-Delhi.
Libraries: Flask, Requests, python-dotenv, gunicorn. Fonts: Fraunces and Nunito (Google Fonts). Design: Figma and Google Stitch.
**AI tools used:** Claude (Anthropic) assisted with planning, the product document, the design prompts and drafting the application code, which the team reviewed, tested and edited.

---

<sub>Built at Fork-IT 2026 · ESYA'26 · IIIT-Delhi · 14–15 Nov 2026. Starter docs: [`docs/STARTER_GUIDE.md`](docs/STARTER_GUIDE.md)</sub>
