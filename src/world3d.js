// The house: a cozy living room (Home) with doors to the kitchen (Recipes), the gym
// (Workouts), the office (To-do and Notes) and the Library. Each room is a small three.js
// scene drawn on one shared canvas that sits fixed behind the page. The camera pans
// slowly on its own; drag to look around, tap a door (or its sign) to walk through.
// Signs are real links laid over the canvas, so everything still works by keyboard and
// screen reader, and the page keeps a plain list of doors in case WebGL is unavailable.
import * as THREE from '../vendor/three.module.min.js';
import { byType, getItem, isSaved, search, toggleSaved, syncState } from './store.js';
import { toggleTask, toggleStar, toggleStep, quickAdd } from './todo.js';
import { groupTasks, dueLabel, todayISO, parseQuickTask } from '../shared/tasks.js';
import { toast } from './ui.js';
import { editing } from './editor.js';
import { mode, startTimer, stopTimer, addTime, parseSeconds, markDone, lastDone, agoLabel } from './modes.js';
import { THEMES, chosenTheme, autoNight } from './theme.js';
import { startHome } from './settings.js';

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer = null, failed = false;
let room = null; // { key, scene, camera, spots, update, yawCenter, yawRange, eye }
let raf = 0, clock = null;
let host = null, signs = null, stage = null;
let yawUser = 0, yawVel = 0, flying = null, stageVisible = true;

const C = (v, f) => new THREE.Color(v || f);
const cssVar = (name, f) => C(getComputedStyle(document.documentElement).getPropertyValue(name).trim(), f);
const mat = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
const glow = color => new THREE.MeshBasicMaterial({ color });

function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'object' && color.isMaterial ? color : mat(color));
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}
function cyl(rt, rb, h, color, x, y, z, parent, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'object' && color.isMaterial ? color : mat(color));
  m.position.set(x, y, z);
  parent?.add(m);
  return m;
}

let dotTex = null;
function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,.5)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

function plankTexture(base, line, w = 256, h = 256, rows = 8, vertical = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.strokeStyle = line; g.lineWidth = 2;
  for (let i = 0; i <= rows; i++) {
    const p = (i / rows) * (vertical ? w : h);
    g.beginPath();
    if (vertical) { g.moveTo(p, 0); g.lineTo(p, h); } else { g.moveTo(0, p); g.lineTo(w, p); }
    g.stroke();
    for (let k = 0; k < 2; k++) {
      const q = ((i * 37 + k * 91) % 100) / 100 * (vertical ? h : w);
      g.beginPath();
      if (vertical) { g.moveTo(p, q); g.lineTo(p + w / rows, q); } else { g.moveTo(q, p); g.lineTo(q, p + h / rows); }
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function tileTexture(a, b, n = 8) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const s = 128 / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// A shell: floor, four walls, ceiling, with the camera standing in the middle.
function shell(scene, { w = 10, d = 10, h = 3.4, wall, floor, ceiling = 0xf7f0e2, trim = 0xffffff, floorMap }) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMap ? new THREE.MeshLambertMaterial({ map: floorMap }) : mat(floor));
  f.rotation.x = -Math.PI / 2; scene.add(f);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(ceiling));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h; scene.add(ceil);
  const wallMat = mat(wall, { side: THREE.DoubleSide });
  [[0, -d / 2, 0, w], [0, d / 2, Math.PI, w], [-w / 2, 0, Math.PI / 2, d], [w / 2, 0, -Math.PI / 2, d]].forEach(([x, z, ry, len]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), wallMat);
    m.position.set(x, h / 2, z); m.rotation.y = ry; scene.add(m);
    const base = box(len, 0.14, 0.04, trim, 0, 0.07, 0.02); // skirting board
    const g = new THREE.Group(); g.add(base); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  });
}

// Place something against a wall. side: 'back' (-z), 'front' (+z), 'left' (-x), 'right' (+x).
function onWall(obj, side, along, w, d) {
  const off = 0.02;
  if (side === 'back') { obj.position.set(along, obj.position.y, -d / 2 + off); obj.rotation.y = 0; }
  if (side === 'front') { obj.position.set(along, obj.position.y, d / 2 - off); obj.rotation.y = Math.PI; }
  if (side === 'left') { obj.position.set(-w / 2 + off, obj.position.y, along); obj.rotation.y = Math.PI / 2; }
  if (side === 'right') { obj.position.set(w / 2 - off, obj.position.y, along); obj.rotation.y = -Math.PI / 2; }
  return obj;
}

// A wooden plaque with the room's name painted on it, so doors are labelled in 3D.
function plaque(label, sub, w = 0.9, h = 0.34, { bg = '#f6e7c4', ink = '#4a3220', soft = '#8a6a4a', edge = '#c89a5a' } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const paint = () => {
    g.fillStyle = edge; g.fillRect(0, 0, W, H);
    g.fillStyle = bg; g.fillRect(8, 8, W - 16, H - 16);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = ink;
    g.font = `600 ${Math.round(H * (sub ? 0.42 : 0.55))}px "Kiwi Maru", Georgia, serif`;
    g.fillText(label, W / 2, sub ? H * 0.4 : H / 2);
    if (sub) { g.fillStyle = soft; g.font = `${Math.round(H * 0.26)}px "Zen Maru Gothic", system-ui, sans-serif`; g.fillText(sub, W / 2, H * 0.77); }
  };
  paint();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const wood = mat(0x7a4e33);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [wood, wood, wood, wood, new THREE.MeshBasicMaterial({ map: tex }), wood]);
  // repaint once the web fonts load, so a fallback font from the first frame doesn't stick
  document.fonts?.ready.then(() => { paint(); tex.needsUpdate = true; });
  return m;
}

function door({ color = 0x8a5a3a, frame = 0xf3ead8, sign = 0xf6e7c4, arch = false, double = false, glass = false, peek = null, label = '', sub = '' }) {
  const g = new THREE.Group();
  const W = double ? 1.7 : 1.05, H = 2.2;
  box(0.1, H + 0.1, 0.12, frame, -W / 2 - 0.05, H / 2, 0.04, g);
  box(0.1, H + 0.1, 0.12, frame, W / 2 + 0.05, H / 2, 0.04, g);
  box(W + 0.2, 0.12, 0.12, frame, 0, H + 0.06, 0.04, g);
  if (arch) {
    // open archway: show a glimpse of the next room
    const inside = box(W, H, 0.02, peek || 0xf2d9a8, 0, H / 2, 0.005, g);
    inside.material = glow(peek || 0xf2d9a8);
  } else if (double) {
    [-1, 1].forEach(s => {
      const leaf = box(W / 2 - 0.02, H, 0.06, color, s * W / 4, H / 2, 0.03, g);
      leaf.userData.door = true;
      box(W / 2 - 0.3, 0.7, 0.02, new THREE.Color(color).multiplyScalar(0.8), s * W / 4, H * 0.68, 0.065, g);
      box(W / 2 - 0.3, 0.7, 0.02, new THREE.Color(color).multiplyScalar(0.8), s * W / 4, H * 0.3, 0.065, g);
      cyl(0.03, 0.03, 0.18, 0xd8b45a, s * 0.08, H * 0.48, 0.09, g, 8);
    });
  } else {
    box(W, H, 0.06, color, 0, H / 2, 0.03, g);
    if (glass) { const p = box(0.6, 0.5, 0.02, glow(0xbfe3f2), 0, H * 0.72, 0.065, g); p.material.transparent = true; p.material.opacity = 0.85; }
    else box(W - 0.3, 0.75, 0.02, new THREE.Color(color).multiplyScalar(0.82), 0, H * 0.68, 0.065, g);
    box(W - 0.3, 0.75, 0.02, new THREE.Color(color).multiplyScalar(0.82), 0, H * 0.28, 0.065, g);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(0xd8b45a));
    knob.position.set(W / 2 - 0.15, H * 0.47, 0.1); g.add(knob);
  }
  if (label) { const pl = plaque(label, sub, 1.25, 0.46); pl.position.set(0, H + 0.4, 0.07); g.add(pl); }
  else box(0.62, 0.2, 0.03, sign, 0, H + 0.32, 0.06, g);
  return g;
}

function plant(x, z, parent, s = 1) {
  const g = new THREE.Group();
  cyl(0.2, 0.15, 0.32, 0xc96f4a, 0, 0.16, 0, g, 12);
  const leaf = mat(0x5e9447, { flatShading: true });
  [[0, 0.62, 0, 0.26], [0.16, 0.5, 0.06, 0.2], [-0.14, 0.54, -0.05, 0.2], [0.02, 0.82, 0.02, 0.16]].forEach(([a, b, c, r]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf); m.position.set(a, b, c); g.add(m);
  });
  g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
  return g;
}

function windowPane(sky, night, parent, w = 1.6, h = 1.3) {
  const g = new THREE.Group();
  const pane = box(w, h, 0.02, glow(sky), 0, 0, 0, g);
  if (night) {
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.12, 20), glow(0xfff4d0));
    moon.position.set(w * 0.25, h * 0.2, 0.02); g.add(moon);
  } else {
    const hill = new THREE.Mesh(new THREE.CircleGeometry(w * 0.7, 24, 0, Math.PI), glow(0x8fbf72));
    hill.position.set(0, -h / 2, 0.015); g.add(hill);
  }
  box(w + 0.12, 0.08, 0.1, 0xf6efe0, 0, h / 2, 0.04, g);
  box(w + 0.2, 0.08, 0.18, 0xf6efe0, 0, -h / 2, 0.06, g);
  box(0.08, h, 0.08, 0xf6efe0, -w / 2, 0, 0.04, g);
  box(0.08, h, 0.08, 0xf6efe0, w / 2, 0, 0.04, g);
  box(0.05, h, 0.05, 0xf6efe0, 0, 0, 0.04, g);
  box(w, 0.05, 0.05, 0xf6efe0, 0, 0, 0.04, g);
  // curtains
  box(0.3, h + 0.5, 0.05, 0xd98b6a, -w / 2 - 0.2, 0, 0.1, g);
  box(0.3, h + 0.5, 0.05, 0xd98b6a, w / 2 + 0.2, 0, 0.1, g);
  parent.add(g);
  return g;
}

function lights(scene, night, warm = 0xffe2b8) {
  scene.add(new THREE.HemisphereLight(night ? 0x6b74a8 : 0xfff6e8, night ? 0x2a1d18 : 0x8a6a50, night ? 0.9 : 1.6));
  const sun = new THREE.DirectionalLight(night ? 0x8090d0 : 0xfff0d0, night ? 0.4 : 1.4);
  sun.position.set(3, 6, 4); scene.add(sun);
  const lamp = new THREE.PointLight(warm, night ? 9 : 4, 9, 1.6);
  lamp.position.set(0, 2.9, 0); scene.add(lamp);
}

function smoke(scene, origin, n = 8, color = 0xffffff) {
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.phase = i / n; scene.add(s); puffs.push(s);
  }
  return t => puffs.forEach(p => {
    const k = (p.userData.phase + t * 0.16) % 1;
    p.position.set(origin.x + Math.sin(k * 6 + p.userData.phase * 9) * 0.1, origin.y + k * 1.1, origin.z);
    p.scale.setScalar(0.12 + k * 0.4);
    p.material.opacity = reduced ? 0.2 : Math.sin(k * Math.PI) * 0.4;
  });
}

