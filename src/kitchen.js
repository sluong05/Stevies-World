// The Kitchen: a three.js cookbook shelf. Recipes are bound into cookbooks (by cuisine,
// meal, protein or time, your pick), and favorites always get their own books on their
// own bookcase. Tap a cookbook and it slides off the shelf and opens like a Library book:
// the recipes are drawn right on the curved 3D pages, and you flip through them.
import * as THREE from '../vendor/three.module.min.js';
import { byType, getItem, isSaved, search, toggleSaved } from './store.js';
import { toast } from './ui.js';
import { listView } from './views.js';
import { cookbooks, GROUPINGS } from '../shared/cookbooks.js';
import { cuisineOf } from '../shared/cuisine.js';
import { rand, BOOK_COLORS, canvasTex, woodTex, shade, ease, PAGE_W, PAGE_H, INK, FADED, LABEL, HAND, curvedPage, layout, paper } from './library.js';

// ---------- layout ----------
const SHELVES = 3;
const BAY_W = 0.62, SHELF_GAP = 0.36, SHELF_T = 0.022, DEPTH = 0.28, BAY_GAP = 0.05;
const BAY_STEP = BAY_W + BAY_GAP;
const shelfY = s => 1.35 - s * SHELF_GAP;
const FLOOR_Y = shelfY(SHELVES - 1) - 0.3 - 0.9;
const INNER_W = BAY_W - 0.04;
const GROUP_KEY = 'sw-cookbook-group';

const groupBy = () => { try { const v = localStorage.getItem(GROUP_KEY); return GROUPINGS.some(g => g.key === v) ? v : 'cuisine'; } catch { return 'cuisine'; } };
const setGroupBy = v => { try { localStorage.setItem(GROUP_KEY, v); } catch { /* ignore */ } };
const recipes = () => byType('recipe');
const minutes = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

let S = null;
export const mounted = () => Boolean(S);

export function mount(root, bookKey = '', recipeId = '') {
  unmount();
  root.innerHTML = `
    <div class="lib-stage" aria-label="Kitchen: cookbook shelves above the worktop"></div>
    <div class="lib-dim"></div>
    <input class="lib-hidden-input" id="kit-search" type="search" enterkeyhint="search" autocomplete="off" aria-label="Search recipes" />
    <button class="lib-hidden-input" data-action="paste-link" tabindex="-1" aria-hidden="true"></button>`;
  S = { root, stage: root.querySelector('.lib-stage'), searchInput: root.querySelector('#kit-search'), query: '', books: new Map(), bays: [], open: null, busy: false, raf: 0, listeners: [], photos: new Map() };
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); S.listeners.push(() => target.removeEventListener(type, fn, opts)); };
  S.on = on;
  const input = S.searchInput;
  on(input, 'input', () => { S.query = input.value; drawChalk(); });
  on(input, 'focus', () => { S.caretOn = true; drawChalk(); });
  on(input, 'blur', () => drawChalk());
  on(input, 'keydown', e => { if (e.key === 'Escape' && !input.value) zoomTo(null); if (e.key === 'Enter') { const r = S.query && search(S.query, recipes())[0]; input.blur(); const b = r && bookOf(r.id); if (b) location.hash = `#/recipes/${encodeURIComponent(b.key)}/${encodeURIComponent(r.id)}`; } if (e.key === 'Escape') { input.value = S.query = ''; input.blur(); } });
  S.blink = setInterval(() => { if (S && document.activeElement === input) { S.caretOn = !S.caretOn; drawChalk(); } }, 530);
  document.body.classList.add('in-library', 'in-kitchen');
  try { buildRenderer(); buildScene(); }
  catch (error) { console.warn('Kitchen 3D unavailable', error); unmount(); root.innerHTML = listView('recipe'); return; }
  focusBay(firstBay(), true);
  if (bookKey) route(bookKey, recipeId);
}

export function unmount() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  clearInterval(S.blink);
  S.listeners.forEach(off => off());
  S.ro?.disconnect();
  disposeScene();
  S.renderer?.dispose();
  S.renderer?.forceContextLoss?.();
  document.body.classList.remove('in-library', 'in-kitchen', 'lib-reading');
  S = null;
}

/** Called by the router for #/recipes, #/recipes/<book> and #/recipes/<book>/<recipe>. */
export function route(bookKey, recipeId = '') {
  if (!S) return;
  if (!bookKey) { if (S.open) closeBook(); return; }
  const b = S.books.get(bookKey);
  if (!b) { if (S.open) closeBook(); else location.replace('#/recipes'); return; }
  if (S.open?.book === b) { if (recipeId) jumpTo(recipeId); return; }
  if (S.open) closeBook(true).then(() => openBook(b, recipeId));
  else openBook(b, recipeId);
}

/** The top bar's search button: from the shelf or an open cookbook, zoom onto the chalkboard
 *  and focus its search line in the same tap (so the phone keyboard opens). */
export function openSearch() {
  if (!S) return false;
  S.searchInput.focus({ preventScroll: true }); S.caretOn = true;
  if (S.open) { history.replaceState(null, '', '#/recipes'); closeBook().then(() => { if (S) { zoomTo('chalk'); S.searchInput.focus({ preventScroll: true }); drawChalk(); } }); }
  else { zoomTo('chalk'); drawChalk(); }
  return true;
}

/** Recipes or favorites changed (here, or synced from another device). */
export function refresh() {
  if (!S) return;
  if (S.open) { S.dirty = signature() !== S.sig; if (!S.busy) paintSpread(); return; }
  drawChalk();
  if (!S.busy && signature() !== S.sig) rebuild();
}

function signature() {
  const { favorites, others } = cookbooks(recipes(), groupBy(), isSaved);
  return [...favorites, ...others].map(b => `${b.key}:${b.recipes.map(r => `${r.id}.${r.updatedAt || 0}`).join(',')}`).join('|');
}

function rebuild() {
  if (!S) return;
  const x = S.camTarget;
  disposeScene();
  buildScene();
  S.camTarget = S.camX = clampX(Number.isFinite(x) ? x : 0);
  focusBay(currentBay(), true);
}

// ---------- the chalkboard (search, grouping, shelf arrows) and the recipe box, standing on the worktop ----------
const CHALK_W = 640, CHALK_H = 480, BOX_W = 512, BOX_H = 320;
function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

function makeCounterTools() {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return { canvas: c, ctx: c.getContext('2d'), tex, regions: [] }; };
  const wood = new THREE.MeshStandardMaterial({ map: woodTex('#8a5a32', '#3a2210', 128, 64, 8), roughness: 0.6 });
  // Chalkboard on a little easel.
  const chalk = mk(CHALK_W, CHALK_H);
  const board = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), new THREE.MeshStandardMaterial({ map: chalk.tex, emissiveMap: chalk.tex, emissive: new THREE.Color('#777'), roughness: 0.95 }));
  face.position.z = 0.006;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.275, 0.01), wood);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.01), wood); leg.position.set(0, -0.06, -0.06); leg.rotation.x = 0.5;
  board.add(frame, face, leg);
  board.rotation.x = -0.32;
  frame.castShadow = true;
  S.scene.add(board);
  // Recipe box with an index card sticking up.
  const card = mk(BOX_W, BOX_H);
  const box = new THREE.Group();
  const tin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.15), new THREE.MeshStandardMaterial({ color: '#a8462f', roughness: 0.45 }));
  tin.position.y = 0.05; tin.castShadow = true;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.012, 0.155), new THREE.MeshStandardMaterial({ color: '#7a2e22', roughness: 0.4 }));
  lid.position.set(0, 0.13, -0.09); lid.rotation.x = -1.1;
  const label = canvasTex(256, 96, (g, W, H) => { g.fillStyle = '#a8462f'; g.fillRect(0, 0, W, H); g.fillStyle = '#f6e7c4'; rrect(g, 40, 22, W - 80, H - 44, 8); g.fill(); g.fillStyle = '#5a2a1a'; g.font = '600 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Recipes', W / 2, H / 2 + 2); });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.09), new THREE.MeshStandardMaterial({ map: label, roughness: 0.6 }));
  front.position.set(0, 0.05, 0.0751);
  const index = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1375), new THREE.MeshStandardMaterial({ map: card.tex, emissiveMap: card.tex, emissive: new THREE.Color('#8a8070'), roughness: 0.9 }));
  index.position.set(0, 0.15, 0.01); index.rotation.x = -0.25;
  box.add(tin, lid, front, index);
  S.scene.add(box);
  Object.assign(S, { chalk, chalkMesh: face, chalkGroup: board, card, cardMesh: index, cardHit: [index, tin, front], boxGroup: box });
  drawChalk(); drawCard();
  S.toolHits = [face, index, tin, front];
}

function placeCounterTools() {
  if (!S.chalkGroup) return;
  const cam = S.camera;
  // Stand them at the front of the worktop, or further back when the front edge would be cut off by
  // the bottom of the screen (wide screens frame the shelves, not the worktop).
  const camZ = DEPTH / 2 + S.dist, camY = (shelfY(0) + 0.5 + COUNTER_Y - 0.12) / 2 - 0.03 + 0.12;
  const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), tilt = 0.12 / camZ;
  const fitDepth = (camY - COUNTER_Y - 0.03) / (tanV + tilt);
  const zFront = Math.max(Math.min(S.cabFront - 0.13, camZ - fitDepth), S.cabFront - 0.62 + 0.14); // 0.62: worktop depth
  const depth = (camZ - zFront) || 1; // from the shelf view, so zooming in doesn't move them
  const halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect * depth;
  const k = Math.min(1, halfW / 0.42);
  S.chalkGroup.scale.setScalar(k);
  S.chalkGroup.position.set(S.camX - halfW + 0.2 * k + 0.02, COUNTER_Y + 0.115 * k, zFront);
  S.boxGroup.scale.setScalar(k);
  S.boxGroup.position.set(S.camX + halfW - 0.16 * k - 0.02, COUNTER_Y, zFront);
  S.chalkGroup.visible = S.boxGroup.visible = !S.open;
}

