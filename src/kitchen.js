// The Kitchen: a three.js cookbook shelf. Recipes are bound into cookbooks (by cuisine,
// meal, protein or time, your pick), and favorites always get their own books on their
// own bookcase. Tap a cookbook and it slides off the shelf and opens like a Library book:
// the recipes are drawn right on the curved 3D pages, and you flip through them.
import * as THREE from '../vendor/three.module.min.js';
import { byType, getItem, isSaved, search } from './store.js';
import { escape, icon } from './ui.js';
import { listView } from './views.js';
import { cookbooks, GROUPINGS } from '../shared/cookbooks.js';
import { cuisineOf } from '../shared/cuisine.js';
import { rand, BOOK_COLORS, canvasTex, woodTex, shade, ease, PAGE_W, PAGE_H, INK, FADED, LABEL, HAND, curvedPage, layout, paper } from './library.js';

// ---------- layout ----------
const SHELVES = 3;
const BAY_W = 0.62, SHELF_GAP = 0.36, SHELF_T = 0.022, DEPTH = 0.28, BAY_GAP = 0.05;
const BAY_STEP = BAY_W + BAY_GAP;
const shelfY = s => 1.35 - s * SHELF_GAP;
const FLOOR_Y = shelfY(SHELVES - 1) - 0.34;
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
    <div class="lib-stage" aria-hidden="true"></div>
    <div class="kit-top">
      <label class="kit-search">${icon('search')}<span class="sr-only">Search recipes</span><input id="kit-search" type="search" enterkeyhint="search" autocomplete="off" placeholder="Search recipes…" /></label>
      <label class="lib-chip kit-group" title="Group cookbooks by">${icon('book')}<span class="sr-only">Group cookbooks by</span><select data-kit="group">${GROUPINGS.map(g => `<option value="${g.key}" ${g.key === groupBy() ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label>
      <button class="lib-chip kit-add" data-action="paste-link" aria-label="Paste a link to add a recipe">${icon('paste')}<span>Paste link</span></button>
      <div class="kit-results" hidden></div>
    </div>
    <div class="lib-hud">
      <p class="lib-hint">Tap a cookbook to open it</p>
      <div class="lib-nav">
        <button class="lib-chip" data-kit="prev-bay" aria-label="Previous bookcase">${icon('back')}</button>
        <span class="lib-month" aria-live="polite"></span>
        <button class="lib-chip lib-flip" data-kit="next-bay" aria-label="Next bookcase">${icon('back')}</button>
        <a class="lib-chip" href="#/recipes/list" aria-label="Show recipes as a list">${icon('list')}</a>
        <a class="lib-chip" href="#/add?type=recipe" aria-label="Add a recipe">${icon('plus')}</a>
      </div>
    </div>
    <div class="lib-dim"></div>
    <div class="lib-pages lib-ink" hidden></div>`;
  S = { root, stage: root.querySelector('.lib-stage'), tools: root.querySelector('.lib-pages'), books: new Map(), bays: [], open: null, busy: false, raf: 0, listeners: [], photos: new Map() };
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); S.listeners.push(() => target.removeEventListener(type, fn, opts)); };
  S.on = on;
  on(root, 'click', onClick);
  on(root, 'change', e => { if (e.target.dataset.kit === 'group') { setGroupBy(e.target.value); rebuild(); } });
  on(root.querySelector('#kit-search'), 'input', e => showResults(e.target.value));
  on(root.querySelector('#kit-search'), 'keydown', e => { if (e.key === 'Enter') root.querySelector('.kit-results a')?.click(); if (e.key === 'Escape') { e.target.value = ''; showResults(''); } });
  document.body.classList.add('in-library', 'in-kitchen');
  try { buildRenderer(); buildScene(); }
  catch (error) { console.warn('Kitchen 3D unavailable', error); unmount(); root.innerHTML = listView('recipe'); return; }
  focusBay(firstBay(), true);
  if (bookKey) route(bookKey, recipeId);
}