// ---------- rooms ----------
function livingRoom(night) {
  const scene = new THREE.Scene();
  const W = 10, D = 10;
  shell(scene, { w: W, d: D, wall: night ? 0xc9b49a : 0xf1dfc0, floorMap: plankTexture('#a8714a', '#8a5a3a'), ceiling: 0xf5ead6 });
  scene.children[0].material.map.repeat.set(3, 3);
  lights(scene, night);
  const spots = [];

  // back wall: fireplace with a crackling fire, mantel, painting
  const fire = new THREE.Group();
  box(2.4, 1.3, 0.5, 0xc7b8a6, 0, 0.65, 0.25, fire);
  box(1.2, 0.8, 0.1, 0x2b1d17, 0, 0.5, 0.5, fire);
  box(2.7, 0.12, 0.65, 0x7a4e33, 0, 1.36, 0.3, fire);
  box(1.6, 2.0, 0.3, 0xc7b8a6, 0, 2.4, 0.15, fire);
  const flame = [];
  [[0, 0.32, 0.22, 0xffb347], [-0.2, 0.26, 0.16, 0xff7b3a], [0.2, 0.27, 0.15, 0xff8f3a], [0, 0.42, 0.12, 0xffe08a]].forEach(([x, y, r, c]) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, r * 3, 8), glow(c)); f.position.set(x, y + r, 0.42); fire.add(f); flame.push(f);
  });
  box(0.9, 0.12, 0.2, 0x5a3a26, 0, 0.18, 0.42, fire);
  const fireLight = new THREE.PointLight(0xff9a4a, night ? 6 : 3, 6, 1.5);
  fireLight.position.set(0, 0.6, 1.0); fire.add(fireLight);
  // mantel bits: candles + clock + photo
  cyl(0.05, 0.05, 0.24, 0xfff3dc, -1.0, 1.54, 0.35, fire, 10); cyl(0.05, 0.05, 0.16, 0xfff3dc, -0.85, 1.5, 0.35, fire, 10);
  box(0.36, 0.28, 0.04, 0x3a6a8a, 0.9, 1.56, 0.35, fire);
  const painting = box(1.1, 0.8, 0.05, 0x6aa6d8, 0, 2.5, 0.32, fire);
  painting.material = glow(night ? 0x2a3b6a : 0x9cc8e6);
  const ph = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20, 0, Math.PI), glow(0x6d9f55)); ph.position.set(0, 2.1, 0.35); fire.add(ph);
  box(1.22, 0.92, 0.03, 0xb88a4a, 0, 2.5, 0.3, fire);
  onWall(fire, 'back', 0, W, D); scene.add(fire);

  // rug, sofa, armchair, coffee table, floor lamp
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), mat(0xb9584a)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, -1.5); rug.scale.y = 0.7; scene.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.55, 40), mat(0xf0d39a)); rug2.rotation.x = -Math.PI / 2; rug2.position.set(0, 0.015, -1.5); rug2.scale.y = 0.7; scene.add(rug2);
  const sofa = new THREE.Group();
  box(2.6, 0.45, 0.95, 0x5f7f5a, 0, 0.32, 0, sofa); box(2.6, 0.75, 0.25, 0x5f7f5a, 0, 0.7, 0.38, sofa);
  box(0.25, 0.65, 0.95, 0x557352, -1.3, 0.45, 0, sofa); box(0.25, 0.65, 0.95, 0x557352, 1.3, 0.45, 0, sofa);
  box(0.5, 0.45, 0.15, 0xf0d39a, -0.7, 0.75, 0.2, sofa).rotation.z = 0.2; box(0.5, 0.45, 0.15, 0xd98b6a, 0.75, 0.75, 0.2, sofa).rotation.z = -0.15;
  box(0.9, 0.08, 0.7, 0xe9d8b8, 0.5, 0.58, -0.05, sofa).rotation.z = 0.1; // throw blanket
  sofa.position.set(-2.2, 0, -1.4); sofa.rotation.y = -Math.PI / 2; scene.add(sofa);
  const table = new THREE.Group();
  box(1.2, 0.08, 0.7, 0x8a5a3a, 0, 0.42, 0, table);
  [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]].forEach(([x, z]) => box(0.06, 0.4, 0.06, 0x6b4430, x, 0.2, z, table));
  const mug = cyl(0.07, 0.06, 0.13, 0xf6efe0, 0.48, 0.53, -0.2, table, 12);
  box(0.32, 0.05, 0.24, 0x3a6a8a, -0.42, 0.48, 0.18, table).rotation.y = 0.3; box(0.3, 0.04, 0.22, 0xc4513f, -0.41, 0.52, 0.19, table).rotation.y = 0.2;
  table.position.set(0, 0, -1.5); scene.add(table);
  const steam = smoke(scene, new THREE.Vector3(0.48, 0.62, -1.7), 5);
  const lamp = new THREE.Group();
  cyl(0.18, 0.2, 0.04, 0x3a3a3a, 0, 0.02, 0, lamp); cyl(0.02, 0.02, 1.6, 0x3a3a3a, 0, 0.8, 0, lamp);
  const shade = cyl(0.18, 0.3, 0.32, 0xf4e2b8, 0, 1.7, 0, lamp, 16);
  if (night) shade.material.emissive = new THREE.Color(0xffc870);
  const lampLight = new THREE.PointLight(0xffd08a, night ? 5 : 1.5, 5, 1.6); lampLight.position.set(0, 1.6, 0); lamp.add(lampLight);
  lamp.position.set(-1.9, 0, -3.6); scene.add(lamp);
  plant(1.9, -4.3, scene, 1.3);
  // a cat asleep on the rug
  const cat = new THREE.Group();
  const fur = mat(0xe39a52);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), fur); body.scale.set(1.3, 0.6, 1); body.position.y = 0.13; cat.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), fur); head.position.set(0.25, 0.14, 0.08); cat.add(head);
  [-0.05, 0.05].forEach(o => { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), fur); ear.position.set(0.27, 0.25, 0.08 + o); cat.add(ear); });
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16, Math.PI), fur); tail.rotation.x = Math.PI / 2; tail.position.set(-0.05, 0.04, 0.05); cat.add(tail);
  cat.position.set(1.0, 0, -2.4); cat.rotation.y = 0.6; scene.add(cat);

  // windows
  const win = windowPane(night ? 0x1d2a52 : 0xa9d4ef, night, scene); win.position.y = 1.7; onWall(win, 'right', -3.0, W, D);
  // bookshelf by the library door
  const shelf = new THREE.Group();
  box(1.2, 2.0, 0.35, 0x7a4e33, 0, 1.0, 0.17, shelf);
  const spines = [0xc4513f, 0x3a6a8a, 0xf0d39a, 0x5f7f5a, 0x8a5a9a, 0xd98b6a];
  [0.35, 0.95, 1.55].forEach((y, r) => { for (let i = 0; i < 8; i++) box(0.11, 0.38 - (i % 3) * 0.05, 0.25, spines[(i + r) % 6], -0.45 + i * 0.13, y + 0.2, 0.2, shelf); });
  onWall(shelf, 'left', -3.4, W, D); scene.add(shelf);
  // string lights along the back wall
  const bulbs = [];
  for (let i = 0; i < 18; i++) {
    const x = -4.6 + i * 0.54;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), glow(0xffd98a));
    b.position.set(x, 3.15 - Math.sin((i % 6) / 6 * Math.PI) * 0.18, -4.9); scene.add(b); bulbs.push(b);
  }

  // doors. Positions are chosen so the slow pan sweeps past all four.
  const doors = [
    { label: 'Kitchen', sub: 'Recipes', href: '#/recipes', side: 'left', along: -0.6, opts: { arch: true, peek: night ? 0xc89a5a : 0xf6dca8 } },
    { label: 'Library', sub: 'Journal', href: '#/library', side: 'left', along: 2.6, opts: { double: true, color: 0x6b3f2a } },
    { label: 'Gym', sub: 'Workouts', href: '#/workouts', side: 'right', along: 0.4, opts: { color: 0x3a6a8a, glass: true } },
    { label: 'Office', sub: 'To-do & Notes', href: '#/office', side: 'right', along: 3.0, opts: { color: 0x7b8f4a } },
  ];
  doors.forEach(d => {
    const g = door({ ...d.opts, label: d.label, sub: d.sub }); onWall(g, d.side, d.along, W, D); scene.add(g);
    const pos = g.localToWorld(new THREE.Vector3(0, 2.5, 0.1));
    g.updateMatrixWorld(); pos.copy(g.localToWorld(new THREE.Vector3(0, 2.52, 0.1)));
    spots.push({ ...d, pos, target: g.localToWorld(new THREE.Vector3(0, 1.2, 0.6)), mesh: g, plaque: true });
  });

  // a notepad on the coffee table (Add) and a light switch by the gym door (Settings)
  const pad = new THREE.Group();
  box(0.56, 0.72, 0.03, 0x7a4e33, 0, 0, -0.02, pad); box(0.56, 0.06, 0.05, 0xc4513f, 0, 0.36, 0, pad);
  const addPanel = makePanel(0.5, 0.64, 640, 820);
  pad.add(addPanel.mesh); addPanel.mesh.position.set(0, -0.01, 0.001);
  const stand = box(0.06, 0.4, 0.06, 0x6b4430, 0, -0.1, -0.2, pad); stand.rotation.x = 0.7;
  pad.position.set(0.05, 0.78, -1.62); pad.rotation.x = -0.55; scene.add(pad); pad.updateMatrixWorld(true);
  const padTag = plaque('+ Add', '', 0.4, 0.14); padTag.position.set(0, 0.45, 0.02); pad.add(padTag); pad.updateMatrixWorld(true);
  spots.push({ label: 'Add', sub: 'Notepad', href: '#/add', pos: pad.localToWorld(new THREE.Vector3(0, 0.48, 0)), target: new THREE.Vector3(0.05, 1.2, -0.6), mesh: pad, here: true, plaque: true });
  // the house panel on the wall behind you (Settings), switched on by the light switch
  const sp = new THREE.Group();
  box(1.12, 1.62, 0.04, 0x7a4e33, 0, 0, 0, sp);
  const setPanel = makePanel(1.0, 1.5, 640, 960);
  sp.add(setPanel.mesh); setPanel.mesh.position.z = 0.025;
  sp.position.y = 1.65; onWall(sp, 'front', -2.6, W, D); scene.add(sp);
  const sw = new THREE.Group();
  box(0.16, 0.26, 0.02, 0xf6efe0, 0, 0, 0.01, sw); box(0.05, 0.09, 0.03, night ? 0xd8d2c4 : 0xffffff, 0, night ? -0.03 : 0.03, 0.03, sw);
  const swHit = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), new THREE.MeshBasicMaterial({ visible: false })); swHit.position.z = 0.04; sw.add(swHit);
  const swTag = plaque('Settings', '', 0.72, 0.22); swTag.position.set(0, 0.3, 0.01); sw.add(swTag);
  sw.position.y = 1.3; onWall(sw, 'right', -1.0, W, D); scene.add(sw); sw.updateMatrixWorld(true);
  spots.push({ label: 'Settings', sub: 'Light switch', href: '#/settings', pos: sw.localToWorld(new THREE.Vector3(0, 0.25, 0.05)), target: sw.localToWorld(new THREE.Vector3(0, -0.1, 1.2)), mesh: sw, here: true, plaque: true });
  scene.updateMatrixWorld(true);
  const lpanels = { notepad: addPanel, panel: setPanel };

  let lblink = 0;
  return {
    scene, spots, eye: new THREE.Vector3(0, 1.65, 3.4), yawCenter: Math.PI, yawRange: 1.55, pitch: -0.14,
    focus: { notepad: focusOf(addPanel.mesh), panel: focusOf(setPanel.mesh) },
    panels: lpanels,
    refresh() { addPanel.dirty = true; setPanel.dirty = true; },
    update(dt, t) {
      const b = Math.floor(t * 2);
      if (b !== lblink && [addInput, passInput].includes(document.activeElement)) { lblink = b; addPanel.dirty = setPanel.dirty = true; }
      if (addPanel.dirty) { addPanel.dirty = false; drawAdd(addPanel, night); }
      if (setPanel.dirty) { setPanel.dirty = false; drawSettings(setPanel, night); }
      flame.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.18; f.scale.x = 1 + Math.sin(t * 7 + i) * 0.08; });
      fireLight.intensity = (night ? 6 : 3) * (0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 5.3) * 0.07);
      bulbs.forEach((b, i) => b.material.color.setHSL(0.11, 1, 0.6 + Math.sin(t * 2 + i) * 0.12));
      body.scale.y = 0.6 + Math.sin(t * 1.6) * 0.03;
      steam(t);
    },
  };
}

function kitchen(night) {
  const scene = new THREE.Scene();
  const W = 8, D = 8;
  shell(scene, { w: W, d: D, wall: night ? 0xd9cdb0 : 0xf6ecd2, floorMap: tileTexture('#e9dcc0', '#c96f4a', 8), ceiling: 0xfaf3e3 });
  scene.children[0].material.map.repeat.set(3, 3);
  lights(scene, night);
  const spots = [];
  // counters along the back wall
  const run = new THREE.Group();
  box(6, 0.9, 0.7, 0x6f9a8a, 0, 0.45, 0.35, run);
  box(6.1, 0.06, 0.76, 0xf3ead8, 0, 0.93, 0.36, run);
  for (let i = 0; i < 6; i++) box(0.9, 0.7, 0.02, 0x7fae9c, -2.5 + i, 0.45, 0.71, run);
  // backsplash tiles
  const splash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.8), new THREE.MeshLambertMaterial({ map: tileTexture('#ffffff', '#e6eef0', 10) }));
  splash.position.set(0, 1.36, 0.01); run.add(splash);
  // stove + steaming pot
  box(1.0, 0.04, 0.6, 0x2b2b2b, 1.2, 0.97, 0.35, run);
  const pot = cyl(0.26, 0.24, 0.32, 0xc4513f, 1.2, 1.15, 0.35, run, 20);
  cyl(0.28, 0.28, 0.03, 0xa8402f, 1.2, 1.33, 0.35, run, 20);
  const burner = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 20), glow(0xff7b3a)); burner.rotation.x = -Math.PI / 2; burner.position.set(0.85, 0.995, 0.5); run.add(burner);
  // hood
  box(1.2, 0.5, 0.6, 0xd9d4c7, 1.2, 2.4, 0.3, run);
  // hanging utensils + shelf with jars
  box(2.2, 0.06, 0.28, 0x8a5a3a, -1.6, 2.0, 0.14, run);
  [0xf0d39a, 0xd98b6a, 0xc4513f, 0x5f9a45, 0xf6efe0].forEach((c, i) => cyl(0.09, 0.09, 0.22, c, -2.5 + i * 0.42, 2.14, 0.14, run, 12));
  [-0.4, -0.1, 0.2].forEach((x, i) => {
    const pan = cyl(0.16 + i * 0.03, 0.16 + i * 0.03, 0.04, 0x3a3f47, x, 1.75 - i * 0.05, 0.08, run, 18); pan.rotation.x = Math.PI / 2;
  });
  // cutting board with veggies
  box(0.6, 0.04, 0.38, 0xc89a5a, -1.4, 0.98, 0.35, run);
  [[0xf2a43a, -1.55], [0x5f9a45, -1.35], [0xc4513f, -1.2]].forEach(([c, x]) => { const v = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(c)); v.position.set(x, 1.06, 0.35); run.add(v); });
  onWall(run, 'back', 0, W, D); scene.add(run);
  const steam = smoke(scene, run.localToWorld(new THREE.Vector3(1.2, 1.4, 0.35)), 9);
  // window above the sink side
  const win = windowPane(night ? 0x1d2a52 : 0xa9d4ef, night, scene, 1.4, 1.1); win.position.y = 1.85; onWall(win, 'back', -1.6, W, D); win.position.z += 0.02; win.position.y = 2.6; win.scale.setScalar(0.7);
  // fridge
  const fridge = new THREE.Group();
  box(0.95, 2.1, 0.75, 0xf3efe6, 0, 1.05, 0.38, fridge); box(0.04, 0.5, 0.05, 0xb8b2a6, -0.35, 1.5, 0.78, fridge); box(0.04, 0.4, 0.05, 0xb8b2a6, -0.35, 0.7, 0.78, fridge);
  box(0.92, 0.02, 0.02, 0xd8d2c4, 0, 1.25, 0.76, fridge);
  [[0xffd27a, 0.1, 1.7], [0xd98b6a, 0.25, 1.55], [0x8fbf72, -0.1, 1.45]].forEach(([c, x, y]) => box(0.16, 0.2, 0.01, c, x, y, 0.77, fridge));
  onWall(fridge, 'left', -2.6, W, D); scene.add(fridge);
  // little table with a bowl of fruit
  const table = new THREE.Group();
  cyl(0.6, 0.6, 0.06, 0x8a5a3a, 0, 0.75, 0, table, 24); cyl(0.06, 0.08, 0.75, 0x6b4430, 0, 0.37, 0, table, 10);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xf6efe0, { side: THREE.DoubleSide })); bowl.position.y = 0.98; table.add(bowl);
  [[0xc4513f, 0.06, 0], [0xf2a43a, -0.06, 0.04], [0x8fbf72, 0, -0.07]].forEach(([c, x, z]) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(c)); f.position.set(x, 0.95, z); table.add(f); });
  table.position.set(1.8, 0, -0.8); scene.add(table);
  plant(-3.4, -3.3, scene);
  const back = door({ arch: true, peek: night ? 0x8a6a4a : 0xe9cfa0 }); onWall(back, 'front', 0, W, D); scene.add(back);
  spots.push({ label: 'Living room', href: '#/', pos: back.localToWorld(new THREE.Vector3(0, 2.52, 0.1)), target: back.localToWorld(new THREE.Vector3(0, 1.2, 0.6)), mesh: back, back: true });
  return { scene, spots, eye: new THREE.Vector3(0, 1.7, 2.6), yawCenter: Math.PI, yawRange: 0.9, pitch: -0.22, update(dt, t) { steam(t); burner.material.color.setHSL(0.05, 1, 0.55 + Math.sin(t * 6) * 0.05); } };
}

