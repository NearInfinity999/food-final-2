// Culinary Echo frontend. One page, hash routes:
// #/ (home feed) #/discover #/kitchen #/dish/ID #/recreate/ID #/lineage/ID #/share #/posted/ID #/communities #/profile #/u/ID #/login
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// every request carries X-Requested-With: the server refuses changing requests without it (basic CSRF guard)
const api = (p, body, method) => fetch('/api/' + p, {method: method || (body ? 'POST' : 'GET'),
  headers: {'Content-Type': 'application/json', 'X-Requested-With': 'echo'}, body: body ? JSON.stringify(body) : undefined}).then(r => r.json());
const V = html => { $('view').innerHTML = html; };
const split = s => s.split(',').map(x => x.trim()).filter(Boolean);
const toast = t => { const e = $('toast'); e.textContent = t; e.classList.add('s'); setTimeout(() => e.classList.remove('s'), 2200); };
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
let ME = null;                                   // the signed-in person, or null
const loadMe = async () => { ME = await api('me'); drawTop(); };
const needLogin = msg => { toast(msg || 'Log in to do that'); location.hash = '#/login/' + encodeURIComponent(location.hash.slice(2) || ''); };
const CHIPS = ['Smoky', 'Tangy', 'Crunchy & toasted', 'Fermented', 'Fresh & aromatic', 'Sweet heat'];
const EMO = [['dal', '🍲'], ['rice', '🍚'], ['spinach', '🥬'], ['potato', '🥔'], ['tomato', '🍅'], ['mint', '🌿'], ['curd', '🥣']];
const PALETTES = [['#f6c97b', '#e8845a'], ['#cfe3b4', '#6fa66b'], ['#f2b8a2', '#c4472a'], ['#f4dc8e', '#d9a23a'], ['#e9c9a0', '#a8643a'], ['#d9e4a8', '#8fae4a']];
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hue = n => PALETTES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length];
const em = d => (EMO.find(e => (d.ingredients || []).includes(e[0])) || [0, '🍛'])[1];
// pic(d): shows /static/img/<dish-name-slug>.jpg if it exists, otherwise falls back to the emoji
const pic = d => `<img src="/static/img/${slug(d.name)}.jpg" alt="${esc(d.name)}" onerror="this.replaceWith(document.createTextNode('${em(d)}'))">`;
const art = (d, cls) => `<div class="art ${cls || ''}" style="background:linear-gradient(135deg,${hue(d.name)[0]},${hue(d.name)[1]})">${pic(d)}</div>`;
const bc = b => ({'From RecipeDB': 'b-db', 'Flavour reference': 'b-fl', 'FlavorDB pairing': 'b-fl', 'Community-reported': 'b-cm', 'Our rule': 'b-es', 'Estimate': 'b-es'}[b] || 'b-es');
const badge = b => `<span class="badge ${bc(b)}">${esc(b)}</span>`;
const tags = (a, c) => a.map(x => `<span class="tag ${c || ''}">${esc(x)}</span>`).join('');
const avatar = (name, size) => `<span class="av" style="width:${size || 36}px;height:${size || 36}px;font-size:${(size || 36) * .42}px;background:linear-gradient(135deg,${hue(name || '?')[0]},${hue(name || '?')[1]})">${esc((name || '?')[0].toUpperCase())}</span>`;
const who = (id, name) => id ? `<a href="#/u/${id}">${esc(name)}</a>` : esc(name);

// ---------- top bar ----------
function drawTop() {
  $('me').innerHTML = ME ? `<a href="#/profile" title="Your profile">${avatar(ME.name, 34)}</a>` : `<a class="btn sm alt" href="#/login">Log in</a>`;
}

