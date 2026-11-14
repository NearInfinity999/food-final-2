// Culinary Echo frontend. One page, hash routes: #/ #/discover #/explore #/dish/ID #/recreate/ID #/lineage/ID #/share #/communities #/profile
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api = (p, body, method) => fetch('/api/' + p, body
  ? {method: method || 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}
  : {method: method || 'GET'}).then(r => r.json());
const V = html => { $('view').innerHTML = html; };
const split = s => s.split(',').map(x => x.trim()).filter(Boolean);
const toast = t => { const e = $('toast'); e.textContent = t; e.classList.add('s'); setTimeout(() => e.classList.remove('s'), 2000); };
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const CHIPS = ['Smoky', 'Tangy', 'Crunchy & toasted', 'Fermented', 'Fresh & aromatic', 'Sweet heat'];
const EMO = [['dal', '🍲'], ['rice', '🍚'], ['spinach', '🥬'], ['potato', '🥔'], ['tomato', '🍅'], ['mint', '🌿'], ['curd', '🥣']];
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// pic(d): shows /static/img/<dish-name-slug>.jpg if it exists, otherwise falls back to the emoji
const pic = d => `<img src="/static/img/${slug(d.name)}.jpg" alt="${esc(d.name)}" onerror="this.replaceWith(document.createTextNode('${em(d)}'))">`;
const em = d => (EMO.find(e => (d.ingredients || []).includes(e[0])) || [0, '🍛'])[1];
const bc = b => ({'From RecipeDB': 'b-db', 'Flavour reference': 'b-fl', 'Community-reported': 'b-cm', 'Estimate': 'b-es'}[b] || 'b-es');
const badge = b => `<span class="badge ${bc(b)}">${esc(b)}</span>`;
const PAL = [['#f6c97b', '#e8845a'], ['#9fd8a8', '#4f9d69'], ['#f2b5a7', '#d9532f'], ['#a9c8f2', '#5b8fd9'], ['#e5c3f0', '#9a6bc2'], ['#f5e08a', '#e0a21b']];
const grad = d => { let h = 0; for (const ch of String(d.name || '')) h = (h * 31 + ch.charCodeAt(0)) % 997; const p = PAL[h % PAL.length]; return `background:linear-gradient(135deg,${p[0]},${p[1]})`; };
const tags = (a, c) => a.map(x => `<span class="tag ${c || ''}">${esc(x)}</span>`).join('');

// ---------- shared pieces ----------
function dcard(c) {
  const saved = store.get('ce_want').includes(c.id), liked = store.get('ce_like').includes(c.id);
  return `<article class="card dc">
    <div class="chd"><span class="av">${esc((c.by || '?')[0].toUpperCase())}</span><div><b>${esc(c.by)}</b><small>${esc(c.region)}</small></div><span class="tag src">${esc(c.source)}</span></div>
    <a href="#/dish/${c.id}"><div class="art" style="${grad(c)}"><span>${pic(c)}</span></div></a>
    <div class="in"><div class="acts">
      <button class="ib ${liked ? 'on' : ''}" data-like="${c.id}" aria-label="Like">${liked ? '❤️' : '🤍'}</button>
      <a class="ib" href="#/recreate/${c.id}" aria-label="Try recreating" title="Try recreating">🥘</a>
      <a class="ib" href="#/lineage/${c.id}" aria-label="Lineage tree" title="Lineage tree">🌳</a>
      <button class="ib" data-want="${c.id}" aria-label="Save" style="margin-left:auto">${saved ? '🔖' : '📑'}</button></div>
    <h3><a href="#/dish/${c.id}">${esc(c.name)}</a></h3>
    <p class="mut">${esc(c.story)}</p>
    <div class="chips">${tags(c.tags, 'src')}</div>
    <div class="mut">${c.echoes} echoes</div></div></article>`;
}
function wire() {
  document.querySelectorAll('[data-like]').forEach(b => b.onclick = () => {
    let l = store.get('ce_like'); const id = b.dataset.like;
    l = l.includes(id) ? l.filter(x => x !== id) : [...l, id]; store.set('ce_like', l);
    b.textContent = l.includes(id) ? '❤️' : '🤍'; b.classList.add('on');
  });
  document.querySelectorAll('[data-want]').forEach(b => b.onclick = () => {
    let w = store.get('ce_want'); const id = b.dataset.want;
    w = w.includes(id) ? w.filter(x => x !== id) : [...w, id]; store.set('ce_want', w);
    b.textContent = w.includes(id) ? '🔖' : '📑'; toast(w.includes(id) ? 'Saved to your collection' : 'Removed');
  });
}