function gym(night) {
  const scene = new THREE.Scene();
  const W = 9, D = 8;
  shell(scene, { w: W, d: D, wall: night ? 0xb8c4c8 : 0xdfe7e6, floorMap: plankTexture('#3d4148', '#30343a', 256, 256, 6), ceiling: 0xf0f0ea });
  scene.children[0].material.map.repeat.set(2, 2);
  lights(scene, night, 0xfff4e0);
  const spots = [];
  const accent = cssVar('--accent', '#3f6e3c');
  // mirror over the rack
  const mirror = box(2.8, 1.5, 0.03, glow(night ? 0x5a6a80 : 0xcfe2ea), 0, 1.65, 0.02);
  const mg = new THREE.Group(); mg.add(mirror); box(2.9, 0.06, 0.05, 0x9aa3ab, 0, 2.42, 0.03, mg); box(2.9, 0.06, 0.05, 0x9aa3ab, 0, 0.88, 0.03, mg);
  onWall(mg, 'back', 1.2, W, D); scene.add(mg);
  // the workout whiteboard: every workout written up, with search, filters and favorites
  const wb = new THREE.Group();
  box(1.42, 2.02, 0.04, 0xb8bec4, 0, 0, 0, wb);
  box(1.3, 0.05, 0.12, 0xb8bec4, 0, -1.02, 0.06, wb);
  [0xc4513f, 0x3a6a8a, 0x5f9a45].forEach((c, i) => { const m = cyl(0.016, 0.016, 0.14, c, -0.4 + i * 0.18, -0.99, 0.08, wb, 8); m.rotation.z = Math.PI / 2; });
  const wbPanel = makePanel(1.3, 1.9, 768, 1122);
  wb.add(wbPanel.mesh); wbPanel.mesh.position.z = 0.025;
  wb.position.y = 1.55; onWall(wb, 'back', -2.4, W, D); scene.add(wb);
  // dumbbell rack
  const rack = new THREE.Group();
  box(2.6, 0.06, 0.5, 0x2b2b2b, 0, 0.55, 0.3, rack); box(2.6, 0.06, 0.5, 0x2b2b2b, 0, 0.25, 0.3, rack);
  [-1.25, 1.25].forEach(x => box(0.06, 0.6, 0.5, 0x2b2b2b, x, 0.3, 0.3, rack));
  for (let i = 0; i < 6; i++) {
    [0.62, 0.32].forEach((y, r) => {
      const db = new THREE.Group();
      const s = 0.07 + i * 0.012;
      cyl(0.025, 0.025, 0.36, 0x9aa3ab, 0, 0, 0, db, 8).rotation.z = Math.PI / 2;
      [-1, 1].forEach(e => { const p = cyl(s, s, 0.08, r ? 0x3a3f47 : accent, e * 0.14, 0, 0, db, 14); p.rotation.z = Math.PI / 2; });
      db.position.set(-1.0 + i * 0.4, y + s, 0.3); db.rotation.y = Math.PI / 2; rack.add(db);
    });
  }
  onWall(rack, 'back', 1.2, W, D); rack.position.z += 0.2; scene.add(rack);
  // bench + barbell on stands
  const bench = new THREE.Group();
  box(0.4, 0.12, 1.4, 0x2b2b2b, 0, 0.45, 0, bench); box(0.42, 0.08, 1.42, 0xc4513f, 0, 0.53, 0, bench);
  [-0.55, 0.55].forEach(z => box(0.06, 0.45, 0.3, 0x3a3f47, 0, 0.22, z, bench));
  [-0.6, 0.6].forEach(x => box(0.06, 1.2, 0.06, 0x3a3f47, x, 0.6, -0.75, bench));
  const bar = cyl(0.025, 0.025, 2.0, 0x9aa3ab, 0, 1.15, -0.75, bench, 8); bar.rotation.z = Math.PI / 2;
  [-0.8, 0.8].forEach(x => { const p = cyl(0.3, 0.3, 0.08, accent, x, 1.15, -0.75, bench, 24); p.rotation.z = Math.PI / 2; });
  bench.position.set(-2.4, 0, -0.6); bench.rotation.y = 0.4; scene.add(bench);
  // yoga mat + kettlebells
  const yoga = box(0.7, 0.02, 1.8, 0x8a5a9a, 2.2, 0.01, -1.0); scene.add(yoga);
  [[1.4, -2.2, 0.16], [1.7, -2.3, 0.13], [1.95, -2.25, 0.1]].forEach(([x, z, r]) => {
    const k = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(0x2b2b2b)); k.position.set(x, r, z); scene.add(k);
    const h = new THREE.Mesh(new THREE.TorusGeometry(r * 0.55, r * 0.14, 6, 14, Math.PI), mat(0x2b2b2b)); h.position.set(x, r * 1.8, z); scene.add(h);
  });
  // punching bag that sways
  const bagPivot = new THREE.Group(); bagPivot.position.set(3.2, 3.4, 1.0); scene.add(bagPivot);
  const chain = cyl(0.015, 0.015, 0.7, 0x9aa3ab, 0, -0.35, 0, bagPivot, 6);
  const bag = cyl(0.3, 0.3, 1.2, 0xa8402f, 0, -1.3, 0, bagPivot, 20);
  cyl(0.31, 0.31, 0.08, 0x2b2b2b, 0, -0.75, 0, bagPivot, 20);
  // water bottle + towel + clock
  cyl(0.06, 0.06, 0.26, 0x6aa6d8, -1.2, 0.13, -2.4, scene, 12);
  box(0.5, 0.04, 0.3, 0xf0d39a, -0.6, 0.02, -2.6, scene).rotation.y = 0.3;
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), glow(0xffffff)); const cg = new THREE.Group(); cg.add(clockFace);
  const hand = box(0.02, 0.22, 0.01, 0x222222, 0, 0.1, 0.01, cg); const hand2 = box(0.02, 0.16, 0.01, 0xc4513f, 0, 0.07, 0.02, cg);
  cg.position.y = 2.9; onWall(cg, 'left', 0, W, D); cg.position.x += 0.02; scene.add(cg);
  const back = door({ color: 0x3a6a8a, glass: true }); onWall(back, 'front', 0, W, D); scene.add(back);
  spots.push({ label: 'Living room', href: '#/', pos: back.localToWorld(new THREE.Vector3(0, 2.52, 0.1)), target: back.localToWorld(new THREE.Vector3(0, 1.2, 0.6)), mesh: back, back: true });
  scene.updateMatrixWorld(true);
  const panels = { whiteboard: wbPanel };
  let blink = 0, tick = 0, lastLeft = -1;
  return {
    scene, spots, eye: new THREE.Vector3(0, 1.7, 2.8), yawCenter: Math.PI, yawRange: 1.1, pitch: -0.24,
    focus: { whiteboard: focusOf(wbPanel.mesh) },
    panels,
    refresh() { wbPanel.dirty = true; },
    update(dt, t) {
      const b = Math.floor(t * 4);
      if (b !== blink && document.activeElement === searchInput) { blink = b; wbPanel.dirty = true; }
      if (((detailId === 'go' && mode.timer) || (detailId === 'edit' && typingIn())) && b !== tick) { tick = b; wbPanel.dirty = true; }
      if (detailId === 'go' && mode.timerLeft !== lastLeft) { lastLeft = mode.timerLeft; wbPanel.dirty = true; }
      if (wbPanel.dirty) { wbPanel.dirty = false; const it = detailId && getItem(detailId); if (detailId === 'go') drawTraining(wbPanel); else if (detailId === 'edit') drawWorkoutEditor(wbPanel); else if (it?.type === 'workout') drawWorkout(wbPanel, it); else drawGym(wbPanel, night); }
      bagPivot.rotation.z = Math.sin(t * 1.1) * 0.06; bagPivot.rotation.x = Math.sin(t * 0.8) * 0.04;
      hand2.parent.rotation.z = 0; hand2.rotation.z = -t; hand2.position.set(Math.sin(t) * 0.07, Math.cos(t) * 0.07, 0.02);
      void chain; void bag; void hand;
    },
  };
}

function focusOf(mesh) {
  const center = mesh.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));
  return { center, normal, w: mesh.geometry.parameters.width, h: mesh.geometry.parameters.height, mesh };
}

// ---------- canvas panels: flat screens and papers drawn with 2D canvas, shown in 3D ----------
function makePanel(w, h, pxW, pxH) {
  const canvas = document.createElement('canvas');
  canvas.width = pxW; canvas.height = pxH;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  return { canvas, g: canvas.getContext('2d'), tex, mesh, w, h, hits: [], scroll: 0, maxScroll: 0, dirty: true };
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function wrap(g, text, maxW, maxLines = 99) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
      if (out.length >= maxLines) break;
    }
    out.push(line);
    if (out.length >= maxLines) break;
  }
  if (out.length > maxLines) out.length = maxLines;
  return out;
}
function ellipsis(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}
const plainText = s => String(s || '').replace(/^#+\s*/gm, '').replace(/[*_`>]/g, '').replace(/^\s*[-•]\s+/gm, '• ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const FONT = '"Zen Maru Gothic", "Atkinson Hyperlegible", system-ui, sans-serif';
const HEAD = '"Kiwi Maru", Georgia, serif';

// The desk monitor: the To-do app on a tall screen.
const todoState = { filter: 'All' };
function drawTodo(p, night) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = night ? '#eef0dc' : '#2c3a2b', soft = night ? '#aab3c4' : '#6b7866', accent = night ? '#f3c55c' : '#3f6e3c';
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, night ? '#1f2a4a' : '#fffaf0'); bg.addColorStop(1, night ? '#151d36' : '#f3eedc');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  p.hits = [];
  const today = todayISO();
  const every = byType('task');
  const lists = [...new Set(every.map(t => t.list).filter(Boolean))].sort();
  if (!['All', 'Important', ...lists].includes(todoState.filter)) todoState.filter = 'All';
  const f = todoState.filter;
  const all = every.filter(t => f === 'All' || (f === 'Important' ? t.important : t.list === f));
  const groups = groupTasks(all, today);
  const open = all.length - groups.done.length;
  // header
  g.fillStyle = accent; rr(g, 24, 24, 150, 56, 28); g.fill();
  g.fillStyle = night ? '#1a2238' : '#fffdf3'; g.font = `600 28px ${FONT}`; g.textBaseline = 'middle'; g.fillText('← Office', 44, 53);
  p.hits.push({ x: 24, y: 24, w: 150, h: 56, fn: () => { location.hash = '#/office'; } });
  pill(p, W - 190, 24, 166, 56, '+ Details', { stroke: accent, text: accent, font: 25, fn: () => { location.hash = '#/new/task'; } });
  g.fillStyle = ink; g.font = `500 64px ${HEAD}`; g.textBaseline = 'alphabetic'; g.fillText('To-do', 28, 160);
  g.fillStyle = soft; g.font = `400 28px ${FONT}`;
  g.fillText(!all.length ? 'Nothing yet' : open ? `${open} left${groups.overdue.length + groups.today.length ? `, ${groups.overdue.length + groups.today.length} due today` : ''}` : 'All done', 32, 202);
  // add box (typing goes into a hidden input, painted here)
  const val = deskInput?.value || '';
  const typing = document.activeElement === deskInput;
  g.fillStyle = night ? '#28345c' : '#ffffff'; rr(g, 24, 230, W - 48, 76, 20); g.fill();
  g.strokeStyle = typing ? accent : (night ? '#3a4770' : '#ddd6c0'); g.lineWidth = 3; g.stroke();
  g.font = `400 30px ${FONT}`; g.textBaseline = 'middle';
  g.fillStyle = val ? ink : soft;
  const shown = ellipsis(g, val || 'Add a to-do…', W - 220);
  g.fillText(shown, 48, 268);
  if (typing && Math.floor(performance.now() / 500) % 2) { const cx = 48 + (val ? g.measureText(shown).width : 0) + 2; g.fillStyle = accent; g.fillRect(cx, 248, 3, 40); }
  g.fillStyle = accent; rr(g, W - 140, 242, 104, 52, 26); g.fill();
  g.fillStyle = night ? '#1a2238' : '#fffdf3'; g.font = `600 28px ${FONT}`; g.textAlign = 'center'; g.fillText('Add', W - 88, 269); g.textAlign = 'left';
  p.hits.push({ x: 24, y: 230, w: W - 180, h: 76, fn: () => focusDesk(), keep: true });
  p.hits.push({ x: W - 150, y: 230, w: 126, h: 76, fn: () => submitDesk() });
  let listTop = 318;
  // live preview of what the quick-add understood (day, list, star, repeat)
  if (val.trim()) {
    const q = parseQuickTask(val, today);
    const bits = [q.due && `📅 ${dueLabel(q.due, today)}`, q.repeat && '↻ repeats', q.list && `#${q.list}`, q.important && '★ important'].filter(Boolean);
    g.fillStyle = bits.length ? accent : soft; g.font = `500 23px ${FONT}`; g.textBaseline = 'middle';
    g.fillText(ellipsis(g, bits.length ? bits.join('   ') : 'Tip: add “friday”, “#home” or “!”', W - 64), 34, 330);
    listTop += 30;
  }
  // filter chips: All, Important, then each list
  if (every.length) {
    let cx = 24;
    for (const c of ['All', 'Important', ...lists]) {
      const label = c === 'Important' ? '★ Important' : c;
      g.font = `600 22px ${FONT}`; const w = g.measureText(label).width + 30;
      if (cx + w > W - 24) break;
      const on = c === f;
      pill(p, cx, listTop, w, 44, label, { fill: on ? accent : null, stroke: on ? null : (night ? '#46517a' : '#d6cfb8'), text: on ? (night ? '#1a2238' : '#fffdf3') : soft, font: 22, fn: () => { todoState.filter = c; p.scroll = 0; } });
      cx += w + 8;
    }
    listTop += 58;
  }
  // list
  const top = listTop, bottom = H - 16;
  g.save(); g.beginPath(); g.rect(0, top, W, bottom - top); g.clip();
  let y = top + 10 - p.scroll;
  const ROWH = 92;
  const section = label => { g.fillStyle = soft; g.font = `700 22px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText(label.toUpperCase(), 32, y + 30); y += 46; };
  const row = t => {
    const vis = y + ROWH > top && y < bottom;
    if (vis) {
      g.fillStyle = night ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.75)'; rr(g, 20, y, W - 40, ROWH - 10, 18); g.fill();
      // checkbox
      g.lineWidth = 3; g.strokeStyle = t.done ? accent : soft; rr(g, 38, y + 22, 40, 40, 12); g.stroke();
      if (t.done) { g.fillStyle = accent; rr(g, 38, y + 22, 40, 40, 12); g.fill(); g.strokeStyle = night ? '#1a2238' : '#fff'; g.lineWidth = 5; g.beginPath(); g.moveTo(47, y + 42); g.lineTo(55, y + 51); g.lineTo(70, y + 33); g.stroke(); }
      g.fillStyle = t.done ? soft : ink; g.font = `500 30px ${FONT}`; g.textBaseline = 'alphabetic';
      const title = ellipsis(g, t.title, W - 210);
      g.fillText(title, 98, y + 40);
      if (t.done) { g.fillRect(98, y + 30, g.measureText(title).width, 2.5); }
      const meta = [t.due ? dueLabel(t.due, today) : '', t.repeat ? '↻' : '', t.list ? `#${t.list}` : '', t.steps?.length ? `${t.steps.filter(s => s.done).length}/${t.steps.length}` : ''].filter(Boolean).join('  ·  ');
      if (meta) { g.font = `400 23px ${FONT}`; g.fillStyle = !t.done && t.due && t.due < today ? '#c4513f' : soft; g.fillText(ellipsis(g, meta, W - 210), 98, y + 70); }
      // star
      g.font = `400 40px ${FONT}`; g.fillStyle = t.important ? '#f2a43a' : (night ? '#46517a' : '#d6cfb8'); g.textBaseline = 'middle'; g.fillText(t.important ? '★' : '☆', W - 82, y + 42);
      if (y > top - 20 && y + ROWH < bottom + 20) {
        p.hits.push({ x: 20, y, w: 84, h: ROWH - 10, fn: () => toggleTask(t.id).then(m => m && toast(m)) });
        p.hits.push({ x: W - 100, y, w: 80, h: ROWH - 10, fn: () => toggleStar(t.id) });
        p.hits.push({ x: 104, y, w: W - 210, h: ROWH - 10, fn: () => { location.hash = `#/item/${encodeURIComponent(t.id)}`; } });
      }
    }
    y += ROWH;
  };
  const LABELS = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Next 7 days'], ['later', 'Later'], ['someday', 'No date']];
  for (const [k, label] of LABELS) if (groups[k].length) { section(label); groups[k].forEach(row); }
  if (groups.done.length) { section('Done'); groups.done.slice(0, 20).forEach(row); }
  if (every.length && !all.length) { g.fillStyle = soft; g.font = `400 28px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText('Nothing in this list.', 40, top + 60); }
  else if (every.length && !open) { g.fillStyle = accent; g.font = `500 28px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText('✓ All done here. Nice!', 40, Math.max(top + 50, y + 40)); y += 70; }
  if (!every.length) { g.fillStyle = soft; g.font = `400 28px ${FONT}`; wrap(g, 'Tap the box above and type. Try “call dentist friday #health !” to set a day, a list and a star in one go.', W - 80).forEach((l, i) => g.fillText(l, 40, top + 60 + i * 40)); }
  g.restore();
  p.maxScroll = Math.max(0, y + p.scroll - bottom + 20);
  // scroll hint
  if (p.maxScroll > 0) { const frac = (bottom - top) / (bottom - top + p.maxScroll); const bh = (bottom - top) * frac; g.fillStyle = night ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.15)'; rr(g, W - 10, top + (bottom - top - bh) * (p.scroll / p.maxScroll), 6, bh, 3); g.fill(); }
  p.tex.needsUpdate = true;
}