export function unmount() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
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

/** Recipes or favorites changed (here, or synced from another device). */
export function refresh() {
  if (!S) return;
  if (S.open) { S.dirty = signature() !== S.sig; updateTools(); return; }
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

// ---------- search: jump straight to a recipe's page ----------
function showResults(q) {
  const box = S.root.querySelector('.kit-results');
  q = q.trim();
  if (!q) { box.hidden = true; box.innerHTML = ''; return; }
  const hits = search(q, recipes()).slice(0, 8);
  box.hidden = false;
  box.innerHTML = hits.length
    ? hits.map(r => { const b = bookOf(r.id); return `<a href="#/recipes/${encodeURIComponent(b?.key || '')}/${encodeURIComponent(r.id)}">${isSaved(r.id) ? icon('heart') : ''}<strong>${escape(r.title)}</strong><small>${escape(b?.title || '')}${b?.favorite ? ' · Favorites' : ''}</small></a>`; }).join('')
    : '<p>No recipes match that.</p>';
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

function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1c12');
  scene.fog = new THREE.Fog('#2a1c12', 2.4, 6);
  S.scene = scene;
  S.sig = signature();
  S.dirty = false;

  scene.add(new THREE.HemisphereLight('#fff0d6', '#3a2414', 0.8));
  const lamp = new THREE.SpotLight('#ffe0a8', 8, 4.2, Math.PI / 4, 0.6, 1.4);
  lamp.position.set(0, 2.1, 1.3);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  lamp.shadow.bias = -0.0015;
  scene.add(lamp, lamp.target);
  const stove = new THREE.PointLight('#ff9a4d', 1.1, 3, 1.6);
  stove.position.set(0.8, FLOOR_Y + 0.4, 1);
  scene.add(stove);
  Object.assign(S, { lamp, stove });

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
  const bays = [...pack(favorites, 'Favorites', true), ...pack(others, 'Cookbooks', false)];
  bays.forEach((b, i) => { b.n = bays.filter(x => x.label === b.label).indexOf(b) + 1; b.of = bays.filter(x => x.label === b.label).length; void i; });
  const span = bays.length * BAY_STEP;
  const x0 = -(span - BAY_STEP) / 2;
  const bayX = i => x0 + i * BAY_STEP;

  // Room: tiled kitchen wall, wood floor, a warm runner.
  const tile = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#b9a88a'; g.fillRect(0, 0, W, H);
    const r = rand('tile');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
      const ox = (y % 2) * 64;
      g.fillStyle = `hsl(38, 30%, ${78 + r() * 6}%)`;
      g.fillRect(ox + x * 128 + 3, y * 64 + 3, 122, 58);
      g.fillRect(ox + x * 128 - 128 + 3, y * 64 + 3, 122, 58);
    }
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set((span + 12) * 2.5, 10);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(span + 12, 4), new THREE.MeshStandardMaterial({ map: tile, roughness: 0.5 }));
  wall.position.set(0, 1, -DEPTH / 2 - 0.03);
  wall.receiveShadow = true;
  const floorTex = woodTex('#6a4428', '#2c1a0d', 512, 128, 30);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, span * 2 + 8);
  floorTex.rotation = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span + 12, 6), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, 2);
  floor.receiveShadow = true;
  const runnerTex = canvasTex(256, 64, (g, W, H) => {
    g.fillStyle = '#2f4f3a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e9c46a';
    for (let x = 8; x < W; x += 24) g.fillRect(x, 6, 10, 4), g.fillRect(x + 12, H - 10, 10, 4);
  });
  runnerTex.wrapS = THREE.RepeatWrapping; runnerTex.repeat.set(span + 1, 1);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(span + 1, 0.9), new THREE.MeshStandardMaterial({ map: runnerTex, roughness: 1 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, FLOOR_Y + 0.002, 0.8);
  runner.receiveShadow = true;
  scene.add(wall, floor, runner);

  const caseMat = new THREE.MeshStandardMaterial({ map: woodTex('#8a5a32', '#3a2210'), roughness: 0.65, color: '#d6ad80' });
  const backMat = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 1 });
  const totalH = shelfY(0) + 0.42 - FLOOR_Y;
  const add = (geo, mat, x, y, z, shadows = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadows; m.receiveShadow = true; scene.add(m); return m; };
  bays.forEach((bay, i) => {
    const cx = bayX(i);
    add(new THREE.BoxGeometry(BAY_W, totalH, 0.01), backMat, cx, FLOOR_Y + totalH / 2, -DEPTH / 2, false);
    for (let s = 0; s < SHELVES; s++) add(new THREE.BoxGeometry(BAY_W, SHELF_T, DEPTH), caseMat, cx, shelfY(s) - SHELF_T / 2, 0);
    add(new THREE.BoxGeometry(BAY_W + BAY_GAP, 0.08, DEPTH + 0.04), caseMat, cx, FLOOR_Y + 0.04, 0.01);
    add(new THREE.BoxGeometry(BAY_W + BAY_GAP, 0.05, DEPTH + 0.06), caseMat, cx, FLOOR_Y + totalH, 0.02);
    const plaque = canvasTex(320, 64, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, bay.fav ? '#f0c9a0' : '#e6c27a'); grad.addColorStop(1, bay.fav ? '#a8462f' : '#9c7334');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#6b4a1f'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
      g.fillStyle = '#3a2610'; g.font = '600 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${bay.fav ? '♥ ' : ''}${bay.label}`, W / 2, H / 2 + 2);
    });
    add(new THREE.BoxGeometry(0.34, 0.068, 0.008), [caseMat, caseMat, caseMat, caseMat, new THREE.MeshStandardMaterial({ map: plaque, metalness: 0.5, roughness: 0.35 }), caseMat], cx, shelfY(0) + 0.33, DEPTH / 2 + 0.004, false);
    if (bay.empty) {
      const note = canvasTex(256, 160, (g, W, H) => {
        g.fillStyle = '#f3e9cf'; g.fillRect(0, 0, W, H);
        g.fillStyle = INK; g.font = 'italic 22px Georgia, serif'; g.textAlign = 'center';
        (bay.fav ? ['Heart a recipe and', 'it gets its own', 'cookbook here.'] : ['No recipes yet.', 'Paste a link to', 'add your first.']).forEach((t, k) => g.fillText(t, W / 2, 50 + k * 34));
      });
      const card = add(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshStandardMaterial({ map: note, roughness: 0.9 }), cx, shelfY(1) + 0.09, -DEPTH / 2 + 0.03, false);
      card.rotation.z = 0.04;
    }
    bay.x = cx;
  });
  for (let i = 0; i <= bays.length; i++) add(new THREE.BoxGeometry(BAY_GAP, totalH, DEPTH + 0.02), caseMat, x0 - BAY_STEP / 2 + i * BAY_STEP, FLOOR_Y + totalH / 2, 0);

  const pageMat = new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.95 });
  bays.forEach(bay => bay.books.forEach(book => makeBook(book, bay, pageMat)));
  S.bays = bays;
  S.pickables = [...S.books.values()].map(b => b.group.children[0]);
  S.minX = bayX(0); S.maxX = bayX(bays.length - 1);
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
  const byHeight = (shelfY(0) + 0.42 - FLOOR_Y + 0.7) / 2 / Math.tan(halfFov);
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
const currentBay = () => Math.max(0, Math.min(S.bays.length - 1, Math.round((S.camTarget - S.minX) / BAY_STEP)));
const firstBay = () => { const i = S.bays.findIndex(b => !b.fav); return S.bays[0]?.empty && i > 0 ? i : 0; };