// ---------- Landing ----------
async function landing() {
  const l = await api('lineage/base-0');
  V(`<section class="hero"><span class="fl f1">🌶️</span><span class="fl f2">🍋</span><span class="fl f3">🌿</span><div class="eyebrow">A social hearth for food lineages</div>
    <h1>Every dish leaves an <em>echo.</em></h1>
    <p>A warm space to share tastes, trace dish lineages across cultures, recreate memories and reinvent recipes together.</p>
    <a class="btn" href="#/discover">Start exploring</a> <a class="btn alt" href="#/share">Share a dish</a>
    <div class="orb"><img src="/static/img/hero.jpg" alt="" onerror="this.replaceWith(document.createTextNode('🍲'))"></div></section>
    <section class="s"><div class="center"><div class="eyebrow">The kitchen philosophy</div><h2>The Echo Loop</h2></div>
    <div class="g3" style="margin-top:16px">
      ${[['🧭', 'Discover by memory', 'Explore dishes by smell, taste and nostalgia.', '#/discover'],
         ['🥘', 'Recreate & adapt', 'Tweak ingredients for your pantry while keeping the soul of the dish.', '#/recreate/base-0'],
         ['🌳', 'Branch the tree', 'Share your variation and watch it ripple outward.', '#/lineage/base-0']]
        .map((x, i) => `<a class="card dc" style="animation-delay:${i * .12}s" href="${x[3]}"><div style="font-size:34px">${x[0]}</div><h3>${x[1]}</h3><p class="mut">${x[2]}</p></a>`).join('')}
    </div></section>
    <section class="s"><div class="eyebrow">Interactive lineage</div><h2>From one kitchen to many</h2>
    <div class="card" style="margin-top:12px"><div class="note warm"><b>${esc(l.root.name)}</b> · root of the tree · ${l.nodes.length} variations</div>
    <div class="g3">${l.nodes.slice(0, 3).map(n => `<a class="card" href="#/dish/${n.id}"><div class="mut">by ${esc(n.by)}</div><h3>${esc(n.name)}</h3><p class="mut">${esc(n.note)}</p></a>`).join('')}</div>
    <a class="btn sm" href="#/lineage/base-0" style="margin-top:12px">Open the full tree</a></div></section>
    <section class="s"><div class="eyebrow">Palate compass</div><h2>Trending flavour profiles</h2>
    <div class="chips">${CHIPS.map(c => `<a class="chip" href="#/discover/~${encodeURIComponent(c)}">${c}</a>`).join('')}</div></section>
    <div class="note warm"><b>Taste with curiosity, adjust with love.</b> Related flavour compounds suggest connections, but they never guarantee the exact same taste.</div>`);
}

// ---------- Discover ----------
async function discover(arg) {
  let chip = '', q = '';
  if (arg) { const a = decodeURIComponent(arg); if (a[0] === '~') chip = a.slice(1); else q = a; }
  const ds = await api('dishes?chip=' + encodeURIComponent(chip) + '&q=' + encodeURIComponent(q));
  const ex = await api('explore/base-0');
  V(`<section class="s"><div class="eyebrow">Flavour palette</div><h2>Discover</h2>
    <div class="chips"><a class="chip ${chip ? '' : 'on'}" href="#/discover">All</a>
    ${CHIPS.map(c => `<a class="chip ${c === chip ? 'on' : ''}" href="#/discover/~${encodeURIComponent(c)}">${c}</a>`).join('')}</div>
    ${ex.length ? `<div class="note warm"><b>Follow your curiosity:</b> Loved Tadka dal? Try <a href="#/dish/${ex[0].id}"><b>${esc(ex[0].name)}</b></a>. ${esc(ex[0].text)}.</div>` : ''}
    ${q ? `<p class="mut">Results for “${esc(q)}”</p>` : ''}
    <div class="grid">${ds.map(dcard).join('') || '<div class="card">Nothing here yet. Be the first to share one.</div>'}</div></section>`);
  wire();
}

// ---------- Explore (dishes grouped by flavour direction) ----------
async function explore() {
  const ds = await api('dishes');
  V(`<section class="s"><div class="eyebrow">Flavour intelligence, in plain words</div><h2>Explore by flavour direction</h2>
    ${CHIPS.map(c => { const m = ds.filter(d => d.chips.includes(c)).slice(0, 3);
      return m.length ? `<h3 style="margin-top:22px">${c}</h3><div class="grid">${m.map(dcard).join('')}</div>` : ''; }).join('')}</section>`);
  wire();
}

