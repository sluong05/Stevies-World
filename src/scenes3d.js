// Small three.js scenes for every tab except the Library (which has its own reading room).
// One shared WebGL canvas moves into whichever `[data-3d]` slot the current page has, so
// re-rendering a page (filters, search, ticking a task) never rebuilds the scene or leaks
// GPU contexts. Scenes pause off screen and in background tabs, hold still for reduced
// motion, and if WebGL is unavailable the page simply keeps its flat look.
import * as THREE from '../vendor/three.module.min.js';

const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer = null;
let failed = false;
let current = null; // { key, slot, scene, camera, update, onDrag, onTap, dispose }
let raf = 0;
let visible = true;
let clock = null;

const css = (el, name, fallback) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
};
const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function ensureRenderer() {
  if (renderer || failed) return renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    failed = true;
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const el = renderer.domElement;
  el.className = 'scene3d-canvas';
  el.setAttribute('aria-hidden', 'true');
  let down = null;
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX }; });
  el.addEventListener('pointermove', e => {
    if (!down || !current?.onDrag) return;
    current.onDrag((e.clientX - down.lx) / el.clientWidth);
    down.lx = e.clientX;
    wake();
  });
  const up = e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 400) { current?.onTap?.(); wake(); }
    down = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('webglcontextlost', e => { e.preventDefault(); teardown(); renderer = null; });
  return renderer;
}

const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  for (const e of entries) visible = e.isIntersecting;
  if (visible) wake();
}) : null;
const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { resize(); wake(); }) : null;
document.addEventListener('visibilitychange', () => wake());

function resize() {
  if (!current || !renderer) return;
  const w = current.slot.clientWidth, h = current.slot.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  current.camera.aspect = w / h;
  current.camera.updateProjectionMatrix();
  current.fit?.(w / h);
}

function frame() {
  raf = 0;
  if (!current || !renderer) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  current.update(reduced ? 0 : dt, t);
  renderer.render(current.scene, current.camera);
  current.slot.classList.add('is-live');
  if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(frame);
}
function wake() { if (!raf && current) raf = requestAnimationFrame(frame); }

function teardown() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (!current) return;
  io?.unobserve(current.slot);
  ro?.unobserve(current.slot);
  current.scene.traverse(o => {
    o.geometry?.dispose();
    [].concat(o.material || []).forEach(m => { m.map?.dispose(); m.dispose(); });
  });
  current.dispose?.();
  current = null;
}

// Called after every page render. Pass the page root (or null to stop).
export function sync(root, theme) {
  const slot = root?.querySelector('[data-3d]');
  if (!slot || theme === 'plain') { if (current) { renderer?.domElement.remove(); teardown(); } return; }
  if (!ensureRenderer()) return;
  const kind = slot.dataset['3d'];
  const key = `${kind}|${theme}|${slot.dataset.time || ''}|${slot.dataset.count || ''}`;
  if (current && current.key === key) {
    // Same scene, new DOM after a re-render: move the canvas into the fresh slot.
    if (current.slot !== slot) {
      io?.unobserve(current.slot); ro?.unobserve(current.slot);
      current.slot = slot;
      io?.observe(slot); ro?.observe(slot);
    }
    if (renderer.domElement.parentNode !== slot) slot.append(renderer.domElement);
    slot.classList.add('is-live');
    resize(); wake();
    return;
  }
  teardown();
  const build = BUILDERS[kind];
  if (!build) return;
  clock = new THREE.Clock();
  current = { key, slot, ...build(slot, theme) };
  slot.append(renderer.domElement);
  io?.observe(slot); ro?.observe(slot);
  visible = true;
  resize(); wake();
}

// ---------- shared bits ----------
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture(a, b, c) {
  const cv = document.createElement('canvas');
  cv.width = 2; cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `#${a.getHexString()}`); grad.addColorStop(0.62, `#${b.getHexString()}`); grad.addColorStop(1, `#${c.getHexString()}`);
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rng(seed) { return () => (seed = (seed * 9301 + 49297) % 233280) / 233280; }