// ---------- shared pieces ----------
// post(c): one big photo card in the feed
function post(c) {
  const saved = store.get('ce_want').includes(c.id);
  return `<article class="post dc">
    <div class="ph"><a href="${c.author_id ? '#/u/' + c.author_id : '#/dish/' + c.id}">${avatar(c.by, 38)}</a>
      <div><b>${who(c.author_id, c.by)}</b><div class="mut">${esc(c.cuisine)} · about ${c.minutes} min</div></div>
      ${c.privacy === 'Private' ? '<span class="tag src" style="margin-left:auto">Only you</span>' : ''}</div>
    <a href="#/dish/${c.id}" data-dbl="${c.id}">${art(c, 'big')}</a>
    <div class="acts"><button class="ic ${c.liked ? 'on' : ''}" data-like="${c.id}" aria-label="Like">${c.liked ? '♥' : '♡'}</button>
      <a class="ic" href="#/dish/${c.id}" aria-label="Open dish">💬</a>
      <a class="btn sm alt" href="#/recreate/${c.id}">Try</a>
      <a class="btn sm alt" href="#/lineage/${c.id}">Tree</a>
      <button class="btn sm alt" data-want="${c.id}" style="margin-left:auto">${saved ? 'Saved ✓' : 'Save'}</button></div>
    <div class="cap"><div class="mut" data-lc="${c.id}">${c.likes} likes · ${c.echoes} echoes</div>
      <b><a href="#/dish/${c.id}">${esc(c.name)}</a></b> <span class="mut">${esc(c.story)}</span>
      <div class="chips">${tags(c.tags, 'src')}</div></div></article>`;
}
// tile(c): a square in a photo grid (Discover, profiles)
const tile = c => `<a class="tile" href="#/dish/${c.id}">${art(c)}<span class="tn">${esc(c.name)}</span></a>`;
function dcard(c) {   // kept for older screens (dish page variations, Explore)
  const saved = store.get('ce_want').includes(c.id);
  return `<div class="card dc"><a href="#/dish/${c.id}">${art(c)}</a>
    <div class="mut">${esc(c.region)} · by ${who(c.author_id, c.by)}</div>
    <h3><a href="#/dish/${c.id}">${esc(c.name)}</a></h3>
    <p class="mut">${esc(c.story)}</p>
    <div class="chips">${tags(c.tags, 'src')}</div>
    <div class="mut">${c.echoes} echoes</div>
    <a class="btn sm alt" href="#/recreate/${c.id}">Try</a>
    <button class="btn sm alt" data-want="${c.id}">${saved ? 'Saved ✓' : 'Save'}</button>
    <a class="btn sm alt" href="#/lineage/${c.id}">Tree</a></div>`;
}
function wire() {
  document.querySelectorAll('[data-want]').forEach(b => b.onclick = () => {
    let w = store.get('ce_want'); const id = b.dataset.want;
    w = w.includes(id) ? w.filter(x => x !== id) : [...w, id]; store.set('ce_want', w);
    b.textContent = w.includes(id) ? 'Saved ✓' : 'Save';
  });
  const like = async id => {
    const r = await api('like/' + id, {});
    if (r.error) return needLogin('Log in to like dishes');
    document.querySelectorAll(`[data-like="${id}"]`).forEach(b => { b.classList.toggle('on', r.liked); b.textContent = r.liked ? '♥' : '♡'; });
    document.querySelectorAll(`[data-lc="${id}"]`).forEach(e => { e.textContent = e.textContent.replace(/^\d+ likes/, r.likes + ' likes'); });
  };
  document.querySelectorAll('[data-like]').forEach(b => b.onclick = () => like(b.dataset.like));
  document.querySelectorAll('[data-dbl]').forEach(a => a.ondblclick = e => { e.preventDefault(); like(a.dataset.dbl); });
  document.querySelectorAll('[data-follow]').forEach(b => b.onclick = async () => {
    const on = b.dataset.on !== '1', r = await api('follow/' + b.dataset.follow, {on});
    if (r.error) return needLogin('Log in to follow cooks');
    route();
  });
}

// ---------- Home: stories row + feed ----------
async function home(tab) {
  tab = tab === 'following' ? 'following' : 'for-you';
  const [st, ds] = await Promise.all([api('stories'), api('dishes' + (tab === 'following' ? '?tab=following' : ''))]);
  const ring = (href, inner, label) => `<a class="story" href="${href}"><span class="ring">${inner}</span><span>${esc(label)}</span></a>`;
  V(`<div class="feedcol">
    <div class="stories">${st.cuisines.map(c => ring('#/discover/?cuisine=' + encodeURIComponent(c), '<span class="av" style="width:100%;height:100%;font-size:26px;background:var(--warm)">🍛</span>', c)).join('')}
      ${st.cooks.map(k => ring('#/u/' + k.id, avatar(k.name, 56), k.name)).join('')}</div>
    <a class="kitchen-cta" href="#/kitchen"><span style="font-size:30px">🧺</span><div><b>My Kitchen</b><div class="mut">Type what is in your kitchen and see what you can cook tonight.</div></div></a>
    <div class="seg tabs2"><button class="${tab === 'for-you' ? 'on' : ''}" onclick="location.hash='#/'">For you</button>
      <button class="${tab === 'following' ? 'on' : ''}" onclick="location.hash='#/following'">Following</button></div>
    ${ds.map(post).join('') || (tab === 'following'
      ? `<div class="card center"><h3>${ME ? 'No posts from cooks you follow yet' : 'Log in to see cooks you follow'}</h3><p class="mut">${ME ? 'Follow a cook from the row above and their dishes will show up here.' : 'Follow people whose cooking you love and their dishes land here.'}</p>${ME ? '' : '<a class="btn" href="#/login/following">Log in</a>'}</div>`
      : '<div class="card">Nothing here yet. Be the first to share one.</div>')}
    <div class="note warm">Related flavour compounds suggest connections, but they never guarantee the exact same taste.</div></div>`);
  wire();
}

