// The Library tab: a cozy three.js reading room. Every day is a book on the shelves
// (one bay of shelves per month). Tap a book and it slides off the shelf, turns to you
// and opens, and its pages hold that day's thoughts plus the plan for the next gym visit.
import * as THREE from '../vendor/three.module.min.js';
import { exitDoor } from './exitdoor.js';
import { byType, getItem, saveItem, deleteItem } from './store.js';
import { escape, icon, toast } from './ui.js';
import { todayISO } from '../shared/tasks.js';

// ---------- dates ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad = n => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parts = date => { const [y, m, d] = date.split('-').map(Number); return { y, m: m - 1, d }; };
const weekday = date => { const { y, m, d } = parts(date); return new Date(y, m, d).getDay(); };
const longDate = date => { const { y, m, d } = parts(date); return `${WEEKDAYS[weekday(date)]}, ${MONTHS[m]} ${d}, ${y}`; };
const shiftDay = (date, n) => { const { y, m, d } = parts(date); const t = new Date(y, m, d + n); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const entryId = date => `journal-${date}`;
const entry = date => getItem(entryId(date));
const hasWriting = e => Boolean(e && (e.body || e.nextWorkout || e.workoutId));
const writtenDates = () => byType('journal').filter(hasWriting).map(e => e.date).filter(d => d <= todayISO()).sort();

// One bay per month that has entries, oldest first, and always this month so today's book has a home.
function months() {
  const t = parts(todayISO());
  const map = new Map();
  for (const date of writtenDates()) {
    const { y, m } = parts(date);
    const key = y * 12 + m;
    if (!map.has(key)) map.set(key, { y, m, days: [] });
    map.get(key).days.push(date);
  }
  if (!map.has(t.y * 12 + t.m)) map.set(t.y * 12 + t.m, { y: t.y, m: t.m, days: [] });
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

// Small stable random numbers per date, so each book keeps its look.
export function rand(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
export const BOOK_COLORS = ['#7a2e2a', '#2f4f3a', '#24344f', '#8a5a1f', '#5a2f4a', '#4a3424', '#1f4a4a', '#6b3a1f', '#3d4a2a', '#8c3b2e', '#2e3b5c', '#5c4a2e'];

// ---------- layout ----------
const PER_SHELF = 8, SHELVES = 4;
const BAY_W = 0.56, SHELF_GAP = 0.34, SHELF_T = 0.022, DEPTH = 0.26, BAY_GAP = 0.05;
const BAY_STEP = BAY_W + BAY_GAP;
const shelfY = s => 1.55 - s * SHELF_GAP; // top face of shelf board s (0 = top shelf)
const FLOOR_Y = shelfY(SHELVES - 1) - 0.32;

// ---------- module state ----------
let S = null;

export const mounted = () => Boolean(S);

export function mount(root, date) {
  unmount();
  root.innerHTML = `
    <div class="lib-stage" aria-hidden="true"></div>
    <div class="lib-hud">
      <p class="lib-hint">Tap a book to open that day</p>
      <div class="lib-nav">
        <button class="lib-chip" data-lib="prev-month" aria-label="Earlier month">${icon('back')}</button>
        <span class="lib-month" aria-live="polite"></span>
        <button class="lib-chip lib-flip" data-lib="next-month" aria-label="Later month">${icon('back')}</button>
        <button class="lib-chip lib-today" data-lib="today">Today</button>
      </div>
    </div>
    <div class="lib-dim"></div>
    <div class="lib-pages" hidden></div>`;
  S = { root, stage: root.querySelector('.lib-stage'), pages: root.querySelector('.lib-pages'), books: new Map(), bays: [], open: null, busy: false, pendingSave: null, raf: 0, listeners: [] };
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); S.listeners.push(() => target.removeEventListener(type, fn, opts)); };
  S.on = on;
  on(root, 'click', onHudClick);
  on(S.pages, 'input', onPageInput);
  on(S.pages, 'change', onPageInput);
  document.body.classList.add('in-library');
  try { buildScene(); root.classList.add('lib-3d'); }
  catch (error) { console.warn('Library 3D unavailable', error); S.flat = true; buildFlat(); }
  updateHud();
  if (isDate(date)) route(date); else focusMonth(S.bays.length - 1, true);
}

function updateHud() {
  if (!S) return;
  const hasToday = Boolean(entry(todayISO()) && hasWriting(entry(todayISO())));
  const empty = !writtenDates().length;
  S.root.querySelector('.lib-hint').textContent = empty ? 'Your shelves are empty for now. Start today’s book to place the first one.' : hasToday ? 'Tap a book to open that day' : 'Tap a book to open it, or start today’s';
  const btn = S.root.querySelector('[data-lib="today"]');
  btn.textContent = hasToday ? 'Today' : 'Start today';
  btn.classList.toggle('lib-start', !hasToday);
}

export function unmount() {
  if (!S) return;
  saveNow();
  cancelAnimationFrame(S.raf);
  S.listeners.forEach(off => off());
  S.ro?.disconnect();
  if (S.renderer) {
    S.scene.traverse(o => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m?.map?.dispose(); m?.dispose(); }); });
    S.renderer.dispose();
    S.renderer.forceContextLoss?.();
  }
  document.body.classList.remove('in-library', 'lib-reading');
  S = null;
}

/** Called by the router for #/library and #/library/<date>. */
export function route(date) {
  if (!S) return;
  if (!isDate(date) || date > todayISO()) { if (S.open) closeBook(); return; }
  if (S.open?.date === date) return;
  if (S.open) { saveNow(); closeBook(true).then(() => openBook(date)); }
  else openBook(date);
}

function shelvesChanged() {
  const want = writtenDates().join();
  const have = S.flat ? S.flatDates : [...S.books.keys()].filter(d => !S.books.get(d).temp).sort().join();
  return want !== have;
}
function rebuild() {
  const root = S.root;
  const x = S.camTarget;
  mount(root, '');
  if (S && !S.flat && Number.isFinite(x)) { S.camTarget = S.camX = clampX(x); }
}

/** The library changed (a save here, or a sync from another device). */
export function refresh() {
  if (!S) return;
  updateHud();
  if (!S.open && !S.busy && shelvesChanged()) { rebuild(); return; }
  if (!S.flat) for (const [date, b] of S.books) {
    const written = hasWriting(entry(date));
    if (written !== b.written) { b.written = written; paintSpine(b); }
  } else buildFlat();
  const o = S.open;
  if (o && !S.pendingSave) {
    const e = entry(o.date);
    for (const name of ['body', 'nextWorkout']) {
      const field = S.pages.querySelector(`[name="${name}"]`);
      if (field && document.activeElement !== field && field.value !== (e?.[name] || '')) field.value = e?.[name] || '';
    }
    drawPages();
  }
}