function cloud(mat, rand) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(geo, mat);
    const s = 0.6 + rand() * 0.6;
    m.scale.set(s * 1.2, s, s);
    m.position.set((i - 2.5) * 0.75 + rand() * 0.3, rand() * 0.5 - (Math.abs(i - 2.5) * 0.18), rand() * 0.4);
    g.add(m);
  }
  return g;
}

function hill(width, depth, height, color, seed, z, y) {
  const geo = new THREE.PlaneGeometry(width, depth, 40, 6);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), zz = p.getZ(i);
    const back = (depth / 2 - zz) / depth; // 1 at the back edge, 0 at the front
    p.setY(i, (Math.sin(x * 0.35 + seed) * 0.6 + Math.sin(x * 0.9 + seed * 2) * 0.25 + 0.8) * height * Math.pow(back, 0.7));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, lambert(color));
  m.position.set(0, y, z);
  return m;
}

// ---------- Home: the meadow diorama ----------
function home(slot, theme) {
  const time = slot.dataset.time || 'day';
  const svg = slot.querySelector('.scenery') || slot;
  const col = (n, f) => css(svg, n, f);
  const scene = new THREE.Scene();
  scene.background = skyTexture(col('--sky-a', '#6aa6d8'), col('--sky-b', '#b9dbee'), col('--sky-c', '#eef3df'));
  const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 200);
  const night = time === 'night';
  const lit = time === 'dusk' || night;

  scene.add(new THREE.HemisphereLight(night ? 0x8090c0 : 0xffffff, col('--hill-near-b', '#3e6c33'), night ? 0.9 : 1.6));
  const sunLight = new THREE.DirectionalLight(col('--sun', '#f4c64f').lerp(new THREE.Color(0xffffff), 0.5), night ? 0.5 : 2.2);
  scene.add(sunLight);

  const SUN = { dawn: [-9, 3.5], day: [7, 9], dusk: [9, 4], night: [7, 8.5] }[time] || [7, 9];
  const sun = new THREE.Mesh(new THREE.SphereGeometry(night ? 0.9 : 1.3, 24, 16), new THREE.MeshBasicMaterial({ color: col('--sun', '#f4c64f') }));
  sun.position.set(SUN[0], SUN[1], -40);
  scene.add(sun);
  sunLight.position.set(SUN[0], SUN[1] + 4, 10);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: col('--sun', '#f4c64f'), transparent: true, opacity: 0.6, depthWrite: false }));
  glow.scale.set(9, 9, 1);
  glow.position.copy(sun.position).add(new THREE.Vector3(0, 0, -0.5));
  scene.add(glow);

  let stars = null;
  if (night) {
    const rand = rng(3);
    const pos = [];
    for (let i = 0; i < 160; i++) pos.push((rand() - 0.5) * 120, 4 + rand() * 30, -60);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.35, map: softDot(), transparent: true, depthWrite: false }));
    scene.add(stars);
  }

  const rand = rng(11);
  const cloudMat = lambert(col('--cloud', '#ffffff'), { emissive: col('--cloud', '#ffffff'), emissiveIntensity: night ? 0.3 : 0.35 });
  const clouds = [];
  [[-8, 7, -24, 1.6], [5, 8.5, -30, 2.2], [14, 6, -26, 1.2], [-18, 9, -34, 1.8]].forEach(([x, y, z, s]) => {
    const c = cloud(cloudMat, rand);
    c.position.set(x, y, z); c.scale.setScalar(s);
    c.userData.speed = 0.25 + rand() * 0.25;
    scene.add(c); clouds.push(c);
  });

  scene.add(hill(90, 20, 3.2, col('--ridge', '#a2c3cc'), 1, -24, -1));
  scene.add(hill(70, 16, 2.2, col('--hill-far', '#93ba86'), 4, -14, -1));
  scene.add(hill(50, 14, 1.4, col('--hill-mid', '#6d9f55'), 7, -6, -1));
  const near = hill(40, 14, 0.6, col('--hill-near-a', '#5d9149'), 2, 2, -1);
  scene.add(near);

  // A tree on the far hill
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6), lambert(col('--trunk', '#6b4a32')));
  trunk.position.y = 0.7; tree.add(trunk);
  const leaf = lambert(col('--tree', '#4d7b3c'));
  [[0, 1.8, 0, 0.9], [-0.6, 1.4, 0.1, 0.65], [0.6, 1.45, 0, 0.7], [0.1, 2.4, 0, 0.6]].forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
    m.position.set(x, y, z); tree.add(m);
  });
  tree.position.set(4.5, 0.1, -9);
  scene.add(tree);

  // The little red-roofed house
  const house = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.2), lambert(col('--walls', '#f3ead2')));
  walls.position.y = 0.5; house.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.9, 4), lambert(col('--roof', '#c4513f')));
  roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, 0.95); roof.position.y = 1.45; house.add(roof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), lambert(col('--chimney', '#8a5b46')));
  chimney.position.set(0.45, 1.75, 0); house.add(chimney);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ color: lit ? 0xffd27a : 0x6f8fa8 }));
  win.position.set(-0.35, 0.55, 0.61); house.add(win);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.55), lambert(col('--door', '#7a4e33')));
  door.position.set(0.35, 0.28, 0.61); house.add(door);
  house.position.set(-3.2, -0.2, -3.5);
  house.rotation.y = 0.35;
  scene.add(house);
  if (lit) {
    const lamp = new THREE.PointLight(0xffc870, 3, 6);
    lamp.position.set(-3.2, 0.6, -2.4); scene.add(lamp);
  }

  // Chimney smoke
  const smokeTex = softDot();
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: night ? 0x9aa6c0 : 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.phase = i / 7;
    scene.add(s); puffs.push(s);
  }
  const chimneyTop = new THREE.Vector3();

  // Fireflies at dusk and night, flowers by day
  let flies = null;
  const meadowRand = rng(7);
  if (lit) {
    const n = 26, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (meadowRand() - 0.5) * 14; pos[i * 3 + 1] = 0.2 + meadowRand() * 1.6; pos[i * 3 + 2] = -1 - meadowRand() * 6; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    flies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe98a, size: 0.32, map: softDot(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    flies.userData.base = pos.slice();
    scene.add(flies);
  } else {
    const geo = new THREE.IcosahedronGeometry(0.06, 0);
    const mats = [lambert(col('--flower-a', '#fff3b0')), lambert(col('--flower-b', '#f0a3a3'))];
    for (let i = 0; i < 60; i++) {
      const f = new THREE.Mesh(geo, mats[i % 2]);
      f.position.set((meadowRand() - 0.5) * 16, -0.55 + meadowRand() * 0.3, 0.5 - meadowRand() * 4);
      scene.add(f);
    }
  }

  let yaw = 0, yawVel = 0, distance = 13;
  return {
    scene, camera,
    fit(aspect) { distance = aspect < 1.2 ? 15 : 12; },
    onDrag(dx) { yawVel += dx * 2.4; },
    update(dt, t) {
      yaw += yawVel * Math.min(1, dt * 60) * 0.06;
      yawVel *= 0.92;
      yaw *= 0.995;
      yaw = Math.max(-0.5, Math.min(0.5, yaw));
      const sway = reduced ? 0 : Math.sin(t * 0.15) * 0.06;
      const a = yaw + sway;
      camera.position.set(Math.sin(a) * distance, 2.6, Math.cos(a) * distance - 4);
      camera.lookAt(0, 1.2, -4);
      clouds.forEach(c => { c.position.x += c.userData.speed * dt; if (c.position.x > 26) c.position.x = -26; });
      chimney.getWorldPosition(chimneyTop); chimneyTop.y += 0.3;
      puffs.forEach(p => {
        const k = (p.userData.phase + t * 0.12) % 1;
        p.position.set(chimneyTop.x + Math.sin(k * 6 + p.userData.phase * 9) * 0.25 + k * 0.6, chimneyTop.y + k * 2.4, chimneyTop.z);
        p.scale.setScalar(0.3 + k * 0.9);
        p.material.opacity = reduced ? 0.25 : Math.sin(k * Math.PI) * 0.45;
      });
      if (flies) {
        const p = flies.geometry.attributes.position, b = flies.userData.base;
        for (let i = 0; i < p.count; i++) {
          p.setXYZ(i, b[i * 3] + Math.sin(t * 0.6 + i) * 0.4, b[i * 3 + 1] + Math.sin(t * 0.9 + i * 2) * 0.25, b[i * 3 + 2] + Math.cos(t * 0.5 + i) * 0.3);
        }
        p.needsUpdate = true;
        flies.material.opacity = 0.7 + Math.sin(t * 2) * 0.3;
      }
      if (stars) stars.material.opacity = 0.75 + Math.sin(t * 1.3) * 0.2;
    },
  };
}