function chalkLine(g, text, x, y, size = 34, color = '#f4f1e8', font = '"SW Macrons", "Kiwi Maru", Georgia, serif') {
  g.fillStyle = color; g.font = `${size}px ${font}`; g.fillText(text, x, y);
}
function drawChalk() {
  const { ctx: g, tex } = S.chalk;
  const regions = S.chalk.regions = [];
  const grad = g.createRadialGradient(CHALK_W / 2, CHALK_H / 2, 40, CHALK_W / 2, CHALK_H / 2, CHALK_W * 0.7);
  grad.addColorStop(0, '#36463c'); grad.addColorStop(1, '#222c26');
  g.fillStyle = grad; g.fillRect(0, 0, CHALK_W, CHALK_H);
  const r = rand('chalkdust'); g.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = 0; i < 300; i++) g.fillRect(r() * CHALK_W, r() * CHALK_H, 3, 2);
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const q = S.query || '';
  const focused = document.activeElement === S.searchInput;
  // search line
  g.strokeStyle = 'rgba(244,241,232,.75)'; g.lineWidth = 3; rrect(g, 30, 26, CHALK_W - 60, 70, 35); g.stroke();
  chalkLine(g, '⌕', 52, 76, 40);
  let shown = q || (focused ? '' : 'Search recipes…');
  g.font = '34px "SW Macrons", "Kiwi Maru", Georgia, serif';
  while (g.measureText(shown).width > CHALK_W - 170 && shown.length > 1) shown = shown.slice(1);
  chalkLine(g, shown, 98, 74, 34, q ? '#fffbe8' : 'rgba(244,241,232,.55)');
  if (focused && S.caretOn) g.fillRect(100 + (q ? g.measureText(shown).width : 0), 44, 3, 38);
  if (q) chalkLine(g, '✕', CHALK_W - 80, 74, 32, 'rgba(244,241,232,.8)'), regions.push({ x0: CHALK_W - 110, x1: CHALK_W, y0: 20, y1: 100, act: 'clear' });
  regions.push({ x0: 0, x1: CHALK_W - 110, y0: 10, y1: 110, act: 'search' });
  if (q) {
    const hits = search(q, recipes()).slice(0, 5);
    if (!hits.length) chalkLine(g, 'Nothing matches that yet.', 44, 160, 30, 'rgba(244,241,232,.7)');
    hits.forEach((h, i) => {
      const y = 158 + i * 62;
      let t = `${isSaved(h.id) ? '♥ ' : '• '}${h.title}`;
      g.font = '32px "SW Macrons", "Kiwi Maru", Georgia, serif';
      while (g.measureText(t).width > CHALK_W - 90 && t.length > 4) t = t.slice(0, -2);
      if (t.length < h.title.length + 2) t = t.trimEnd() + '…';
      chalkLine(g, t, 44, y, 32);
      const b = bookOf(h.id);
      chalkLine(g, b ? `${b.title}${b.favorite ? ' · favorites' : ''}` : '', 74, y + 26, 20, 'rgba(244,241,232,.6)', 'Georgia, serif');
      regions.push({ x0: 0, x1: CHALK_W, y0: y - 40, y1: y + 30, act: 'open', id: h.id });
    });
  } else {
    const gb = GROUPINGS.find(x => x.key === groupBy());
    chalkLine(g, 'Cookbooks by', 44, 168, 28, 'rgba(244,241,232,.7)', 'Georgia, serif');
    g.strokeStyle = '#e9c46a'; g.lineWidth = 3; rrect(g, 228, 128, 300, 58, 29); g.stroke();
    g.textAlign = 'center'; chalkLine(g, `${gb.label}  ▸`, 378, 168, 32, '#f5d98a'); g.textAlign = 'left';
    regions.push({ x0: 200, x1: CHALK_W, y0: 115, y1: 200, act: 'group' });
    GROUPINGS.forEach((x, i) => { g.fillStyle = x.key === gb.key ? '#f5d98a' : 'rgba(244,241,232,.35)'; g.beginPath(); g.arc(340 + i * 26, 210, 6, 0, Math.PI * 2); g.fill(); });
    const bay = S.bays[S.bayIndex ?? 0];
    if (bay) {
      g.textAlign = 'center';
      chalkLine(g, `${bay.fav ? '♥ ' : ''}${bay.label}${bay.of > 1 ? ` ${bay.n} of ${bay.of}` : ''}`, CHALK_W / 2, 300, 34);
      const i = S.bayIndex ?? 0;
      chalkLine(g, '◂', 70, 304, 56, i > 0 ? '#f4f1e8' : 'rgba(244,241,232,.2)');
      chalkLine(g, '▸', CHALK_W - 70, 304, 56, i < S.bays.length - 1 ? '#f4f1e8' : 'rgba(244,241,232,.2)');
      regions.push({ x0: 0, x1: 160, y0: 240, y1: 350, act: 'prev-bay' }, { x0: CHALK_W - 160, x1: CHALK_W, y0: 240, y1: 350, act: 'next-bay' });
      const n = recipes().length;
      chalkLine(g, n ? `${n} recipes · tap a book to open it` : 'Tap the recipe box to add one', CHALK_W / 2, 400, 24, 'rgba(244,241,232,.6)', 'Georgia, serif');
      g.textAlign = 'left';
    }
  }
  tex.needsUpdate = true;
}

function drawCard() {
  const { ctx: g, tex } = S.card;
  const regions = S.card.regions = [];
  g.fillStyle = '#fbf4e2'; g.fillRect(0, 0, BOX_W, BOX_H);
  g.strokeStyle = 'rgba(179, 38, 42, .55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 70); g.lineTo(BOX_W, 70); g.stroke();
  g.strokeStyle = 'rgba(90, 120, 160, .3)';
  for (let y = 110; y < BOX_H; y += 44) { g.beginPath(); g.moveTo(0, y); g.lineTo(BOX_W, y); g.stroke(); }
  g.fillStyle = '#8a5a2e'; g.font = '600 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('Add a recipe', BOX_W / 2, 52);
  const btn = (y, text, act, fill) => {
    g.fillStyle = fill; rrect(g, 36, y, BOX_W - 72, 84, 42); g.fill();
    g.fillStyle = '#fff6e0'; g.font = '600 34px system-ui, sans-serif'; g.fillText(text, BOX_W / 2, y + 54);
    regions.push({ x0: 0, x1: BOX_W, y0: y - 6, y1: y + 90, act });
  };
  btn(96, '📋  Paste a link', 'paste', '#2f6f4f');
  btn(204, '✎  Write one in', 'write', '#8a5a2e');
  tex.needsUpdate = true;
}

function regionAt(regions, uv, W, H) {
  const x = uv.x * W, y = (1 - uv.y) * H;
  return regions?.find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) || null;
}

function onCounterTap(hit) {
  if (hit.object === S.chalkMesh) {
    const reg = regionAt(S.chalk.regions, hit.uv, CHALK_W, CHALK_H);
    const act = reg?.act || 'search';
    if (act === 'search') { S.searchInput.focus({ preventScroll: true }); S.caretOn = true; drawChalk(); }
    if (act === 'clear') { S.query = ''; S.searchInput.value = ''; S.searchInput.blur(); drawChalk(); }
    if (act === 'open') { const b = bookOf(reg.id); S.searchInput.blur(); if (b) location.hash = `#/recipes/${encodeURIComponent(b.key)}/${encodeURIComponent(reg.id)}`; }
    if (act === 'group') { const i = GROUPINGS.findIndex(x => x.key === groupBy()); setGroupBy(GROUPINGS[(i + 1) % GROUPINGS.length].key); rebuild(); }
    if (act === 'prev-bay') focusBay(currentBay() - 1);
    if (act === 'next-bay') focusBay(currentBay() + 1);
    return;
  }
  const reg = hit.object === S.cardMesh ? regionAt(S.card.regions, hit.uv, BOX_W, BOX_H) : { act: 'paste' };
  if (reg?.act === 'paste') S.root.querySelector('[data-action="paste-link"]').click();
  if (reg?.act === 'write') location.hash = '#/add?type=recipe';
}

function bookOf(recipeId) {
  for (const b of S.books.values()) if (b.recipes.some(r => r.id === recipeId)) return b;
  return null;
}

// ---------- scene ----------
function buildRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  S.stage.append(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 20);
  Object.assign(S, { renderer, camera, clock: new THREE.Clock(), camX: 0, camTarget: 0, vel: 0, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches });
  makePages();
  S.ro = new ResizeObserver(resize); S.ro.observe(S.stage);
  bindPointer();
  S.on(document, 'visibilitychange', () => { if (!document.hidden) loop(); });
  if (window.visualViewport) S.on(window.visualViewport, 'resize', () => { if (S?.open) settleBook(); });
  loop();
}

function disposeScene() {
  if (!S?.scene) return;
  detachPages();
  S.scene.traverse(o => {
    if (o === S.leftPage?.mesh || o === S.rightPage?.mesh) return;
    o.geometry?.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m?.map?.dispose(); m?.dispose(); });
  });
  S.scene = null; S.books = new Map(); S.bays = []; S.pickables = [];
}

function bookColor(title, fav) {
  const r = rand(title);
  const warm = ['#8c3b2e', '#a8462f', '#7a2e2a', '#8a5a1f', '#b0662a'];
  return fav ? warm[Math.floor(r() * warm.length)] : BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)];
}

const COUNTER_Y = shelfY(SHELVES - 1) - 0.3; // worktop, just under the lowest shelf