// ---------- textures ----------
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function woodTex(base, dark, w = 512, h = 128, rings = 26) {
  return canvasTex(w, h, (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const r = rand(base + dark);
    for (let i = 0; i < rings; i++) {
      g.strokeStyle = dark; g.globalAlpha = 0.08 + r() * 0.18; g.lineWidth = 1 + r() * 3;
      const y0 = r() * H, amp = 2 + r() * 6, f = 0.004 + r() * 0.01;
      g.beginPath();
      for (let x = 0; x <= W; x += 8) g.lineTo(x, y0 + Math.sin(x * f + i) * amp);
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function paintSpine(b) {
  const { ctx: g, canvas } = b.spineCanvas;
  const W = canvas.width, H = canvas.height;
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, shade(b.color, 0.6)); grad.addColorStop(0.3, shade(b.color, 1.15)); grad.addColorStop(0.7, b.color); grad.addColorStop(1, shade(b.color, 0.55));
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const gold = b.written ? '#e9c46a' : 'rgba(233, 196, 106, .42)';
  g.fillStyle = gold;
  for (const y of [H * 0.07, H * 0.11, H * 0.89, H * 0.93]) g.fillRect(0, y, W, H * 0.012);
  const { d, m } = parts(b.date);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${Math.round(W * 0.62)}px Georgia, 'Times New Roman', serif`;
  g.fillText(String(d), W / 2, H * 0.36);
  g.font = `600 ${Math.round(W * 0.26)}px Georgia, serif`;
  g.fillText(MONTHS[m].slice(0, 3).toUpperCase(), W / 2, H * 0.5);
  g.fillText(WEEKDAYS[weekday(b.date)].slice(0, 3), W / 2, H * 0.6);
  if (b.written) { g.beginPath(); g.arc(W / 2, H * 0.75, W * 0.13, 0, Math.PI * 2); g.fill(); }
  b.spineTex.needsUpdate = true;
}

// ---------- scene ----------
function buildScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  S.stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b120c');
  scene.fog = new THREE.Fog('#1b120c', 2.2, 5.5);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 20);
  Object.assign(S, { renderer, scene, camera, clock: new THREE.Clock(), camX: 0, camTarget: 0, vel: 0 });
  S.exit = exitDoor(); scene.add(S.exit.group);

  // Light: a warm lamp that travels with you, a flickering hearth glow, and soft fill.
  scene.add(new THREE.HemisphereLight('#ffd9a8', '#2a1a10', 0.8));
  const lamp = new THREE.SpotLight('#ffcf8a', 8, 4.5, Math.PI / 3.3, 0.7, 1.3);
  lamp.position.set(0, 2.2, 1.3);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(512, 512);
  lamp.shadow.bias = -0.0015;
  scene.add(lamp, lamp.target);
  const hearth = new THREE.PointLight('#ff8a3d', 1.6, 3.2, 1.6);
  hearth.position.set(-0.7, FLOOR_Y + 0.25, 1.1);
  scene.add(hearth);
  const fill = new THREE.PointLight('#ffb070', 1.1, 3, 1.5);
  fill.position.set(0, FLOOR_Y + 0.5, 1.4);
  scene.add(fill);
  Object.assign(S, { lamp, hearth, fill });

  const list = months();
  const span = list.length * BAY_STEP;
  const x0 = -(span - BAY_STEP) / 2;
  S.bayX = i => x0 + i * BAY_STEP;

  // Room: paneled wall, floorboards, rug.
  const wallTex = woodTex('#3a2416', '#1d1009', 256, 256, 40);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.repeat.set(span * 2 + 6, 3);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(span + 12, 4), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }));
  wall.position.set(0, 1, -DEPTH / 2 - 0.03);
  wall.receiveShadow = true;
  const floorTex = woodTex('#5a3a22', '#2c1a0d', 512, 128, 30);
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(4, span * 2 + 8);
  floorTex.rotation = Math.PI / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(span + 12, 6), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, 2);
  floor.receiveShadow = true;
  const rugTex = canvasTex(256, 128, (g, W, H) => {
    g.fillStyle = '#6e2a22'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d8a657'; g.lineWidth = 5; g.strokeRect(10, 10, W - 20, H - 20);
    g.strokeStyle = '#2f3f2a'; g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44);
    g.fillStyle = '#d8a657';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(48 + i * 32, H / 2, 7, 0, Math.PI * 2); g.fill(); }
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(span + 1, 1.4), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, FLOOR_Y + 0.002, 0.95);
  rug.receiveShadow = true;
  scene.add(wall, floor, rug);

  // Bookcase: one bay per month, with a brass plaque on top.
  const caseTex = woodTex('#6b4226', '#2e1a0c');
  const caseMat = new THREE.MeshStandardMaterial({ map: caseTex, roughness: 0.65, color: '#c79a6e' });
  const backMat = new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 1 });
  const totalH = shelfY(0) + 0.44 - FLOOR_Y;
  const add = (geo, mat, x, y, z, shadows = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadows; m.receiveShadow = true; scene.add(m); return m; };
  const pageMat = new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.95 });
  list.forEach((month, i) => {
    const cx = S.bayX(i);
    add(new THREE.BoxGeometry(BAY_W, totalH, 0.01), backMat, cx, FLOOR_Y + totalH / 2, -DEPTH / 2, false);
    for (let s = 0; s < SHELVES; s++) add(new THREE.BoxGeometry(BAY_W, SHELF_T, DEPTH), caseMat, cx, shelfY(s) - SHELF_T / 2, 0);
    add(new THREE.BoxGeometry(BAY_W + BAY_GAP, 0.08, DEPTH + 0.04), caseMat, cx, FLOOR_Y + 0.04, 0.01); // plinth
    add(new THREE.BoxGeometry(BAY_W + BAY_GAP, 0.05, DEPTH + 0.06), caseMat, cx, FLOOR_Y + totalH, 0.02); // crown
    const plaque = canvasTex(256, 64, (g, W, H) => {
      const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#e6c27a'); grad.addColorStop(1, '#9c7334');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#6b4a1f'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
      g.fillStyle = '#3a2610'; g.font = '600 30px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${MONTHS[month.m]} ${month.y}`, W / 2, H / 2 + 2);
    });
    add(new THREE.BoxGeometry(0.3, 0.075, 0.008), [caseMat, caseMat, caseMat, caseMat, new THREE.MeshStandardMaterial({ map: plaque, metalness: 0.6, roughness: 0.35 }), caseMat], cx, shelfY(0) + 0.37, DEPTH / 2 + 0.004, false);
    S.bays.push({ ...month, x: cx });
  });
  for (let i = 0; i <= list.length; i++) add(new THREE.BoxGeometry(BAY_GAP, totalH, DEPTH + 0.02), caseMat, x0 - BAY_STEP / 2 + i * BAY_STEP, FLOOR_Y + totalH / 2, 0);

  // Books.
  const today = todayISO();
  S.makeBook = (date, month, index) => {
    const r = rand(date);
    const { d } = parts(date);
    const s = Math.min(SHELVES - 1, Math.floor(index / PER_SHELF)), slot = index % PER_SHELF;
    const H = 0.2 + r() * 0.07, W = 0.15 + r() * 0.02, T = 0.04 + r() * 0.018;
    const color = BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)];
    const c = document.createElement('canvas'); c.width = 64; c.height = 384;
    const b = { date, color, H, W, T, written: hasWriting(entry(date)), spineCanvas: { canvas: c, ctx: c.getContext('2d') } };
    b.spineTex = new THREE.CanvasTexture(c); b.spineTex.colorSpace = THREE.SRGBColorSpace; b.spineTex.anisotropy = 4;
    paintSpine(b);
    const coverMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const spineMat = new THREE.MeshStandardMaterial({ map: b.spineTex, roughness: 0.6, emissive: new THREE.Color('#e9a84a'), emissiveIntensity: 0 });
    b.glowMats = [spineMat];
    const firstPage = canvasTex(256, 340, (g, Wc, Hc) => {
      g.fillStyle = '#f3e9cf'; g.fillRect(0, 0, Wc, Hc);
      g.strokeStyle = 'rgba(90, 120, 160, .35)'; g.lineWidth = 1.5;
      for (let y = 70; y < Hc - 16; y += 18) { g.beginPath(); g.moveTo(16, y); g.lineTo(Wc - 16, y); g.stroke(); }
      g.fillStyle = '#4a3020'; g.font = 'italic 22px Georgia, serif'; g.textAlign = 'center';
      g.fillText(longDate(date).replace(/, \d{4}$/, ''), Wc / 2, 44);
    });
    // Body: [+x pages edge, -x spine, +y top, -y bottom, +z first page, -z back cover]
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), [pageMat, spineMat, pageMat, pageMat, new THREE.MeshStandardMaterial({ map: firstPage, roughness: 0.95 }), coverMat]);
    body.castShadow = true; body.receiveShadow = true;
    const coverTex = canvasTex(256, 340, (g, Wc, Hc) => {
      g.fillStyle = color; g.fillRect(0, 0, Wc, Hc);
      g.strokeStyle = '#e9c46a'; g.lineWidth = 4; g.strokeRect(18, 18, Wc - 36, Hc - 36);
      g.fillStyle = '#e9c46a'; g.textAlign = 'center';
      g.font = '600 64px Georgia, serif'; g.fillText(String(d), Wc / 2, Hc / 2 - 6);
      g.font = '600 24px Georgia, serif'; g.fillText(`${MONTHS[parts(date).m]} ${parts(date).y}`.toUpperCase(), Wc / 2, Hc / 2 + 38);
    });
    const insideMat = new THREE.MeshStandardMaterial({ color: '#d9c49a', roughness: 0.9 });
    const cover = new THREE.Mesh(new THREE.BoxGeometry(W + 0.006, H + 0.008, 0.005), [coverMat, coverMat, coverMat, coverMat, new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.6 }), insideMat]);
    cover.position.x = W / 2; cover.castShadow = true;
    const hinge = new THREE.Group();
    hinge.position.set(-W / 2, 0, T / 2 + 0.0025);
    hinge.add(cover);
    const group = new THREE.Group();
    group.add(body, hinge);
    if (date === today) {
      const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.05), new THREE.MeshStandardMaterial({ color: '#b3262a', side: THREE.DoubleSide }));
      ribbon.position.set(-W / 2 + 0.05, H / 2 + 0.02, 0); // bookmark peeking out of the top
      ribbon.rotation.y = Math.PI / 2;
      group.add(ribbon);
      b.ribbon = ribbon;
    }
    const lean = slot === PER_SHELF - 1 && r() < 0.3 ? 0.06 : 0;
    const slotW = (BAY_W - 0.04) / PER_SHELF;
    group.position.set(month.x - BAY_W / 2 + 0.02 + slotW * (slot + 0.5), shelfY(s) + H / 2, (DEPTH / 2) - W / 2 - 0.01 - r() * 0.012);
    group.rotation.set(0, Math.PI / 2, lean);
    group.userData.date = date;
    body.userData.date = date;
    scene.add(group);
    Object.assign(b, { group, hinge, home: { pos: group.position.clone(), rot: group.rotation.clone() } });
    S.books.set(date, b);
    return b;
  };
  S.bays.forEach(month => month.days.forEach((date, i) => S.makeBook(date, month, i)));
  if (!S.books.has(today)) addGhost();
  addDecor(add, caseMat, list.length, totalH);

  // Dust drifting through the lamplight.
  const N = 160, pos = new Float32Array(N * 3), rd = rand('dust');
  for (let i = 0; i < N; i++) { pos[i * 3] = (rd() - 0.5) * (span + 2); pos[i * 3 + 1] = FLOOR_Y + rd() * 2; pos[i * 3 + 2] = rd() * 1.4; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dot = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,230,180,1)'); gr.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  S.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.012, map: dot, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(S.dust);

  S.pickables = [...S.books.values()].map(b => b.group.children[0]);
  if (S.tag) S.pickables.push(S.tag);
  S.month = monthOf;
  makePages();
  S.minX = S.bayX(0); S.maxX = S.bayX(S.bays.length - 1);
  S.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  resize();
  S.ro = new ResizeObserver(resize); S.ro.observe(S.stage);
  bindPointer();
  S.on(document, 'visibilitychange', () => { if (!document.hidden) loop(); });
  loop();
}