// ---------- banner scenes share a camera + soft lights ----------
function banner(slot, fov = 35) {
  const scene = new THREE.Scene();
  const root = document.documentElement;
  const camera = new THREE.PerspectiveCamera(fov, 3, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, css(root, '--accent-soft', '#e1ead0'), 1.7));
  const key = new THREE.DirectionalLight(0xfff2dc, 2.2);
  key.position.set(3, 5, 4); scene.add(key);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const color = (n, f) => css(root, n, f);
  return { scene, camera, shadow, color };
}

// Recipes: a steaming bowl of noodles with chopsticks
function recipes(slot) {
  const { scene, camera, shadow, color } = banner(slot);
  const bowl = new THREE.Group();
  const outer = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; outer.push(new THREE.Vector2(0.25 + Math.sin(a) * 1.05, -Math.cos(a) * 0.85 + 0.85)); }
  const shell = new THREE.Mesh(new THREE.LatheGeometry(outer, 40), new THREE.MeshLambertMaterial({ color: color('--roof', '#c4513f'), side: THREE.DoubleSide }));
  bowl.add(shell);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.05, 8, 48), lambert(0xfff6e4));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.85; bowl.add(rim);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 32), lambert(color('--roof', '#c4513f')));
  foot.position.y = 0.02; bowl.add(foot);
  const broth = new THREE.Mesh(new THREE.CircleGeometry(1.22, 40), new THREE.MeshLambertMaterial({ color: 0xd99a4e }));
  broth.rotation.x = -Math.PI / 2; broth.position.y = 0.72; bowl.add(broth);
  // noodles: a few wavy tubes lying in the broth
  const noodleMat = lambert(0xf6e2a8);
  for (let n = 0; n < 7; n++) {
    const pts = [];
    const z = (n - 3) * 0.14;
    for (let i = 0; i <= 16; i++) { const x = -0.95 + i * 0.12; pts.push(new THREE.Vector3(x, 0.76 + Math.sin(i * 1.4 + n) * 0.03, z + Math.sin(i * 0.8 + n * 2) * 0.08)); }
    bowl.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.035, 5), noodleMat));
  }
  // soft egg, greens, fish-cake swirl
  const egg = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xfffaf0));
  egg.scale.set(1, 0.6, 1.3); egg.position.set(0.55, 0.74, 0.3); bowl.add(egg);
  const yolk = new THREE.Mesh(new THREE.CircleGeometry(0.14, 20), new THREE.MeshLambertMaterial({ color: 0xf2a43a }));
  yolk.rotation.x = -Math.PI / 2; yolk.position.set(0.55, 0.915, 0.3); bowl.add(yolk);
  const greens = lambert(0x5f9a45);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), greens);
    g.position.set(-0.4 + Math.cos(i * 2.1) * 0.35, 0.8, -0.2 + Math.sin(i * 2.1) * 0.35); bowl.add(g);
  }
  const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), lambert(0xfff3f3));
  cake.position.set(-0.45, 0.79, 0.45); bowl.add(cake);
  const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 20), lambert(0xe86f8a));
  swirl.rotation.x = Math.PI / 2; swirl.position.set(-0.45, 0.83, 0.45); bowl.add(swirl);
  // chopsticks resting across the rim
  const stickMat = lambert(0x9a6a3f);
  [-0.12, 0.12].forEach((o, i) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 3, 8), stickMat);
    s.rotation.z = Math.PI / 2 + 0.06; s.rotation.y = 0.5 + i * 0.08; s.position.set(0.2, 0.92 + i * 0.03, -0.4 + o);
    bowl.add(s);
  });
  scene.add(bowl);
  shadow.scale.setScalar(1.4); shadow.position.y = 0.001;

  const tex = softDot();
  const steam = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.phase = i / 14; s.userData.x = (Math.random() - 0.5) * 1.2; s.userData.z = (Math.random() - 0.5) * 0.8;
    scene.add(s); steam.push(s);
  }
  let spin = 0;
  return {
    scene, camera,
    fit(aspect) { camera.position.set(0, 2.5, aspect < 1.6 ? 6.2 : 5); camera.lookAt(0, 0.85, 0); },
    onDrag(dx) { spin += dx * 6; },
    onTap() { spin += 0.6; },
    update(dt, t) {
      spin *= 0.94;
      bowl.rotation.y += dt * 0.25 + spin * 0.08;
      steam.forEach(s => {
        const k = (s.userData.phase + t * 0.18) % 1;
        s.position.set(s.userData.x + Math.sin(t + s.userData.phase * 10) * 0.15 * k, 0.9 + k * 2.2, s.userData.z);
        s.scale.setScalar(0.35 + k * 0.8);
        s.material.opacity = reduced ? 0.2 : Math.sin(k * Math.PI) * 0.35;
      });
    },
  };
}