function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#3a2a1c');
  scene.fog = new THREE.Fog('#3a2a1c', 2.6, 6.5);
  S.scene = scene;
  S.sig = signature();
  S.dirty = false;

  // Warm kitchen light: soft fill, a lamp that follows you, pendant glows and the stove.
  scene.add(new THREE.HemisphereLight('#fff2dc', '#4a3220', 1.0));
  const lamp = new THREE.SpotLight('#ffe6b8', 9, 4.4, Math.PI / 3.6, 0.6, 1.4);
  lamp.position.set(0, 2.2, 1.4);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0015;
  scene.add(lamp, lamp.target);

  // Bays: favorites always have their own bookcase (even when empty), then the rest.
  const { favorites, others } = cookbooks(recipes(), groupBy(), isSaved);
  const pack = (books, label, fav) => {
    const bays = [];
    let cur = null;
    for (const book of books) {
      const T = 0.045 + Math.min(book.recipes.length, 24) * 0.0018;
      if (!cur || (cur.cursor + T + 0.004 > INNER_W && ++cur.shelf >= SHELVES)) { cur = { label, fav, books: [], shelf: 0, cursor: 0 }; bays.push(cur); }
      if (cur.cursor + T + 0.004 > INNER_W) cur.cursor = 0;
      cur.books.push({ ...book, T, shelf: cur.shelf, at: cur.cursor });
      cur.cursor += T + 0.004;
    }
    if (!bays.length) bays.push({ label, fav, books: [], shelf: 0, cursor: 0, empty: true });
    return bays;
  };
  const favBays = pack(favorites, 'Favorites', true), allBays = pack(others, 'Cookbooks', false);
  const bays = [...favBays, ...allBays];
  bays.forEach(b => { const same = bays.filter(x => x.label === b.label); b.n = same.indexOf(b) + 1; b.of = same.length; });
  // Kitchen run, left to right: sink under a window, favorites, the stove, the rest, the fridge.
  const STOVE_W = 0.95;
  let x = 0;
  favBays.forEach(b => { b.x = x; x += BAY_STEP; });
  const stoveX = x - BAY_STEP / 2 + STOVE_W / 2;
  x += STOVE_W;
  allBays.forEach(b => { b.x = x; x += BAY_STEP; });
  const mid = (bays[0].x + bays[bays.length - 1].x) / 2;
  bays.forEach(b => { b.x -= mid; });
  const sx = stoveX - mid;
  const left = bays[0].x - BAY_STEP / 2, right = bays[bays.length - 1].x + BAY_STEP / 2;
  const sinkX = left - 0.55, fridgeX = right + 0.42;
  const runL = sinkX - 0.6, runR = fridgeX + 0.45, runW = runR - runL, runC = (runL + runR) / 2;

  const add = (geo, mat, x, y, z, shadows = true, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadows; m.receiveShadow = true; parent.add(m); return m; };
  const std = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  const WALL_Z = -DEPTH / 2 - 0.03;

  // Walls, a tiled backsplash and a checked floor.
  const wall = add(new THREE.PlaneGeometry(runW + 10, 4), std('#efe2c6', { roughness: 0.9 }), runC, COUNTER_Y + 1, WALL_Z, false);
  void wall;
  const tile = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#c9b48e'; g.fillRect(0, 0, W, H);
    const r = rand('tile');
    for (let y = 0; y < 4; y++) for (let k = -1; k < 2; k++) { g.fillStyle = `hsl(${165 + r() * 10}, 28%, ${70 + r() * 6}%)`; g.fillRect((y % 2) * 64 + k * 128 + 3, y * 64 + 3, 122, 58); }
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(runW * 4, 2.2);
  add(new THREE.PlaneGeometry(runW, 0.55), std('#ffffff', { map: tile, roughness: 0.35 }), runC, COUNTER_Y + 0.275, WALL_Z + 0.002, false);
  const floorTex = canvasTex(256, 256, (g, W, H) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#c96f4a' : '#efe0c0'; g.fillRect(i * 64, j * 64, 64, 64); } });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set((runW + 10) * 1.2, 3);
  const floor = add(new THREE.PlaneGeometry(runW + 10, 3), std('#ffffff', { map: floorTex, roughness: 0.7 }), runC, FLOOR_Y, 1.2, false);
  floor.rotation.x = -Math.PI / 2;

  // Lower cabinets and a butcher-block worktop all along the run.
  const CAB_D = 0.62, cabZ = WALL_Z + CAB_D / 2;
  const cabMat = std('#6f9a8a', { roughness: 0.55 }), doorMat = std('#7fae9c', { roughness: 0.5 }), brass = std('#c9a25a', { metalness: 0.8, roughness: 0.3 });
  add(new THREE.BoxGeometry(runW, COUNTER_Y - FLOOR_Y - 0.04, CAB_D), cabMat, runC, (COUNTER_Y + FLOOR_Y - 0.04) / 2, cabZ);
  add(new THREE.BoxGeometry(runW, 0.08, CAB_D), std('#2c2018'), runC, FLOOR_Y + 0.04, cabZ + 0.03, false); // toe kick
  for (let dx = runL + 0.04; dx + 0.42 <= runR; dx += 0.46) {
    if (Math.abs(dx + 0.21 - sx) < STOVE_W / 2) continue;
    add(new THREE.BoxGeometry(0.42, COUNTER_Y - FLOOR_Y - 0.2, 0.02), doorMat, dx + 0.21, (COUNTER_Y + FLOOR_Y + 0.04) / 2, cabZ + CAB_D / 2 + 0.01);
    add(new THREE.BoxGeometry(0.1, 0.014, 0.02), brass, dx + 0.21, COUNTER_Y - 0.14, cabZ + CAB_D / 2 + 0.03, false);
  }
  const topTex = woodTex('#b98a56', '#7a5230', 512, 64, 40);
  topTex.wrapS = THREE.RepeatWrapping; topTex.repeat.set(runW, 1);
  add(new THREE.BoxGeometry(runW + 0.04, 0.045, CAB_D + 0.03), std('#ffffff', { map: topTex, roughness: 0.5 }), runC, COUNTER_Y - 0.0225, cabZ + 0.015);

  // The stove: range, burners, a simmering pot and a hood.
  const range = new THREE.Group(); range.position.set(sx, 0, cabZ); scene.add(range);
  add(new THREE.BoxGeometry(STOVE_W - 0.05, COUNTER_Y - FLOOR_Y, CAB_D), std('#2b2b2e', { metalness: 0.4, roughness: 0.4 }), 0, (COUNTER_Y + FLOOR_Y) / 2, 0.005, true, range);
  const glow = std('#ff8a3d', { emissive: new THREE.Color('#ff6a1a'), emissiveIntensity: 0.6 });
  add(new THREE.BoxGeometry(STOVE_W - 0.25, 0.3, 0.01), glow, 0, FLOOR_Y + 0.4, CAB_D / 2 + 0.01, false, range);
  add(new THREE.BoxGeometry(STOVE_W - 0.2, 0.02, 0.03), std('#c0c0c0', { metalness: 0.9, roughness: 0.2 }), 0, FLOOR_Y + 0.62, CAB_D / 2 + 0.04, false, range);
  for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), std('#d8d8d8', { metalness: 0.8 }), -0.3 + k * 0.2, COUNTER_Y - 0.06, CAB_D / 2 + 0.02, false, range).rotation.x = Math.PI / 2;
  S.flames = [];
  for (const [bx, bz] of [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.14], [0.2, 0.14]]) {
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 24), std('#111'), bx, COUNTER_Y + 0.006, bz, false, range);
    const f = add(new THREE.TorusGeometry(0.06, 0.008, 6, 24), new THREE.MeshBasicMaterial({ color: '#4aa8ff' }), bx, COUNTER_Y + 0.016, bz, false, range);
    f.rotation.x = Math.PI / 2; S.flames.push(f);
  }
  const pot = add(new THREE.CylinderGeometry(0.11, 0.1, 0.14, 24), std('#9a3b2a', { roughness: 0.35 }), -0.2, COUNTER_Y + 0.09, 0.14, true, range);
  add(new THREE.CylinderGeometry(0.115, 0.115, 0.012, 24), std('#7a2e22'), 0, 0.075, 0, false, pot);
  add(new THREE.CylinderGeometry(0.11, 0.1, 0.06, 24), std('#3a3a3a', { metalness: 0.6 }), 0.2, COUNTER_Y + 0.04, -0.12, true, range);
  const hood = add(new THREE.CylinderGeometry(0.18, STOVE_W / 2, 0.32, 4, 1), std('#c9c2b4', { metalness: 0.5, roughness: 0.35 }), 0, shelfY(0) + 0.05, -0.08, true, range);
  hood.rotation.y = Math.PI / 4; hood.scale.z = 0.7;
  add(new THREE.BoxGeometry(0.3, 0.6, 0.3), std('#c9c2b4', { metalness: 0.5, roughness: 0.35 }), 0, shelfY(0) + 0.5, -0.12, false, range);
  const stoveLight = new THREE.PointLight('#ff9a4d', 1.4, 2.4, 1.6); stoveLight.position.set(sx, COUNTER_Y + 0.25, 0.3); scene.add(stoveLight);
  // steam
  const N = 24, sp = new Float32Array(N * 3), rs = rand('steam');
  for (let i = 0; i < N; i++) { sp[i * 3] = sx - 0.2 + (rs() - 0.5) * 0.08; sp[i * 3 + 1] = COUNTER_Y + 0.17 + rs() * 0.4; sp[i * 3 + 2] = cabZ + 0.14 + (rs() - 0.5) * 0.08; }
  const steamGeo = new THREE.BufferGeometry(); steamGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const puff = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  S.steam = new THREE.Points(steamGeo, new THREE.PointsMaterial({ size: 0.07, map: puff, transparent: true, opacity: 0.35, depthWrite: false }));
  S.steamBase = COUNTER_Y + 0.17;
  scene.add(S.steam);

  // The sink under a sunny window.
  add(new THREE.BoxGeometry(0.5, 0.02, 0.36), std('#d9dde0', { metalness: 0.8, roughness: 0.25 }), sinkX, COUNTER_Y + 0.002, cabZ - 0.02, false);
  add(new THREE.BoxGeometry(0.44, 0.02, 0.3), std('#6b7378', { metalness: 0.6 }), sinkX, COUNTER_Y + 0.006, cabZ - 0.02, false);
  const tap = add(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 10), std('#d9dde0', { metalness: 0.9, roughness: 0.2 }), sinkX, COUNTER_Y + 0.13, WALL_Z + 0.08);
  add(new THREE.TorusGeometry(0.07, 0.012, 8, 16, Math.PI), tap.material, 0, 0.13, 0.07, false, tap).rotation.y = Math.PI / 2;
  const sky = canvasTex(128, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fd0f0'); gr.addColorStop(1, '#fbe3b0'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#7fb36a'; g.beginPath(); g.ellipse(40, H, 70, 30, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5f9a55'; g.beginPath(); g.ellipse(110, H, 60, 22, 0, 0, Math.PI * 2); g.fill(); });
  add(new THREE.PlaneGeometry(0.62, 0.56), new THREE.MeshBasicMaterial({ map: sky }), sinkX, COUNTER_Y + 0.85, WALL_Z + 0.004, false);
  const frameMat = std('#f6efe0');
  for (const [w, h, fx, fy] of [[0.7, 0.04, 0, 0.3], [0.7, 0.04, 0, -0.3], [0.04, 0.64, -0.33, 0], [0.04, 0.64, 0.33, 0], [0.02, 0.56, 0, 0], [0.62, 0.02, 0, 0]]) add(new THREE.BoxGeometry(w, h, 0.04), frameMat, sinkX + fx, COUNTER_Y + 0.85 + fy, WALL_Z + 0.02, false);
  add(new THREE.BoxGeometry(0.74, 0.03, 0.1), frameMat, sinkX, COUNTER_Y + 0.54, WALL_Z + 0.05);
  const sun = new THREE.PointLight('#fff1c8', 0.8, 2.5, 1.5); sun.position.set(sinkX, COUNTER_Y + 0.8, 0.4); scene.add(sun);
  // herbs on the sill
  for (let k = 0; k < 3; k++) {
    add(new THREE.CylinderGeometry(0.035, 0.028, 0.06, 12), std('#c96f4a'), sinkX - 0.2 + k * 0.2, COUNTER_Y + 0.585, WALL_Z + 0.05);
    add(new THREE.SphereGeometry(0.05, 10, 8), std(['#4f8a3c', '#6aa04a', '#3f7a3a'][k]), sinkX - 0.2 + k * 0.2, COUNTER_Y + 0.64, WALL_Z + 0.05);
  }

  // The fridge at the far end.
  add(new THREE.BoxGeometry(0.8, 1.95, 0.7), std('#e9e4d8', { roughness: 0.35 }), fridgeX + 0.1, FLOOR_Y + 0.975, WALL_Z + 0.36);
  add(new THREE.BoxGeometry(0.02, 0.5, 0.03), brass, fridgeX - 0.22, FLOOR_Y + 1.3, WALL_Z + 0.73, false);
  add(new THREE.BoxGeometry(0.02, 0.4, 0.03), brass, fridgeX - 0.22, FLOOR_Y + 0.6, WALL_Z + 0.73, false);
  add(new THREE.BoxGeometry(0.78, 0.008, 0.01), std('#bdb6a6'), fridgeX + 0.1, FLOOR_Y + 1.05, WALL_Z + 0.715, false);

  // Little things on the worktop: a cutting board, jars, a fruit bowl.
  const cutX = (bays[0].x + (bays[1]?.x ?? bays[0].x + 0.4)) / 2;
  add(new THREE.BoxGeometry(0.3, 0.02, 0.2), std('#c99a62', { map: woodTex('#c99a62', '#8a6038', 128, 64, 10) }), cutX, COUNTER_Y + 0.01, WALL_Z + 0.22).rotation.y = 0.15;
  const jarMat = std('#e8f0ee', { transparent: true, opacity: 0.55, roughness: 0.1 });
  [['#d8a657', 0.14], ['#8a5a2e', 0.11], ['#b3262a', 0.09]].forEach(([c, h], k) => {
    const jx = right - 0.18 - k * 0.09;
    add(new THREE.CylinderGeometry(0.035, 0.035, h * 0.8, 14), std(c), jx, COUNTER_Y + h * 0.4, WALL_Z + 0.09, false);
    add(new THREE.CylinderGeometry(0.04, 0.04, h, 14), jarMat, jx, COUNTER_Y + h / 2, WALL_Z + 0.09);
    add(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 14), std('#3a2a1c'), jx, COUNTER_Y + h + 0.01, WALL_Z + 0.09, false);
  });
  add(new THREE.SphereGeometry(0.1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#e9dcc0', { side: THREE.DoubleSide }), sx + STOVE_W / 2 + 0.25, COUNTER_Y + 0.1, WALL_Z + 0.2);
  [['#d33a2c', -0.04, 0], ['#f2b632', 0.04, 0.02], ['#7fb03a', 0, -0.04]].forEach(([c, ox, oz]) => add(new THREE.SphereGeometry(0.035, 12, 10), std(c, { roughness: 0.4 }), sx + STOVE_W / 2 + 0.25 + ox, COUNTER_Y + 0.05, WALL_Z + 0.2 + oz));

  // Pendant lamps over the worktop.
  S.pendants = [];
  for (let px = left + 0.3; px < right; px += 1.3) {
    add(new THREE.CylinderGeometry(0.004, 0.004, 0.8, 6), std('#222'), px, shelfY(0) + 1.0, 0.45, false);
    add(new THREE.ConeGeometry(0.12, 0.12, 20, 1, true), std('#2f4f3a', { side: THREE.DoubleSide }), px, shelfY(0) + 0.58, 0.45);
    S.pendants.push(add(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffe2a0' }), px, shelfY(0) + 0.54, 0.45, false));
  }

  // Open wall shelves above the worktop, one bay per stack, each with a brass plaque.
  const caseMat = new THREE.MeshStandardMaterial({ map: woodTex('#8a5a32', '#3a2210'), roughness: 0.65, color: '#d6ad80' });
  const backMat = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 1 });
  const base = COUNTER_Y + 0.14, topY = shelfY(0) + 0.42, caseH = topY - base;
  bays.forEach(bay => {
    const cx = bay.x;
    add(new THREE.BoxGeometry(BAY_W, caseH, 0.01), backMat, cx, base + caseH / 2, -DEPTH / 2, false);
    for (let s = 0; s < SHELVES; s++) add(new THREE.BoxGeometry(BAY_W, SHELF_T, DEPTH), caseMat, cx, shelfY(s) - SHELF_T / 2, 0);
    add(new THREE.BoxGeometry(BAY_W + BAY_GAP, 0.04, DEPTH + 0.06), caseMat, cx, topY, 0.02);
    for (const side of [-1, 1]) add(new THREE.BoxGeometry(BAY_GAP, caseH, DEPTH + 0.02), caseMat, cx + side * BAY_STEP / 2, base + caseH / 2, 0);
    const plaque = canvasTex(320, 64, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, bay.fav ? '#f0c9a0' : '#e6c27a'); grad.addColorStop(1, bay.fav ? '#a8462f' : '#9c7334');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#6b4a1f'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
      g.fillStyle = '#3a2610'; g.font = '600 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${bay.fav ? '♥ ' : ''}${bay.label}${bay.of > 1 ? ` ${bay.n}/${bay.of}` : ''}`, W / 2, H / 2 + 2);
    });
    add(new THREE.BoxGeometry(0.34, 0.068, 0.008), [caseMat, caseMat, caseMat, caseMat, new THREE.MeshStandardMaterial({ map: plaque, metalness: 0.5, roughness: 0.35 }), caseMat], cx, shelfY(0) + 0.33, DEPTH / 2 + 0.004, false);
    if (bay.empty) {
      const note = canvasTex(256, 160, (g, W) => {
        g.fillStyle = '#f3e9cf'; g.fillRect(0, 0, W, 160);
        g.fillStyle = INK; g.font = 'italic 22px Georgia, serif'; g.textAlign = 'center';
        (bay.fav ? ['Heart a recipe and', 'it gets its own', 'cookbook here.'] : ['No recipes yet.', 'Tap the recipe box', 'to add your first.']).forEach((t, k) => g.fillText(t, W / 2, 50 + k * 34));
      });
      add(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshStandardMaterial({ map: note, roughness: 0.9 }), cx, shelfY(1) + 0.09, -DEPTH / 2 + 0.03, false).rotation.z = 0.04;
    }
  });

  const pageMat = new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.95 });
  bays.forEach(bay => bay.books.forEach(book => makeBook(book, bay, pageMat)));
  S.bays = bays;
  S.pickables = [...S.books.values()].map(b => b.group.children[0]);
  S.minX = bays[0].x; S.maxX = bays[bays.length - 1].x;
  Object.assign(S, { lamp, stove: stoveLight, cabFront: cabZ + CAB_D / 2 });
  makeCounterTools();
  resize();
}