// Today's book, waiting on the shelf with a soft glow and a paper tag until you write in it.
function addGhost() {
  const today = todayISO();
  const bay = S.bays[S.bays.length - 1];
  const b = S.makeBook(today, bay, bay.days.length);
  b.temp = true;
  S.ghost = b;
  const tex = canvasTex(320, 160, (g, W, H) => {
    g.fillStyle = '#f3e6c4'; g.beginPath(); g.moveTo(24, 0); g.lineTo(W, 0); g.lineTo(W, H); g.lineTo(24, H); g.lineTo(0, H / 2); g.closePath(); g.fill();
    g.fillStyle = '#7a3b1e'; g.beginPath(); g.arc(22, H / 2, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a2610'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `600 52px ${HAND}`; g.fillText(writtenDates().length ? 'Today' : 'Start', W / 2 + 14, H * 0.36);
    g.font = `italic 36px Georgia, serif`; g.fillText('tap to write', W / 2 + 14, H * 0.7);
  });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.075), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, side: THREE.DoubleSide, emissive: new THREE.Color('#5a4630'), emissiveMap: tex }));
  const p = b.group.position;
  tag.position.set(p.x + 0.095, p.y + b.H * 0.22, p.z + b.W / 2 + 0.012);
  tag.userData.date = today;
  S.scene.add(tag);
  S.tag = tag;
}