// Workouts: a dumbbell you can flick to spin
function workouts(slot) {
  const { scene, camera, shadow, color } = banner(slot);
  const bell = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: 0x6c7480 });
  const plate = lambert(color('--accent', '#3f6e3c'));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.2, 16), metal);
  handle.rotation.z = Math.PI / 2; bell.add(handle);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.9, 16), lambert(0x3a3f47));
  grip.rotation.z = Math.PI / 2; bell.add(grip);
  [-1, 1].forEach(side => {
    [[0.62, 0.7, 0.14], [0.8, 0.55, 0.12], [0.96, 0.42, 0.1]].forEach(([x, r, w]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 24), plate);
      p.rotation.z = Math.PI / 2; p.position.x = side * x; bell.add(p);
    });
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), metal);
    collar.rotation.z = Math.PI / 2; collar.position.x = side * 1.06; bell.add(collar);
  });
  scene.add(bell);
  shadow.scale.set(1.6, 0.6, 1);
  let spin = 0, turn = 0;
  return {
    scene, camera,
    fit(aspect) { camera.position.set(0, 1.6, aspect < 1.6 ? 8 : 6.8); camera.lookAt(0, 0.7, 0); },
    onDrag(dx) { spin += dx * 10; },
    onTap() { spin += 0.9; },
    update(dt, t) {
      spin *= 0.95;
      turn += spin * 0.1;
      bell.rotation.y = 0.35 + Math.sin(t * 0.4) * 0.45 + turn;
      bell.rotation.x = Math.sin(t * 0.7) * 0.15;
      bell.position.y = 0.8 + Math.sin(t * 1.4) * 0.12;
      shadow.material.opacity = 0.14 - Math.sin(t * 1.4) * 0.03;
    },
  };
}