function makeBook(book, bay, pageMat) {
  const r = rand(book.key);
  const H = 0.26 + r() * 0.03, W = 0.19, T = book.T;
  const color = bookColor(book.title, book.favorite);
  const coverMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const spine = canvasTex(96, 512, (g, Wc, Hc) => {
    const grad = g.createLinearGradient(0, 0, Wc, 0);
    grad.addColorStop(0, shade(color, 0.6)); grad.addColorStop(0.3, shade(color, 1.15)); grad.addColorStop(0.7, color); grad.addColorStop(1, shade(color, 0.55));
    g.fillStyle = grad; g.fillRect(0, 0, Wc, Hc);
    g.fillStyle = '#e9c46a';
    for (const y of [Hc * 0.05, Hc * 0.08, Hc * 0.92, Hc * 0.95]) g.fillRect(0, y, Wc, Hc * 0.01);
    g.save(); g.translate(Wc / 2, Hc * 0.5); g.rotate(-Math.PI / 2);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 40; g.font = `600 ${size}px Georgia, serif`;
    while (g.measureText(book.title).width > Hc * 0.62 && size > 18) { size -= 2; g.font = `600 ${size}px Georgia, serif`; }
    g.fillText(book.title, 0, 0);
    g.restore();
    g.textAlign = 'center'; g.font = '600 26px Georgia, serif';
    g.fillText(book.favorite ? '♥' : '❦', Wc / 2, Hc * 0.15);
    g.font = '600 22px Georgia, serif';
    g.fillText(String(book.recipes.length), Wc / 2, Hc * 0.86);
  });
  const first = canvasTex(256, 340, (g, Wc, Hc) => { g.fillStyle = '#f3e9cf'; g.fillRect(0, 0, Wc, Hc); });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), [pageMat, new THREE.MeshStandardMaterial({ map: spine, roughness: 0.6 }), pageMat, pageMat, new THREE.MeshStandardMaterial({ map: first, roughness: 0.95 }), coverMat]);
  body.castShadow = true; body.receiveShadow = true;
  const coverTex = canvasTex(256, 340, (g, Wc, Hc) => {
    g.fillStyle = color; g.fillRect(0, 0, Wc, Hc);
    g.strokeStyle = '#e9c46a'; g.lineWidth = 4; g.strokeRect(16, 16, Wc - 32, Hc - 32);
    g.lineWidth = 1.5; g.strokeRect(24, 24, Wc - 48, Hc - 48);
    g.fillStyle = '#e9c46a'; g.textAlign = 'center';
    g.font = 'italic 20px Georgia, serif'; g.fillText(book.favorite ? '♥ Favorites' : 'Cookbook', Wc / 2, 86);
    let size = 40; g.font = `600 ${size}px Georgia, serif`;
    const lines = () => layout(g, book.title, Wc - 60);
    while (lines().length > 2 && size > 22) { size -= 2; g.font = `600 ${size}px Georgia, serif`; }
    lines().slice(0, 3).forEach((l, i) => g.fillText(l.text.trim(), Wc / 2, Hc / 2 - 4 + i * (size + 6)));
    g.font = '18px Georgia, serif';
    g.fillText(`${book.recipes.length} recipe${book.recipes.length === 1 ? '' : 's'}`, Wc / 2, Hc - 54);
  });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(W + 0.006, H + 0.008, 0.005), [coverMat, coverMat, coverMat, coverMat, new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: '#d9c49a', roughness: 0.9 })]);
  cover.position.x = W / 2; cover.castShadow = true;
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, 0, T / 2 + 0.0025);
  hinge.add(cover);
  const group = new THREE.Group();
  group.add(body, hinge);
  if (book.favorite) {
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.06), new THREE.MeshStandardMaterial({ color: '#b3262a', side: THREE.DoubleSide }));
    ribbon.position.set(-W / 2 + 0.06, H / 2 + 0.02, 0); ribbon.rotation.y = Math.PI / 2;
    group.add(ribbon);
  }
  group.position.set(bay.x - INNER_W / 2 + book.at + T / 2, shelfY(book.shelf) + H / 2, DEPTH / 2 - W / 2 - 0.01 - r() * 0.01);
  group.rotation.set(0, Math.PI / 2, 0);
  body.userData.key = book.key;
  S.scene.add(group);
  const b = { ...book, H, W, T, group, hinge, bay, home: { pos: group.position.clone(), rot: group.rotation.clone() } };
  S.books.set(book.key, b);
}