// ---------- Discover (filters) ----------
const F0 = {chip: '', q: '', region: '', cuisine: '', diet: '', method: '', time: ''};
let F = {...F0};
async function discover(arg) {
  if (arg !== undefined) {                      // a link sets the filters fresh; plain #/discover keeps what you chose
    if (arg === '') F = {...F};
    else if (arg[0] === '?') { F = {...F0}; new URLSearchParams(arg.slice(1)).forEach((v, k) => { if (k in F0) F[k] = v; }); }
    else { const a = decodeURIComponent(arg); F = {...F0}; if (a[0] === '~') F.chip = a.slice(1); else F.q = a; }
  }
  const qs = Object.entries(F).filter(e => e[1]).map(e => e[0] + '=' + encodeURIComponent(e[1])).join('&');
  const [ds, fl] = await Promise.all([api('dishes?' + qs), api('filters')]);
  const row = (label, key, opts, fmt) => `<div class="frow"><span class="fl">${label}</span><div class="chips scroll">
    <button class="chip ${F[key] ? '' : 'on'}" data-f="${key}" data-v="">Any</button>
    ${opts.map(o => `<button class="chip ${String(F[key]) === String(o) ? 'on' : ''}" data-f="${key}" data-v="${esc(o)}">${esc(fmt ? fmt(o) : o)}</button>`).join('')}</div></div>`;
  const active = Object.values(F).filter(Boolean).length;
  V(`<section class="s"><h2>Discover</h2>
    <div class="filters">${row('Taste', 'chip', fl.tastes)}${row('Region', 'region', fl.regions)}${row('Cuisine', 'cuisine', fl.cuisines)}
      ${row('Diet', 'diet', fl.diets, o => o[0].toUpperCase() + o.slice(1))}${row('Method', 'method', fl.methods)}${row('Time', 'time', fl.times, o => 'Under ' + o + ' min')}</div>
    <p class="mut">${F.q ? `Results for “${esc(F.q)}” · ` : ''}${ds.length} ${ds.length === 1 ? 'dish' : 'dishes'}${active ? ' · <a href="#/discover/?" id="clr"><b>Clear filters</b></a>' : ''}</p>
    <div class="photogrid">${ds.map(tile).join('') || '<div class="card" style="grid-column:1/-1">No dish matches all of those filters. Remove one to see more.</div>'}</div></section>`);
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { F[b.dataset.f] = b.dataset.v; discover(); });
  const c = $('clr'); if (c) c.onclick = e => { e.preventDefault(); F = {...F0}; discover(); };
}

// ---------- Explore (dishes grouped by flavour direction) ----------
async function explore() {
  const ds = await api('dishes');
  V(`<section class="s"><div class="eyebrow">Flavour intelligence, in plain words</div><h2>Explore by flavour direction</h2>
    ${CHIPS.map(c => { const m = ds.filter(d => d.chips.includes(c)).slice(0, 3);
      return m.length ? `<h3 style="margin-top:22px">${c}</h3><div class="grid">${m.map(dcard).join('')}</div>` : ''; }).join('')}</section>`);
  wire();
}