// To-do: a glass jar with one firefly for every task finished today
function todo(slot) {
  const { scene, camera, shadow, color } = banner(slot);
  const count = Math.min(Number(slot.dataset.count) || 0, 40);
  const jar = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.9, 32, 1, true), new THREE.MeshLambertMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 0.95; jar.add(glass);
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), new THREE.MeshLambertMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.35 }));
  base.rotation.x = -Math.PI / 2; base.position.y = 0.01; jar.add(base);
  [0.02, 1.88].forEach(y => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.03, 6, 40), new THREE.MeshLambertMaterial({ color: 0xe8f6fa, transparent: true, opacity: 0.6 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = y; jar.add(ring);
  });
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.22, 32), lambert(color('--roof', '#c4513f')));
  lid.position.y = 2.0; jar.add(lid);
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.92, 0.1, 32), lambert(0xf3ead2));
  cloth.position.y = 1.94; jar.add(cloth);
  scene.add(jar);
  shadow.scale.setScalar(1.1);

  const glowTex = softDot();
  const flies = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe36b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.userData = { r: 0.15 + Math.random() * 0.5, h: 0.3 + Math.random() * 1.3, a: Math.random() * 6.28, s: 0.4 + Math.random() * 0.6, p: Math.random() * 6.28 };
    scene.add(s); flies.push(s);
  }
  const light = new THREE.PointLight(0xffd560, count ? 1 + Math.min(count, 10) * 0.5 : 0, 4);
  light.position.set(0, 1, 0); scene.add(light);
  let swirl = 0;
  return {
    scene, camera,
    fit(aspect) { camera.position.set(0, 1.8, aspect < 1.6 ? 6.4 : 5.2); camera.lookAt(0, 1, 0); },
    onTap() { swirl = 3; },
    onDrag(dx) { swirl += Math.abs(dx) * 8; },
    update(dt, t) {
      swirl = Math.max(0, swirl - dt * 1.5);
      jar.rotation.y = Math.sin(t * 0.3) * 0.2;
      flies.forEach(f => {
        const u = f.userData;
        u.a += dt * (u.s + swirl * 2);
        f.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(t * 1.2 + u.p) * 0.15, Math.sin(u.a) * u.r);
        const blink = 0.55 + Math.sin(t * 3 + u.p) * 0.45;
        f.scale.setScalar(0.32 * (0.7 + blink * 0.5));
        f.material.opacity = reduced ? 0.9 : blink;
      });
    },
  };
}