// The corkboard: every note pinned as a paper card; tap one to read it big.
function rng(seed) { return () => (seed = (seed * 9301 + 49297) % 233280) / 233280; }
let corkDots = null;
function drawBoard(p, night) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  g.fillStyle = night ? '#9a7448' : '#c89a5a'; g.fillRect(0, 0, W, H);
  if (!corkDots) { const r = rng(5); corkDots = Array.from({ length: 700 }, () => [r() * W, r() * H, r() * 2.4 + 0.6, r() > 0.5]); }
  corkDots.forEach(([x, y, s, d]) => { g.fillStyle = d ? 'rgba(90,55,25,.35)' : 'rgba(255,230,190,.25)'; g.fillRect(x, y, s, s); });
  p.hits = [];
  const notes = byType('note').sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  const paper = (x, y, w, h, color, rot) => { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot); g.shadowColor = 'rgba(40,20,5,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 6; g.fillStyle = color; g.fillRect(-w / 2, -h / 2, w, h); g.restore(); };
  const pin = (x, y) => { g.fillStyle = '#c4513f'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(x - 3, y - 3, 3.5, 0, 7); g.fill(); };
  const button = (x, y, w, label, fn, filled = true) => {
    g.fillStyle = filled ? '#3f6e3c' : '#fffdf3'; rr(g, x, y, w, 56, 28); g.fill();
    g.fillStyle = filled ? '#fffdf3' : '#3f6e3c'; g.font = `600 27px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + 29); g.textAlign = 'left';
    p.hits.push({ x, y, w, h: 56, fn });
  };
  const openNote = detailId?.startsWith?.('note:') && getItem(detailId.slice(5));
  if (openNote) {
    paper(30, 30, W - 60, H - 60, '#fffdf3', -0.004); pin(W / 2, 52);
    button(56, 78, 170, '← Board', () => { location.hash = '#/notes'; }, false);
    button(W - 196, 78, 140, 'Edit', () => { location.hash = `#/edit/${encodeURIComponent(openNote.id)}`; });
    g.fillStyle = '#2c3a2b'; g.font = `500 48px ${HEAD}`; g.textBaseline = 'alphabetic';
    const tl = wrap(g, openNote.title || 'Untitled', W - 140, 3);
    tl.forEach((l, i) => g.fillText(l, 64, 200 + i * 56));
    let y = 200 + tl.length * 56;
    if (openNote.category) { g.fillStyle = '#6b7866'; g.font = `400 24px ${FONT}`; g.fillText(openNote.category, 66, y); y += 24; }
    g.strokeStyle = '#e3d9bd'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, y + 10); g.lineTo(W - 64, y + 10); g.stroke();
    const top = y + 30, bottom = H - 50;
    g.save(); g.beginPath(); g.rect(40, top, W - 80, bottom - top); g.clip();
    g.font = `400 29px ${FONT}`; g.fillStyle = '#2c3a2b';
    const lines = wrap(g, plainText(openNote.body), W - 140);
    lines.forEach((l, i) => { const ly = top + 34 + i * 42 - p.scroll; if (ly > top - 40 && ly < bottom + 40) g.fillText(l, 66, ly); });
    if (openNote.sourceUrl) {
      const ly = top + 34 + lines.length * 42 + 20 - p.scroll; g.fillStyle = '#3f6e3c'; g.fillText(`🔗 ${ellipsis(g, openNote.sourceUrl, W - 180)}`, 66, ly);
      if (ly > top && ly < bottom) p.hits.push({ x: 50, y: ly - 32, w: W - 100, h: 46, fn: () => window.open(openNote.sourceUrl, '_blank', 'noopener') });
    }
    g.restore();
    p.maxScroll = Math.max(0, lines.length * 42 + 120 - (bottom - top));
    if (p.maxScroll > 0) { const frac = (bottom - top) / (bottom - top + p.maxScroll), bh = (bottom - top) * frac; g.fillStyle = 'rgba(0,0,0,.15)'; rr(g, W - 56, top + (bottom - top - bh) * (p.scroll / p.maxScroll), 6, bh, 3); g.fill(); }
  } else {
    // header strip
    paper(W / 2 - 170, 26, 340, 90, '#fff3c8', 0.01); pin(W / 2, 40);
    g.fillStyle = '#2c3a2b'; g.font = `500 48px ${HEAD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Notes', W / 2, 78); g.textAlign = 'left';
    button(24, 40, 150, '← Office', () => { location.hash = '#/office'; }, false);
    const top = 140, bottom = H - 10;
    g.save(); g.beginPath(); g.rect(0, top, W, bottom - top); g.clip();
    const cw = (W - 3 * 28) / 2, ch = 300;
    const tints = ['#fffdf3', '#fff3c8', '#e1ead0', '#f6dcd3', '#dff0ff'];
    const cards = [{ add: true }, ...notes];
    cards.forEach((n, i) => {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 28 + col * (cw + 28), y = top + 16 + r * (ch + 26) - p.scroll;
      if (y > bottom || y + ch < top) return;
      const rot = ((i * 37) % 7 - 3) * 0.006;
      if (n.add) {
        g.save(); g.translate(x + cw / 2, y + ch / 2); g.rotate(rot); g.setLineDash([14, 10]); g.strokeStyle = '#fffdf3'; g.lineWidth = 4; g.strokeRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, ch - 12); g.restore();
        g.fillStyle = '#fffdf3'; g.font = `500 80px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', x + cw / 2, y + ch / 2 - 24);
        g.font = `600 30px ${FONT}`; g.fillText('New note', x + cw / 2, y + ch / 2 + 44); g.textAlign = 'left';
        p.hits.push({ x, y, w: cw, h: ch, fn: () => { location.hash = '#/new/note'; } });
        return;
      }
      paper(x, y, cw, ch, tints[i % tints.length], rot); pin(x + cw / 2, y + 16);
      g.fillStyle = '#2c3a2b'; g.font = `600 30px ${FONT}`; g.textBaseline = 'alphabetic';
      const tl = wrap(g, n.title || 'Untitled', cw - 44, 2);
      tl.forEach((l, k) => g.fillText(ellipsis(g, l, cw - 44), x + 22, y + 66 + k * 38));
      g.fillStyle = '#5e6c57'; g.font = `400 23px ${FONT}`;
      wrap(g, plainText(n.body), cw - 44, 6 - tl.length).forEach((l, k) => g.fillText(ellipsis(g, l, cw - 44), x + 22, y + 74 + tl.length * 38 + k * 32));
      if (n.category) { g.fillStyle = '#3f6e3c'; g.font = `600 20px ${FONT}`; g.fillText(ellipsis(g, n.category.toUpperCase(), cw - 44), x + 22, y + ch - 22); }
      p.hits.push({ x, y, w: cw, h: ch, fn: () => { location.hash = `#/item/${encodeURIComponent(n.id)}`; } });
    });
    g.restore();
    p.maxScroll = Math.max(0, top + 16 + Math.ceil(cards.length / 2) * (ch + 26) - bottom);
  }
  p.tex.needsUpdate = true;
}

// The gym whiteboard: workouts written up like a class schedule.
const gymState = { filter: 'All', quick: '' };
function gymItems() {
  let items = byType('workout');
  const f = gymState.filter;
  if (f === 'Favorites') items = items.filter(i => isSaved(i.id));
  else if (f !== 'All') items = items.filter(i => (i.focus || 'Other') === f);
  if (gymState.quick === 'short') items = items.filter(i => i.minutes && i.minutes <= 30);
  if (gymState.quick === 'noequip') items = items.filter(i => !i.equipment || /bodyweight/i.test(i.equipment));
  const q = (searchInput?.value || '').trim();
  if (q) items = search(q, items);
  else items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return items;
}
function drawGym(p, night) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = '#24303a', soft = '#6a7680', blue = '#2f5f9a', red = '#c4513f', green = '#3f7a3c';
  g.fillStyle = night ? '#e9edf0' : '#fbfcfd'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(120,140,160,.06)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(120 + i * 110, 300 + (i % 3) * 260, 90, 30, 0.3, 0, 7); g.fill(); }
  p.hits = [];
  const btn = (x, y, w, label, color, fn, on = true) => {
    g.lineWidth = 4; g.strokeStyle = color; rr(g, x, y, w, 58, 29); g.stroke();
    if (on) { g.fillStyle = color; rr(g, x, y, w, 58, 29); g.fill(); }
    g.fillStyle = on ? '#fff' : color; g.font = `600 27px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + 30); g.textAlign = 'left';
    p.hits.push({ x, y, w, h: 58, fn });
    return x + w;
  };
  btn(24, 22, 206, '← Living room', green, () => { location.hash = '#/'; }, false);
  btn(W - 144, 22, 120, '+ Add', green, () => { location.hash = '#/add?type=workout'; });
  const all = byType('workout');
  const items = gymItems();
  g.fillStyle = blue; g.font = `500 66px ${HEAD}`; g.textBaseline = 'alphabetic'; g.fillText('Workouts', 28, 150);
  const tw = g.measureText('Workouts').width;
  g.fillStyle = soft; g.font = `400 25px ${FONT}`; g.fillText(items.length === all.length ? `${all.length}` : `${items.length} of ${all.length}`, 28 + tw + 18, 150);
  // search (typed into a hidden input, written here)
  const val = searchInput?.value || '';
  const typing = document.activeElement === searchInput;
  g.lineWidth = 3; g.strokeStyle = typing ? blue : '#c9d1d8'; rr(g, 24, 176, W - 48, 66, 33); g.stroke();
  g.fillStyle = soft; g.beginPath(); g.arc(62, 207, 12, 0, 7); g.lineWidth = 3; g.strokeStyle = soft; g.stroke(); g.fillRect(70, 214, 10, 3);
  g.font = `400 28px ${FONT}`; g.textBaseline = 'middle'; g.fillStyle = val ? ink : soft;
  const shown = ellipsis(g, val || 'Search workouts…', W - 220);
  g.fillText(shown, 94, 210);
  if (typing && Math.floor(performance.now() / 500) % 2) { g.fillStyle = blue; g.fillRect(94 + (val ? g.measureText(shown).width : 0) + 2, 190, 3, 38); }
  if (val) { g.fillStyle = soft; g.font = `600 30px ${FONT}`; g.fillText('×', W - 66, 208); p.hits.push({ x: W - 96, y: 176, w: 72, h: 66, fn: () => { searchInput.value = ''; } }); }
  p.hits.push({ x: 24, y: 176, w: W - 120, h: 66, fn: () => focusSearch(), keep: true });
  // filter chips (wrap)
  const cats = ['All', 'Favorites', ...[...new Set(all.map(i => i.focus || 'Other'))].sort()];
  if (!cats.includes(gymState.filter)) gymState.filter = 'All';
  let x = 24, y = 262;
  g.font = `600 24px ${FONT}`;
  const chip = (label, on, color, fn) => {
    const w = g.measureText(label).width + 40;
    if (x + w > W - 24) { x = 24; y += 58; }
    g.lineWidth = 3; g.strokeStyle = color; rr(g, x, y, w, 46, 23); g.stroke();
    if (on) { g.fillStyle = color; rr(g, x, y, w, 46, 23); g.fill(); }
    g.fillStyle = on ? '#fff' : color; g.textBaseline = 'middle'; g.fillText(label, x + 20, y + 24);
    p.hits.push({ x, y, w, h: 46, fn });
    x += w + 12;
  };
  cats.forEach(c => chip(c === 'Favorites' ? '♥ Favorites' : c, gymState.filter === c, blue, () => { gymState.filter = c; p.scroll = 0; }));
  x = 24; y += 58;
  [['short', '30 min or less'], ['noequip', 'No equipment']].forEach(([k, l]) => chip(l, gymState.quick === k, red, () => { gymState.quick = gymState.quick === k ? '' : k; p.scroll = 0; }));
  chip('🎲 Pick one', false, green, () => {
    const favs = items.filter(i => isSaved(i.id));
    const from = favs.length >= 2 ? favs : items;
    if (from.length) location.hash = `#/item/${encodeURIComponent(from[Math.floor(Math.random() * from.length)].id)}`;
  });
  // the list
  const top = y + 66, bottom = H - 70;
  g.strokeStyle = '#d5dbe0'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, top - 8); g.lineTo(W - 24, top - 8); g.stroke();
  g.save(); g.beginPath(); g.rect(0, top, W, bottom - top); g.clip();
  const ROWH = 116;
  const magnets = [red, blue, green, '#e0a63a', '#8a5a9a'];
  items.forEach((it, i) => {
    const ry = top + 8 + i * ROWH - p.scroll;
    if (ry + ROWH < top || ry > bottom) return;
    g.fillStyle = magnets[i % magnets.length]; g.beginPath(); g.arc(50, ry + 40, 15, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(45, ry + 35, 5, 0, 7); g.fill();
    g.fillStyle = ink; g.font = `600 31px ${FONT}`; g.textBaseline = 'alphabetic';
    g.fillText(ellipsis(g, it.title, W - 200), 84, ry + 50);
    const n = (it.blocks || []).reduce((k, b) => k + b.exercises.length, 0);
    const meta = [it.minutes ? (it.minutes < 60 ? `${Math.round(it.minutes)} min` : `${Math.floor(it.minutes / 60)} hr ${Math.round(it.minutes % 60) || ''}`.trim()) : '', n ? `${n} exercise${n === 1 ? '' : 's'}` : '', it.focus || '', lastDone(it.id) ? `✓ ${agoLabel(lastDone(it.id))}` : ''].filter(Boolean).join('  ·  ');
    g.fillStyle = soft; g.font = `400 24px ${FONT}`; g.fillText(ellipsis(g, meta, W - 200), 84, ry + 86);
    const saved = isSaved(it.id);
    g.font = `400 44px ${FONT}`; g.textBaseline = 'middle'; g.fillStyle = saved ? red : '#c9d1d8'; g.fillText(saved ? '♥' : '♡', W - 86, ry + 50);
    g.strokeStyle = '#eef1f3'; g.lineWidth = 2; g.beginPath(); g.moveTo(84, ry + ROWH - 6); g.lineTo(W - 24, ry + ROWH - 6); g.stroke();
    if (ry > top - 30 && ry + ROWH < bottom + 30) {
      p.hits.push({ x: 24, y: ry, w: W - 150, h: ROWH - 8, fn: () => { location.hash = `#/item/${encodeURIComponent(it.id)}`; } });
      p.hits.push({ x: W - 120, y: ry, w: 96, h: ROWH - 8, fn: () => toggleSaved(it.id).then(on => toast(on ? 'Added to favorites' : 'Removed from favorites')) });
    }
  });
  if (!items.length) { g.fillStyle = soft; g.font = `400 28px ${FONT}`; g.textBaseline = 'alphabetic'; wrap(g, all.length ? 'Nothing here with these filters.' : 'No workouts yet. Tap + Add to paste one from TikTok or Instagram, or write your own.', W - 80).forEach((l, k) => g.fillText(l, 40, top + 60 + k * 40)); }
  g.restore();
  p.maxScroll = Math.max(0, items.length * ROWH + 16 - (bottom - top));
  if (p.maxScroll > 0) { const frac = (bottom - top) / (bottom - top + p.maxScroll); const bh = (bottom - top) * frac; g.fillStyle = 'rgba(0,0,0,.15)'; rr(g, W - 12, top + (bottom - top - bh) * (p.scroll / p.maxScroll), 6, bh, 3); g.fill(); }
  // marker tray hint
  g.fillStyle = soft; g.font = `400 22px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText(p.maxScroll > 0 ? 'Drag up and down to see more' : '', 28, H - 26);
  p.tex.needsUpdate = true;
}

// ---------- proxies: the flat page stays in the DOM (hidden), and 3D buttons press its controls ----------
const fb = sel => document.querySelector(`.room-fallback ${sel}`);
const press = sel => { const el = fb(sel); if (el) el.click(); return !!el; };

function caretText(g, x, y, val, placeholder, input, maxW, color, softc, mask = false) {
  const typing = document.activeElement === input;
  const shown = ellipsis(g, mask && val ? '•'.repeat(val.length) : (val || placeholder), maxW);
  g.fillStyle = val ? color : softc; g.fillText(shown, x, y);
  if (typing && Math.floor(performance.now() / 500) % 2) { g.fillStyle = color; g.fillRect(x + (val ? g.measureText(shown).width : 0) + 2, y - 20, 3, 38); }
  return typing;
}
function pill(p, x, y, w, h, label, { fill, stroke, text, fn, keep = false, font = 26 }) {
  const g = p.g;
  if (fill) { g.fillStyle = fill; rr(g, x, y, w, h, h / 2); g.fill(); }
  if (stroke) { g.lineWidth = 3; g.strokeStyle = stroke; rr(g, x, y, w, h, h / 2); g.stroke(); }
  g.fillStyle = text; g.font = `600 ${font}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x + w / 2, y + h / 2 + 1); g.textAlign = 'left';
  if (fn) p.hits.push({ x, y, w, h, fn, keep });
}