function viewDistance() {
  const { camera } = S;
  const want = Math.min(BAY_STEP * 1.15 * Math.max(1, camera.aspect / 0.75), BAY_STEP * 3.2);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const byWidth = want / 2 / (Math.tan(halfFov) * camera.aspect);
  const byHeight = (shelfY(0) + 0.5 - (COUNTER_Y - 0.12)) / 0.82 / 2 / Math.tan(halfFov); // shelves and the worktop
  return Math.max(byWidth, Math.min(byHeight, byWidth * 1.6), 0.9);
}
function resize() {
  if (!S?.renderer) return;
  const w = S.stage.clientWidth || 1, h = S.stage.clientHeight || 1;
  S.renderer.setSize(w, h, false);
  S.camera.aspect = w / h;
  S.camera.updateProjectionMatrix();
  S.dist = viewDistance();
  if (S.open && !S.busy) settleBook();
}

// ---------- input ----------
const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
function cast(e, objects) {
  const r = S.renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, S.camera);
  return ray.intersectObjects(objects, false)[0] || null;
}
const worldPerPixel = () => (2 * Math.tan(THREE.MathUtils.degToRad(S.camera.fov / 2)) * S.dist) / (S.stage.clientHeight || 1);
const clampX = x => Math.max(S.minX - 0.15, Math.min(S.maxX + 0.15, x));
const nearestBay = x => S.bays.reduce((best, b, i) => (Math.abs(b.x - x) < Math.abs(S.bays[best].x - x) ? i : best), 0);
const currentBay = () => nearestBay(S.camTarget);
const firstBay = () => { const i = S.bays.findIndex(b => !b.fav); return S.bays[0]?.empty && i > 0 ? i : 0; };

function bindPointer() {
  const el = S.renderer.domElement;
  let down = null;
  S.on(el, 'pointerdown', e => {
    e.preventDefault(); // stops the follow-up mousedown from stealing focus from the chalkboard's search box
    if (S.busy) return;
    down = { x: e.clientX, y: e.clientY, cam: S.camTarget, lastX: e.clientX, lastT: performance.now(), moved: false };
    el.setPointerCapture?.(e.pointerId);
    S.vel = 0;
  });
  S.on(el, 'pointermove', e => {
    if (!down) { hover(e); return; }
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
    if (S.open || S.zoom) return;
    const perPx = worldPerPixel();
    S.camTarget = clampX(down.cam - dx * perPx);
    const now = performance.now();
    S.vel = -(e.clientX - down.lastX) * perPx / Math.max(1, now - down.lastT) * 16;
    down.lastX = e.clientX; down.lastT = now;
  });
  S.on(el, 'pointerup', e => {
    if (!down) return;
    const d = down; down = null;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (S.open) {
      if (S.busy) return;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); return; }
      if (d.moved) return;
      const hit = cast(e, [S.leftPage.mesh, S.rightPage.mesh, S.open.book.group.children[0]]);
      if (!hit) { location.hash = '#/recipes'; return; } // tapped beside the book: back on the shelf
      if (hit.object !== S.leftPage.mesh && hit.object !== S.rightPage.mesh) return;
      const page = S.pageList[S.spread * 2 + (hit.object === S.leftPage.mesh ? 0 : 1)];
      const reg = regionAt(page?.regions, hit.uv, PAGE_W, PAGE_H);
      if (reg) pageAction(reg);
      else if (narrow()) hit.object === S.leftPage.mesh ? (S.cur % 2 ? prev() : next()) : (S.cur % 2 ? next() : prev());
      else hit.object === S.rightPage.mesh ? next() : prev();
      return;
    }
    if (!d.moved) {
      S.vel = 0;
      const tool = cast(e, S.toolHits);
      if (tool) {
        const which = tool.object === S.chalkMesh ? 'chalk' : 'box';
        if (S.zoom !== which) {
          zoomTo(which);
          const reg = which === 'chalk' && regionAt(S.chalk.regions, tool.uv, CHALK_W, CHALK_H);
          if (reg?.act === 'search') onCounterTap(tool); // tapping the search line also opens the keyboard
          return;
        }
        onCounterTap(tool); return;
      }
      S.searchInput.blur();
      if (S.zoom) { zoomTo(null); return; } // tapped away from the board or box: step back
      const hit = cast(e, S.pickables); if (hit) location.hash = `#/recipes/${encodeURIComponent(hit.object.userData.key)}`;
    } else if (!S.zoom) snapToBay();
  });
  S.on(el, 'pointercancel', () => { down = null; });
  S.on(el, 'wheel', e => { if (S.open || S.zoom) return; e.preventDefault(); S.camTarget = clampX(S.camTarget + (e.deltaX || e.deltaY) * worldPerPixel()); clearTimeout(S.wheelT); S.wheelT = setTimeout(snapToBay, 220); }, { passive: false });
  S.on(window, 'keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'Escape' && S.open) location.hash = '#/recipes';
    if (e.key === 'Escape' && S.zoom) zoomTo(null);
    if (e.key === 'ArrowLeft') S.open ? prev() : focusBay(currentBay() - 1);
    if (e.key === 'ArrowRight') S.open ? next() : focusBay(currentBay() + 1);
  });
}
function hover(e) {
  if (S.open || S.busy || e.pointerType !== 'mouse') return;
  const hit = cast(e, S.pickables);
  const b = hit ? S.books.get(hit.object.userData.key) : null;
  if (S.hovered && S.hovered !== b) S.hovered.peek = 0;
  S.hovered = b;
  if (b) b.peek = 1;
  S.renderer.domElement.style.cursor = b ? 'pointer' : 'grab';
}
// Step up to the chalkboard or the recipe box so it fills the screen and is easy to read and tap.
function zoomTo(which) {
  if (!S) return;
  S.zoom = which;
  if (!which) S.searchInput.blur();
}
const _zp = new THREE.Vector3(), _zn = new THREE.Vector3(), _zq = new THREE.Quaternion();
function zoomPose() {
  const mesh = S.zoom === 'chalk' ? S.chalkMesh : S.cardMesh;
  const g = mesh.geometry.parameters, k = (S.zoom === 'chalk' ? S.chalkGroup : S.boxGroup).scale.x;
  const w = g.width * k * (S.zoom === 'chalk' ? 1.06 : 1.12), h = g.height * k * 1.12;
  const cam = S.camera, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const d = Math.max(w / 2 / (tanH * cam.aspect), h / 2 / tanH);
  mesh.updateWorldMatrix(true, false);
  mesh.getWorldPosition(_zp); mesh.getWorldQuaternion(_zq);
  _zn.set(0, 0, 1).applyQuaternion(_zq);
  return { look: _zp, pos: _zp.clone().addScaledVector(_zn, d) };
}
function snapToBay() {
  const ahead = S.camTarget + S.vel * 6;
  focusBay(nearestBay(ahead));
}
function focusBay(i, instant = false) {
  if (!S?.bays.length) return;
  i = Math.max(0, Math.min(S.bays.length - 1, i));
  S.vel = 0;
  const bay = S.bays[i];
  S.camTarget = bay.x; if (instant) S.camX = bay.x;
  S.bayIndex = i;
  drawChalk();
}