// ---------- My Kitchen ----------
const KS = {have: [], soon: [], region: '', max: 0};
async function kitchen() {
  const regions = (await api('filters')).regions;
  const staples = ['dal', 'rice', 'potato', 'tomato', 'onion', 'spinach', 'curd', 'ghee', 'cumin', 'garlic', 'lemon', 'peanuts'];
  V(`<section class="s"><h2>My Kitchen</h2>
    <p class="mut">Add what you have. Tap an ingredient to mark it ⏳ use soon, and we will favour dishes that use it up.</p>
    <div class="two"><div class="card"><input id="ki" placeholder="Type an ingredient and press Enter" autocomplete="off">
      <div class="chips" id="kc" style="margin-top:10px"></div>
      <div class="mut">Quick add: ${staples.map(c => `<a class="chip" data-a="${c}">+ ${c}</a>`).join(' ')}</div>
      <label>Region</label><select id="kr"><option value="">Anywhere</option>${regions.map(r => `<option ${KS.region === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>
      <label>Time you have</label><div class="seg" id="kt">${[[0, 'Any'], [15, '15 min'], [30, '30 min'], [45, '45 min']].map(t => `<button class="${KS.max === t[0] ? 'on' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div></div>
    <div id="kres"></div></div></section>`);
  const draw = () => {
    $('kc').innerHTML = KS.have.map(h => `<span class="chip ${KS.soon.includes(h) ? 'soon' : 'on'}" data-s="${esc(h)}">${KS.soon.includes(h) ? '⏳ ' : ''}${esc(h)} <b data-x="${esc(h)}" aria-label="Remove ${esc(h)}">×</b></span>`).join('') || '<span class="mut">Nothing added yet</span>';
    document.querySelectorAll('#kc [data-s]').forEach(c => c.onclick = e => {
      if (e.target.dataset.x) KS.have = KS.have.filter(x => x !== e.target.dataset.x), KS.soon = KS.soon.filter(x => x !== e.target.dataset.x);
      else KS.soon = KS.soon.includes(c.dataset.s) ? KS.soon.filter(x => x !== c.dataset.s) : [...KS.soon, c.dataset.s];
      draw(); run();
    });
  };
  const run = async () => {
    if (!KS.have.length) { $('kres').innerHTML = '<div class="card center"><div style="font-size:34px">🧺</div><h3>Your kitchen is empty</h3><p class="mut">Add two or three ingredients to see what you can cook.</p></div>'; return; }
    const rs = await api('kitchen', {ingredients: KS.have, soon: KS.soon, region: KS.region, max_min: KS.max});
    $('kres').innerHTML = rs.length ? rs.map(r => `<div class="card dc" style="margin-bottom:14px"><div class="mut">${esc(r.cuisine)} · about ${r.minutes} min · ${esc(r.source)}</div>
      <h3><a href="#/dish/${r.id}">${esc(r.name)}</a></h3>
      <p><b>Uses ${r.uses} of ${r.of} ingredients</b>${r.uses_soon.length ? ` · ⏳ uses your ${esc(r.uses_soon.join(', '))}` : ''}</p>
      <div class="chips">${tags(r.have, 'have')}${tags(r.missing, 'miss')}</div>
      ${r.swaps.slice(0, 3).map(w => `<div class="note"><b>${esc(w.to)}</b> can stand in for <b>${esc(w.from)}</b>: shares ${esc(w.shared.join(', '))}.</div>`).join('')}
      ${r.missing.length ? `<p class="mut">Missing: ${esc(r.missing.join(', '))}${r.swaps.length ? '' : '. No close swap in your kitchen.'}</p>` : '<p class="mut">You have everything.</p>'}
      <a class="btn sm" href="#/recreate/${r.id}">Cook this</a> <a class="btn sm alt" href="#/dish/${r.id}">See dish</a></div>`).join('')
      : '<div class="card">Nothing fits that region and time. Try a longer time or another region.</div>';
  };
  const add = v => { split(v).forEach(n => { n = n.toLowerCase(); if (!KS.have.includes(n)) KS.have.push(n); }); $('ki').value = ''; draw(); run(); };
  $('ki').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add($('ki').value); } };
  document.querySelectorAll('[data-a]').forEach(a => a.onclick = () => add(a.dataset.a));
  $('kr').onchange = e => { KS.region = e.target.value; run(); };
  document.querySelectorAll('#kt button').forEach(b => b.onclick = () => { KS.max = +b.dataset.t; document.querySelectorAll('#kt button').forEach(x => x.classList.toggle('on', x === b)); run(); });
  draw(); run();
}

// ---------- Pairs well with ----------
const pairsHtml = (ps, title) => ps.length ? `<section class="s"><h2>${title || 'Pairs well with'}</h2><div class="pairs">
  ${ps.map(p => `<a class="pair" href="#/dish/${p.id}"><span class="tag ${p.kind === 'echo' ? 'swp' : 'src'}">${p.kind === 'echo' ? 'Echo pair' : 'Contrast pair'}</span>
    <h3>${esc(p.name)}</h3><div class="mut">${esc(p.text)}</div><div style="margin-top:6px">${badge(p.badge)}</div></a>`).join('')}</div></section>` : '';

// ---------- Dish detail ----------
async function dish(id) {
  const d = await api('dish/' + id);
  if (d.error) return V('<p>Dish not found.</p>');
  V(`<a class="mut" href="#/">← Back</a>
    <div class="two" style="margin-top:12px"><div>
      ${art(d, 'hero')}
      <div class="eyebrow">${esc(d.cuisine)} · ${esc(d.source)}</div>
      <h1 style="font-size:2.4rem">${esc(d.name)}</h1>
      <p class="mut">by ${who(d.author_id, d.by)} · about ${d.minutes} min · ${d.likes} likes · ${d.echoes} echoes</p><div class="chips">${tags(d.tags, 'src')}${tags(d.diets.slice(0, 1), 'have')}</div>
      <div class="card warm"><h3>The hearth story</h3><p>${esc(d.story || d.note || 'No story yet. Add yours by sharing a version.')}</p></div>
      <section class="s"><h2>Soul ingredients</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
      ${d.ingredient_details.map(i => `<div class="card"><b>${esc(i.name)}</b><div>${badge(i.badge)}</div><div class="mut">${esc(i.notes.join(', '))}</div></div>`).join('') || '<p class="mut">No ingredients listed.</p>'}</div></section>
      ${pairsHtml(d.pairs)}
      <section class="s"><h2>Method</h2><ol>${d.steps.map(s => `<li>${esc(s)}</li>`).join('') || '<li class="mut">No steps shared yet.</li>'}</ol></section>
      <section class="s"><div class="eyebrow">Lineage evolution</div><h2>The living tree: ${d.variations.length} community variations</h2>
      <div class="grid" style="grid-template-columns:1fr">${d.variations.map(dcard).join('') || '<div class="card">No variations yet. Make the first one.</div>'}</div>
      <a class="btn" href="#/lineage/${d.id}" style="margin-top:12px">View the full family tree</a></section>
    </div><aside class="sticky"><div class="card"><div class="eyebrow">Flavour connections</div><h3>Explore this dish</h3>
      <a class="btn" href="#/recreate/${d.id}" style="margin:12px 0;display:block;text-align:center">Try recreating this</a>
      <div class="seg" id="lens">${[['flavour', 'Whole dish'], ['aroma', 'Aroma'], ['texture', 'Texture'], ['ingredients', 'Ingredient links']].map((l, i) => `<button class="${i ? '' : 'on'}" data-l="${l[0]}">${l[1]}</button>`).join('')}</div>
      <div id="ex"></div>
      <div class="note">Related flavour compounds suggest connections. They don’t guarantee the same taste.</div></div></aside></div>`);
  wire();
  const load = async l => {
    const r = await api(`explore/${id}?lens=${l}`);
    $('ex').innerHTML = r.length ? r.map(x => `<div class="card" style="margin:8px 0;box-shadow:none"><a href="#/dish/${x.id}"><b>${esc(x.name)}</b></a><div>${badge(x.badge)}</div><div class="mut">${esc(x.text)}</div></div>`).join('') : '<p class="mut">No connections found for this lens yet.</p>';
  };
  document.querySelectorAll('#lens button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#lens button').forEach(x => x.classList.toggle('on', x === b)); load(b.dataset.l);
  });
  load('flavour');
}