// Little things that make the room feel lived in: a candle on top of the case and a plant on the floor.
function addDecor(add, caseMat, bays, totalH) {
  const top = shelfY(0);
  const x = S.bayX(bays - 1) + BAY_W / 2 - 0.08;
  const wax = new THREE.MeshStandardMaterial({ color: '#efe2c4', roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c79a4a', metalness: 0.7, roughness: 0.35 });
  add(new THREE.CylinderGeometry(0.04, 0.045, 0.012, 20), brass, x, top + 0.006, 0.02);
  add(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 16), wax, x, top + 0.057, 0.02);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a' }));
  flame.geometry.translate(0, 0.008, 0); flame.scale.y = 1.8;
  flame.position.set(x, top + 0.104, 0.02);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,120,.9)'); gr.addColorStop(1, 'rgba(255,160,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(0.14, 0.14, 1); glow.position.set(x, top + 0.115, 0.02);
  const light = new THREE.PointLight('#ffb35c', 0.9, 1.6, 1.6);
  light.position.set(x, top + 0.14, 0.12);
  S.scene.add(flame, glow, light);
  S.candle = { flame, light };
  // potted plant beside the case
  const px = S.bayX(0) - BAY_STEP / 2 - 0.16;
  const pot = new THREE.MeshStandardMaterial({ color: '#9a4f32', roughness: 0.8 });
  add(new THREE.CylinderGeometry(0.075, 0.06, 0.14, 20), pot, px, FLOOR_Y + 0.07, 0.1);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.7, side: THREE.DoubleSide });
  const r = rand('plant');
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.22), leafMat);
    leaf.geometry.translate(0, 0.11, 0);
    leaf.position.set(px, FLOOR_Y + 0.13, 0.1);
    leaf.rotation.set(0.25 + r() * 0.5, (i / 9) * Math.PI * 2, 0, 'YXZ');
    leaf.castShadow = true;
    S.scene.add(leaf);
  }
}

function monthOf(date) {
  const { y, m } = parts(date);
  return S.bays.findIndex(b => b.y === y && b.m === m);
}

function viewDistance() {
  // Fit about one bay (plus a bit of its neighbours) across a phone, more on wide screens.
  const { camera } = S;
  const want = Math.min(BAY_STEP * 1.18 * Math.max(1, camera.aspect / 0.75), BAY_STEP * 3.2);
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const byWidth = want / 2 / (Math.tan(halfFov) * camera.aspect);
  const byHeight = (shelfY(0) + 0.5 - FLOOR_Y + 0.5) / 2 / Math.tan(halfFov); // whole case plus room for the controls
  return Math.max(byWidth, Math.min(byHeight, byWidth * 1.6), 0.9);
}

function resize() {
  if (!S?.renderer) return;
  const w = S.stage.clientWidth || 1, h = S.stage.clientHeight || 1;
  S.renderer.setSize(w, h, false);
  S.camera.aspect = w / h;
  S.camera.updateProjectionMatrix();
  S.dist = viewDistance();
}

// ---------- input ----------
function bindPointer() {
  const el = S.renderer.domElement;
  let down = null;
  S.on(el, 'pointerdown', e => { if (S.open) { if (!S.busy) S.openTap = { x: e.clientX, y: e.clientY }; return; } if (S.busy) return; down = { x: e.clientX, y: e.clientY, cam: S.camTarget, t: performance.now(), lastX: e.clientX, lastT: performance.now(), moved: false }; el.setPointerCapture?.(e.pointerId); S.vel = 0; });
  S.on(el, 'pointermove', e => {
    if (!down) { hover(e); return; }
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - down.y) > 8) down.moved = true;
    const perPx = worldPerPixel();
    S.camTarget = clampX(down.cam - dx * perPx);
    const now = performance.now();
    S.vel = -(e.clientX - down.lastX) * perPx / Math.max(1, now - down.lastT) * 16;
    down.lastX = e.clientX; down.lastT = now;
  });
  const up = e => {
    { // the little door back to the living room
      const r = S.renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), S.camera);
      if (S.exit?.hit(ray)) { down = null; S.openTap = null; location.hash = '#/'; return; }
    }
    if (S.open && S.openTap) {
      const moved = Math.hypot(e.clientX - S.openTap.x, e.clientY - S.openTap.y) > 10;
      S.openTap = null;
      if (moved || S.busy) return;
      const side = pickPage(e);
      if (side) focusSide(side);
      else { document.activeElement?.blur?.(); S.open.side = null; markSide(null); settleBook(); }
      return;
    }
    if (!down) return;
    const tap = !down.moved;
    down = null;
    if (tap) { S.vel = 0; const b = pick(e); if (b) location.hash = `#/library/${b.date}`; }
    else snapToBay();
  };
  S.on(el, 'pointerup', up);
  // On phones a tap also fires a compatibility mousedown on the canvas, which would steal focus back
  // from the hidden textarea we just focused, so the keyboard never stayed up.
  S.on(el, 'mousedown', e => { if (S.open) e.preventDefault(); });
  S.on(el, 'pointercancel', () => { down = null; });
  S.on(el, 'wheel', e => { if (S.open) return; e.preventDefault(); S.camTarget = clampX(S.camTarget + (e.deltaX || e.deltaY) * worldPerPixel()); clearTimeout(S.wheelT); S.wheelT = setTimeout(snapToBay, 220); }, { passive: false });
  S.on(window, 'keydown', e => {
    if (e.key === 'Escape' && S.open) location.hash = '#/library';
    if (!S.open && !e.target.closest?.('input, textarea, select')) {
      if (e.key === 'ArrowLeft') focusMonth(currentBay() - 1);
      if (e.key === 'ArrowRight') focusMonth(currentBay() + 1);
    }
  });
}
const worldPerPixel = () => (2 * Math.tan(THREE.MathUtils.degToRad(S.camera.fov / 2)) * S.dist) / (S.stage.clientHeight || 1);
const clampX = x => Math.max(S.minX - 0.15, Math.min(S.maxX + 0.15, x));
const currentBay = () => Math.max(0, Math.min(S.bays.length - 1, Math.round((S.camTarget - S.minX) / BAY_STEP)));
function snapToBay() {
  if (S.flat) return;
  const ahead = S.camTarget + S.vel * 6;
  focusMonth(Math.max(0, Math.min(S.bays.length - 1, Math.round((ahead - S.minX) / BAY_STEP))));
}
function focusMonth(i, instant = false) {
  if (!S) return;
  i = Math.max(0, Math.min(S.bays.length - 1, i));
  S.vel = 0;
  const bay = S.bays[i];
  if (!bay) return;
  if (!S.flat) { S.camTarget = bay.x; if (instant) S.camX = bay.x; }
  else S.root.querySelector(`[data-month="${i}"]`)?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth', block: 'start' });
  S.root.querySelector('.lib-month').textContent = `${MONTHS[bay.m]} ${bay.y}`;
  S.root.querySelector('[data-lib="prev-month"]').disabled = i === 0;
  S.root.querySelector('[data-lib="next-month"]').disabled = i === S.bays.length - 1;
  S.bayIndex = i;
}

const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
function pick(e) {
  const r = S.renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, S.camera);
  const hit = ray.intersectObjects(S.pickables, false)[0];
  return hit ? S.books.get(hit.object.userData.date) || null : null;
}
function hover(e) {
  if (S.open || S.busy || e.pointerType !== 'mouse') return;
  const b = pick(e);
  if (S.hovered && S.hovered !== b) S.hovered.peek = 0;
  S.hovered = b;
  if (b) b.peek = 1;
  S.renderer.domElement.style.cursor = b ? 'pointer' : 'grab';
}