// ---------- animation ----------
function tween(ms, step) {
  if (S.reduced) ms = Math.min(ms, 120);
  return new Promise(resolve => {
    const t0 = performance.now();
    const tick = now => {
      if (!S) return resolve();
      const t = Math.min(1, (now - t0) / ms);
      step(ease(t));
      t < 1 ? requestAnimationFrame(tick) : resolve();
    };
    requestAnimationFrame(tick);
  });
}

const _look = new THREE.Vector3();
function loop() {
  if (!S?.renderer || document.hidden) return;
  cancelAnimationFrame(S.raf);
  S.raf = requestAnimationFrame(loop);
  if (!S.scene) return;
  const t = S.clock.getElapsedTime();
  if (!S.open && !S.busy && Math.abs(S.vel) > 0.0001) { S.camTarget = clampX(S.camTarget + S.vel); S.vel *= 0.9; }
  S.camX += (S.camTarget - S.camX) * (S.reduced ? 1 : 0.14);
  const cam = S.camera;
  const midY = (shelfY(0) + 0.5 + COUNTER_Y - 0.12) / 2 - 0.03;
  const zWant = S.zoom && !S.open ? 1 : 0, zPrev = S.zoomT || 0;
  S.zoomT = S.reduced ? zWant : zPrev + (zWant - zPrev) * 0.16;
  if (Math.abs(S.zoomT - zWant) < 0.001) S.zoomT = zWant;
  if (!S.open || S.camFree) {
    cam.position.set(S.camX, midY + 0.12, DEPTH / 2 + S.dist);
    _look.set(S.camX, midY, 0);
    if (S.zoomT > 0 && S.chalkGroup) {
      placeCounterTools();
      const z = zoomPose(), t = ease(S.zoomT);
      cam.position.lerp(z.pos, t); _look.lerp(z.look, t);
    }
    cam.lookAt(_look);
  }
  // Idle (nothing moving but the steam): draw every other frame to spare the phone's battery.
  const idle = !S.busy && !S.open && Math.abs(S.camTarget - S.camX) < 0.0005 && Math.abs(S.vel) < 0.0001 && S.zoomT === zWant;
  S.frame = (S.frame || 0) + 1;
  if (idle && S.frame % 2) return;
  S.lamp.position.x = S.camX + 0.25; S.lamp.target.position.set(S.camX, midY - 0.1, 0);
  S.stove.intensity = 1.3 + Math.sin(t * 5.3) * 0.12 + Math.sin(t * 11.1) * 0.06;
  S.flames.forEach((f, i) => { f.scale.setScalar(1 + Math.sin(t * 13 + i * 2) * 0.06); });
  const sp = S.steam.geometry.attributes.position;
  for (let i = 0; i < sp.count; i++) { let y = sp.getY(i) + 0.0015; if (y > S.steamBase + 0.45) y = S.steamBase; sp.setY(i, y); sp.setX(i, sp.getX(i) + Math.sin(t * 1.3 + i) * 0.0004); }
  sp.needsUpdate = true;
  placeCounterTools();
  for (const b of S.books.values()) {
    if (S.open?.book === b) continue;
    const want = b.home.pos.z + (b.peek ? 0.035 : 0);
    if (Math.abs(b.group.position.z - want) > 0.0005 && !S.busy) b.group.position.z += (want - b.group.position.z) * 0.2;
  }
  S.renderer.render(S.scene, cam);
}

// ---------- pages: recipes drawn straight onto the 3D paper ----------
function pageCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W; canvas.height = PAGE_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = S.renderer.capabilities.getMaxAnisotropy();
  return { canvas, ctx: canvas.getContext('2d'), tex };
}
function makePages() {
  const mk = gutterAtLeft => {
    const p = pageCanvas();
    p.mesh = new THREE.Mesh(curvedPage(gutterAtLeft), new THREE.MeshStandardMaterial({ map: p.tex, emissiveMap: p.tex, emissive: new THREE.Color('#9a8a70'), roughness: 0.92, side: THREE.DoubleSide }));
    p.mesh.visible = false; p.mesh.receiveShadow = true;
    return p;
  };
  S.leftPage = mk(false);
  S.rightPage = mk(true);
  // The leaf that turns when you flip: its front is a right-hand page, its back a left-hand one.
  const front = pageCanvas(), back = pageCanvas();
  const mat = p => new THREE.MeshStandardMaterial({ map: p.tex, emissiveMap: p.tex, emissive: new THREE.Color('#9a8a70'), roughness: 0.92 });
  front.mesh = new THREE.Mesh(curvedPage(true), mat(front));
  back.mesh = new THREE.Mesh(curvedPage(false), mat(back));
  back.mesh.rotation.y = Math.PI;
  const pivot = new THREE.Group();
  pivot.add(front.mesh, back.mesh);
  pivot.visible = false;
  S.leaf = { front, back, pivot };
  S.scratch = document.createElement('canvas').getContext('2d');
}
function attachPages(b) {
  const sx = b.W * 0.965, sy = b.H * 0.955, bulge = 0.009;
  const R = S.rightPage.mesh, L = S.leftPage.mesh;
  R.scale.set(sx, sy, bulge); R.position.set(0.002, 0, b.T / 2 + 0.0012); R.rotation.set(0, 0, 0);
  L.scale.set(sx, sy, bulge); L.position.set(b.W / 2 + 0.002, 0, -0.0034); L.rotation.set(0, Math.PI, 0);
  const { pivot, front, back } = S.leaf;
  pivot.position.set(-b.W / 2 + 0.002, 0, b.T / 2 + 0.004);
  for (const m of [front.mesh, back.mesh]) { m.scale.set(sx, sy, bulge * 0.6); m.position.set(sx / 2, 0, m === back.mesh ? -0.0005 : 0.0005); }
  b.group.add(R, pivot); b.hinge.add(L);
  R.visible = L.visible = true;
}
function detachPages() {
  if (!S?.leftPage) return;
  for (const m of [S.leftPage.mesh, S.rightPage.mesh, S.leaf.pivot]) { m.parent?.remove(m); }
  S.leftPage.mesh.visible = S.rightPage.mesh.visible = S.leaf.pivot.visible = false;
}

const M = 70, TOP = 92, BOTTOM = PAGE_H - 96, TEXT_W = PAGE_W - M * 2;
const TOC_FONT = `27px ${HAND}`, TOC_LH = 36;
const FONTS = {
  title: { font: '600 46px Georgia, serif', lh: 56, color: INK },
  kicker: { font: 'italic 26px Georgia, serif', lh: 40, color: LABEL },
  meta: { font: '24px system-ui, sans-serif', lh: 34, color: '#6a4a30' },
  label: { font: '600 24px system-ui, sans-serif', lh: 52, color: LABEL },
  line: { font: `31px ${HAND}`, lh: 43, color: INK },
  note: { font: `italic 28px ${HAND}`, lh: 40, color: '#5a4030' },
  credit: { font: 'italic 20px Georgia, serif', lh: 30, color: FADED },
};