// Add: a notepad on a little stand on the coffee table.
const addState = { type: '' };
function drawAdd(p, night) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = '#2c3a2b', soft = '#7a8574', green = '#3f6e3c', red = '#c4513f';
  g.fillStyle = '#fffdf3'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#d7e3ef'; g.lineWidth = 2; for (let y = 120; y < H; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = '#f0b8b0'; g.beginPath(); g.moveTo(70, 0); g.lineTo(70, H); g.stroke();
  p.hits = [];
  pill(p, 90, 18, 200, 54, '← Living room', { stroke: green, text: green, fn: () => { location.hash = '#/'; } });
  g.fillStyle = ink; g.font = `500 50px ${HEAD}`; g.textBaseline = 'alphabetic'; g.fillText('Add something', 90, 128);
  const st = editing.importState;
  // the paste box
  g.fillStyle = '#ffffff'; rr(g, 90, 150, W - 120, 130, 18); g.fill();
  g.lineWidth = 3; g.strokeStyle = document.activeElement === addInput ? green : '#d9d2bd'; g.stroke();
  g.font = `400 26px ${FONT}`; g.textBaseline = 'middle';
  const val = addInput?.value || '';
  const lines = val ? wrap(g, val, W - 170, 3) : [''];
  if (!val) caretText(g, 110, 190, '', 'Paste a TikTok, Instagram, YouTube or recipe link…', addInput, W - 160, ink, soft);
  else lines.forEach((l, i) => { g.fillStyle = ink; g.fillText(l, 110, 186 + i * 36); });
  if (val && document.activeElement === addInput && Math.floor(performance.now() / 500) % 2) { const last = lines[lines.length - 1]; g.fillStyle = green; g.fillRect(110 + g.measureText(last).width + 2, 168 + (lines.length - 1) * 36, 3, 34); }
  p.hits.push({ x: 90, y: 150, w: W - 120, h: 130, fn: () => focusTyper(addInput), keep: true });
  let y = 300;
  if (st.error) { g.fillStyle = st.needsText ? green : red; g.font = `400 22px ${FONT}`; g.textBaseline = 'alphabetic'; wrap(g, st.error, W - 130, 3).forEach((l, i) => g.fillText(l, 92, y + 20 + i * 30)); y += 24 + Math.min(3, wrap(g, st.error, W - 130, 3).length) * 30; }
  // it's a…
  g.fillStyle = soft; g.font = `600 22px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText('IT’S A…', 92, y + 22); y += 36;
  let x = 90;
  [['', 'Let it guess'], ['recipe', 'Recipe'], ['workout', 'Workout'], ['note', 'Note']].forEach(([v, l]) => {
    g.font = `600 24px ${FONT}`; const w = g.measureText(l).width + 36;
    if (x + w > W - 20) { x = 90; y += 58; }
    const on = addState.type === v;
    pill(p, x, y, w, 48, l, { fill: on ? green : null, stroke: green, text: on ? '#fffdf3' : green, fn: () => { addState.type = v; }, font: 24 });
    x += w + 10;
  });
  y += 72;
  pill(p, 90, y, 170, 62, 'Paste', { stroke: green, text: green, keep: true, fn: async () => {
    try { const t = await navigator.clipboard.readText(); if (t) { addInput.value = t; p.dirty = true; wake(); } } catch { focusTyper(addInput); toast('Tap the box and paste'); }
  } });
  pill(p, 276, y, W - 306, 62, st.busy ? 'Reading…' : st.needsText ? 'Use this text' : 'Import', { fill: green, text: '#fffdf3', fn: () => {
    const ta = fb('#import-input'); const form = fb('form[data-form="import"]');
    if (!ta || !form || st.busy) return;
    ta.value = addInput.value;
    const radio = fb(`input[name="type"][value="${addState.type}"]`); if (radio) radio.checked = true;
    form.requestSubmit();
  } });
  y += 96;
  g.fillStyle = soft; g.font = `600 22px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText('OR START FROM SCRATCH', 92, y); y += 18;
  const bw = (W - 130) / 2;
  [['recipe', 'Recipe'], ['workout', 'Workout'], ['note', 'Note'], ['task', 'To-do']].forEach(([t, l], i) => {
    pill(p, 90 + (i % 2) * (bw + 10), y + Math.floor(i / 2) * 70, bw, 58, `+ ${l}`, { stroke: '#c89a5a', fill: '#fff6e0', text: '#7a4e33', fn: () => { location.hash = `#/new/${t}`; } });
  });
  p.tex.needsUpdate = true;
}

// Settings: the house panel on the living-room wall.
function drawSettings(p, night) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = '#2c2418', soft = '#7a6a55', brass = '#b88a4a', green = '#3f6e3c';
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#f6ead2'); bg.addColorStop(1, '#ead9b8');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  p.hits = [];
  pill(p, 24, 20, 200, 54, '← Living room', { stroke: green, text: green, fn: () => { location.hash = '#/'; } });
  g.fillStyle = ink; g.font = `500 52px ${HEAD}`; g.textBaseline = 'alphabetic'; g.fillText('Settings', 28, 130);
  const section = (label, y) => { g.fillStyle = soft; g.font = `700 21px ${FONT}`; g.fillText(label.toUpperCase(), 30, y); g.fillStyle = brass; g.fillRect(30, y + 10, W - 60, 2); };
  // themes: brass switches
  section('Look', 178);
  const current = chosenTheme();
  const tw = (W - 78) / 2;
  THEMES.forEach((t, i) => {
    const x = 30 + (i % 2) * (tw + 18), y = 204 + Math.floor(i / 2) * 92;
    const on = t.id === current;
    g.fillStyle = on ? '#fffaf0' : 'rgba(255,255,255,.45)'; rr(g, x, y, tw, 78, 16); g.fill();
    g.lineWidth = on ? 4 : 2; g.strokeStyle = on ? green : '#d4c19c'; g.stroke();
    g.fillStyle = on ? green : '#cbb894'; g.beginPath(); g.arc(x + 32, y + 39, 13, 0, 7); g.fill();
    g.fillStyle = ink; g.font = `600 25px ${FONT}`; g.textBaseline = 'middle'; g.fillText(ellipsis(g, t.name, tw - 70), x + 58, y + 40);
    p.hits.push({ x, y, w: tw, h: 78, fn: () => press(`[data-action="theme"][data-value="${t.id}"]`) });
  });
  let y = 204 + Math.ceil(THEMES.length / 2) * 92 + 6;
  const an = autoNight();
  g.fillStyle = an ? green : '#cbb894'; rr(g, 30, y, 74, 40, 20); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(an ? 84 : 50, y + 20, 15, 0, 7); g.fill();
  g.fillStyle = ink; g.font = `400 23px ${FONT}`; g.textBaseline = 'middle';
  wrap(g, 'Firefly night when my phone is in dark mode', W - 150, 2).forEach((l, i) => g.fillText(l, 120, y + 12 + i * 28));
  p.hits.push({ x: 24, y: y - 6, w: W - 48, h: 60, fn: () => press('[data-action="auto-night"]') });
  const sh = startHome();
  y += 64;
  g.fillStyle = sh ? green : '#cbb894'; rr(g, 30, y, 74, 40, 20); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(sh ? 84 : 50, y + 20, 15, 0, 7); g.fill();
  g.fillStyle = ink; g.font = `400 23px ${FONT}`; g.textBaseline = 'middle';
  wrap(g, 'Start on the home screen instead of the living room', W - 150, 2).forEach((l, i) => g.fillText(l, 120, y + 12 + i * 28));
  p.hits.push({ x: 24, y: y - 6, w: W - 48, h: 60, fn: () => press('[data-action="start-home"]') });
  // sync
  y += 100; section('Sync', y); y += 44;
  const sy = syncState();
  const status = sy.reason === 'checking' ? 'Checking…' : !sy.available ? 'Sync isn’t available here. Everything stays on this device.' : !sy.hasPasscode ? 'Enter your passcode to sync your phone and laptop.' : sy.error || `Synced${sy.lastSynced ? ` at ${new Date(sy.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}.${sy.pending ? ` ${sy.pending} waiting.` : ''}`;
  g.fillStyle = sy.connected && !sy.error ? green : soft; g.font = `400 23px ${FONT}`; g.textBaseline = 'alphabetic';
  wrap(g, status, W - 60, 3).forEach((l, i) => { g.fillText(l, 30, y + i * 30); });
  y += Math.min(3, wrap(g, status, W - 60, 3).length) * 30 + 6;
  if (sy.available) {
    g.fillStyle = '#fffaf0'; rr(g, 30, y, W - 220, 60, 30); g.fill(); g.lineWidth = 3; g.strokeStyle = document.activeElement === passInput ? green : '#d4c19c'; g.stroke();
    g.font = `400 24px ${FONT}`; g.textBaseline = 'middle';
    caretText(g, 54, y + 31, passInput?.value || '', sy.hasPasscode ? 'New passcode' : 'Passcode', passInput, W - 270, ink, soft, true);
    p.hits.push({ x: 30, y, w: W - 220, h: 60, fn: () => focusTyper(passInput), keep: true });
    pill(p, W - 180, y, 150, 60, sy.hasPasscode ? 'Update' : 'Connect', { fill: green, text: '#fff', fn: () => {
      const inp = fb('form[data-form="passcode"] input[name="passcode"]'); const form = fb('form[data-form="passcode"]');
      if (!inp || !form || !passInput.value) { focusTyper(passInput); return; }
      inp.value = passInput.value; passInput.value = ''; form.requestSubmit();
    } });
    y += 76;
    if (sy.hasPasscode) {
      pill(p, 30, y, 200, 54, 'Sync now', { stroke: green, text: green, fn: () => press('[data-action="sync-now"]') });
      pill(p, 244, y, W - 274, 54, 'Sign out here', { stroke: soft, text: soft, fn: () => press('[data-action="forget-pass"]') });
      y += 70;
    }
  }
  // backups
  y += 18; section('Backups', y); y += 30;
  pill(p, 30, y, (W - 74) / 2, 58, 'Download', { stroke: brass, fill: '#fff6e0', text: '#7a4e33', fn: () => press('[data-action="export"]') });
  pill(p, 44 + (W - 74) / 2, y, (W - 74) / 2, 58, 'Load a backup', { stroke: brass, fill: '#fff6e0', text: '#7a4e33', fn: () => press('input[data-action="import-file"]') });
  p.maxScroll = 0;
  p.tex.needsUpdate = true;
}

// A single workout, written up on the gym whiteboard.
function drawWorkout(p, it) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = '#24303a', soft = '#6a7680', blue = '#2f5f9a', red = '#c4513f', green = '#3f7a3c';
  g.fillStyle = '#fbfcfd'; g.fillRect(0, 0, W, H);
  p.hits = [];
  pill(p, 24, 22, 230, 56, '← All workouts', { stroke: green, text: green, fn: () => { location.hash = '#/workouts'; } });
  const saved = isSaved(it.id);
  pill(p, W - 236, 22, 100, 56, saved ? '♥' : '♡', { stroke: red, fill: saved ? red : null, text: saved ? '#fff' : red, font: 34, fn: () => toggleSaved(it.id).then(on => toast(on ? 'Added to favorites' : 'Removed from favorites')) });
  pill(p, W - 124, 22, 100, 56, 'Edit', { stroke: blue, text: blue, fn: () => { location.hash = `#/edit/${encodeURIComponent(it.id)}`; } });
  const top = 96, bottom = H - 100;
  g.save(); g.beginPath(); g.rect(0, top, W, bottom - top); g.clip();
  let y = top + 60 - p.scroll;
  g.fillStyle = blue; g.font = `500 54px ${HEAD}`; g.textBaseline = 'alphabetic';
  wrap(g, it.title, W - 60, 3).forEach(l => { g.fillText(l, 28, y); y += 60; });
  const n = (it.blocks || []).reduce((k, b) => k + b.exercises.length, 0);
  const meta = [it.minutes ? `${Math.round(it.minutes)} min` : '', n ? `${n} exercises` : '', it.focus, it.equipment].filter(Boolean).join('  ·  ');
  g.fillStyle = soft; g.font = `400 25px ${FONT}`; wrap(g, meta, W - 60, 2).forEach(l => { g.fillText(l, 30, y - 10); y += 34; });
  const done = lastDone(it.id);
  if (done) { g.fillStyle = green; g.font = `600 24px ${FONT}`; g.fillText(`✓ Last done ${agoLabel(done)}`, 30, y - 6); y += 34; }
  y += 10;
  const scheme = e => (e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.reps ? e.reps : e.sets ? `${e.sets} sets` : '');
  (it.blocks || []).forEach(b => {
    if (b.name) { g.fillStyle = red; g.font = `700 24px ${FONT}`; g.fillText(`${b.name}${b.rounds ? ` · ${b.rounds} rounds` : ''}`.toUpperCase(), 30, y + 10); y += 46; }
    b.exercises.forEach(e => {
      g.fillStyle = ink; g.font = `500 29px ${FONT}`; g.fillText('•', 34, y + 4);
      const sc = scheme(e); g.font = `600 27px ${FONT}`; const sw = sc ? g.measureText(sc).width : 0;
      g.fillStyle = blue; if (sc) g.fillText(sc, W - 30 - sw, y + 4);
      g.fillStyle = ink; g.font = `500 29px ${FONT}`;
      wrap(g, e.name || '', W - 120 - sw, 2).forEach((l, i) => { g.fillText(l, 62, y + 4 + i * 36); if (i) y += 36; });
      if (e.note) { y += 32; g.fillStyle = soft; g.font = `400 23px ${FONT}`; g.fillText(ellipsis(g, e.note, W - 100), 62, y + 4); }
      y += 48;
    });
    y += 10;
  });
  if (it.notes || it.body) { g.fillStyle = soft; g.font = `400 24px ${FONT}`; wrap(g, plainText(it.notes || it.body), W - 60).forEach(l => { g.fillText(l, 30, y); y += 32; }); }
  g.restore();
  p.maxScroll = Math.max(0, y + p.scroll - bottom + 20);
  pill(p, 24, H - 88, W - 48, 70, '▶  Start workout', { fill: green, text: '#fff', font: 30, fn: () => { location.hash = `#/item/${encodeURIComponent(it.id)}/go`; } });
  p.tex.needsUpdate = true;
}