function onHudClick(e) {
  const el = e.target.closest('[data-lib]');
  if (!el) return;
  const a = el.dataset.lib;
  if (a === 'prev-month') focusMonth((S.bayIndex ?? 0) - 1);
  if (a === 'next-month') focusMonth((S.bayIndex ?? 0) + 1);
  if (a === 'today') location.hash = `#/library/${todayISO()}`;
  if (a === 'close') location.hash = '#/library';
  if (a === 'day' && el.dataset.date) location.hash = `#/library/${el.dataset.date}`;
  if (a === 'side') focusSide(el.dataset.side);
}

// ---------- animation ----------
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
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

// ---------- writing straight onto the 3D pages ----------
// Shared with the Kitchen's cookbooks (src/kitchen.js).
// Each open page is a curved mesh with a canvas texture. Typing goes into a hidden
// textarea (so phone keyboards, autocorrect and dictation all work) and is painted onto
// the page as you type, so the letters bend with the paper.
export const PAGE_W = 768, PAGE_H = 1024;
export const INK = '#2e1e10', FADED = 'rgba(74, 48, 32, .45)', RULE = 'rgba(90, 120, 160, .32)', LABEL = '#8a5a2e';
export const HAND = '"Kiwi Maru", Georgia, serif';

export function curvedPage(gutterAtLeft) {
  // A 1×1 sheet that rises out of the gutter and settles toward the outer edge.
  const geo = new THREE.PlaneGeometry(1, 1, 40, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = gutterAtLeft ? p.getX(i) + 0.5 : 0.5 - p.getX(i);
    p.setZ(i, Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.04)), 0.55) * (1 - u * 0.35));
  }
  geo.computeVertexNormals();
  return geo;
}

function makePages() {
  const mk = gutterAtLeft => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W; canvas.height = PAGE_H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = S.renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(curvedPage(gutterAtLeft), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color('#9a8a70'), roughness: 0.92, side: THREE.DoubleSide }));
    mesh.visible = false;
    mesh.receiveShadow = true;
    return { canvas, ctx: canvas.getContext('2d'), tex, mesh };
  };
  S.leftPage = mk(false);
  S.rightPage = mk(true);
  S.leftPage.mesh.userData.side = 'body';
  S.rightPage.mesh.userData.side = 'nextWorkout';
}

function attachPages(b) {
  const sx = b.W * 0.965, sy = b.H * 0.955, bulge = 0.009;
  const R = S.rightPage.mesh, L = S.leftPage.mesh;
  R.scale.set(sx, sy, bulge); R.position.set(0.002, 0, b.T / 2 + 0.0012); R.rotation.set(0, 0, 0);
  L.scale.set(sx, sy, bulge); L.position.set(b.W / 2 + 0.002, 0, -0.0034); L.rotation.set(0, Math.PI, 0);
  b.group.add(R); b.hinge.add(L);
  R.visible = L.visible = true;
}
function detachPages() {
  for (const p of [S.leftPage, S.rightPage]) { p.mesh.visible = false; p.mesh.parent?.remove(p.mesh); }
}

// Lay text out in lines that fit the page, remembering where each line starts so the caret can be placed.
export function layout(g, text, maxW) {
  const lines = [];
  let index = 0;
  for (const para of text.split('\n')) {
    let line = '', lineStart = index;
    const words = para.split(/(\s+)/);
    for (const w of words) {
      if (!w) continue;
      if (g.measureText(line + w).width <= maxW || !line) {
        if (!line && g.measureText(w).width > maxW) {
          for (const ch of w) { if (g.measureText(line + ch).width > maxW && line) { lines.push({ text: line, start: lineStart }); lineStart += line.length; line = ''; } line += ch; }
        } else line += w;
      } else { lines.push({ text: line, start: lineStart }); lineStart += line.length; line = /^\s+$/.test(w) ? '' : w; if (!line) lineStart += w.length; }
    }
    lines.push({ text: line, start: lineStart });
    index += para.length + 1;
  }
  return lines;
}

const paperCache = new Map();
export function paper(g, gutterLeft) {
  const key = String(Boolean(gutterLeft));
  let c = paperCache.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = PAGE_W; c.height = PAGE_H;
    paintPaper(c.getContext('2d'), gutterLeft);
    paperCache.set(key, c);
  }
  g.drawImage(c, 0, 0);
}
function paintPaper(g, gutterLeft) {
  const grad = g.createLinearGradient(0, 0, PAGE_W, 0);
  const a = '#e6d5ae', b = '#f6ecd4';
  if (gutterLeft) { grad.addColorStop(0, a); grad.addColorStop(0.12, b); grad.addColorStop(1, '#f1e4c6'); }
  else { grad.addColorStop(0, '#f1e4c6'); grad.addColorStop(0.88, b); grad.addColorStop(1, a); }
  g.fillStyle = grad; g.fillRect(0, 0, PAGE_W, PAGE_H);
  // a little paper grain
  const r = rand('paper' + gutterLeft);
  g.fillStyle = 'rgba(120, 90, 50, .05)';
  for (let i = 0; i < 400; i++) g.fillRect(r() * PAGE_W, r() * PAGE_H, 2, 2);
}

// Draws text on ruled lines between y0 and y1 and returns where the caret is.
function writeBlock(g, { text, placeholder, x, y0, y1, w, focused, caretAt }) {
  const LH = 52;
  g.font = `32px ${HAND}`;
  g.strokeStyle = RULE; g.lineWidth = 2;
  for (let y = y0 + LH; y <= y1; y += LH) { g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + w, y + 8); g.stroke(); }
  if (!text && placeholder) {
    g.fillStyle = FADED; g.font = `italic 30px ${HAND}`;
    layout(g, placeholder, w).slice(0, 3).forEach((l, i) => g.fillText(l.text, x + 4, y0 + LH * (i + 1)));
    g.font = `32px ${HAND}`;
  }
  const lines = layout(g, text || '', w);
  const fit = Math.max(1, Math.floor((y1 - y0) / LH));
  let caretLine = lines.length - 1;
  if (caretAt !== undefined) for (let i = 0; i < lines.length; i++) if (lines[i].start <= caretAt) caretLine = i;
  const first = focused ? Math.max(0, Math.min(lines.length - fit, caretLine - fit + 1)) : 0;
  g.fillStyle = INK;
  lines.slice(first, first + fit).forEach((l, i) => g.fillText(l.text, x + 4, y0 + LH * (i + 1)));
  if (first > 0) { g.fillStyle = FADED; g.font = `italic 22px ${HAND}`; g.fillText('…', x + w - 20, y0 + 16); }
  if (!focused && lines.length > fit) { g.fillStyle = FADED; g.font = `italic 22px ${HAND}`; g.textAlign = 'right'; g.fillText(`… ${lines.length - fit} more line${lines.length - fit === 1 ? '' : 's'}, tap to read`, x + w, y1 + 26); g.textAlign = 'left'; }
  g.font = `32px ${HAND}`;
  if (focused && S.caretOn) {
    const l = lines[caretLine] || { text: '', start: 0 };
    g.font = `32px ${HAND}`;
    const cx = x + 4 + g.measureText(l.text.slice(0, Math.max(0, (caretAt ?? 0) - l.start))).width;
    const cy = y0 + LH * (caretLine - first + 1);
    g.fillStyle = '#7a3b1e'; g.fillRect(cx + 1, cy - 30, 3, 38);
  }
}