function bindPointer() {
  const el = S.renderer.domElement;
  let down = null;
  S.on(el, 'pointerdown', e => {
    if (S.busy) return;
    down = { x: e.clientX, y: e.clientY, cam: S.camTarget, lastX: e.clientX, lastT: performance.now(), moved: false };
    el.setPointerCapture?.(e.pointerId);
    S.vel = 0;
  });
  S.on(el, 'pointermove', e => {
    if (!down) { hover(e); return; }
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
    if (S.open) return;
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
      const hit = cast(e, [S.leftPage.mesh, S.rightPage.mesh]);
      if (!hit) return;
      const page = S.pageList[S.spread * 2 + (hit.object === S.leftPage.mesh ? 0 : 1)];
      const y = (1 - hit.uv.y) * PAGE_H;
      const link = page?.links?.find(l => y >= l.y0 && y <= l.y1);
      if (link) jumpTo(link.id);
      else if (narrow()) hit.object === S.leftPage.mesh ? (S.cur % 2 ? prev() : next()) : (S.cur % 2 ? next() : prev());
      else hit.object === S.rightPage.mesh ? next() : prev();
      return;
    }
    if (!d.moved) { S.vel = 0; const hit = cast(e, S.pickables); if (hit) location.hash = `#/recipes/${encodeURIComponent(hit.object.userData.key)}`; }
    else snapToBay();
  });
  S.on(el, 'pointercancel', () => { down = null; });
  S.on(el, 'wheel', e => { if (S.open) return; e.preventDefault(); S.camTarget = clampX(S.camTarget + (e.deltaX || e.deltaY) * worldPerPixel()); clearTimeout(S.wheelT); S.wheelT = setTimeout(snapToBay, 220); }, { passive: false });
  S.on(window, 'keydown', e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'Escape' && S.open) location.hash = '#/recipes';
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
function snapToBay() {
  const ahead = S.camTarget + S.vel * 6;
  focusBay(Math.round((ahead - S.minX) / BAY_STEP));
}
function focusBay(i, instant = false) {
  if (!S?.bays.length) return;
  i = Math.max(0, Math.min(S.bays.length - 1, i));
  S.vel = 0;
  const bay = S.bays[i];
  S.camTarget = bay.x; if (instant) S.camX = bay.x;
  S.root.querySelector('.lib-month').textContent = `${bay.fav ? '♥ ' : ''}${bay.label}${bay.of > 1 ? ` ${bay.n} of ${bay.of}` : ''}`;
  S.root.querySelector('[data-kit="prev-bay"]').disabled = i === 0;
  S.root.querySelector('[data-kit="next-bay"]').disabled = i === S.bays.length - 1;
  const n = recipes().length;
  S.root.querySelector('.lib-hint').textContent = n ? `Tap a cookbook to open it · ${n} recipe${n === 1 ? '' : 's'}` : 'Paste a link from any recipe site, TikTok or Instagram to start';
  S.bayIndex = i;
}