// Turns a cookbook into a list of pages, each a set of positioned lines. A recipe always
// starts on a left-hand page, so it opens as a spread: ingredients left, steps right.
function paginate(book) {
  const g = S.scratch;
  const pages = [];
  // Contents: every recipe, over as many pages as it takes, with long titles wrapped onto a
  // second line rather than cut off. Laid out first so the recipe page numbers are known.
  g.font = TOC_FONT;
  const toc = book.recipes.map(r => {
    let lines = layout(g, r.title.normalize('NFC'), TEXT_W - 80).map(l => l.text.trim());
    if (lines.length > 2) { let last = lines.slice(1).join(' '); while (g.measureText(`${last}…`).width > TEXT_W - 80 && last.length > 4) last = last.slice(0, -1); lines = [lines[0], `${last.trimEnd()}…`]; }
    return { id: r.id, lines };
  });
  const contentsPages = [];
  let cy = BOTTOM;
  for (const e of toc) {
    const h = e.lines.length * TOC_LH + 12;
    if (cy + h > BOTTOM) { contentsPages.push({ kind: 'contents', cont: contentsPages.length > 0, ops: [] }); cy = TOP + 64; }
    contentsPages.at(-1).ops.push({ kind: 'toc', lines: e.lines, id: e.id, x: M, y: cy + TOC_LH });
    cy += h;
  }
  if (!contentsPages.length) contentsPages.push({ kind: 'contents', ops: [] });
  pages.push({ kind: 'title', ops: [] }, ...contentsPages);
  const starts = new Map();
  for (const r of book.recipes) {
    if (pages.length % 2) pages.push({ ops: [] });
    starts.set(r.id, pages.length);
    let page = null, y = 0;
    const newPage = cont => { page = { recipeId: r.id, ops: [] }; pages.push(page); y = TOP; if (cont) { put('kicker', `${r.title} (continued)`, { size: 'small' }); y += 8; } };
    const put = (kind, text, { indent = 0, bullet = '', keep = 0, size } = {}) => {
      const f = FONTS[kind];
      g.font = size === 'small' ? 'italic 22px Georgia, serif' : f.font;
      const lines = layout(g, String(text), TEXT_W - indent);
      if (y + f.lh * Math.min(lines.length, 2 + keep) > BOTTOM) newPage(true);
      lines.forEach((l, i) => {
        if (y + f.lh > BOTTOM) newPage(true);
        y += f.lh;
        page.ops.push({ kind, text: l.text.trim(), x: M + indent, y, bullet: i === 0 ? bullet : '', small: size === 'small' });
      });
    };
    const section = (label, fn) => { if (y + 170 > BOTTOM) newPage(true); else y += 14; put('label', label, { keep: 1 }); fn(); };
    newPage(false);
    const kicker = [cuisineOf(r), r.category].filter(Boolean).join(' · ');
    if (kicker) put('kicker', kicker);
    put('title', r.title);
    const meta = [r.minutes ? minutes(r.minutes) : '', r.servings ? `serves ${r.servings}` : '', r.nutrition?.protein ? `${Math.round(r.nutrition.protein)} g protein` : '', r.nutrition?.calories ? `${Math.round(r.nutrition.calories)} cal` : ''].filter(Boolean).join('  ·  ');
    if (meta) put('meta', meta);
    y += 14; page.ops.push({ kind: 'actions', id: r.id, y }); y += 70;
    if (r.photo?.src) {
      const h = 300;
      if (y + h + 20 > BOTTOM) newPage(true);
      y += 10; page.ops.push({ kind: 'photo', src: r.photo.src, alt: r.photo.alt || r.title, x: M, y, w: TEXT_W, h }); y += h + 4;
      const credit = [r.photo.credit || r.photo.author, r.photo.license].filter(Boolean).join(' · ');
      if (credit) put('credit', `Photo: ${credit}`);
    }
    if (r.description) { y += 8; put('note', r.description); }
    if (r.ingredients?.length) section('INGREDIENTS', () => r.ingredients.forEach(t => put('line', t, { indent: 30, bullet: '•' })));
    if (r.steps?.length) {
      if (pages.length - 1 === starts.get(r.id) && y > PAGE_H * 0.45) { newPage(false); y -= 14; } // the method starts on the right-hand page
      section('METHOD', () => r.steps.forEach((t, i) => { put('line', t, { indent: 44, bullet: `${i + 1}.` }); y += 8; }));
    }
    const n = r.nutrition;
    if (n && Object.values(n).some(v => typeof v === 'number')) section('NUTRITION, PER SERVING', () => {
      put('line', [['calories', ''], ['protein', ' g protein'], ['carbs', ' g carbs'], ['fat', ' g fat']].filter(([k]) => typeof n[k] === 'number').map(([k, u]) => `${Math.round(n[k])}${u || ' calories'}`).join('  ·  '));
      if (n.note) put('note', n.note);
    });
    if (r.cost && Number.isFinite(r.cost.total)) section('COST', () => {
      put('line', `$${r.cost.total.toFixed(2)} for the recipe${r.servings ? `  ·  $${(r.cost.total / r.servings).toFixed(2)} a serving` : ''}`);
      if (r.cost.note) put('note', r.cost.note);
    });
    if (r.note) section('NOTES', () => r.note.split('\n').filter(Boolean).forEach(t => put('note', t)));
    if (r.tags?.length) section('TAGS', () => put('meta', r.tags.join('  ·  ')));
    const src = [r.sourceName, r.sourceUrl].filter(Boolean);
    const more = [...(r.sources || []), ...(r.nutrition?.sources || []), ...(r.cost?.sources || [])];
    if (src.length || more.length) section('SOURCE', () => {
      if (src.length) put('credit', src.join(' — '));
      more.slice(0, 6).forEach(x => put('credit', `${x.label}: ${x.url}`));
    });
    if (!r.ingredients?.length && !r.steps?.length && !r.note && !r.description) put('note', 'No ingredients or steps saved yet. Tap “Full recipe” to add them.');
  }
  if (pages.length % 2) pages.push({ ops: [] });
  for (const c of contentsPages) for (const op of c.ops) op.num = String(starts.get(op.id) + 1);
  return { pages, starts };
}

function loadPhoto(src) {
  if (S.photos.has(src)) return S.photos.get(src);
  const img = new Image();
  if (/^https?:/.test(src)) img.crossOrigin = 'anonymous';
  img.onload = () => { if (S?.open) paintSpread(); };
  img.onerror = () => { img.failed = true; if (S?.open) paintSpread(); };
  img.decoding = 'async';
  img.src = src;
  S.photos.set(src, img);
  return img;
}

function chip(g, regions, x, y, w, text, act, id, on) {
  g.fillStyle = on ? '#b3262a' : 'rgba(201, 164, 106, .28)';
  rrect(g, x, y, w, 56, 28); g.fill();
  g.strokeStyle = on ? '#7a1a1c' : '#c9a46a'; g.lineWidth = 2; g.stroke();
  g.fillStyle = on ? '#fff3da' : '#5a3a1e'; g.font = '600 24px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(text, x + w / 2, y + 37); g.textAlign = 'left';
  regions.push({ x0: x - 4, x1: x + w + 4, y0: y - 8, y1: y + 64, act, id });
}

function drawPage(g, page, index, book, gutterLeft) {
  paper(g, gutterLeft);
  if (!page) return;
  const regions = page.regions = [];
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (page.kind === 'title') {
    g.textAlign = 'center';
    g.fillStyle = LABEL; g.font = 'italic 32px Georgia, serif';
    g.fillText(book.favorite ? '♥ From your favorites' : 'A cookbook of', PAGE_W / 2, 330);
    g.fillStyle = INK;
    let size = 72; g.font = `600 ${size}px Georgia, serif`;
    while (g.measureText(book.title).width > TEXT_W && size > 36) { size -= 4; g.font = `600 ${size}px Georgia, serif`; }
    g.fillText(book.title, PAGE_W / 2, 430);
    g.strokeStyle = '#c9a46a'; g.lineWidth = 2; g.beginPath(); g.moveTo(PAGE_W / 2 - 110, 470); g.lineTo(PAGE_W / 2 + 110, 470); g.stroke();
    g.fillStyle = LABEL; g.font = 'italic 28px Georgia, serif';
    g.fillText(`${book.recipes.length} recipe${book.recipes.length === 1 ? '' : 's'}`, PAGE_W / 2, 530);
    g.fillStyle = FADED; g.font = 'italic 24px Georgia, serif';
    g.fillText('Swipe or tap the right page to turn it.', PAGE_W / 2, 700);
    g.fillText('Tap beside the book to put it back.', PAGE_W / 2, 740);
  } else if (page.kind === 'contents') {
    g.fillStyle = LABEL; g.font = '600 26px system-ui, sans-serif'; g.fillText(page.cont ? 'CONTENTS, CONTINUED' : 'CONTENTS', M, TOP + 10);
    for (const op of page.ops) {
      const fav = isSaved(op.id);
      g.fillStyle = INK; g.font = TOC_FONT;
      op.lines.forEach((l, i) => g.fillText(`${fav && !i ? '♥ ' : ''}${l}`, op.x + (fav && i ? g.measureText('♥ ').width : 0), op.y + i * TOC_LH));
      const lastY = op.y + (op.lines.length - 1) * TOC_LH;
      const w = g.measureText(`${fav ? '♥ ' : ''}${op.lines.at(-1)}`).width; // a wrapped line is indented past the heart too
      g.fillStyle = FADED; g.font = '24px Georgia, serif'; g.textAlign = 'right';
      g.fillText(op.num, PAGE_W - M, lastY);
      g.textAlign = 'left';
      g.strokeStyle = 'rgba(74, 48, 32, .25)'; g.setLineDash([3, 7]); g.beginPath(); g.moveTo(op.x + w + 12, lastY - 6); g.lineTo(PAGE_W - M - 50, lastY - 6); g.stroke(); g.setLineDash([]);
      regions.push({ x0: 0, x1: PAGE_W, y0: op.y - 34, y1: lastY + 10, act: 'goto', id: op.id });
    }
  } else {
    for (const op of page.ops) {
      if (op.kind === 'photo') {
        const img = loadPhoto(op.src);
        g.fillStyle = 'rgba(120, 90, 50, .12)'; g.fillRect(op.x, op.y, op.w, op.h);
        if (img.complete && img.naturalWidth && !img.failed) {
          const s = Math.max(op.w / img.naturalWidth, op.h / img.naturalHeight), sw = op.w / s, sh = op.h / s;
          g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, op.x, op.y, op.w, op.h);
        } else {
          g.fillStyle = FADED; g.font = 'italic 24px Georgia, serif'; g.textAlign = 'center';
          g.fillText(img.failed ? 'Photo on the full recipe page' : 'Loading photo…', op.x + op.w / 2, op.y + op.h / 2);
          g.textAlign = 'left';
        }
        g.strokeStyle = '#fbf6ea'; g.lineWidth = 10; g.strokeRect(op.x, op.y, op.w, op.h);
        g.strokeStyle = 'rgba(90, 60, 30, .35)'; g.lineWidth = 2; g.strokeRect(op.x - 5, op.y - 5, op.w + 10, op.h + 10);
        continue;
      }
      if (op.kind === 'actions') {
        const r = getItem(op.id), fav = isSaved(op.id);
        let x = M;
        chip(g, regions, x, op.y, 200, fav ? '♥ Favorite' : '♡ Favorite', 'fav', op.id, fav); x += 214;
        if (r?.steps?.length) { chip(g, regions, x, op.y, 170, '▶ Cook', 'cook', op.id); x += 184; }
        chip(g, regions, x, op.y, 210, 'Full recipe ›', 'full', op.id);
        continue;
      }
      const f = FONTS[op.kind];
      g.fillStyle = f.color; g.font = op.small ? 'italic 22px Georgia, serif' : f.font;
      g.fillText(op.text, op.x, op.y);
      if (op.bullet) { g.fillStyle = LABEL; g.font = /\d/.test(op.bullet) ? '600 26px Georgia, serif' : f.font; g.fillText(op.bullet, M + (/\d/.test(op.bullet) ? 0 : 6), op.y); }
    }
  }
  // Footer on every page: contents, page number, back to the shelf.
  g.fillStyle = FADED; g.font = '22px Georgia, serif'; g.textAlign = 'center';
  g.fillText(String(index + 1), PAGE_W / 2, PAGE_H - 46);
  g.fillStyle = LABEL; g.font = '600 22px system-ui, sans-serif';
  if (page.kind !== 'contents') { g.textAlign = 'left'; g.fillText('☰ Contents', M, PAGE_H - 46); regions.push({ x0: 0, x1: 240, y0: PAGE_H - 100, y1: PAGE_H, act: 'contents' }); }
  g.textAlign = 'right'; g.fillText('Shelf ✕', PAGE_W - M, PAGE_H - 46); regions.push({ x0: PAGE_W - 220, x1: PAGE_W, y0: PAGE_H - 100, y1: PAGE_H, act: 'shelf' });
  g.textAlign = 'left';
}

