// The house: a cozy living room (Home) with doors to the kitchen (Recipes), the gym
// (Workouts), the office (To-do and Notes) and the Library. Each room is a small three.js
// scene drawn on one shared canvas that sits fixed behind the page. The camera pans
// slowly on its own; drag to look around, tap a door (or its sign) to walk through.
// Signs are real links laid over the canvas, so everything still works by keyboard and
// screen reader, and the page keeps a plain list of doors in case WebGL is unavailable.
import * as THREE from '../vendor/three.module.min.js';

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

function door({ color = 0x8a5a3a, frame = 0xf3ead8, sign = 0xf6e7c4, arch = false, double = false, glass = false, peek = null }) {
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
  box(0.62, 0.2, 0.03, sign, 0, H + 0.32, 0.06, g);
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
  const mug = cyl(0.07, 0.06, 0.13, 0xf6efe0, 0.25, 0.53, 0.05, table, 12);
  box(0.32, 0.05, 0.24, 0x3a6a8a, -0.25, 0.48, 0, table); box(0.3, 0.04, 0.22, 0xc4513f, -0.24, 0.52, 0.01, table);
  table.position.set(0, 0, -1.5); scene.add(table);
  const steam = smoke(scene, new THREE.Vector3(0.25, 0.62, -1.45), 5);
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
    const g = door(d.opts); onWall(g, d.side, d.along, W, D); scene.add(g);
    const pos = g.localToWorld(new THREE.Vector3(0, 2.5, 0.1));
    g.updateMatrixWorld(); pos.copy(g.localToWorld(new THREE.Vector3(0, 2.52, 0.1)));
    spots.push({ ...d, pos, target: g.localToWorld(new THREE.Vector3(0, 1.2, 0.6)), mesh: g });
  });

  return {
    scene, spots, eye: new THREE.Vector3(0, 1.65, 3.4), yawCenter: Math.PI, yawRange: 1.55, pitch: -0.14,
    update(dt, t) {
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
  // mirror wall
  const mirror = box(5, 1.8, 0.03, glow(night ? 0x5a6a80 : 0xcfe2ea), 0, 1.5, 0.02);
  const mg = new THREE.Group(); mg.add(mirror); box(5.1, 0.06, 0.05, 0x9aa3ab, 0, 2.42, 0.03, mg); box(5.1, 0.06, 0.05, 0x9aa3ab, 0, 0.58, 0.03, mg);
  onWall(mg, 'back', 0, W, D); scene.add(mg);
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
  onWall(rack, 'back', 0, W, D); rack.position.z += 0.2; scene.add(rack);
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
  return {
    scene, spots, eye: new THREE.Vector3(0, 1.7, 2.8), yawCenter: Math.PI, yawRange: 1.1, pitch: -0.24,
    update(dt, t) {
      bagPivot.rotation.z = Math.sin(t * 1.1) * 0.06; bagPivot.rotation.x = Math.sin(t * 0.8) * 0.04;
      hand2.parent.rotation.z = 0; hand2.rotation.z = -t; hand2.position.set(Math.sin(t) * 0.07, Math.cos(t) * 0.07, 0.02);
      void chain; void bag; void hand;
    },
  };
}

function office(night) {
  const scene = new THREE.Scene();
  const W = 8, D = 8;
  shell(scene, { w: W, d: D, wall: night ? 0xa8b48e : 0xdfe5c8, floorMap: plankTexture('#b98a5a', '#9a6e44'), ceiling: 0xf6f0e0 });
  scene.children[0].material.map.repeat.set(3, 3);
  lights(scene, night);
  const spots = [];
  // desk with a laptop, lamp, mug and the to-do clipboard
  const desk = new THREE.Group();
  box(2.4, 0.08, 0.9, 0x8a5a3a, 0, 0.78, 0.45, desk);
  [[-1.1, 0.1], [1.1, 0.1], [-1.1, 0.8], [1.1, 0.8]].forEach(([x, z]) => box(0.07, 0.76, 0.07, 0x6b4430, x, 0.38, z, desk));
  box(0.6, 0.6, 0.8, 0x7a4e33, 0.75, 0.42, 0.45, desk);
  const laptop = new THREE.Group();
  box(0.6, 0.03, 0.4, 0x9aa3ab, 0, 0, 0, laptop);
  const screen = box(0.6, 0.4, 0.02, 0x9aa3ab, 0, 0.2, -0.2, laptop); screen.rotation.x = -0.2;
  const glowScreen = box(0.54, 0.34, 0.01, glow(night ? 0x9ac8ff : 0xdff0ff), 0, 0.2, -0.185, laptop); glowScreen.rotation.x = -0.2;
  laptop.position.set(-0.1, 0.84, 0.45); desk.add(laptop);
  const lamp = new THREE.Group();
  cyl(0.12, 0.14, 0.03, 0x2b4a3a, 0, 0, 0, lamp); const arm = cyl(0.015, 0.015, 0.5, 0x2b4a3a, 0, 0.25, 0, lamp, 6); arm.rotation.z = 0.25;
  const head = cyl(0.06, 0.14, 0.16, 0x2b4a3a, -0.1, 0.5, 0, lamp, 12); head.rotation.z = 0.7;
  const lampLight = new THREE.PointLight(0xffd08a, night ? 5 : 2, 3, 1.6); lampLight.position.set(-0.2, 0.4, 0); lamp.add(lampLight);
  lamp.position.set(0.85, 0.83, 0.3); desk.add(lamp);
  const mugD = cyl(0.06, 0.05, 0.12, 0xc4513f, 0.55, 0.88, 0.7, desk, 12);
  // clipboard (To-do)
  const clip = new THREE.Group();
  box(0.36, 0.02, 0.48, 0x9a6e44, 0, 0, 0, clip); box(0.3, 0.01, 0.4, 0xffffff, 0, 0.015, 0.02, clip); box(0.12, 0.03, 0.05, 0x9aa3ab, 0, 0.02, -0.22, clip);
  for (let i = 0; i < 4; i++) { box(0.035, 0.012, 0.035, i < 2 ? 0x5f9a45 : 0xc8c8c8, -0.1, 0.022, -0.1 + i * 0.09, clip); box(0.15, 0.012, 0.012, 0x888888, 0.03, 0.022, -0.1 + i * 0.09, clip); }
  clip.position.set(-0.85, 0.83, 0.65); clip.rotation.y = 0.2; desk.add(clip);
  // chair
  const chair = new THREE.Group();
  box(0.55, 0.08, 0.55, 0x3a6a8a, 0, 0.5, 0, chair); box(0.55, 0.6, 0.08, 0x3a6a8a, 0, 0.85, 0.26, chair); cyl(0.04, 0.04, 0.45, 0x3a3f47, 0, 0.25, 0, chair, 8);
  chair.position.set(-0.1, 0, 1.3); desk.add(chair);
  onWall(desk, 'back', -0.6, W, D); scene.add(desk);
  const steam = smoke(scene, desk.localToWorld(new THREE.Vector3(0.55, 0.96, 0.7)), 4);
  // corkboard (Notes) with pinned papers
  const board = new THREE.Group();
  box(1.6, 1.05, 0.05, 0xc89a5a, 0, 0, 0.02, board); box(1.7, 1.15, 0.03, 0x7a4e33, 0, 0, 0.0, board);
  const papers = [];
  [[-0.5, 0.22, 0xfff3c8, 0.1], [-0.05, 0.25, 0xffffff, -0.08], [0.45, 0.18, 0xf6dcd3, 0.12], [-0.35, -0.24, 0xe1ead0, -0.1], [0.2, -0.22, 0xfff3c8, 0.06], [0.58, -0.28, 0xdff0ff, -0.05]].forEach(([x, y, c, r]) => {
    const p = box(0.34, 0.38, 0.01, c, x, y, 0.06, board); p.rotation.z = r; papers.push(p);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0xc4513f)); pin.position.set(x, y + 0.15, 0.08); board.add(pin);
  });
  board.position.y = 2.0; onWall(board, 'back', -0.6, W, D); scene.add(board);
  // bookshelf, plant, window, a radiator cat bed
  const shelf = new THREE.Group();
  box(1.0, 2.1, 0.32, 0x7a4e33, 0, 1.05, 0.16, shelf);
  const spines = [0xc4513f, 0x3a6a8a, 0xf0d39a, 0x5f7f5a, 0x8a5a9a];
  [0.35, 0.95, 1.55].forEach((y, r) => { for (let i = 0; i < 6; i++) box(0.12, 0.36, 0.24, spines[(i + r) % 5], -0.35 + i * 0.14, y + 0.2, 0.18, shelf); });
  onWall(shelf, 'left', -1.6, W, D); scene.add(shelf);
  plant(3.3, -3.3, scene, 1.4);
  const win = windowPane(night ? 0x1d2a52 : 0xa9d4ef, night, scene, 1.4, 1.2); win.position.y = 1.7; onWall(win, 'right', -1.4, W, D);
  const back = door({ color: 0x7b8f4a }); onWall(back, 'front', 0, W, D); scene.add(back);
  const at = (o, v) => o.localToWorld(new THREE.Vector3(...v));
  desk.updateMatrixWorld(true); board.updateMatrixWorld(true);
  spots.push({ label: 'To-do', sub: 'Clipboard', href: '#/todo', pos: at(desk, [-0.85, 1.05, 0.65]), target: at(desk, [-0.6, 1.4, 1.6]), mesh: clip });
  spots.push({ label: 'Notes', sub: 'Corkboard', href: '#/notes', pos: at(board, [0, 0.72, 0.1]), target: at(board, [0, -0.2, 1.4]), mesh: board });
  spots.push({ label: 'Living room', href: '#/', pos: back.localToWorld(new THREE.Vector3(0, 2.52, 0.1)), target: back.localToWorld(new THREE.Vector3(0, 1.2, 0.6)), mesh: back, back: true });
  return {
    scene, spots, eye: new THREE.Vector3(0, 1.7, 2.4), yawCenter: Math.PI, yawRange: 1.0, pitch: -0.16,
    update(dt, t) { steam(t); papers.forEach((p, i) => { p.rotation.z += Math.sin(t * 1.5 + i) * 0.0008; }); void mugD; },
  };
}