// ---------- the flat form's own fields, painted in 3D ----------
// Editing screens keep their real form in the hidden fallback; tapping a field focuses that
// field (so the phone keyboard, autocorrect and dictation all work) and we paint its value.
const typingIn = () => document.activeElement?.closest?.('.room-fallback') ? document.activeElement : null;
document.addEventListener('input', e => { if (e.target.closest?.('.room-fallback')) for (const p of Object.values(room?.panels || {})) p.dirty = true; });
document.addEventListener('focusout', () => setTimeout(() => { for (const p of Object.values(room?.panels || {})) p.dirty = true; }, 0));

function fieldBox(p, x, y, w, h, el, placeholder, { multiline = false, font = 28 } = {}) {
  const { g } = p;
  const on = el && document.activeElement === el;
  g.fillStyle = '#ffffff'; rr(g, x, y, w, h, 14); g.fill();
  g.lineWidth = 3; g.strokeStyle = on ? '#3f6e3c' : '#ddd3bb'; g.stroke();
  g.save(); g.beginPath(); g.rect(x + 4, y + 4, w - 8, h - 8); g.clip();
  g.font = `400 ${font}px ${FONT}`; g.textBaseline = 'alphabetic';
  const val = el?.value || '';
  const lh = font * 1.4;
  let lines = multiline ? wrap(g, val, w - 40) : [val];
  if (!val) { g.fillStyle = '#9a9a88'; g.fillText(ellipsis(g, placeholder, w - 40), x + 20, y + 20 + font); }
  // keep the end (where you are typing) in view
  const fit = Math.max(1, Math.floor((h - 24) / lh));
  if (lines.length > fit) lines = lines.slice(lines.length - fit);
  if (val) { g.fillStyle = '#2c3a2b'; lines.forEach((l, i) => g.fillText(multiline ? l : ellipsis(g, l, w - 40), x + 20, y + 20 + font + i * lh)); }
  if (on && Math.floor(performance.now() / 500) % 2) {
    const last = lines[lines.length - 1] || '';
    g.fillStyle = '#3f6e3c'; g.fillRect(x + 20 + (val ? Math.min(g.measureText(last).width, w - 44) : 0) + 2, y + 18 + (val ? lines.length - 1 : 0) * lh, 3, font + 8);
  }
  g.restore();
  if (el) p.hits.push({ x, y, w, h, keep: true, fn: () => { el.focus({ preventScroll: true }); try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* ignore */ } } });
}

// A note being written, on a big sheet pinned to the corkboard.
function drawNoteEditor(p) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  g.fillStyle = '#c89a5a'; g.fillRect(0, 0, W, H);
  if (corkDots) corkDots.forEach(([x, y, s, d]) => { g.fillStyle = d ? 'rgba(90,55,25,.35)' : 'rgba(255,230,190,.25)'; g.fillRect(x, y, s, s); });
  g.save(); g.shadowColor = 'rgba(40,20,5,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 6; g.fillStyle = '#fffdf3'; g.fillRect(26, 26, W - 52, H - 52); g.restore();
  g.fillStyle = '#c4513f'; g.beginPath(); g.arc(W / 2, 46, 11, 0, 7); g.fill();
  p.hits = [];
  const form = fb('form[data-form="editor"]');
  const title = fb('form[data-form="editor"] [name="title"]'), cat = fb('form[data-form="editor"] [name="category"]'), body = fb('form[data-form="editor"] [name="body"]');
  const d = editing.draft;
  const cancel = d?.id ? `#/item/${encodeURIComponent(d.id)}` : '#/notes';
  pill(p, 48, 70, 150, 54, 'Cancel', { stroke: '#7a8574', text: '#5e6c57', fn: () => { location.hash = cancel; } });
  pill(p, W - 188, 70, 140, 54, 'Save', { fill: '#3f6e3c', text: '#fffdf3', fn: () => form?.requestSubmit() });
  g.fillStyle = '#2c3a2b'; g.font = `500 44px ${HEAD}`; g.textBaseline = 'alphabetic'; g.fillText(d?.id ? 'Edit note' : 'New note', 50, 182);
  const err = fb('#form-error');
  let y = 200;
  if (err && !err.hidden && err.textContent) { g.fillStyle = '#c4513f'; g.font = `400 22px ${FONT}`; g.fillText(ellipsis(g, err.textContent, W - 110), 52, y + 22); y += 34; }
  fieldBox(p, 48, y, W - 96, 70, title, 'Title', { font: 30 }); y += 86;
  fieldBox(p, 48, y, W - 96, 62, cat, 'Category (Gear, Links, Lists…)', { font: 24 }); y += 76;
  // quick category chips
  let x = 48;
  ['General', 'Healthy living', 'Gear', 'Links', 'Lists'].forEach(c => {
    g.font = `600 21px ${FONT}`; const w = g.measureText(c).width + 28;
    if (x + w > W - 48) return;
    const on = cat?.value === c;
    pill(p, x, y, w, 40, c, { fill: on ? '#3f6e3c' : null, stroke: '#3f6e3c', text: on ? '#fff' : '#3f6e3c', font: 21, fn: () => { if (cat) cat.value = c; } });
    x += w + 8;
  });
  y += 56;
  const del = fb('form[data-form="editor"] [data-action="delete"]');
  fieldBox(p, 48, y, W - 96, H - y - (del ? 130 : 60), body, 'Write anything. “## ” makes a heading, “- ” a list.', { multiline: true, font: 26 });
  if (del) pill(p, 48, H - 112, 200, 54, 'Delete', { stroke: '#c4513f', text: '#c4513f', fn: () => del.click() });
  p.maxScroll = 0;
  p.tex.needsUpdate = true;
}

// Small helper: a row of choice chips that set a fallback form field.
function chipRow(p, x, y, maxW, opts, cur, set, { accent = '#3f6e3c', font = 21 } = {}) {
  const { g } = p;
  let cx = x, cy = y;
  for (const [v, l] of opts) {
    g.font = `600 ${font}px ${FONT}`; const w = g.measureText(l).width + 28;
    if (cx + w > x + maxW) { cx = x; cy += 50; }
    const on = cur === v;
    pill(p, cx, cy, w, 40, l, { fill: on ? accent : null, stroke: accent, text: on ? '#fff' : accent, font, fn: () => set(v) });
    cx += w + 8;
  }
  return cy + 52;
}
const ef = n => fb(`form[data-form="editor"] [name="${n}"]`);
const editorErr = (p, y, W) => {
  const err = fb('#form-error');
  if (err && !err.hidden && err.textContent) { p.g.fillStyle = '#c4513f'; p.g.font = `400 22px ${FONT}`; p.g.textBaseline = 'alphabetic'; p.g.fillText(ellipsis(p.g, err.textContent, W - 110), 52, y + 22); return y + 34; }
  return y;
};

// A workout being written, in marker on the gym whiteboard.
function drawWorkoutEditor(p) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const blue = '#2f5f9a', soft = '#6a7680';
  g.fillStyle = '#fbfcfd'; g.fillRect(0, 0, W, H);
  p.hits = [];
  const d = editing.draft, form = fb('form[data-form="editor"]');
  const cancel = d?.id ? `#/item/${encodeURIComponent(d.id)}` : '#/workouts';
  pill(p, 24, 22, 150, 54, 'Cancel', { stroke: soft, text: soft, fn: () => { location.hash = cancel; } });
  pill(p, W - 164, 22, 140, 54, 'Save', { fill: blue, text: '#fff', fn: () => form?.requestSubmit() });
  g.fillStyle = blue; g.font = `500 42px ${HEAD}`; g.textBaseline = 'alphabetic'; g.fillText(d?.id ? 'Edit workout' : 'New workout', 28, 130);
  let y = editorErr(p, 146, W);
  fieldBox(p, 24, y, W - 48, 64, ef('title'), 'Name, like “Leg day”', { font: 28 }); y += 78;
  const focus = ef('focus');
  y = chipRow(p, 24, y, W - 48, [...(focus?.options || [])].map(o => [o.value, o.textContent]), focus?.value, v => { if (focus) focus.value = v; }, { accent: blue });
  fieldBox(p, 24, y, 180, 58, ef('minutes'), 'Minutes', { font: 24 });
  fieldBox(p, 216, y, W - 240, 58, ef('equipment'), 'Equipment', { font: 24 }); y += 72;
  g.fillStyle = soft; g.font = `400 20px ${FONT}`; g.fillText('One per line: “Squat 3x10 rest 60s”. “Main:” starts a section.', 28, y + 18); y += 30;
  const del = fb('form[data-form="editor"] [data-action="delete"]');
  fieldBox(p, 24, y, W - 48, H - y - (del ? 100 : 30), ef('exercises'), 'Warm-up:\nBike 5 min', { multiline: true, font: 24 });
  if (del) pill(p, 24, H - 84, 180, 56, 'Delete', { stroke: '#c4513f', text: '#c4513f', fn: () => del.click() });
  p.maxScroll = 0;
  p.tex.needsUpdate = true;
}

// A to-do being written, on the desk monitor.
function drawTaskEditor(p, night) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = night ? '#eef0dc' : '#2c3a2b', soft = night ? '#aab3c4' : '#6b7866', accent = night ? '#f3c55c' : '#3f6e3c', on = night ? '#1a2238' : '#fffdf3';
  g.fillStyle = night ? '#1a2440' : '#fffaf0'; g.fillRect(0, 0, W, H);
  p.hits = [];
  const d = editing.draft, form = fb('form[data-form="editor"]');
  const cancel = d?.id ? `#/item/${encodeURIComponent(d.id)}` : '#/todo';
  pill(p, 24, 20, 140, 50, 'Cancel', { stroke: soft, text: soft, fn: () => { location.hash = cancel; } });
  pill(p, W - 144, 20, 120, 50, 'Save', { fill: accent, text: on, fn: () => form?.requestSubmit() });
  g.fillStyle = ink; g.font = `500 36px ${HEAD}`; g.textBaseline = 'alphabetic'; g.fillText(d?.id ? 'Edit to-do' : 'New to-do', W / 2 - g.measureText(d?.id ? 'Edit to-do' : 'New to-do').width / 2, 58);
  let y = editorErr(p, 86, W);
  fieldBox(p, 24, y, W - 48, 58, ef('title'), 'What needs doing?', { font: 26 }); y += 70;
  const due = ef('due'), today = todayISO();
  const dueBtns = [...form?.querySelectorAll('[data-action="set-due"]') || []].map(b => [b.dataset.value, b.textContent]);
  g.fillStyle = soft; g.font = `600 20px ${FONT}`; g.fillText(due?.value ? `Due ${dueLabel(due.value, today) || due.value}` : 'No due date', 28, y + 20); y += 30;
  y = chipRow(p, 24, y, W - 48, dueBtns, due?.value || '', v => { if (due) due.value = v; }, { accent, font: 19 });
  const rep = ef('repeat');
  y = chipRow(p, 24, y - 4, W - 48, [...(rep?.options || [])].map(o => [o.value, o.textContent]), rep?.value, v => { if (rep) rep.value = v; }, { accent, font: 19 });
  const imp = ef('important');
  fieldBox(p, 24, y, W / 2 - 32, 52, ef('list'), 'List (Personal…)', { font: 22 });
  pill(p, W / 2 + 8, y, W / 2 - 32, 52, imp?.checked ? '★ Important' : '☆ Important', { fill: imp?.checked ? accent : null, stroke: accent, text: imp?.checked ? on : accent, font: 21, fn: () => { if (imp) imp.checked = !imp.checked; } });
  y += 64;
  const del = fb('form[data-form="editor"] [data-action="delete"]');
  const rest = H - y - (del ? 80 : 20), half = (rest - 12) / 2;
  fieldBox(p, 24, y, W - 48, half, ef('steps'), 'Steps, one per line (optional)', { multiline: true, font: 22 }); y += half + 12;
  fieldBox(p, 24, y, W - 48, half, ef('note'), 'Notes: details, who to ask…', { multiline: true, font: 22 });
  if (del) pill(p, 24, H - 66, 160, 50, 'Delete', { stroke: '#c4513f', text: '#c4513f', fn: () => del.click() });
  p.maxScroll = 0;
  p.tex.needsUpdate = true;
}