function onClick(e) {
  const el = e.target.closest('[data-kit]');
  if (!el) { if (e.target.closest('.kit-results a')) { S.root.querySelector('#kit-search').blur(); } return; }
  const a = el.dataset.kit;
  if (a === 'prev-bay') focusBay(currentBay() - 1);
  if (a === 'next-bay') focusBay(currentBay() + 1);
  if (a === 'close') location.hash = '#/recipes';
  if (a === 'prev') prev();
  if (a === 'next') next();
  if (a === 'contents') turnTo(0, 0);
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

function loop() {
  if (!S?.renderer || document.hidden) return;
  cancelAnimationFrame(S.raf);
  S.raf = requestAnimationFrame(loop);
  if (!S.scene) return;
  const t = S.clock.getElapsedTime();
  if (!S.open && !S.busy && Math.abs(S.vel) > 0.0001) { S.camTarget = clampX(S.camTarget + S.vel); S.vel *= 0.9; }
  S.camX += (S.camTarget - S.camX) * (S.reduced ? 1 : 0.14);
  const cam = S.camera;
  const midY = (shelfY(0) + 0.42 + FLOOR_Y) / 2 + 0.02;
  if (!S.open) { cam.position.set(S.camX, midY + 0.12, DEPTH / 2 + S.dist); cam.lookAt(S.camX, midY, 0); }
  S.lamp.position.x = S.camX + 0.25; S.lamp.target.position.set(S.camX, midY - 0.1, 0);
  S.stove.position.x = S.camX + 0.8;
  S.stove.intensity = 1 + Math.sin(t * 5.3) * 0.08 + Math.sin(t * 11.1) * 0.05;
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
const FONTS = {
  title: { font: '600 46px Georgia, serif', lh: 56, color: INK },
  kicker: { font: 'italic 26px Georgia, serif', lh: 40, color: LABEL },
  meta: { font: '24px system-ui, sans-serif', lh: 34, color: '#6a4a30' },
  label: { font: '600 24px system-ui, sans-serif', lh: 52, color: LABEL },
  line: { font: `31px ${HAND}`, lh: 43, color: INK },
  note: { font: `italic 28px ${HAND}`, lh: 40, color: FADED },
};

// Turns a cookbook into a list of pages, each a set of positioned lines. A recipe always
// starts on a left-hand page, so it opens as a spread: ingredients left, steps right.
function paginate(book) {
  const g = S.scratch;
  const pages = [];
  const contents = { kind: 'contents', ops: [], links: [] };
  pages.push({ kind: 'title', ops: [] }, contents);
  const starts = new Map();
  for (const r of book.recipes) {
    if (pages.length % 2) pages.push({ ops: [] });
    starts.set(r.id, pages.length);
    let page = null, y = 0;
    const newPage = cont => { page = { recipeId: r.id, ops: [] }; pages.push(page); y = TOP; if (cont) { put('kicker', `${r.title} (continued)`, { size: 'small' }); y += 8; } };
    const put = (kind, text, { indent = 0, bullet = '', keep = 0, size } = {}) => {
      const f = FONTS[kind];
      g.font = size === 'small' ? 'italic 22px Georgia, serif' : f.font;
      const lines = layout(g, text, TEXT_W - indent);
      if (y + f.lh * Math.min(lines.length, 2 + keep) > BOTTOM) newPage(true);
      lines.forEach((l, i) => {
        if (y + f.lh > BOTTOM) newPage(true);
        y += f.lh;
        page.ops.push({ kind, text: l.text.trim(), x: M + indent, y, bullet: i === 0 ? bullet : '', small: size === 'small' });
      });
    };
    newPage(false);
    const kicker = [cuisineOf(r), r.category].filter(Boolean).join(' · ');
    if (kicker) put('kicker', kicker);
    put('title', r.title);
    const meta = [r.minutes ? minutes(r.minutes) : '', r.servings ? `serves ${r.servings}` : '', r.nutrition?.protein ? `${Math.round(r.nutrition.protein)} g protein` : '', r.nutrition?.calories ? `${Math.round(r.nutrition.calories)} cal` : ''].filter(Boolean).join('  ·  ');
    if (meta) put('meta', meta);
    const src = r.photo?.src || '';
    if (/^(\/assets\/|data:image\/)/.test(src) && y + 260 < BOTTOM) { y += 18; page.ops.push({ kind: 'photo', src, x: M, y, w: TEXT_W, h: 230 }); y += 236; }
    if (isSaved(r.id)) page.ops.push({ kind: 'heart', x: PAGE_W - M - 10, y: TOP + 28 });
    if (r.ingredients?.length) { y += 10; put('label', 'INGREDIENTS', { keep: 1 }); r.ingredients.forEach(t => put('line', t, { indent: 30, bullet: '•' })); }
    if (r.steps?.length) {
      if (pages.length - 1 === starts.get(r.id) && y > PAGE_H * 0.45) newPage(false); // steps start on the right-hand page
      else y += 10;
      put('label', 'METHOD', { keep: 1 });
      r.steps.forEach((t, i) => { put('line', t, { indent: 44, bullet: `${i + 1}.` }); y += 8; });
    }
    if (r.notes) { y += 10; put('label', 'NOTES', { keep: 1 }); put('note', r.notes); }
    if (!r.ingredients?.length && !r.steps?.length && !r.notes) put('note', 'No ingredients or steps saved yet. Open the full recipe to add them.');
  }
  if (pages.length % 2) pages.push({ ops: [] });
  // Contents page, now that every recipe has a page number.
  let y = TOP + 70;
  g.font = FONTS.line.font;
  for (const r of book.recipes) {
    if (y > BOTTOM - 20) { contents.more = book.recipes.length - contents.links.length; break; }
    let title = r.title;
    while (g.measureText(title).width > TEXT_W - 90 && title.length > 4) title = title.slice(0, -2);
    if (title !== r.title) title = title.trimEnd() + '…';
    contents.ops.push({ kind: 'toc', text: title, num: String(starts.get(r.id) + 1), x: M, y, fav: isSaved(r.id) });
    contents.links.push({ id: r.id, y0: y - 36, y1: y + 12 });
    y += 52;
  }
  return { pages, starts };
}

function loadPhoto(src) {
  if (S.photos.has(src)) return S.photos.get(src);
  const img = new Image();
  img.onload = () => { if (S?.open) paintSpread(); };
  img.src = src;
  S.photos.set(src, img);
  return img;
}

function drawPage(g, page, index, book, gutterLeft) {
  paper(g, gutterLeft);
  if (!page) return;
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
    g.fillText('Swipe or tap a page to turn it', PAGE_W / 2, BOTTOM);
    return;
  }
  if (page.kind === 'contents') {
    g.fillStyle = LABEL; g.font = '600 26px system-ui, sans-serif'; g.fillText('CONTENTS', M, TOP + 10);
    for (const op of page.ops) {
      g.fillStyle = INK; g.font = FONTS.line.font;
      g.fillText(`${op.fav ? '♥ ' : ''}${op.text}`, op.x, op.y);
      const w = g.measureText(`${op.fav ? '♥ ' : ''}${op.text}`).width;
      g.fillStyle = FADED; g.font = '24px Georgia, serif'; g.textAlign = 'right';
      g.fillText(op.num, PAGE_W - M, op.y);
      g.textAlign = 'left';
      g.strokeStyle = 'rgba(74, 48, 32, .25)'; g.setLineDash([3, 7]); g.beginPath(); g.moveTo(op.x + w + 12, op.y - 6); g.lineTo(PAGE_W - M - 50, op.y - 6); g.stroke(); g.setLineDash([]);
    }
    if (page.more) { g.fillStyle = FADED; g.font = 'italic 24px Georgia, serif'; g.fillText(`…and ${page.more} more. Keep flipping.`, M, BOTTOM - 10); }
  } else {
    for (const op of page.ops) {
      if (op.kind === 'photo') {
        const img = loadPhoto(op.src);
        if (img.complete && img.naturalWidth) {
          const s = Math.max(op.w / img.naturalWidth, op.h / img.naturalHeight), sw = op.w / s, sh = op.h / s;
          g.save(); g.globalAlpha = 0.92; g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, op.x, op.y, op.w, op.h); g.restore();
          g.strokeStyle = 'rgba(90, 60, 30, .35)'; g.lineWidth = 3; g.strokeRect(op.x, op.y, op.w, op.h);
        }
        continue;
      }
      if (op.kind === 'heart') { g.fillStyle = '#b3262a'; g.font = '40px Georgia, serif'; g.textAlign = 'right'; g.fillText('♥', op.x, op.y); g.textAlign = 'left'; continue; }
      const f = FONTS[op.kind];
      g.fillStyle = f.color; g.font = op.small ? 'italic 22px Georgia, serif' : f.font;
      g.fillText(op.text, op.x, op.y);
      if (op.bullet) { g.fillStyle = LABEL; g.font = /\d/.test(op.bullet) ? '600 26px Georgia, serif' : f.font; g.fillText(op.bullet, M + (/\d/.test(op.bullet) ? 0 : 6), op.y); }
    }
  }
  g.fillStyle = FADED; g.font = '22px Georgia, serif'; g.textAlign = 'center';
  g.fillText(String(index + 1), PAGE_W / 2, PAGE_H - 46);
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
  const { pages, starts } = paginate(b);
  S.pageList = pages; S.starts = starts;
  const start = recipeId && starts.has(recipeId) ? starts.get(recipeId) : 0;
  S.spread = start / 2; S.cur = start;
  document.body.classList.add('lib-reading');
  S.root.querySelector('.kit-results').hidden = true;
  S.busy = true; S.opening = true;
  const bayI = S.bays.indexOf(b.bay);
  if (bayI !== S.bayIndex || Math.abs(S.camX - b.bay.x) > 0.01) { focusBay(bayI); await tween(450, () => {}); }
  if (S.open?.book !== b) return;
  b.peek = 0;
  attachPages(b);
  paintSpread();
  showTools();
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
  S.tools.classList.add('on');
}