// ---------- Recreate wizard (3 steps) ----------
async function recreate(id) {
  const d = await api('dish/' + id);
  if (d.error) return V('<p>Dish not found.</p>');
  const S = {step: 1, intent: 'Complete dish', have: [], most: false, time: '20m', skill: 'Beginner'};
  const COMMON = ['oil', 'onion', 'lemon', 'cumin', 'turmeric', 'red chilli', 'garlic', 'ginger', 'tomato', 'coriander', 'potato'];
  const draw = async () => {
    const bar = `<div class="steps">${['Intent & focus', 'Pantry & constraints', 'Your practical route'].map((t, i) => `<div class="${S.step === i + 1 ? 'on' : S.step > i + 1 ? 'done' : ''}">${i + 1}. ${t}</div>`).join('')}</div>`;
    const head = `<a class="mut" href="#/dish/${id}">← Back to dish: ${esc(d.name)}</a>
      <div class="card warm" style="margin:12px 0"><div class="eyebrow">Recreate</div><h1 style="font-size:2rem">${esc(d.name)}</h1>
      <p class="mut">Adapt the core sensory memory to your pantry, schedule and equipment. A forgiving guide to making it yours.</p></div>${bar}`;
    if (S.step === 1) {
      V(head + `<h2>What do you want to recreate?</h2><div class="g2" style="margin-top:12px">
        ${[['Complete dish', '🍽️', 'The whole experience'], ['Flavour', '👅', 'The taste direction'], ['Aroma', '👃', 'The smell that brings it back'], ['Texture', '🥄', 'The bite and mouthfeel']]
          .map(o => `<div class="opt ${S.intent === o[0] ? 'on' : ''}" data-i="${o[0]}"><div style="font-size:30px">${o[1]}</div><h3>${o[0]}</h3><p class="mut">${o[2]}</p></div>`).join('')}</div>
        <button class="btn" id="nx" style="margin-top:16px">Next: your pantry</button>`);
      document.querySelectorAll('.opt').forEach(o => o.onclick = () => { S.intent = o.dataset.i; draw(); });
      $('nx').onclick = () => { S.step = 2; draw(); };
    } else if (S.step === 2) {
      V(head + `<div class="note">No stress about rare spices. We suggest sensible substitutes and keep the core aromas.</div>
        <div class="two"><div class="card"><h3>Search or add kitchen items</h3>
        <div class="chips" id="pc">${S.have.map((h, i) => `<span class="chip" data-x="${i}">✓ ${esc(h)} ×</span>`).join('') || '<span class="mut">Nothing added yet</span>'}</div>
        <input id="pi" placeholder="Type an ingredient and press Enter"><div class="mut" style="margin-top:8px">Common staples: ${COMMON.map(c => `<a class="chip" data-a="${c}">+ ${c}</a>`).join(' ')}</div>
        <label><input type="checkbox" id="most" style="width:auto" ${S.most ? 'checked' : ''}> I have most common pantry staples</label></div>
        <div class="card"><h3>Kitchen reality</h3><label>Available time</label>
        <div class="seg" id="tm">${['20m', '35-40m', '60m+'].map(t => `<button class="${S.time === t ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div>
        <label>Cooking confidence</label><div class="seg" id="sk">${['Beginner', 'Confident'].map(t => `<button class="${S.skill === t ? 'on' : ''}" data-t="${t}">${t}</button>`).join('')}</div></div></div>
        <button class="btn alt" id="bk" style="margin-top:14px">Back</button> <button class="btn" id="nx" style="margin-top:14px">Generate my practical route</button>`);
      const add = v => { split(v).forEach(n => { if (!S.have.includes(n.toLowerCase())) S.have.push(n.toLowerCase()); }); draw(); };
      $('pi').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add($('pi').value); } };
      document.querySelectorAll('[data-a]').forEach(a => a.onclick = () => add(a.dataset.a));
      document.querySelectorAll('#pc [data-x]').forEach(c => c.onclick = () => { S.have.splice(+c.dataset.x, 1); draw(); });
      $('most').onchange = e => { S.most = e.target.checked; };
      document.querySelectorAll('#tm button').forEach(b => b.onclick = () => { S.time = b.dataset.t; draw(); });
      document.querySelectorAll('#sk button').forEach(b => b.onclick = () => { S.skill = b.dataset.t; draw(); });
      $('bk').onclick = () => { S.step = 1; draw(); };
      $('nx').onclick = () => { S.step = 3; draw(); };
    } else {
      const have = [...new Set([...S.have, ...(S.most ? COMMON : [])])];
      const [r] = await api('recreate', {recipe_id: id, ingredients: have, simple: S.time !== '60m+'});
      V(head + `<div class="card"><div class="eyebrow">${esc(S.intent)} focus</div><h2>Your practical route</h2>
        <div class="note warm">A starting point, not a guaranteed match. Taste as you go.</div>
        <p><b>${esc(r.closeness)}</b> <span class="mut">(an estimate from shared flavour notes)</span> ${badge('Estimate')}</p>
        <div class="chips">${tags(r.have, 'have')}${r.swaps.map(w => `<span class="tag swp">${esc(w.from)} → ${esc(w.to)}</span>`).join('')}${tags(r.need, 'miss')}</div>
        ${r.swaps.map(w => `<div class="note"><b>${esc(w.to)}</b> instead of <b>${esc(w.from)}</b>: shares ${esc(w.shared.join(', ') || 'some notes')}. Expect a slightly different depth.</div>`).join('')}
        ${r.dropped.length ? `<p class="mut">Skipped (optional): ${esc(r.dropped.join(', '))}</p>` : ''}
        ${r.need.length ? `<p><b>Core ingredients still needed: ${esc(r.need.join(', '))}</b></p>` : ''}
        <ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <button class="btn alt" id="bk">Back</button> <button class="btn" id="sv">I tried it, share my version</button></div>`);
      $('bk').onclick = () => { S.step = 2; draw(); };
      $('sv').onclick = async () => {
        const res = await api('save', {name: d.name + ' (my echo)', kind: 'Experiment', ingredients: r.new_ingredients, steps: r.steps,
          taste: r.taste, region: r.region, method: r.method, parent: d.name, privacy: 'Community',
          note: 'Swaps: ' + (r.swaps.map(w => `${w.from} → ${w.to}`).join(', ') || 'none'), story: 'My recreation of ' + d.name});
        if (res.error) return needLogin(res.error);
        toast('Your version joined the tree'); location.hash = '#/lineage/saved-' + res.id;
      };
    }
  };
  draw();
}

// ---------- Lineage ----------
async function lineage(id) {
  const l = await api('lineage/' + id), r = l.root;
  V(`<a class="mut" href="#/dish/${r.id}">← Back to dish</a>
    <section class="s"><div class="eyebrow">Flavour lineage tree</div><h1 style="font-size:2.4rem">The Living Lineage: <em style="color:var(--terra)">${esc(r.name)}</em></h1>
    <p class="mut">Food isn’t fixed in stone. Follow how one dish travelled through kitchens, and who changed what.</p>
    <a class="btn" href="#/recreate/${r.id}">Fork your variation</a></section>
    <div class="tl"><div class="node card warm"><div class="eyebrow">Root ancestor · ${esc(r.region)}</div><h3>${esc(r.name)}</h3>
      <p class="mut">${esc(r.story)}</p><div class="chips">${tags(r.tags, 'src')}</div></div>
    ${l.nodes.map((n, i) => `<div class="node card dc" style="animation-delay:${i * .12}s"><div class="eyebrow">${esc(n.region)} · branch ${i + 1}</div>
      <h3><a href="#/dish/${n.id}">${esc(n.name)}</a></h3><div class="mut">by ${esc(n.by)} · from ${esc(n.parent)}</div>
      <p>${esc(n.note)}</p><div class="sc"><div class="st"><b>What stayed</b><br>${esc(n.stayed.join(', ') || 'Nothing in common yet')}</div>
      <div class="ch"><b>What changed</b><br>${esc(n.changed.join(', ') || 'No ingredient changes')}</div></div>
      <a class="btn sm alt" href="#/dish/${n.id}">Inspect recipe</a></div>`).join('') || '<div class="card">No variations yet. Be the first to fork it.</div>'}</div>`);
}

// ---------- Communities ----------
async function communities() {
  const cs = await api('communities'), joined = store.get('ce_join');
  V(`<section class="s"><div class="eyebrow">Hearth circles</div><h2>Kitchen Communities</h2>
    <div class="grid">${cs.map(c => `<div class="card dc"><span class="tag">${esc(c.tag)}</span><h3 style="margin-top:8px">${esc(c.name)}</h3>
      <div class="mut">${c.members.toLocaleString()} members</div><div class="note">${esc(c.exp)}</div>
      <button class="btn sm ${joined.includes(c.id) ? 'alt' : ''}" data-j="${c.id}">${joined.includes(c.id) ? 'Joined ✓' : 'Join'}</button></div>`).join('')}
      <div class="card center" style="border-style:dashed"><div style="font-size:34px">➕</div><h3>Create a community</h3><p class="mut">Start a circle around a region, a taste or a tradition.</p><button class="btn sm alt" id="mk">Coming soon</button></div></div></section>`);
  document.querySelectorAll('[data-j]').forEach(b => b.onclick = () => {
    let j = store.get('ce_join'); j = j.includes(b.dataset.j) ? j.filter(x => x !== b.dataset.j) : [...j, b.dataset.j]; store.set('ce_join', j); communities();
  });
  $('mk').onclick = () => toast('Community creation is on the roadmap');
}

// ---------- Share (low friction) ----------
function share() {
  if (!ME) return needLogin('Log in to share a dish');
  const S = {type: 'Dish', sens: []};
  V(`<section class="s" style="max-width:720px;margin:0 auto"><div class="eyebrow">Share an echo</div><h1 style="font-size:2.2rem">What are you sharing?</h1>
    <div class="card" style="margin-top:14px">
    <div class="seg" id="ty">${['Dish', 'Memory', 'Experiment', 'Drink'].map((t, i) => `<button class="${i ? '' : 'on'}" data-t="${t}">${['🍛', '💭', '🧪', '🥤'][i]} ${t}</button>`).join('')}</div>
    <input id="nm" placeholder="Name it: e.g. Dadi’s smoky dal">
    <label>Photo (optional)</label><label class="drop" for="ph" id="dz">📷 Tap to add a photo</label><input type="file" id="ph" accept="image/*" hidden>
    <label>Your story</label><textarea id="sy" placeholder="What did it taste like? What stood out?"></textarea>
    <details><summary class="mut" style="cursor:pointer;margin-top:10px">More prompts (optional)</summary>
      <label>What inspired it?</label><input id="in"><label>Did you experiment?</label><input id="xp"></details>
    <label>Sensory notes</label><div class="chips" id="sn">${CHIPS.map(c => `<span class="chip" data-c="${c}">${c}</span>`).join('')}</div>
    <label>Ingredients (optional, comma-separated)</label><input id="ig">
    <label>Who can see this?</label><select id="pv"><option value="Community">Community: signed-in people</option><option value="Public">Public: anyone</option><option value="Private">Private: only me</option></select>
    <button class="btn" id="go" style="margin-top:16px">Share</button> <button class="btn alt" id="sk" style="margin-top:16px">Skip details, just share</button></div></section>`);
  document.querySelectorAll('#ty button').forEach(b => b.onclick = () => { S.type = b.dataset.t; document.querySelectorAll('#ty button').forEach(x => x.classList.toggle('on', x === b)); });
  document.querySelectorAll('#sn .chip').forEach(c => c.onclick = () => { c.classList.toggle('on'); S.sens = [...document.querySelectorAll('#sn .on')].map(x => x.dataset.c); });
  $('ph').onchange = e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = () => { $('dz').innerHTML = `<img src="${r.result}">`; }; r.readAsDataURL(f); } };
  const post = async quick => {
    if (!$('nm').value.trim()) return toast('Tell us what you are sharing');
    const res = await api('save', {name: $('nm').value, kind: S.type === 'Dish' || S.type === 'Memory' ? 'Family dish' : S.type === 'Experiment' ? 'Experiment' : 'Daily meal',
      story: quick ? '' : $('sy').value, ingredients: quick ? [] : split($('ig').value), sensory: S.sens, privacy: $('pv').value,
      note: quick ? '' : [$('sy').value, $('in').value && 'Inspired by: ' + $('in').value, $('xp').value && 'Experiment: ' + $('xp').value].filter(Boolean).join(' · ')});
    if (res.error) return res.error.startsWith('Please log') ? needLogin(res.error) : toast(res.error);
    toast('Shared!'); location.hash = '#/posted/saved-' + res.id;
  };
  $('go').onclick = () => post(false); $('sk').onclick = () => post(true);
}

// After sharing: confirmation plus "Pairs well with" for the new dish
async function posted(id) {
  const d = await api('dish/' + id);
  if (d.error) return location.hash = '#/profile';
  V(`<section class="s" style="max-width:720px;margin:0 auto"><div class="card center warm"><div style="font-size:40px">🎉</div><h1 style="font-size:2rem">Shared: ${esc(d.name)}</h1>
    <p class="mut">${d.privacy === 'Private' ? 'Only you can see it.' : d.privacy === 'Public' ? 'Anyone can see it.' : 'Signed-in people can see it.'}</p>
    <a class="btn" href="#/dish/${d.id}">Open the dish</a> <a class="btn alt" href="#/profile">Go to my profile</a></div>
    ${d.pairs.length ? pairsHtml(d.pairs, 'Pairs well with your dish') : '<p class="mut center" style="margin-top:18px">Add ingredients to your dish to get pairing ideas.</p>'}</section>`);
}

// ---------- Login / sign up ----------
function login(next) {
  if (ME) return location.hash = '#/profile';
  let mode = 'login';
  const go = decodeURIComponent(next || '') || 'profile';
  const draw = (err) => {
    V(`<section class="s" style="max-width:420px;margin:0 auto"><h1 style="font-size:2.2rem">${mode === 'login' ? 'Welcome back' : 'Join the hearth'}</h1>
      <p class="mut">${mode === 'login' ? 'Log in to share dishes, follow cooks and like what you love.' : 'We store only your name, email and an optional bio. Your password is saved scrambled (hashed), never as typed.'}</p>
      <div class="card"><div class="seg"><button class="${mode === 'login' ? 'on' : ''}" data-m="login">Log in</button><button class="${mode === 'signup' ? 'on' : ''}" data-m="signup">Sign up</button></div>
      ${mode === 'signup' ? '<label>Name</label><input id="an" autocomplete="name" maxlength="40">' : ''}
      <label>Email</label><input id="ae" type="email" autocomplete="email">
      <label>Password</label><input id="ap" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" placeholder="${mode === 'signup' ? 'At least 8 characters' : ''}">
      ${err ? `<div class="note" style="background:#fbe3df;color:var(--red)" role="alert">${esc(err)}</div>` : ''}
      <button class="btn" id="ab" style="margin-top:14px;width:100%">${mode === 'login' ? 'Log in' : 'Create account'}</button></div></section>`);
    document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
    const submit = async () => {
      const body = {email: $('ae').value, password: $('ap').value}; if (mode === 'signup') body.name = $('an').value;
      const r = await api(mode, body);
      if (r.error) return draw(r.error);
      ME = r; drawTop(); toast(mode === 'login' ? 'Welcome back, ' + r.name : 'Welcome, ' + r.name); location.hash = '#/' + (go === 'profile' && mode === 'signup' ? 'profile' : go);
    };
    $('ab').onclick = submit; $('ap').onkeydown = e => { if (e.key === 'Enter') submit(); };
  };
  draw();
}

// ---------- Profiles: photo grid ----------
function profileHead(u, tabsHtml) {
  return `<section class="s profile"><div class="phead">${avatar(u.name, 84)}<div class="pstats">
      <div><b>${u.posts.length}</b><span>posts</span></div><div><b>${u.followers}</b><span>followers</span></div><div><b>${u.following}</b><span>following</span></div></div></div>
    <h2 style="margin-top:12px">${esc(u.name)}</h2><p class="bio">${esc(u.bio) || (u.is_me ? '<span class="mut">Add a short bio so people know your kitchen.</span>' : '')}</p>${tabsHtml || ''}`;
}
async function person(id) {
  const u = await api('user/' + id);
  if (u.error) return V('<p>Cook not found.</p>');
  if (u.is_me) return location.hash = '#/profile';
  V(profileHead(u) + `<div style="margin:12px 0"><button class="btn ${u.is_following ? 'alt' : ''}" data-follow="${u.id}" data-on="${u.is_following ? 1 : 0}">${u.is_following ? 'Following ✓' : 'Follow'}</button></div>
    <div class="photogrid">${u.posts.map(tile).join('') || '<div class="card" style="grid-column:1/-1">No dishes shared yet.</div>'}</div></section>`);
  wire();
}
async function profile(tab) {
  if (!ME) return needLogin('Log in to see your profile');
  tab = tab || 'posts';
  const [u, p] = await Promise.all([api('user/' + ME.id), api('profile')]);
  const all = await api('dishes'), want = store.get('ce_want');
  const pick = {posts: u.posts, family: u.posts.filter(x => p.saved.find(s => s.id === x.id && s.kind === 'Family dish')),
    exp: u.posts.filter(x => p.saved.find(s => s.id === x.id && s.kind === 'Experiment')), want: all.filter(d => want.includes(d.id))}[tab] || u.posts;
  const tabs = `<div class="seg tabs2">${[['posts', 'Posts'], ['family', 'Family'], ['exp', 'Experiments'], ['want', 'Want to try']].map(t => `<button class="${tab === t[0] ? 'on' : ''}" onclick="location.hash='#/profile/${t[0]}'">${t[1]}</button>`).join('')}</div>`;
  V(profileHead({...u, is_me: true}, tabs) + `<p class="mut">Your dishes inspired <b>${p.inspired}</b> echoes.</p>
    <div style="margin:10px 0"><a class="btn sm" href="#/share">+ Share a dish</a> <button class="btn sm alt" id="ed">Edit profile</button> <button class="btn sm alt" id="lo">Log out</button></div>
    <div id="edit"></div>
    <div class="photogrid">${pick.map(r => `<div class="tilewrap">${tile(r)}${tab !== 'want' && r.id.startsWith('saved-') ? `<button class="x" data-d="${r.id.split('-')[1]}" aria-label="Delete ${esc(r.name)}">Delete</button>` : ''}${r.privacy === 'Private' ? '<span class="lock" title="Only you">🔒</span>' : ''}</div>`).join('')
      || '<div class="card" style="grid-column:1/-1">Nothing here yet. <a href="#/share"><b>Share your first dish</b></a>.</div>'}</div>
    <details class="danger"><summary>Delete my account</summary><p class="mut">This removes your profile, your dishes, your likes and your follows for good.</p>
      <label>Email</label><input id="de" type="email"><label>Password</label><input id="dp" type="password"><button class="btn sm" id="da" style="margin-top:10px;background:var(--red)">Delete my account</button></details></section>`);
  $('lo').onclick = async () => { await api('logout', {}); ME = null; drawTop(); toast('Logged out'); location.hash = '#/'; };
  $('ed').onclick = () => {
    $('edit').innerHTML = `<div class="card"><label>Name</label><input id="en" value="${esc(ME.name)}" maxlength="40"><label>Bio</label><textarea id="eb" maxlength="160">${esc(ME.bio)}</textarea>
      <button class="btn sm" id="es" style="margin-top:10px">Save profile</button></div>`;
    $('es').onclick = async () => { const r = await api('me', {name: $('en').value, bio: $('eb').value}, 'PATCH'); if (r.error) return toast(r.error); ME = r; drawTop(); toast('Profile saved'); route(); };
  };
  $('da').onclick = async () => {
    const r = await api('account', {email: $('de').value, password: $('dp').value}, 'DELETE');
    if (r.error) return toast(r.error);
    ME = null; drawTop(); toast('Your account was deleted'); location.hash = '#/';
  };
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { await api('saved/' + b.dataset.d, null, 'DELETE'); profile(tab); });
}

// ---------- router ----------
const ROUTES = {'': home, following: () => home('following'), home, discover, kitchen, explore, dish, recreate, lineage, share, posted, communities, profile, u: person, login};
async function route() {
  const [p, ...rest] = location.hash.slice(2).split('/');
  const tab = {'': 'home', following: 'home', home: 'home', discover: 'discover', explore: 'discover', kitchen: 'home', share: 'share', posted: 'share', communities: 'communities', profile: 'profile', u: 'profile', login: 'profile'}[p];
  document.querySelectorAll('[data-p]').forEach(a => a.classList.toggle('on', a.dataset.p === tab));
  V('<p class="mut" style="padding:40px 0">Loading…</p>');
  try { await (ROUTES[p] || home)(p === 'discover' && rest.length === 0 ? undefined : rest.join('/')); } catch (e) { console.error(e); V('<div class="card" style="margin-top:20px">Something went wrong. Is the server running?</div>'); }
  scrollTo(0, 0);
}
$('gs').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim()) location.hash = '#/discover/' + encodeURIComponent(e.target.value.trim()); };
addEventListener('hashchange', route);
loadMe().then(route);