function drawPages() {
  if (!S || S.drawQueued) return;
  S.drawQueued = true;
  requestAnimationFrame(() => { if (!S) return; S.drawQueued = false; paintPages(); });
}
function paintPages() {
  if (!S?.open || !S.leftPage) return;
  const date = S.open.date;
  const body = S.pages.querySelector('[name="body"]'), next = S.pages.querySelector('[name="nextWorkout"]'), sel = S.pages.querySelector('[name="workoutId"]');
  if (!body) return;
  const focus = document.activeElement;
  const today = todayISO();
  // Left page: the day and its thoughts.
  {
    const g = S.leftPage.ctx;
    paper(g, false);
    g.textAlign = 'center';
    g.fillStyle = LABEL; g.font = 'italic 30px Georgia, serif';
    g.fillText(date === today ? 'Today' : date === shiftDay(today, -1) ? 'Yesterday' : WEEKDAYS[weekday(date)], PAGE_W / 2, 84);
    g.fillStyle = INK; g.font = '600 46px Georgia, serif';
    g.fillText(longDate(date).replace(/^\w+, /, ''), PAGE_W / 2, 140);
    g.strokeStyle = '#c9a46a'; g.lineWidth = 2; g.beginPath(); g.moveTo(PAGE_W / 2 - 90, 168); g.lineTo(PAGE_W / 2 + 90, 168); g.stroke();
    g.textAlign = 'left';
    g.fillStyle = LABEL; g.font = '600 24px system-ui, sans-serif'; g.fillText('THOUGHTS', 70, 222);
    writeBlock(g, { text: body.value, placeholder: 'Tap here and write what’s on your mind…', x: 66, y0: 236, y1: PAGE_H - 70, w: PAGE_W - 136, focused: focus === body, caretAt: body.selectionStart });
    S.leftPage.tex.needsUpdate = true;
  }
  // Right page: the plan for the next gym visit, and the saved workout it points to.
  {
    const g = S.rightPage.ctx;
    paper(g, true);
    g.textAlign = 'left';
    g.fillStyle = LABEL; g.font = '600 24px system-ui, sans-serif'; g.fillText('NEXT TIME AT THE GYM', 70, 96);
    const prev = !next.value ? lastPlan(date) : null;
    writeBlock(g, { text: next.value, placeholder: prev ? `Last plan (${longDate(prev.date).replace(/^\w+, /, '').replace(/, \d{4}$/, '')}): ${prev.nextWorkout.slice(0, 120)}` : 'Tap here and plan your next workout…', x: 66, y0: 110, y1: 690, w: PAGE_W - 136, focused: focus === next, caretAt: next.selectionStart });
    g.fillStyle = LABEL; g.font = '600 24px system-ui, sans-serif'; g.fillText('SAVED WORKOUT', 70, 770);
    const w = sel.value ? getItem(sel.value) : null;
    g.fillStyle = w ? INK : FADED; g.font = `${w ? '' : 'italic '}32px ${HAND}`;
    g.fillText(w ? w.title.slice(0, 34) : 'None picked (choose one below)', 74, 820);
    g.strokeStyle = RULE; g.beginPath(); g.moveTo(66, 836); g.lineTo(PAGE_W - 70, 836); g.stroke();
    g.fillStyle = FADED; g.font = 'italic 24px Georgia, serif';
    g.fillText(S.saveNote || 'Your writing saves on its own', 70, PAGE_H - 72);
    S.rightPage.tex.needsUpdate = true;
  }
}

function lastPlan(before) {
  return byType('journal').filter(e => e.date < before && e.nextWorkout).sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}

// ---------- reading pose: whole spread on wide screens, one page at a time on phones ----------
const narrow = () => S.camera.aspect < 0.9;
function readingPose(b, side = S.open?.side) {
  const cam = S.camera;
  const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const vv = window.visualViewport;
  const stageH = S.stage.clientHeight || 1;
  const visible = vv ? Math.min(1, Math.max(0.35, (vv.height - (S.stage.getBoundingClientRect().top - (vv.offsetTop || 0)) - 8) / stageH)) : 1;
  const toolsFrac = 64 / stageH; // keep the page clear of the little toolbar
  const spread = !narrow() || !side;
  const wantW = spread ? b.W * 2 + 0.03 : b.W * 1.04;
  const usableH = Math.max(0.3, visible - (visible < 0.98 ? 0 : toolsFrac));
  const d = Math.max(wantW / 0.94 / 2 / (tanH * cam.aspect), (b.H + 0.02) / (0.92 * usableH) / 2 / tanH);
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const pos = cam.position.clone().addScaledVector(dir, d);
  pos.x += spread ? b.W / 2 : side === 'body' ? b.W : 0;
  const frustumH = 2 * d * tanH;
  pos.y += frustumH * (1 - usableH) / 2; // lift the page into the part of the screen you can see
  return { pos, rot: new THREE.Euler(cam.rotation.x, 0, 0) };
}

function settleBook() {
  const b = S?.open?.book;
  if (!b || S.busy) return;
  const from = b.group.position.clone(), to = readingPose(b).pos;
  if (from.distanceTo(to) < 0.0005) return;
  S.settleId = (S.settleId || 0) + 1;
  const id = S.settleId;
  tween(380, t => { if (S.settleId === id && S.open?.book === b) b.group.position.lerpVectors(from, to, t); });
}

async function openBook(date) {
  if (!S) return;
  S.open = { date, side: null };
  document.body.classList.add('lib-reading');
  if (S.flat) { showFlatPages(date); return; }
  let b = S.books.get(date);
  if (!b && date === todayISO()) {
    const bay = S.bays[S.bays.length - 1];
    b = S.makeBook(date, bay, bay.days.length);
    b.temp = true;
    S.pickables.push(b.group.children[0]);
  }
  for (const m of b.glowMats || []) m.emissiveIntensity = 0;
  if (!b) { showFlatPages(date); return; }
  S.busy = true;
  const bayI = Math.max(0, monthOf(date));
  if (bayI !== S.bayIndex || Math.abs(S.camX - S.bays[bayI].x) > 0.01) { focusMonth(bayI); await tween(450, () => {}); }
  S.open.book = b;
  b.peek = 0;
  if (b.ribbon) b.ribbon.visible = false;
  if (S.tag) S.tag.visible = false;
  showInk(date);
  attachPages(b);
  drawPages();
  const from = b.group.position.clone(), fromRot = b.group.rotation.clone();
  const out = from.clone(); out.z += 0.2;
  await tween(420, t => { b.group.position.lerpVectors(from, out, t); b.group.rotation.z = fromRot.z * (1 - t); });
  const pose = readingPose(b, null);
  await tween(650, t => {
    b.group.position.lerpVectors(out, pose.pos, t);
    b.group.position.y += Math.sin(t * Math.PI) * 0.06;
    b.group.rotation.set(pose.rot.x * t, Math.PI / 2 * (1 - t), 0);
  });
  S.root.querySelector('.lib-dim').classList.add('on');
  await tween(650, t => { b.hinge.rotation.y = -Math.PI * 0.985 * t; });
  if (S.open?.date !== date) return;
  S.busy = false;
  S.pages.classList.add('on');
  if (matchMedia('(hover: hover)').matches && !narrow()) focusSide('body');
}