// Notes: paper leaves drifting on a breeze
function notes(slot) {
  const { scene, camera, shadow, color } = banner(slot);
  shadow.visible = false;
  const papers = [];
  const geo = new THREE.PlaneGeometry(0.6, 0.78, 4, 4);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3) * 0.06 + p.getY(i) * p.getY(i) * 0.15);
  geo.computeVertexNormals();
  const tints = [0xfffdf3, 0xfff3c8, color('--accent-soft', '#e1ead0').getHex(), 0xf6dcd3];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: tints[i % tints.length], side: THREE.DoubleSide }));
    m.userData = { x: -6 + (i / 12) * 12, y: 0.2 + Math.random() * 1.6, z: -Math.random() * 2, s: 0.25 + Math.random() * 0.35, r: Math.random() * 6, w: 0.5 + Math.random() };
    // a couple of ruled lines on each page
    for (let l = 0; l < 3; l++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.018), new THREE.MeshBasicMaterial({ color: color('--accent', '#3f6e3c'), transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
      line.position.set(0, 0.2 - l * 0.14, 0.012 + l * 0.004);
      m.add(line);
    }
    scene.add(m); papers.push(m);
  }
  let gust = 0;
  return {
    scene, camera,
    fit(aspect) { camera.position.set(0, 0.9, aspect < 1.6 ? 5.6 : 4.6); camera.lookAt(0, 0.9, 0); },
    onTap() { gust = 3; },
    onDrag(dx) { gust += Math.abs(dx) * 10; },
    update(dt, t) {
      gust = Math.max(0, gust - dt * 1.2);
      papers.forEach(m => {
        const u = m.userData;
        u.x += dt * (u.s + gust);
        if (u.x > 6.5) u.x = -6.5;
        m.position.set(u.x, u.y + Math.sin(t * u.w + u.r) * 0.25, u.z);
        m.rotation.set(Math.sin(t * 0.8 + u.r) * 0.6, t * 0.3 * u.w + u.r, Math.sin(t * 0.6 + u.r * 2) * 0.5);
      });
    },
  };
}

const BUILDERS = { home, recipes, workouts, todo, notes };