// Training: one exercise at a time on the gym whiteboard, with the rest timer.
function drawTraining(p) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = '#24303a', soft = '#6a7680', blue = '#2f5f9a', red = '#c4513f', green = '#3f7a3c';
  g.fillStyle = '#fbfcfd'; g.fillRect(0, 0, W, H);
  p.hits = [];
  const it = getItem(mode.id);
  if (!it) { p.tex.needsUpdate = true; return; }
  const flat = (it.blocks || []).flatMap(b => b.exercises.map(e => ({ ...e, block: b.name })));
  const i = Math.min(Math.max(0, mode.index), Math.max(0, flat.length - 1));
  const ex = flat[i] || {}, next = flat[i + 1];
  pill(p, 24, 22, 150, 56, '✕ Close', { stroke: soft, text: soft, fn: () => { location.hash = `#/item/${encodeURIComponent(it.id)}`; } });
  g.fillStyle = soft; g.font = `500 26px ${FONT}`; g.textBaseline = 'middle'; g.fillText(ellipsis(g, it.title, W - 220), 194, 50);
  // progress dots
  const pw = W - 48;
  g.fillStyle = '#e3e8ec'; rr(g, 24, 100, pw, 14, 7); g.fill();
  g.fillStyle = green; rr(g, 24, 100, pw * ((i + 1) / Math.max(1, flat.length)), 14, 7); g.fill();
  g.fillStyle = soft; g.font = `600 24px ${FONT}`; g.textBaseline = 'alphabetic';
  g.fillText(`${i + 1} of ${flat.length}${ex.block ? `  ·  ${ex.block.toUpperCase()}` : ''}`, 28, 160);
  g.fillStyle = blue; g.font = `500 64px ${HEAD}`;
  let y = 240;
  wrap(g, ex.name || '', W - 56, 3).forEach(l => { g.fillText(l, 28, y); y += 72; });
  const scheme = [ex.sets && `${ex.sets} sets`, ex.reps && (ex.sets ? `of ${ex.reps}` : ex.reps)].filter(Boolean).join(' ');
  if (scheme) { g.fillStyle = red; g.font = `600 44px ${FONT}`; g.fillText(scheme, 28, y + 10); y += 70; }
  // set tracker: tap a magnet to tick off a set; that starts the rest timer
  const nSets = Math.min(8, parseInt(ex.sets, 10) || 0);
  if (nSets > 1) {
    const doneSets = mode.sets[i] || 0, d = 74, gap = 18;
    for (let k = 0; k < nSets; k++) {
      const cx = 28 + d / 2 + k * (d + gap), cyy = y + d / 2 - 10, on = k < doneSets;
      g.lineWidth = 5; g.strokeStyle = on ? green : '#c9d1d8'; g.beginPath(); g.arc(cx, cyy, d / 2 - 4, 0, 7); g.stroke();
      if (on) { g.fillStyle = green; g.beginPath(); g.arc(cx, cyy, d / 2 - 4, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 14, cyy); g.lineTo(cx - 4, cyy + 11); g.lineTo(cx + 15, cyy - 11); g.stroke(); }
      else { g.fillStyle = soft; g.font = `600 28px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k + 1), cx, cyy + 1); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; }
      p.hits.push({ x: cx - d / 2 - gap / 2, y: cyy - d / 2 - 6, w: d + gap, h: d + 12, fn: () => {
        const was = mode.sets[i] || 0;
        mode.sets[i] = k + 1 === was ? k : k + 1;
        if (mode.sets[i] > was && mode.sets[i] < nSets) startTimer(parseSeconds(ex.rest), () => {});
        else if (mode.sets[i] >= nSets) { stopTimer(); mode.timerLeft = 0; mode.timerTotal = 0; toast(next ? `All sets done. Next up: ${next.name}` : 'All sets done!'); }
      } });
    }
    g.fillStyle = soft; g.font = `400 22px ${FONT}`; g.fillText(doneSets >= nSets ? 'All sets done' : 'Tap a set when you finish it', 28, y + d + 22);
    y += d + 50;
  }
  if (ex.note) { g.fillStyle = soft; g.font = `400 26px ${FONT}`; wrap(g, ex.note, W - 56, 3).forEach(l => { g.fillText(l, 28, y); y += 36; }); }
  // rest timer: a big marker-drawn clock
  const cy = Math.max(y + 150, 640), r = 120;
  const timerOn = Boolean(mode.timer) || (mode.timerLeft > 0 && mode.timerTotal);
  g.lineWidth = 14; g.strokeStyle = '#e3e8ec'; g.beginPath(); g.arc(W / 2, cy, r, 0, 7); g.stroke();
  if (timerOn) {
    g.strokeStyle = mode.timerLeft === 0 ? green : blue; g.beginPath(); g.arc(W / 2, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (mode.timerLeft / (mode.timerTotal || 1))); g.stroke();
    g.fillStyle = ink; g.font = `600 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(mode.timerLeft === 0 ? 'Go!' : `${Math.floor(mode.timerLeft / 60)}:${String(mode.timerLeft % 60).padStart(2, '0')}`, W / 2, cy); g.textAlign = 'left';
    p.hits.push({ x: W / 2 - r, y: cy - r, w: r * 2, h: r * 2, fn: () => press('[data-action="timer-stop"]') });
    g.fillStyle = soft; g.font = `400 22px ${FONT}`; g.textAlign = 'center'; g.fillText(mode.timerLeft === 0 ? 'Tap to close' : 'Tap to stop', W / 2, cy + r + 34); g.textAlign = 'left';
    if (mode.timer) {
      pill(p, W / 2 - r - 130, cy - 32, 110, 64, '−15s', { stroke: blue, text: blue, font: 26, fn: () => addTime(-15) });
      pill(p, W / 2 + r + 20, cy - 32, 110, 64, '+15s', { stroke: blue, text: blue, font: 26, fn: () => addTime(15) });
    }
  } else {
    g.fillStyle = blue; g.font = `600 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Rest', W / 2, cy - 18); g.font = `400 28px ${FONT}`; g.fillText(ex.rest || '90s', W / 2, cy + 24); g.textAlign = 'left';
    p.hits.push({ x: W / 2 - r, y: cy - r, w: r * 2, h: r * 2, fn: () => press('[data-action="timer-start"]') });
    g.fillStyle = soft; g.font = `400 22px ${FONT}`; g.textAlign = 'center'; g.fillText('Tap to start the rest timer', W / 2, cy + r + 34); g.textAlign = 'left';
  }
  if (next) { g.fillStyle = soft; g.font = `400 26px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText(ellipsis(g, `Next: ${next.name}`, W - 56), 28, H - 130); }
  const bw = (W - 64) / 2;
  if (i > 0) pill(p, 24, H - 96, bw, 74, '← Back', { stroke: green, text: green, font: 30, fn: () => press('[data-action="mode-prev"]') });
  if (i < flat.length - 1) pill(p, 40 + bw, H - 96, bw, 74, 'Next →', { fill: green, text: '#fff', font: 30, fn: () => press('[data-action="mode-next"]') });
  else pill(p, 40 + bw, H - 96, bw, 74, '✓ Finish', { fill: green, text: '#fff', font: 30, fn: () => {
    markDone(it.id);
    const mins = mode.startedAt ? Math.round((Date.now() - mode.startedAt) / 60000) : 0;
    toast(mins >= 1 ? `Workout done in ${mins} min. Nice work!` : 'Workout done. Nice work!');
    location.hash = `#/item/${encodeURIComponent(it.id)}`;
  } });
  p.maxScroll = 0;
  p.tex.needsUpdate = true;
}

// A single to-do, opened on the desk monitor.
function drawTask(p, t, night) {
  const { g, canvas } = p, W = canvas.width, H = canvas.height;
  const ink = night ? '#eef0dc' : '#2c3a2b', soft = night ? '#aab3c4' : '#6b7866', accent = night ? '#f3c55c' : '#3f6e3c', on = night ? '#1a2238' : '#fffdf3';
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, night ? '#1f2a4a' : '#fffaf0'); bg.addColorStop(1, night ? '#151d36' : '#f3eedc');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  p.hits = [];
  const today = todayISO();
  pill(p, 24, 24, 150, 56, '← To-do', { fill: accent, text: on, fn: () => { location.hash = '#/todo'; } });
  pill(p, W - 140, 24, 116, 56, 'Edit', { stroke: accent, text: accent, fn: () => { location.hash = `#/edit/${encodeURIComponent(t.id)}`; } });
  const top = 96, bottom = H - 8;
  g.save(); g.beginPath(); g.rect(0, top, W, bottom - top); g.clip();
  const off = p.scroll, hit = h => { if (h.y + h.h > top && h.y < bottom) p.hits.push(h); };
  // big checkbox + title
  g.lineWidth = 4; g.strokeStyle = t.done ? accent : soft; rr(g, 28, 120 - off, 56, 56, 16); g.stroke();
  if (t.done) { g.fillStyle = accent; rr(g, 28, 120 - off, 56, 56, 16); g.fill(); g.strokeStyle = on; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 148 - off); g.lineTo(52, 161 - off); g.lineTo(73, 135 - off); g.stroke(); }
  hit({ x: 20, y: 112 - off, w: 72, h: 72, fn: () => toggleTask(t.id).then(m => m && toast(m)) });
  g.fillStyle = ink; g.font = `500 44px ${HEAD}`; g.textBaseline = 'alphabetic';
  let y = 164 - off;
  wrap(g, t.title, W - 130, 3).forEach(l => { g.fillText(l, 104, y); y += 52; });
  if (t.done) { g.fillStyle = soft; g.font = `400 24px ${FONT}`; g.fillText('Done', 104, y); y += 34; }
  y += 6;
  // star + facts
  const star = t.important;
  if (y + 54 > top) pill(p, 28, y, 220, 54, star ? '★ Important' : '☆ Mark important', { fill: star ? '#f2a43a' : null, stroke: '#f2a43a', text: star ? '#fff' : '#c88a1a', font: 23, fn: () => toggleStar(t.id) });
  y += 80;
  const facts = [
    t.due ? ['When', dueLabel(t.due, today), !t.done && t.due < today] : null,
    t.repeat ? ['Repeats', { daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week', biweekly: 'Every 2 weeks', monthly: 'Every month', yearly: 'Every year' }[t.repeat] || t.repeat] : null,
    t.list ? ['List', `#${t.list}`] : null,
  ].filter(Boolean);
  facts.forEach(([k, v, late]) => {
    g.fillStyle = soft; g.font = `600 21px ${FONT}`; g.fillText(k.toUpperCase(), 30, y);
    g.fillStyle = late ? '#c4513f' : ink; g.font = `500 28px ${FONT}`; g.fillText(v, 200, y + 2); y += 46;
  });
  // steps
  if (t.steps?.length) {
    y += 10; g.fillStyle = soft; g.font = `600 21px ${FONT}`; g.fillText(`STEPS  ${t.steps.filter(s => s.done).length}/${t.steps.length}`, 30, y); y += 20;
    t.steps.forEach((st, i) => {
      g.lineWidth = 3; g.strokeStyle = st.done ? accent : soft; rr(g, 30, y + 10, 36, 36, 10); g.stroke();
      if (st.done) { g.fillStyle = accent; rr(g, 30, y + 10, 36, 36, 10); g.fill(); }
      g.fillStyle = st.done ? soft : ink; g.font = `400 26px ${FONT}`; const tx = ellipsis(g, st.text, W - 120); g.fillText(tx, 82, y + 38);
      if (st.done) g.fillRect(82, y + 30, g.measureText(tx).width, 2.5);
      hit({ x: 20, y: y + 2, w: W - 40, h: 52, fn: () => toggleStep(t.id, i) });
      y += 56;
    });
  }
  if (t.note) {
    y += 16; g.fillStyle = soft; g.font = `600 21px ${FONT}`; g.fillText('NOTES', 30, y); y += 38;
    g.fillStyle = ink; g.font = `400 25px ${FONT}`;
    wrap(g, plainText(t.note), W - 60).forEach(l => { g.fillText(l, 30, y); y += 34; });
  }
  if (t.sourceUrl) { y += 10; g.fillStyle = accent; g.font = `400 24px ${FONT}`; g.fillText(ellipsis(g, t.sourceUrl, W - 60), 30, y); hit({ x: 24, y: y - 30, w: W - 48, h: 44, fn: () => window.open(t.sourceUrl, '_blank', 'noopener') }); }
  g.restore();
  p.maxScroll = Math.max(0, y + off + 40 - bottom);
  if (p.maxScroll > 0) { const frac = (bottom - top) / (bottom - top + p.maxScroll), bh = (bottom - top) * frac; g.fillStyle = night ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.15)'; rr(g, W - 10, top + (bottom - top - bh) * (off / p.maxScroll), 6, bh, 3); g.fill(); }
  p.tex.needsUpdate = true;
}

function office(night) {
  const scene = new THREE.Scene();
  const W = 8, D = 8;
  shell(scene, { w: W, d: D, wall: night ? 0xa8b48e : 0xdfe5c8, floorMap: plankTexture('#b98a5a', '#9a6e44'), ceiling: 0xf6f0e0 });
  scene.children[0].material.map.repeat.set(3, 3);
  lights(scene, night);
  const spots = [];
  // desk with a tall monitor (the To-do screen), keyboard, lamp and mug
  const desk = new THREE.Group();
  box(2.4, 0.08, 0.9, 0x8a5a3a, 0, 0.78, 0.45, desk);
  [[-1.1, 0.1], [1.1, 0.1], [-1.1, 0.8], [1.1, 0.8]].forEach(([x, z]) => box(0.07, 0.76, 0.07, 0x6b4430, x, 0.38, z, desk));
  box(0.6, 0.6, 0.8, 0x7a4e33, 0.75, 0.42, 0.45, desk);
  const monitor = new THREE.Group();
  box(0.68, 1.06, 0.05, 0x2b2f36, 0, 0, -0.03, monitor);
  cyl(0.04, 0.05, 0.3, 0x2b2f36, 0, -0.62, -0.08, monitor, 10); box(0.34, 0.03, 0.22, 0x2b2f36, 0, -0.77, -0.06, monitor);
  const todoPanel = makePanel(0.6, 0.96, 640, 1024);
  monitor.add(todoPanel.mesh); todoPanel.mesh.position.z = 0.001;
  monitor.position.set(-0.2, 1.4, 0.32); desk.add(monitor);
  const screenGlow = new THREE.PointLight(night ? 0x9ac8ff : 0xfff6e0, night ? 2 : 0.6, 2.5); screenGlow.position.set(-0.2, 1.4, 0.8); desk.add(screenGlow);
  box(0.6, 0.025, 0.2, 0xe9e4d6, -0.2, 0.83, 0.7, desk);
  const lamp = new THREE.Group();
  cyl(0.12, 0.14, 0.03, 0x2b4a3a, 0, 0, 0, lamp); const arm = cyl(0.015, 0.015, 0.5, 0x2b4a3a, 0, 0.25, 0, lamp, 6); arm.rotation.z = 0.25;
  const head = cyl(0.06, 0.14, 0.16, 0x2b4a3a, -0.1, 0.5, 0, lamp, 12); head.rotation.z = 0.7;
  const lampLight = new THREE.PointLight(0xffd08a, night ? 5 : 2, 3, 1.6); lampLight.position.set(-0.2, 0.4, 0); lamp.add(lampLight);
  lamp.position.set(0.85, 0.83, 0.3); desk.add(lamp);
  cyl(0.06, 0.05, 0.12, 0xc4513f, 0.55, 0.88, 0.7, desk, 12);
  const chair = new THREE.Group();
  box(0.55, 0.08, 0.55, 0x3a6a8a, 0, 0.5, 0, chair); box(0.55, 0.6, 0.08, 0x3a6a8a, 0, 0.85, 0.26, chair); cyl(0.04, 0.04, 0.45, 0x3a3f47, 0, 0.25, 0, chair, 8);
  chair.position.set(-0.1, 0, 1.4); desk.add(chair);
  onWall(desk, 'back', -1.1, W, D); scene.add(desk);
  const steam = smoke(scene, desk.localToWorld(new THREE.Vector3(0.55, 0.96, 0.7)), 4);
  // tall corkboard (Notes)
  const board = new THREE.Group();
  box(1.32, 1.82, 0.03, 0x7a4e33, 0, 0, 0, board);
  const boardPanel = makePanel(1.2, 1.7, 768, 1088);
  board.add(boardPanel.mesh); boardPanel.mesh.position.z = 0.02;
  board.position.y = 1.65; onWall(board, 'back', 2.0, W, D); scene.add(board);
  // wall clock between the desk and the corkboard, with real hands
  const clock = new THREE.Group();
  cyl(0.24, 0.24, 0.05, 0x7a4e33, 0, 0, 0, clock, 28).rotation.x = Math.PI / 2;
  cyl(0.21, 0.21, 0.02, 0xfffaf0, 0, 0, 0.03, clock, 28).rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(i % 3 ? 0.012 : 0.02, i % 3 ? 0.03 : 0.05, 0.01, 0x2c3a2b, Math.sin(a) * 0.17, Math.cos(a) * 0.17, 0.045, clock).rotation.z = -a; }
  const hand = (len, wid, color, z) => { const h = new THREE.Group(); box(wid, len, 0.008, color, 0, len / 2 - 0.02, 0, h); h.position.z = z; clock.add(h); return h; };
  const hourHand = hand(0.1, 0.022, 0x2c3a2b, 0.05), minHand = hand(0.155, 0.014, 0x2c3a2b, 0.056), secHand = hand(0.17, 0.006, 0xc4513f, 0.062);
  cyl(0.015, 0.015, 0.03, 0xc4513f, 0, 0, 0.06, clock, 10).rotation.x = Math.PI / 2;
  clock.position.y = 2.35; onWall(clock, 'back', 0.65, W, D); scene.add(clock);
  const setClock = () => { const d = new Date(), s = d.getSeconds(), m = d.getMinutes() + s / 60, h = d.getHours() % 12 + m / 60; secHand.rotation.z = -s / 60 * Math.PI * 2; minHand.rotation.z = -m / 60 * Math.PI * 2; hourHand.rotation.z = -h / 12 * Math.PI * 2; };
  setClock();
  // bookshelf, plant, window
  const shelf = new THREE.Group();
  box(1.0, 2.1, 0.32, 0x7a4e33, 0, 1.05, 0.16, shelf);
  const spines = [0xc4513f, 0x3a6a8a, 0xf0d39a, 0x5f7f5a, 0x8a5a9a];
  [0.35, 0.95, 1.55].forEach((y, r) => { for (let i = 0; i < 6; i++) box(0.12, 0.36, 0.24, spines[(i + r) % 5], -0.35 + i * 0.14, y + 0.2, 0.18, shelf); });
  onWall(shelf, 'left', -1.6, W, D); scene.add(shelf);
  plant(-3.3, -3.3, scene, 1.3);
  const win = windowPane(night ? 0x1d2a52 : 0xa9d4ef, night, scene, 1.4, 1.2); win.position.y = 1.7; onWall(win, 'right', -1.4, W, D);
  const back = door({ color: 0x7b8f4a }); onWall(back, 'front', 0, W, D); scene.add(back);
  scene.updateMatrixWorld(true);
  const at = (o, v) => o.localToWorld(new THREE.Vector3(...v));
  spots.push({ label: 'To-do', sub: 'Monitor', href: '#/todo', pos: at(monitor, [0, 0.6, 0]), target: at(monitor, [0, 0, 1]), mesh: monitor, here: true });
  spots.push({ label: 'Notes', sub: 'Corkboard', href: '#/notes', pos: at(board, [0, 0.98, 0.05]), target: at(board, [0, 0, 1.2]), mesh: board, here: true });
  spots.push({ label: 'Living room', href: '#/', pos: back.localToWorld(new THREE.Vector3(0, 2.52, 0.1)), target: back.localToWorld(new THREE.Vector3(0, 1.2, 0.6)), mesh: back, back: true });
  const panels = { monitor: todoPanel, board: boardPanel };
  const draw = { monitor: () => { if (detailId === 'edit-task') return drawTaskEditor(todoPanel, night); const t = detailId?.startsWith?.('task:') && getItem(detailId.slice(5)); if (t) drawTask(todoPanel, t, night); else drawTodo(todoPanel, night); }, board: () => (detailId === 'edit' ? drawNoteEditor(boardPanel) : drawBoard(boardPanel, night)) };
  let blink = 0;
  return {
    scene, spots, eye: new THREE.Vector3(0, 1.7, 2.4), yawCenter: Math.PI, yawRange: 1.0, pitch: -0.12,
    focus: { monitor: focusOf(todoPanel.mesh), board: focusOf(boardPanel.mesh) },
    panels,
    refresh() { todoPanel.dirty = true; boardPanel.dirty = true; },
    update(dt, t) {
      steam(t);
      setClock();
      const b = Math.floor(t * 2);
      if (b !== blink && document.activeElement === deskInput) { blink = b; todoPanel.dirty = true; }
      if (b !== blink && typingIn()) { blink = b; boardPanel.dirty = true; todoPanel.dirty = true; }
      for (const k of ['monitor', 'board']) if (panels[k].dirty) { panels[k].dirty = false; draw[k](); }
    },
  };
}