async function closeBook(fast = false) {
  if (!S?.open) return;
  const { book: b } = S.open;
  S.open = null;
  hideInk();
  document.body.classList.remove('lib-reading');
  S.root.querySelector('.lib-dim').classList.remove('on');
  if (!b || S.flat) { if (shelvesChanged()) rebuild(); return; }
  S.busy = true;
  const k = fast ? 0.5 : 1;
  const startHinge = b.hinge.rotation.y;
  await tween(450 * k, t => { b.hinge.rotation.y = startHinge * (1 - t); });
  if (S) detachPages();
  const from = b.group.position.clone(), fromRot = b.group.rotation.clone();
  const out = b.home.pos.clone(); out.z += 0.2;
  await tween(600 * k, t => {
    b.group.position.lerpVectors(from, out, t);
    b.group.rotation.set(fromRot.x * (1 - t), fromRot.y + (Math.PI / 2 - fromRot.y) * t, 0);
  });
  await tween(380 * k, t => { b.group.position.lerpVectors(out, b.home.pos, t); b.group.rotation.z = b.home.rot.z * t; });
  if (!S) return;
  S.busy = false;
  if (b.ribbon) b.ribbon.visible = true;
  if (b.temp && !hasWriting(entry(b.date))) { if (S.tag) S.tag.visible = true; }
  else if (b.temp) { b.temp = false; S.ghost = null; if (S.tag) { S.scene.remove(S.tag); S.pickables = S.pickables.filter(m => m !== S.tag); S.tag = null; } S.bays[monthOf(b.date)]?.days.push(b.date); }
  if (shelvesChanged()) rebuild();
}

function loop() {
  if (!S?.renderer || document.hidden) return;
  cancelAnimationFrame(S.raf);
  S.raf = requestAnimationFrame(loop);
  // When nothing is moving, only the dust and firelight drift: draw every third frame to save battery.
  const idle = !S.open && !S.busy && !S.hovered && Math.abs(S.vel) < 0.0001 && Math.abs(S.camTarget - S.camX) < 0.0005;
  S.frame = (S.frame || 0) + 1;
  if (idle && S.frame % 3) return;
  const t = S.clock.getElapsedTime();
  if (S.ghost && !S.open) for (const m of S.ghost.glowMats) m.emissiveIntensity = 0.25 + 0.2 * Math.sin(t * 2.4);
  if (S.tag) S.tag.rotation.z = Math.sin(t * 1.3) * 0.05;
  if (S.candle) { const f = 0.85 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 15.7) * 0.05; S.candle.light.intensity = 0.9 * f; S.candle.flame.scale.set(1, f, 1); }
  if (!S.open && !S.busy && Math.abs(S.vel) > 0.0001) { S.camTarget = clampX(S.camTarget + S.vel); S.vel *= 0.9; }
  S.camX += (S.camTarget - S.camX) * (S.reduced ? 1 : 0.14);
  const cam = S.camera;
  const midY = (shelfY(0) + 0.44 + FLOOR_Y) / 2 - 0.02;
  if (!S.open || !S.open.book) {
    cam.position.set(S.camX, midY + 0.12, DEPTH / 2 + S.dist);
    cam.lookAt(S.camX, midY, 0);
  }
  S.lamp.position.x = S.camX + 0.25; S.lamp.target.position.set(S.camX, midY - 0.1, 0);
  S.hearth.position.x = S.camX - 0.8;
  S.fill.position.x = S.camX;
  S.hearth.intensity = 1.4 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 13.1) * 0.1 + Math.sin(t * 2.1) * 0.12;
  for (const b of S.books.values()) {
    if (S.open?.book === b) continue;
    const want = b.home.pos.z + (b.peek ? 0.035 : 0);
    if (Math.abs(b.group.position.z - want) > 0.0005 && !S.busy) b.group.position.z += (want - b.group.position.z) * 0.2;
  }
  const p = S.dust.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i) + 0.0006;
    if (y > FLOOR_Y + 2) y = FLOOR_Y;
    p.setY(i, y);
    p.setX(i, p.getX(i) + Math.sin(t * 0.5 + i) * 0.0003);
  }
  p.needsUpdate = true;
  S.exit?.place(cam);
  S.renderer.render(S.scene, cam);
}

// ---------- the hidden inputs and the little toolbar under the book ----------
function navStops(date) {
  const today = todayISO();
  const stops = [...new Set([...writtenDates(), today])].sort();
  return { before: stops.filter(d => d < date).pop() || '', after: stops.find(d => d > date) || '' };
}