const ROOMS = { living: livingRoom, kitchen, gym, office };

// ---------- engine ----------
function ensure() {
  if (renderer || failed) return renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' }); } catch { failed = true; return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host = document.getElementById('world');
  signs = document.getElementById('signs');
  host.append(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; stop(); document.body.classList.remove('world-live'); });
  addEventListener('resize', () => { resize(); wake(); });
  addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', wake);
  // Drag anywhere over the room stage to look around; tap a door to walk through.
  let down = null;
  document.addEventListener('pointerdown', e => {
    if (!room || !e.target.closest?.('.room-stage') || e.target.closest('a,button,input,select,textarea')) return;
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, t: performance.now() };
  });
  document.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = (e.clientX - down.lx) / innerWidth;
    down.lx = e.clientX;
    yawVel += dx * 2.2;
    wake();
  });
  document.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 450) tapAt(e.clientX, e.clientY);
    down = null;
  });
  document.addEventListener('pointercancel', () => { down = null; });
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
  for (const s of room.spots) {
    if (ray.intersectObject(s.mesh, true).length) { walkTo(s, s.href); return; }
  }
}

function walkTo(spot, href) {
  if (!spot || flying) return;
  if (reduced) { location.hash = href; return; }
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

const tmp = new THREE.Vector3();
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
    cam.lookAt(tmp.lerpVectors(flying.look0, flying.look1, Math.min(1, k * 1.6)));
    host.style.opacity = String(1 - Math.max(0, (flying.t - 0.6) / 0.4));
    if (flying.t >= 1) { const href = flying.href; flying = null; location.hash = href; }
  } else {
    yawUser += yawVel * 0.12; yawVel *= 0.9;
    const auto = reduced ? 0 : Math.sin(t * 0.09) * room.yawRange * 0.85;
    yawUser = Math.max(-room.yawRange - auto, Math.min(room.yawRange - auto, yawUser));
    const yaw = room.yawCenter + auto + yawUser;
    cam.position.copy(room.eye);
    cam.position.y += reduced ? 0 : Math.sin(t * 0.7) * 0.015;
    cam.lookAt(tmp.set(room.eye.x + Math.sin(yaw), room.eye.y + room.pitch, room.eye.z + Math.cos(yaw)));
    if (!reduced) room.update(dt, t);
  }
  renderer.render(room.scene, cam);
  placeSigns();
  document.body.classList.add('world-live');
  if (!reduced || flying) if (stageVisible && !document.hidden) raf = requestAnimationFrame(frame);
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
    const on = v.z < 1 && Math.abs(v.x) < 1.05 && y > 70 && y < limit - 8;
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
export function show(name, theme) {
  if (!name || theme === 'plain') {
    stop(); disposeRoom();
    document.body.classList.remove('world-live', 'world-walking');
    if (signs) signs.innerHTML = '';
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
    yawUser = 0; yawVel = 0; flying = null;
    signs.innerHTML = room.spots.map((s, i) => `<a class="sign ${s.back ? 'sign-back' : ''}" data-spot="${i}" href="${s.href}"><strong>${s.back ? '← ' : ''}${s.label}</strong>${s.sub ? `<small>${s.sub}</small>` : ''}</a>`).join('');
  }
  stage = document.querySelector('.room-stage');
  void stage;
  resize(); onScroll(); wake();
}