const ROOMS = { living: livingRoom, kitchen, gym, office };

// ---------- typing on the monitor ----------
let deskInput = null, searchInput = null, addInput = null, passInput = null, detailId = null;
function focusTyper(el) { el?.focus({ preventScroll: true }); for (const p of Object.values(room?.panels || {})) p.dirty = true; }
function focusSearch() { searchInput?.focus({ preventScroll: true }); if (room?.panels?.whiteboard) room.panels.whiteboard.dirty = true; }
const blurTyping = () => { for (const el of [deskInput, searchInput, addInput, passInput]) if (el && document.activeElement === el) el.blur(); typingIn()?.blur(); };
function focusDesk() { deskInput?.focus({ preventScroll: true }); if (room?.panels) room.panels.monitor.dirty = true; }
async function submitDesk() {
  const text = deskInput?.value.trim();
  if (!text) { focusDesk(); return; }
  const saved = await quickAdd(text);
  if (saved) { deskInput.value = ''; toast(`Added “${saved.title}”`); }
  if (room?.panels) room.panels.monitor.dirty = true;
}

// ---------- engine ----------
function ensure() {
  if (renderer || failed) return renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); } catch { failed = true; document.body.classList.add('world-failed'); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host = document.getElementById('world');
  signs = document.getElementById('signs');
  host.append(renderer.domElement);
  deskInput = document.createElement('input');
  deskInput.className = 'lib-hidden-input'; deskInput.id = 'desk-input';
  deskInput.setAttribute('aria-label', 'Add a to-do'); deskInput.setAttribute('enterkeyhint', 'done'); deskInput.autocomplete = 'off';
  document.body.append(deskInput);
  deskInput.addEventListener('input', () => { if (room?.panels) room.panels.monitor.dirty = true; });
  deskInput.addEventListener('blur', () => { if (room?.panels) room.panels.monitor.dirty = true; });
  deskInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitDesk(); } });
  searchInput = document.createElement('input');
  searchInput.className = 'lib-hidden-input'; searchInput.id = 'gym-search'; searchInput.type = 'search';
  searchInput.setAttribute('aria-label', 'Search workouts'); searchInput.setAttribute('enterkeyhint', 'search'); searchInput.autocomplete = 'off';
  document.body.append(searchInput);
  const dirtyBoard = () => { const p = room?.panels?.whiteboard; if (p) { p.dirty = true; p.scroll = 0; } };
  searchInput.addEventListener('input', dirtyBoard);
  searchInput.addEventListener('blur', () => { if (room?.panels?.whiteboard) room.panels.whiteboard.dirty = true; });
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchInput.blur(); } });
  addInput = document.createElement('textarea');
  addInput.className = 'lib-hidden-input'; addInput.id = 'add-input'; addInput.setAttribute('aria-label', 'Paste a link or the caption text'); addInput.autocapitalize = 'off'; addInput.spellcheck = false;
  passInput = document.createElement('input');
  passInput.className = 'lib-hidden-input'; passInput.id = 'pass-input'; passInput.type = 'password'; passInput.autocomplete = 'current-password'; passInput.setAttribute('aria-label', 'Sync passcode');
  document.body.append(addInput, passInput);
  for (const el of [addInput, passInput]) {
    el.addEventListener('input', () => { for (const p of Object.values(room?.panels || {})) p.dirty = true; });
    el.addEventListener('blur', () => { for (const p of Object.values(room?.panels || {})) p.dirty = true; });
  }
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; stop(); document.body.classList.remove('world-live'); document.body.classList.add('world-failed'); });
  addEventListener('resize', () => { resize(); wake(); });
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', wake);
  // Drag over the stage to look around (or scroll a screen when zoomed in); tap to use things.
  let down = null;
  document.addEventListener('pointerdown', e => {
    if (!room || !e.target.closest?.('.room-stage') || e.target.closest('a,button,input,select,textarea')) return;
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now() };
  });
  document.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = (e.clientX - down.lx) / innerWidth, dy = e.clientY - down.ly;
    down.lx = e.clientX; down.ly = e.clientY;
    const p = focusName && room.panels?.[focusName];
    if (p) { p.scroll = Math.max(0, Math.min(p.maxScroll, p.scroll - dy * (p.canvas.height / (host.clientHeight * 0.9)))); p.dirty = true; }
    else { yawVel += dx * 2.2; heldAt = performance.now(); }
    wake();
  });
  document.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 450) tapAt(e.clientX, e.clientY);
    down = null;
  });
  document.addEventListener('pointercancel', () => { down = null; });
  addEventListener('wheel', e => {
    const p = focusName && room?.panels?.[focusName];
    if (!p || !e.target.closest?.('.room-stage')) return;
    p.scroll = Math.max(0, Math.min(p.maxScroll, p.scroll + e.deltaY)); p.dirty = true; wake();
  }, { passive: true });
  signs.addEventListener('click', e => {
    const a = e.target.closest('a[data-spot]');
    if (!a) return;
    e.preventDefault();
    walkTo(room?.spots[Number(a.dataset.spot)], a.getAttribute('href'));
  });
  return renderer;
}

const ray = new THREE.Raycaster();
function tapAt(x, y) {
  if (!room) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), room.camera);
  const p = focusName && room.panels?.[focusName];
  if (p) {
    const hit = ray.intersectObject(p.mesh)[0];
    if (!hit?.uv) { blurTyping(); return; }
    const cx = hit.uv.x * p.canvas.width, cy = (1 - hit.uv.y) * p.canvas.height;
    for (let i = p.hits.length - 1; i >= 0; i--) {
      const h = p.hits[i];
      if (cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h) {
        if (!h.keep) blurTyping();
        h.fn(); p.dirty = true; wake(); return;
      }
    }
    blurTyping();
    return;
  }
  for (const s of room.spots) {
    if (ray.intersectObject(s.mesh, true).length) { walkTo(s, s.href); return; }
  }
}

function walkTo(spot, href) {
  if (!spot || flying) return;
  if (reduced || spot.here) { location.hash = href; return; }
  const cam = room.camera;
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  flying = { t: 0, from: cam.position.clone(), to: spot.target.clone(), look0: cam.position.clone().add(dir), look1: spot.pos.clone().setY(1.3), href };
  document.body.classList.add('world-walking');
  wake();
}

function resize() {
  if (!room || !renderer) return;
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  room.camera.aspect = w / h;
  room.camera.fov = w / h < 0.8 ? 68 : 55;
  room.camera.updateProjectionMatrix();
}

function onScroll() {
  const st = document.querySelector('.room-stage');
  const was = stageVisible;
  stageVisible = !st || st.getBoundingClientRect().bottom > 60;
  signs?.classList.toggle('faded', !st || st.getBoundingClientRect().bottom < innerHeight * 0.35);
  if (stageVisible && !was) wake();
}

let focusName = null, snap = true, autoT = 0, heldAt = -1e9;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const want = new THREE.Vector3(), wantLook = new THREE.Vector3();
function frame() {
  raf = 0;
  if (!room) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const cam = room.camera;
  if (flying) {
    flying.t = Math.min(1, flying.t + dt / 0.75);
    const k = flying.t * flying.t * (3 - 2 * flying.t);
    cam.position.lerpVectors(flying.from, flying.to, k);
    cam.lookAt(wantLook.lerpVectors(flying.look0, flying.look1, Math.min(1, k * 1.6)));
    host.style.opacity = String(1 - Math.max(0, (flying.t - 0.6) / 0.4));
    if (flying.t >= 1) { const href = flying.href; flying = null; location.hash = href; }
  } else {
    const f = focusName && room.focus?.[focusName];
    if (f) {
      const tanv = Math.tan((cam.fov * Math.PI) / 360);
      const d = Math.max(f.h / 2 / tanv, f.w / 2 / (tanv * cam.aspect)) * 1.04;
      want.copy(f.center).addScaledVector(f.normal, d);
      wantLook.copy(f.center);
    } else {
      yawUser += yawVel * 0.12; yawVel *= 0.9;
      // the slow look-around holds still for a while after you drag, so it doesn't pull your view away
      if (performance.now() - heldAt > 6000) autoT += dt;
      const auto = reduced ? 0 : Math.sin(autoT * 0.12) * room.yawRange * 0.85;
      yawUser = Math.max(-room.yawRange - auto, Math.min(room.yawRange - auto, yawUser));
      const yaw = room.yawCenter + auto + yawUser;
      want.copy(room.eye); want.y += reduced ? 0 : Math.sin(t * 0.7) * 0.015;
      wantLook.set(room.eye.x + Math.sin(yaw), room.eye.y + room.pitch, room.eye.z + Math.cos(yaw));
    }
    const a = snap || reduced ? 1 : 1 - Math.exp(-dt * 4.5);
    snap = false;
    camPos.lerp(want, a); camLook.lerp(wantLook, a);
    cam.position.copy(camPos); cam.lookAt(camLook);
    room.update(reduced ? 0 : dt, t);
  }
  renderer.render(room.scene, cam);
  placeSigns();
  document.body.classList.add('world-live');
  const settling = camPos.distanceToSquared(want) > 1e-6;
  if (!reduced || flying || settling || room.panels) if (stageVisible && !document.hidden) raf = requestAnimationFrame(frame);
}
function wake() { if (!raf && room && renderer) { if (clock) clock.getDelta(); raf = requestAnimationFrame(frame); } }
function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

const v = new THREE.Vector3();
function placeSigns() {
  if (!signs || !room) return;
  const w = host.clientWidth, h = host.clientHeight;
  const top = host.getBoundingClientRect().top;
  const limit = document.querySelector('.room-stage')?.getBoundingClientRect().bottom ?? h;
  room.spots.forEach((s, i) => {
    const el = signs.children[i];
    if (!el) return;
    v.copy(s.pos).project(room.camera);
    const y = top + (1 - v.y) / 2 * h;
    const on = !focusName && v.z < 1 && Math.abs(v.x) < 1.05 && y > 20 && y < limit - 8;
    el.classList.toggle('off', !on);
    if (on) el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  });
}

function disposeRoom() {
  if (!room) return;
  room.scene.traverse(o => { o.geometry?.dispose(); [].concat(o.material || []).forEach(m => { if (m.map && m.map !== dotTex) m.map.dispose(); m.dispose(); }); });
  room = null;
}

// Show a room (or null to hide the house, e.g. on the Library or an item page).
// focus zooms the camera onto something in the room ('monitor' or 'board' in the office).
export function show(name, theme, focus = null, detail = null) {
  if (!name || theme === 'plain') {
    stop(); disposeRoom(); focusName = null;
    document.body.classList.remove('world-live', 'world-walking');
    if (signs) signs.innerHTML = '';
    blurTyping();
    return;
  }
  if (!ensure()) return;
  const night = theme === 'night';
  const key = `${name}|${theme}`;
  host.style.opacity = '';
  document.body.classList.remove('world-walking');
  if (!room || room.key !== key) {
    stop(); disposeRoom();
    const built = ROOMS[name](night);
    room = { ...built, key, camera: new THREE.PerspectiveCamera(60, 1, 0.05, 60) };
    room.scene.background = new THREE.Color(night ? 0x1a1410 : 0xf3e6cc);
    room.scene.updateMatrixWorld(true);
    clock = new THREE.Clock();
    yawUser = 0; yawVel = 0; flying = null; snap = false; autoT = 0; heldAt = -1e9;
    camPos.copy(room.eye); camLook.set(room.eye.x + Math.sin(room.yawCenter), room.eye.y + room.pitch, room.eye.z + Math.cos(room.yawCenter));
    signs.innerHTML = room.spots.map((s, i) => `<a class="sign ${s.back ? 'sign-back' : ''} ${s.plaque ? 'sign-3d' : ''}" data-spot="${i}" href="${s.href}"><strong>${s.back ? '← ' : ''}${s.label}</strong>${s.sub ? `<small>${s.sub}</small>` : ''}</a>`).join('');
  }
  if ((focus !== focusName || detail !== detailId) && room.panels) { for (const p of Object.values(room.panels)) { p.scroll = 0; p.open = null; } }
  detailId = detail;
  focusName = room.focus?.[focus] ? focus : null;
  if (focusName !== 'monitor' && document.activeElement === deskInput) deskInput.blur();
  if (focusName !== 'whiteboard' && document.activeElement === searchInput) searchInput.blur();
  if (focusName !== 'notepad' && document.activeElement === addInput) addInput.blur();
  if (focusName !== 'panel' && document.activeElement === passInput) passInput.blur();
  room.refresh?.();
  resize(); onScroll(); wake();
}