// ---------- Dish detail ----------
async function dish(id) {
  const d = await api('dish/' + id);
  if (d.error) return V('<p>Dish not found.</p>');
  V(`<a class="mut" href="#/discover">← Back to Discover</a>
    <div class="two" style="margin-top:12px"><div>
      <div class="art" style="height:260px;font-size:110px">${pic(d)}</div>
      <div class="eyebrow">${esc(d.region)} · ${esc(d.source)}</div>
      <h1 style="font-size:2.4rem">${esc(d.name)}</h1>
      <p class="mut">by ${esc(d.by)} · ${d.echoes} echoes</p><div class="chips">${tags(d.tags, 'src')}</div>
      <div class="card warm"><h3>The hearth story</h3><p>${esc(d.story || d.note || 'No story yet. Add yours by sharing a version.')}</p></div>
      <section class="s"><h2>Soul ingredients</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
      ${d.ingredient_details.map(i => `<div class="card"><b>${esc(i.name)}</b><div>${badge(i.badge)}</div><div class="mut">${esc(i.notes.join(', '))}</div></div>`).join('') || '<p class="mut">No ingredients listed.</p>'}</div></section>
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

// ---------- Share (low friction) ----------
function share() {
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
    <label>Who can see this?</label><select id="pv"><option>Community</option><option>Public</option><option>Private</option></select>
    <button class="btn" id="go" style="margin-top:16px">Share</button> <button class="btn alt" id="sk" style="margin-top:16px">Skip details, just share</button></div></section>`);
  document.querySelectorAll('#ty button').forEach(b => b.onclick = () => { S.type = b.dataset.t; document.querySelectorAll('#ty button').forEach(x => x.classList.toggle('on', x === b)); });
  document.querySelectorAll('#sn .chip').forEach(c => c.onclick = () => { c.classList.toggle('on'); S.sens = [...document.querySelectorAll('#sn .on')].map(x => x.dataset.c); });
  $('ph').onchange = e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = () => { $('dz').innerHTML = `<img src="${r.result}">`; }; r.readAsDataURL(f); } };
  const post = async quick => {
    if (!$('nm').value.trim()) return toast('Tell us what you are sharing');
    const res = await api('save', {name: $('nm').value, kind: S.type === 'Dish' || S.type === 'Memory' ? 'Family dish' : S.type === 'Experiment' ? 'Experiment' : 'Daily meal',
      story: quick ? '' : $('sy').value, ingredients: quick ? [] : split($('ig').value), sensory: S.sens, privacy: $('pv').value,
      note: quick ? '' : [$('sy').value, $('in').value && 'Inspired by: ' + $('in').value, $('xp').value && 'Experiment: ' + $('xp').value].filter(Boolean).join(' · ')});
    if (res.error) return toast(res.error);
    toast('Shared!'); location.hash = '#/profile';
  };
  $('go').onclick = () => post(false); $('sk').onclick = () => post(true);
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

// ---------- Collections & Profile ----------
async function profile(tab) {
  tab = tab || 'all';
  const p = await api('profile'), want = store.get('ce_want');
  const all = await api('dishes'), wants = all.filter(d => want.includes(d.id));
  const pick = {all: p.saved, family: p.saved.filter(s => s.kind === 'Family dish'), exp: p.saved.filter(s => s.kind === 'Experiment'), want: wants}[tab] || p.saved;
  V(`<section class="s"><div class="eyebrow">Your kitchen</div><h2>Collections</h2>
    <p class="mut">${p.saved.length} saved · your dishes inspired <b>${p.inspired}</b> echoes</p>
    <div class="seg">${[['all', 'All mine'], ['family', 'Family recipes'], ['exp', 'My experiments'], ['want', 'Want to try']].map(t => `<button class="${tab === t[0] ? 'on' : ''}" onclick="location.hash='#/profile/${t[0]}'">${t[1]}</button>`).join('')}</div>
    <div class="grid">${pick.map(r => tab === 'want' ? dcard(r) : `<div class="card dc"><div class="mut">${esc(r.kind)} · ${esc(r.created)} · ${esc(r.privacy)}</div>
      <h3><a href="#/dish/${r.id}">${esc(r.name)}</a></h3>${r.parent ? `<div class="mut">Version of ${esc(r.parent)}</div>` : ''}
      <p class="mut">${esc((r.story || '').slice(0, 120))}</p><div class="chips">${tags(r.sensory || [], 'src')}</div>
      <a class="btn sm alt" href="#/lineage/${r.id}">Tree</a> <button class="btn sm alt" data-d="${r.id.split('-')[1]}">Delete</button></div>`).join('')
      || '<div class="card">Nothing here yet. <a href="#/share"><b>Share your first dish</b></a>.</div>'}</div></section>`);
  wire();
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { await api('saved/' + b.dataset.d, null, 'DELETE'); profile(tab); });
}

// ---------- router ----------
const ROUTES = {'': landing, discover, explore, dish, recreate, lineage, share, communities, profile};
async function route() {
  const [p, ...rest] = location.hash.slice(2).split('/');
  document.querySelectorAll('[data-p]').forEach(a => a.classList.toggle('on', a.dataset.p === p));
  V('<div class="grid" style="margin-top:24px">' + '<div class="card sk"></div>'.repeat(6) + '</div>');
  try { await (ROUTES[p] || landing)(rest.join('/')); } catch (e) { V('<div class="card" style="margin-top:20px">Something went wrong. Is the server running?</div>'); }
  scrollTo(0, 0);
}
$('gs').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim()) location.hash = '#/discover/' + encodeURIComponent(e.target.value.trim()); };
addEventListener('hashchange', route); route();