function showInk(date) {
  const e = entry(date) || {};
  const workouts = byType('workout').sort((a, b) => a.title.localeCompare(b.title));
  const { before, after } = navStops(date);
  S.saveNote = '';
  S.pages.className = 'lib-pages lib-ink';
  S.pages.innerHTML = `
    <textarea class="lib-hidden-input" name="body" aria-label="Thoughts for ${escape(longDate(date))}" autocapitalize="sentences">${escape(e.body || '')}</textarea>
    <textarea class="lib-hidden-input" name="nextWorkout" aria-label="Next time at the gym" autocapitalize="sentences">${escape(e.nextWorkout || '')}</textarea>
    <div class="lib-tools" role="toolbar" aria-label="${escape(longDate(date))}">
      <button class="lib-chip" data-lib="day" data-date="${before}" aria-label="Earlier entry" ${before ? '' : 'disabled'}>${icon('back')}</button>
      <button class="lib-chip lib-side" data-lib="side" data-side="body" aria-label="Thoughts">${icon('edit')}<span>Thoughts</span></button>
      <button class="lib-chip lib-side" data-lib="side" data-side="nextWorkout" aria-label="Next time at the gym">${icon('dumbbell')}<span>Gym</span></button>
      <label class="lib-chip lib-pick">${icon('list')}<span class="sr-only">Saved workout</span><select name="workoutId">
        <option value="">Workout</option>
        ${workouts.map(w => `<option value="${escape(w.id)}" ${w.id === e.workoutId ? 'selected' : ''}>${escape(w.title)}</option>`).join('')}
      </select></label>
      <a class="lib-chip lib-go" href="${e.workoutId ? `#/item/${encodeURIComponent(e.workoutId)}` : '#/workouts'}" data-lib-link aria-label="Open saved workout">${icon('next')}</a>
      <button class="lib-chip lib-shelf" data-lib="close">${icon('close')}<span>Shelf</span></button>
      <button class="lib-chip lib-flip" data-lib="day" data-date="${after}" aria-label="Later entry" ${after ? '' : 'disabled'}>${icon('back')}</button>
    </div>`;
  S.pages.hidden = false;
  const redraw = () => drawPages();
  for (const ta of S.pages.querySelectorAll('textarea')) {
    ta.addEventListener('focus', () => { S.caretOn = true; markSide(ta.name); redraw(); });
    ta.addEventListener('blur', () => { setTimeout(() => { if (S && !S.pages.contains(document.activeElement)) markSide(null); redraw(); }, 0); });
    ta.addEventListener('keyup', redraw);
    ta.addEventListener('select', redraw);
  }
  S.on(document, 'selectionchange', () => { if (S?.pages.contains(document.activeElement)) drawPages(); });
  clearInterval(S.blink);
  S.blink = setInterval(() => { if (!S?.open) return; S.caretOn = !S.caretOn; if (S.pages.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') drawPages(); }, 530);
  if (window.visualViewport && !S.vvBound) {
    S.vvBound = true;
    S.on(window.visualViewport, 'resize', () => { if (S?.open?.book) settleBook(); });
  }
}

function markSide(side) {
  S.pages.querySelectorAll('.lib-side').forEach(b => b.classList.toggle('on', b.dataset.side === side));
}

function focusSide(side) {
  if (!S?.open) return;
  const ta = S.pages.querySelector(`[name="${side}"]`);
  if (!ta) return;
  S.open.side = side;
  ta.focus({ preventScroll: true });
  const end = ta.value.length;
  try { ta.setSelectionRange(end, end); } catch { /* ignore */ }
  markSide(side);
  settleBook();
  drawPages();
}

function hideInk() {
  saveNow();
  clearInterval(S.blink);
  document.activeElement?.blur?.();
  S.pages.classList.remove('on');
  S.pages.hidden = true;
  S.pages.innerHTML = '';
}

function pickPage(e) {
  const r = S.renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, S.camera);
  const hit = ray.intersectObjects([S.leftPage.mesh, S.rightPage.mesh], false)[0];
  return hit?.object.userData.side || null;
}

function onPageInput(e) {
  if (!S?.open || !e.target.name) return;
  if (e.target.name === 'workoutId') {
    const link = S.pages.querySelector('[data-lib-link]');
    link.href = e.target.value ? `#/item/${encodeURIComponent(e.target.value)}` : '#/workouts';
  }
  S.pendingSave = { date: S.open.date, body: S.pages.querySelector('[name="body"]').value, nextWorkout: S.pages.querySelector('[name="nextWorkout"]').value, workoutId: S.pages.querySelector('[name="workoutId"]').value };
  S.saveNote = 'Writing…';
  drawPages();
  clearTimeout(S.saveT);
  S.saveT = setTimeout(saveNow, e.type === 'change' ? 0 : 700);
}

async function saveNow() {
  if (!S?.pendingSave) return;
  clearTimeout(S.saveT);
  const { date, body, nextWorkout, workoutId } = S.pendingSave;
  S.pendingSave = null;
  const existing = entry(date);
  try {
    if (!body.trim() && !nextWorkout.trim() && !workoutId) { if (existing) await deleteItem(existing.id); }
    else await saveItem({ id: entryId(date), type: 'journal', title: longDate(date), date, body, nextWorkout, workoutId });
    if (S) { S.saveNote = 'Saved'; drawPages(); const n = S.pages.querySelector('.lib-saved'); if (n) n.textContent = 'Saved'; }
  } catch (error) { toast(error.message || 'Couldn’t save that page'); }
}

// ---------- no WebGL: plain pages ----------
function showFlatPages(date) {
  const e = entry(date) || {};
  const workouts = byType('workout').sort((a, b) => a.title.localeCompare(b.title));
  const { before, after } = navStops(date);
  S.pages.className = 'lib-pages';
  S.pages.innerHTML = `
    <div class="lib-book" role="dialog" aria-modal="true" aria-label="${escape(longDate(date))}">
      <div class="lib-page lib-left">
        <header class="lib-head">
          <button class="lib-chip" data-lib="day" data-date="${before}" aria-label="Earlier entry" ${before ? '' : 'disabled'}>${icon('back')}</button>
          <h2>${escape(longDate(date).replace(/^\w+, /, ''))}</h2>
          <button class="lib-chip lib-flip" data-lib="day" data-date="${after}" aria-label="Later entry" ${after ? '' : 'disabled'}>${icon('back')}</button>
        </header>
        <label class="lib-label" for="lib-body">Thoughts</label>
        <textarea id="lib-body" name="body" class="lib-lines" placeholder="What’s on your mind today?">${escape(e.body || '')}</textarea>
      </div>
      <div class="lib-page lib-right">
        <label class="lib-label" for="lib-next">${icon('dumbbell')}Next time at the gym</label>
        <textarea id="lib-next" name="nextWorkout" class="lib-lines lib-short">${escape(e.nextWorkout || '')}</textarea>
        <label class="lib-label" for="lib-workout">Saved workout</label>
        <div class="lib-row"><select id="lib-workout" name="workoutId"><option value="">None</option>${workouts.map(w => `<option value="${escape(w.id)}" ${w.id === e.workoutId ? 'selected' : ''}>${escape(w.title)}</option>`).join('')}</select>
        <a class="lib-chip lib-go" href="${e.workoutId ? `#/item/${encodeURIComponent(e.workoutId)}` : '#/workouts'}" data-lib-link>Open</a></div>
        <p class="lib-saved" aria-live="polite"></p>
        <button class="btn btn-soft lib-close" data-lib="close">${icon('close')}Back on the shelf</button>
      </div>
    </div>`;
  S.pages.hidden = false;
  requestAnimationFrame(() => S?.pages.classList.add('on'));
}

// ---------- no WebGL: a simple shelf of buttons ----------
function buildFlat() {
  S.bays = months();
  S.flatDates = writtenDates().join();
  S.stage.innerHTML = `<div class="lib-flat">${S.bays.map((m, i) => `<section data-month="${i}"><h2>${MONTHS[m.m]} ${m.y}</h2><div class="lib-flat-row">${m.days.length ? '' : '<p class="lib-flat-empty">No books yet.</p>'}${m.days.map(date => { const r = rand(date); return `<a class="lib-flat-book ${hasWriting(entry(date)) ? 'written' : ''}" style="--c:${BOOK_COLORS[Math.floor((r(), r(), r(), r()) * BOOK_COLORS.length)]}" href="#/library/${date}" aria-label="${escape(longDate(date))}">${parts(date).d}</a>`; }).join('')}</div></section>`).join('')}</div>`;
  S.stage.removeAttribute('aria-hidden');
}

// Test hook: where a given day's book sits on screen.
if (typeof window !== 'undefined' && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
  window.__bookPoint = (date = todayISO()) => {
    const b = S?.books.get(date); if (!b) return null;
    const v = b.group.position.clone().project(S.camera), r = S.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  };
}