async function pageAction(reg) {
  if (reg.act === 'goto') jumpTo(reg.id);
  if (reg.act === 'contents') turnTo(0, 1);
  if (reg.act === 'shelf') location.hash = '#/recipes';
  if (reg.act === 'cook') location.hash = `#/item/${encodeURIComponent(reg.id)}/cook`;
  if (reg.act === 'full') location.hash = `#/item/${encodeURIComponent(reg.id)}`;
  if (reg.act === 'fav') { const on = await toggleSaved(reg.id); toast(on ? 'Added to favorites. It moves to the Favorites shelf when you close this book.' : 'Removed from favorites'); if (S?.open) paintSpread(); }
}

function paintTo(target, pageIndex, gutterLeft) {
  drawPage(target.ctx, S.pageList[pageIndex], pageIndex, S.open.book, gutterLeft);
  target.tex.needsUpdate = true;
}
function paintSpread() {
  if (!S?.open) return;
  paintTo(S.leftPage, S.spread * 2, false);
  paintTo(S.rightPage, S.spread * 2 + 1, true);
  updateTools();
}

// ---------- flipping ----------
const narrow = () => S.camera.aspect < 0.9;
const spreads = () => S.pageList.length / 2;
function next() {
  if (!S?.open || S.busy) return;
  if (narrow() && S.cur % 2 === 0) { S.cur++; settleBook(); updateTools(); return; }
  if (S.spread + 1 < spreads()) turnTo(S.spread + 1, (S.spread + 1) * 2);
}
function prev() {
  if (!S?.open || S.busy) return;
  if (narrow() && S.cur % 2 === 1) { S.cur--; settleBook(); updateTools(); return; }
  if (S.spread > 0) turnTo(S.spread - 1, (S.spread - 1) * 2 + (narrow() ? 1 : 0));
}
function jumpTo(recipeId) {
  const start = S.starts?.get(recipeId);
  if (start === undefined || S.busy) return;
  turnTo(start / 2, start);
}

async function turnTo(spread, cur) {
  if (!S?.open || S.busy) return;
  if (spread === S.spread) { S.cur = cur; settleBook(); updateTools(); return; }
  const forward = spread > S.spread;
  const old = S.spread;
  const { pivot, front, back } = S.leaf;
  S.busy = true;
  if (forward) {
    paintTo(front, old * 2 + 1, true);
    paintTo(back, spread * 2, false);
    S.spread = spread; S.cur = cur;
    paintTo(S.rightPage, spread * 2 + 1, true);
  } else {
    paintTo(front, spread * 2 + 1, true);
    paintTo(back, old * 2, false);
    S.spread = spread; S.cur = cur;
    paintTo(S.leftPage, spread * 2, false);
  }
  updateTools();
  pivot.visible = true;
  let swapped = false;
  const from = forward ? 0 : -Math.PI, to = forward ? -Math.PI : 0;
  const lift = 0.02;
  settleBook();
  await tween(520, t => {
    pivot.rotation.y = from + (to - from) * t;
    pivot.position.z = S.open.book.T / 2 + 0.004 + Math.sin(t * Math.PI) * lift;
    if (!swapped && t >= 0.5) { swapped = true; forward ? paintTo(S.leftPage, spread * 2, false) : paintTo(S.rightPage, spread * 2 + 1, true); }
  });
  if (!S?.open) return;
  pivot.visible = false;
  S.busy = false;
}

// ---------- open and close ----------
function readingPose(b) {
  const cam = S.camera;
  const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const stageH = S.stage.clientHeight || 1;
  const toolsFrac = 70 / stageH;
  const one = narrow();
  const wantW = one ? b.W * 1.04 : b.W * 2 + 0.03;
  const usableH = Math.max(0.3, 1 - toolsFrac);
  const d = Math.max(wantW / 0.96 / 2 / (tanH * cam.aspect), (b.H + 0.02) / (0.94 * usableH) / 2 / tanH);
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const pos = cam.position.clone().addScaledVector(dir, d);
  pos.x += !one ? b.W / 2 : S.cur % 2 === 0 ? b.W : 0;
  pos.y += 2 * d * tanH * (1 - usableH) / 2;
  return { pos, rot: new THREE.Euler(cam.rotation.x, 0, 0) };
}
function settleBook() {
  const b = S?.open?.book;
  if (!b || S.opening) return;
  const from = b.group.position.clone(), to = readingPose(b).pos;
  if (from.distanceTo(to) < 0.0005) return;
  const id = (S.settleId = (S.settleId || 0) + 1);
  tween(360, t => { if (S.settleId === id && S.open?.book === b) b.group.position.lerpVectors(from, to, t); });
}

async function openBook(b, recipeId) {
  if (!S) return;
  S.open = { book: b };
  const zoomed = S.zoomT > 0; S.zoom = null;
  const { pages, starts } = paginate(b);
  S.pageList = pages; S.starts = starts;
  const start = recipeId && starts.has(recipeId) ? starts.get(recipeId) : 0;
  S.spread = start / 2; S.cur = start;
  document.body.classList.add('lib-reading');
  S.searchInput.blur();
  S.busy = true; S.opening = true;
  const bayI = S.bays.indexOf(b.bay);
  if (zoomed || bayI !== S.bayIndex || Math.abs(S.camX - b.bay.x) > 0.01) {
    S.camFree = true; // keep the camera moving back to the shelf while the book waits
    focusBay(bayI); await tween(zoomed ? 650 : 450, () => {});
    if (S) { S.camFree = false; S.zoomT = 0; }
  }
  if (S.open?.book !== b) return;
  b.peek = 0;
  attachPages(b);
  paintSpread();
  const from = b.group.position.clone();
  const out = from.clone(); out.z += 0.22;
  await tween(400, t => { b.group.position.lerpVectors(from, out, t); });
  const pose = readingPose(b);
  await tween(650, t => {
    b.group.position.lerpVectors(out, pose.pos, t);
    b.group.position.y += Math.sin(t * Math.PI) * 0.06;
    b.group.rotation.set(pose.rot.x * t, Math.PI / 2 * (1 - t), 0);
  });
  S.root.querySelector('.lib-dim').classList.add('on');
  await tween(650, t => { b.hinge.rotation.y = -Math.PI * 0.985 * t; });
  if (S?.open?.book !== b) return;
  S.busy = false; S.opening = false;
}

async function closeBook(fast = false) {
  if (!S?.open) return;
  const b = S.open.book;
  S.open = null;
  document.body.classList.remove('lib-reading');
  S.root.querySelector('.lib-dim').classList.remove('on');
  S.busy = true; S.opening = false;
  const k = fast ? 0.5 : 1;
  const startHinge = b.hinge.rotation.y;
  S.leaf.pivot.visible = false;
  await tween(450 * k, t => { b.hinge.rotation.y = startHinge * (1 - t); });
  if (!S) return;
  detachPages();
  const from = b.group.position.clone(), fromRot = b.group.rotation.clone();
  const out = b.home.pos.clone(); out.z += 0.22;
  await tween(600 * k, t => { b.group.position.lerpVectors(from, out, t); b.group.rotation.set(fromRot.x * (1 - t), fromRot.y + (Math.PI / 2 - fromRot.y) * t, 0); });
  await tween(380 * k, t => { b.group.position.lerpVectors(out, b.home.pos, t); });
  if (!S) return;
  S.busy = false;
  if (S.dirty || signature() !== S.sig) rebuild();
}

function updateTools() { /* the page buttons are drawn on the paper (see drawPage) */ }

// Test hook: where a cookbook sits on screen.
if (typeof window !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
  window.__cookbookPoint = key => {
    const b = key ? S?.books.get(key) : S?.books.values().next().value; if (!b) return null;
    const v = b.group.position.clone().project(S.camera), r = S.renderer.domElement.getBoundingClientRect();
    return { key: b.key, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  window.__cookbooks = () => [...(S?.books.values() || [])].map(b => ({ key: b.key, title: b.title, favorite: b.favorite, n: b.recipes.length }));
}