async function closeBook(fast = false) {
  if (!S?.open) return;
  const b = S.open.book;
  S.open = null;
  S.tools.classList.remove('on'); S.tools.hidden = true; S.tools.innerHTML = '';
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

// ---------- the little toolbar under the open cookbook ----------
function currentRecipe() {
  const page = S.pageList?.[narrow() ? S.cur : S.spread * 2] ;
  const other = S.pageList?.[S.spread * 2 + 1];
  const id = page?.recipeId || (!narrow() && other?.recipeId) || '';
  return id ? getItem(id) : null;
}
function showTools() {
  S.tools.hidden = false;
  S.tools.innerHTML = `
    <div class="lib-tools" role="toolbar" aria-label="${escape(S.open.book.title)} cookbook">
      <button class="lib-chip" data-kit="prev" aria-label="Previous page">${icon('back')}</button>
      <button class="lib-chip" data-kit="contents" aria-label="Contents">${icon('list')}</button>
      <span class="kit-recipe-tools"></span>
      <button class="lib-chip lib-shelf" data-kit="close">${icon('close')}<span>Shelf</span></button>
      <button class="lib-chip lib-flip" data-kit="next" aria-label="Next page">${icon('back')}</button>
    </div>`;
  updateTools();
}
function updateTools() {
  if (!S?.open || S.tools.hidden) return;
  const r = currentRecipe();
  const slot = S.tools.querySelector('.kit-recipe-tools');
  const on = r && isSaved(r.id);
  slot.innerHTML = r ? `
    <button class="lib-chip kit-heart ${on ? 'on' : ''}" data-action="save" data-id="${escape(r.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from favorites' : 'Add to favorites'}">${icon('heart')}</button>
    ${r.steps?.length ? `<a class="lib-chip" href="#/item/${encodeURIComponent(r.id)}/cook" aria-label="Cook mode">${icon('play')}<span class="kit-wide">Cook</span></a>` : ''}
    <a class="lib-chip" href="#/item/${encodeURIComponent(r.id)}" aria-label="Full recipe">${icon('note')}<span class="kit-wide">Recipe</span></a>` : '';
  const last = S.spread + 1 >= spreads() && (!narrow() || S.cur % 2 === 1);
  S.tools.querySelector('[data-kit="prev"]').disabled = S.spread === 0 && (!narrow() || S.cur === 0);
  S.tools.querySelector('[data-kit="next"]').disabled = last;
}

// Test hook: where a cookbook sits on screen.
if (typeof window !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
  window.__cookbookPoint = key => {
    const b = key ? S?.books.get(key) : S?.books.values().next().value; if (!b) return null;
    const v = b.group.position.clone().project(S.camera), r = S.renderer.domElement.getBoundingClientRect();
    return { key: b.key, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
  window.__cookbooks = () => [...(S?.books.values() || [])].map(b => ({ key: b.key, title: b.title, favorite: b.favorite, n: b.recipes.length }));
}
