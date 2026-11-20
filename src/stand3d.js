// Cook mode and the recipe editor, in 3D. Both sit on the kitchen worktop: Cook mode is a
// big recipe card on a wooden stand, one step at a time; the editor is a notepad you write
// on. Everything is drawn onto the paper (no 2D panels). Typing goes into hidden form
// fields, so phone keyboards, autocorrect and dictation all work, and the app's normal
// save/photo/delete handlers do the rest.
import * as THREE from '../vendor/three.module.min.js';
import { getItem, isBuiltIn } from './store.js';
import { escape } from './ui.js';
import { mode, keepAwake, startTimer, stopTimer } from './modes.js';
import { editing } from './editor.js';
import { RECIPE_CATEGORIES } from '../shared/schema.js';
import { rand, canvasTex, woodTex, layout, paper, INK, FADED, LABEL, HAND } from './library.js';

let S = null;
export const mounted = kind => Boolean(S && (!kind || S.kind === kind));

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

export function unmount() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  clearInterval(S.blink);
  if (S.kind === 'cook') { stopTimer(); }
  S.listeners.forEach(off => off());
  S.ro?.disconnect();
  S.mo?.disconnect();
  S.scene?.traverse(o => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m?.map?.dispose(); m?.dispose(); }); });
  S.renderer?.dispose();
  S.renderer?.forceContextLoss?.();
  document.body.classList.remove('in-library', 'in-stand');
  S = null;
}

/** Mounts Cook mode ('cook', recipe id) or the recipe notepad ('edit'). Returns false if 3D isn't available. */
export function mount(root, kind, id) {
  unmount();
  S = { root, kind, id, listeners: [], raf: 0, scroll: 0, regions: [] };
  const on = (t, type, fn, opts) => { t.addEventListener(type, fn, opts); S.listeners.push(() => t.removeEventListener(type, fn, opts)); };
  S.on = on;
  root.innerHTML = `<div class="lib-stage" aria-label="${kind === 'cook' ? 'Cook mode' : 'Recipe notepad'}"></div>${kind === 'edit' ? hiddenForm() : ''}`;
  S.stage = root.querySelector('.lib-stage');
  document.body.classList.add('in-library', 'in-stand');
  try { build(); }
  catch (error) { console.warn('3D unavailable', error); unmount(); return false; }
  if (kind === 'cook') keepAwake(true);
  else bindForm();
  draw();
  return true;
}

// ---------- the room: a slice of the kitchen worktop ----------
const PW = 0.42, PH = 0.56; // paper size (world units)
function build() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  S.stage.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#3a2a1c');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 20);
  Object.assign(S, { renderer, scene, camera, clock: new THREE.Clock() });
  scene.add(new THREE.HemisphereLight('#fff2dc', '#4a3220', 1.1));
  const key = new THREE.DirectionalLight('#ffe6b8', 1.4); key.position.set(0.6, 1.2, 1); scene.add(key);
  const std = (color, extra) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };
  // wall with tiles and a window, worktop, cabinets
  add(new THREE.PlaneGeometry(6, 3), std('#efe2c6', { roughness: 0.9 }), 0, 0.9, -0.35);
  const tile = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#c9b48e'; g.fillRect(0, 0, W, H);
    const r = rand('tile');
    for (let y = 0; y < 4; y++) for (let k = -1; k < 2; k++) { g.fillStyle = `hsl(${165 + r() * 10}, 28%, ${70 + r() * 6}%)`; g.fillRect((y % 2) * 64 + k * 128 + 3, y * 64 + 3, 122, 58); }
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(24, 2.4);
  add(new THREE.PlaneGeometry(6, 0.6), std('#fff', { map: tile, roughness: 0.35 }), 0, 0.3, -0.348);
  const sky = canvasTex(128, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fd0f0'); gr.addColorStop(1, '#fbe3b0'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#7fb36a'; g.beginPath(); g.ellipse(40, H, 70, 30, 0, 0, Math.PI * 2); g.fill(); });
  add(new THREE.PlaneGeometry(0.7, 0.55), new THREE.MeshBasicMaterial({ map: sky }), -0.62, 0.95, -0.345);
  const top = woodTex('#b98a56', '#7a5230', 512, 64, 40); top.wrapS = THREE.RepeatWrapping; top.repeat.set(6, 1);
  add(new THREE.BoxGeometry(6, 0.045, 0.9), std('#fff', { map: top, roughness: 0.5 }), 0, -0.0225, 0.1);
  add(new THREE.BoxGeometry(6, 0.9, 0.86), std('#6f9a8a'), 0, -0.47, 0.08);
  for (let x = -2.8; x < 3; x += 0.46) add(new THREE.BoxGeometry(0.42, 0.7, 0.02), std('#7fae9c'), x, -0.45, 0.52);
  // props: jars and a plant at the edges, so the paper stays clear
  [['#d8a657', -0.5], ['#8a5a2e', -0.42], ['#b3262a', 0.48]].forEach(([c, x]) => { add(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 14), std(c), x, 0.06, -0.22); add(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 14), std('#e8f0ee', { transparent: true, opacity: 0.5 }), x, 0.07, -0.22); });
  add(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 12), std('#c96f4a'), 0.6, 0.04, -0.2);
  add(new THREE.SphereGeometry(0.075, 12, 10), std('#4f8a3c'), 0.6, 0.12, -0.2);

  // The paper: a recipe card on a stand (cook) or a notepad leaning on a board (edit).
  const canvas = document.createElement('canvas');
  S.CW = 900; S.CH = Math.round(900 * PH / PW);
  canvas.width = S.CW; canvas.height = S.CH;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const group = new THREE.Group();
  const backing = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.03, PH + 0.03, 0.012), S.kind === 'cook' ? std('#8a5a32', { map: woodTex('#8a5a32', '#3a2210', 128, 128, 12) }) : std('#3a3f46'));
  backing.position.z = -0.008;
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color('#a09480'), roughness: 0.9 }));
  group.add(backing, sheet);
  if (S.kind === 'edit') { // a clip and a pencil
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), std('#c9c2b4', { metalness: 0.8, roughness: 0.3 })); clip.position.set(0, PH / 2 + 0.005, 0.006); group.add(clip);
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), std('#e9b949')); pencil.rotation.z = Math.PI / 2 - 0.3; pencil.position.set(0.3, -0.25, 0.02); group.add(pencil);
  } else {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.06, 0.03, 0.05), backing.material); ledge.position.set(0, -PH / 2 - 0.01, 0.02); group.add(ledge);
  }
  group.position.set(0, PH / 2 + 0.03, 0.05);
  group.rotation.x = -0.12;
  scene.add(group);
  Object.assign(S, { canvas, ctx: canvas.getContext('2d'), tex, sheet, group });
  S.resize = () => {
    const w = S.stage.clientWidth || 1, h = S.stage.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max((PH + 0.05) / 2 / tanH, (PW + 0.04) / 2 / (tanH * camera.aspect));
    camera.position.set(0, group.position.y + 0.02, group.position.z + d);
    camera.lookAt(0, group.position.y, group.position.z);
  };
  S.ro = new ResizeObserver(S.resize); S.ro.observe(S.stage); S.resize();
  bindPointer();
  const loop = () => { if (!S) return; S.raf = requestAnimationFrame(loop); renderer.render(scene, camera); };
  loop();
}

// ---------- input ----------
const pointer = new THREE.Vector2(), ray = new THREE.Raycaster();
function hitUV(e) {
  const r = S.renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer, S.camera);
  const hit = ray.intersectObject(S.sheet, false)[0];
  return hit ? { x: hit.uv.x * S.CW, y: (1 - hit.uv.y) * S.CH } : null;
}
function bindPointer() {
  const el = S.renderer.domElement;
  let down = null;
  S.on(el, 'pointerdown', e => { down = { x: e.clientX, y: e.clientY, scroll: S.scroll, moved: false }; el.setPointerCapture?.(e.pointerId); });
  S.on(el, 'pointermove', e => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) down.moved = true;
    if (S.kind === 'edit' && down.moved) { S.scroll = Math.max(0, Math.min(S.maxScroll || 0, down.scroll - dy * (S.CH / (S.stage.clientHeight || 1)) * 1.1)); draw(); }
  });
  S.on(el, 'pointerup', e => {
    if (!down) return;
    const d = down; down = null;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (S.kind === 'cook' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); return; }
    if (d.moved) return;
    const p = hitUV(e);
    const reg = p && S.regions.find(r => p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1);
    if (reg) act(reg);
    else if (S.kind === 'edit') document.activeElement?.blur?.();
  });
  S.on(el, 'wheel', e => { if (S.kind !== 'edit') return; e.preventDefault(); S.scroll = Math.max(0, Math.min(S.maxScroll || 0, S.scroll + e.deltaY)); draw(); }, { passive: false });
  S.on(window, 'keydown', e => {
    if (S.kind !== 'cook') return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'Escape') location.hash = `#/item/${encodeURIComponent(S.id)}`;
  });
}

function act(reg) {
  if (S.kind === 'cook') return cookAct(reg);
  return editAct(reg);
}

// ---------- Cook mode ----------
function cookSteps(item) {
  let n = 0;
  const steps = (item.steps || []).map(s => (/:\s*$/.test(s) && s.length < 60 ? { head: s.replace(/:\s*$/, '') } : { text: s, n: ++n }));
  return { steps, real: steps.filter(s => s.text) };
}
export function timerIn(text) {
  const m = String(text).match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/i);
  if (!m) return 0;
  const n = Number(m[2] || m[1]);
  const unit = m[3].toLowerCase();
  return Math.round(n * (unit.startsWith('h') ? 3600 : unit.startsWith('m') ? 60 : 1));
}
const clock = s => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

function go(delta) {
  const item = getItem(S.id); if (!item) return;
  const { real } = cookSteps(item);
  if (S.showIngredients) { S.showIngredients = false; draw(); return; }
  const next = mode.index + delta;
  if (next >= real.length) { location.hash = `#/item/${encodeURIComponent(S.id)}`; return; }
  if (next < 0) return;
  mode.index = next;
  stopTimer(); mode.timerLeft = 0; mode.timerTotal = 0;
  // a little nudge of the card, like sliding a page over
  const g = S.group, x0 = delta * 0.06;
  const t0 = performance.now();
  const tick = now => { if (!S) return; const t = Math.min(1, (now - t0) / 260); g.position.x = x0 * (1 - t) * (1 - t); if (t < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  draw();
}

function cookAct(reg) {
  if (reg.act === 'close') location.hash = `#/item/${encodeURIComponent(S.id)}`;
  if (reg.act === 'next') go(1);
  if (reg.act === 'prev') go(-1);
  if (reg.act === 'ingredients') { S.showIngredients = !S.showIngredients; draw(); }
  if (reg.act === 'check') { S.checked = S.checked || new Set(); S.checked.has(reg.i) ? S.checked.delete(reg.i) : S.checked.add(reg.i); draw(); }
  if (reg.act === 'timer') startTimer(reg.seconds, () => { if (S) draw(); });
  if (reg.act === 'stop') { stopTimer(); mode.timerLeft = 0; mode.timerTotal = 0; draw(); }
}

function button(g, x, y, w, h, text, act, extra = {}, style = 'soft') {
  const fill = { soft: 'rgba(201, 164, 106, .28)', primary: '#2f6f4f', danger: '#a8342a', dim: 'rgba(120, 100, 80, .12)' }[style];
  g.fillStyle = fill; rr(g, x, y, w, h, h / 2); g.fill();
  if (style === 'soft') { g.strokeStyle = '#c9a46a'; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = style === 'soft' ? '#5a3a1e' : style === 'dim' ? FADED : '#fff6e0';
  g.font = `600 ${Math.round(h * 0.42)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, x + w / 2, y + h / 2 + 1);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  if (act && style !== 'dim') S.regions.push({ x0: x - 6, x1: x + w + 6, y0: y - 8, y1: y + h + 8, act, ...extra });
}

function drawCook() {
  const g = S.ctx, W = S.CW, H = S.CH;
  const item = getItem(S.id);
  g.save(); g.scale(W / 768, H / 1024); paper(g, true); g.restore();
  S.regions = [];
  if (!item) { g.fillStyle = INK; g.font = '32px Georgia'; g.fillText('Recipe not found.', 60, 200); return; }
  const { steps, real } = cookSteps(item);
  mode.index = Math.min(Math.max(0, mode.index), Math.max(0, real.length - 1));
  // header
  button(g, 40, 36, 150, 64, '✕ Close', 'close');
  button(g, W - 270, 36, 230, 64, S.showIngredients ? '▤ Steps' : '▤ Ingredients', 'ingredients');
  g.fillStyle = LABEL; g.font = 'italic 28px Georgia, serif'; g.textAlign = 'center';
  let title = item.title; while (g.measureText(title).width > W - 520 && title.length > 4) title = title.slice(0, -2);
  if (title !== item.title) title += '…';
  g.fillText(title, W / 2, 78); g.textAlign = 'left';
  if (S.showIngredients) {
    g.fillStyle = LABEL; g.font = '600 26px system-ui, sans-serif'; g.fillText('INGREDIENTS · tap to tick off', 60, 170);
    let y = 220;
    g.font = `34px ${HAND}`;
    (item.ingredients || []).forEach((line, i) => {
      if (y > H - 80) return;
      const head = /:\s*$/.test(line);
      const done = S.checked?.has(i);
      const text = line.replace(/:\s*$/, '');
      g.font = head ? '600 28px Georgia, serif' : `32px ${HAND}`;
      const lines = layout(g, text, W - 190);
      g.fillStyle = head ? LABEL : done ? FADED : INK;
      if (!head) { g.strokeStyle = done ? FADED : '#8a5a2e'; g.lineWidth = 3; g.strokeRect(62, y - 28, 30, 30); if (done) { g.beginPath(); g.moveTo(68, y - 14); g.lineTo(76, y - 4); g.lineTo(90, y - 26); g.stroke(); } }
      const y0 = y;
      lines.forEach(l => { g.fillText(l.text.trim(), head ? 62 : 112, y); if (done) { g.fillRect(112, y - 11, g.measureText(l.text.trim()).width, 2); } y += 44; });
      if (!head) S.regions.push({ x0: 0, x1: W, y0: y0 - 40, y1: y - 30, act: 'check', i });
      y += 6;
    });
    return;
  }
  if (!real.length) { g.fillStyle = INK; g.font = `34px ${HAND}`; g.fillText('This recipe has no steps yet.', 60, 260); return; }
  const step = real[mode.index];
  const heading = steps.slice(0, steps.indexOf(step)).reverse().find(s => s.head)?.head;
  g.fillStyle = LABEL; g.font = '600 28px system-ui, sans-serif';
  g.fillText(`STEP ${mode.index + 1} OF ${real.length}`, 60, 180);
  if (heading) { g.font = 'italic 28px Georgia, serif'; g.fillText(heading, 60, 222); }
  // the step itself, as big as fits
  const top = heading ? 270 : 240, bottom = H - 330;
  let size = 58, lines;
  for (; size >= 30; size -= 2) { g.font = `${size}px ${HAND}`; lines = layout(g, step.text, W - 120); if (lines.length * size * 1.4 <= bottom - top) break; }
  g.fillStyle = INK;
  lines.forEach((l, i) => g.fillText(l.text.trim(), 60, top + size + i * size * 1.4));
  // timer
  const secs = timerIn(step.text);
  const running = mode.timer || (mode.timerTotal && mode.timerLeft === 0);
  if (running) {
    g.fillStyle = mode.timerLeft === 0 ? '#b3262a' : '#2e1e10'; g.font = '600 72px Georgia, serif'; g.textAlign = 'center';
    g.fillText(mode.timerLeft === 0 ? 'Time!' : clock(mode.timerLeft), W / 2 - 110, H - 240); g.textAlign = 'left';
    button(g, W / 2 + 40, H - 300, 220, 76, mode.timerLeft === 0 ? 'Done' : '■ Stop', 'stop');
  } else if (secs) button(g, W / 2 - 200, H - 300, 400, 80, `⏱ Start ${clock(secs)} timer`, 'timer', { seconds: secs });
  // progress
  g.fillStyle = 'rgba(120, 90, 50, .15)'; rr(g, 60, H - 190, W - 120, 10, 5); g.fill();
  g.fillStyle = '#c96f4a'; rr(g, 60, H - 190, (W - 120) * (mode.index + 1) / real.length, 10, 5); g.fill();
  button(g, 60, H - 150, 300, 96, '◂ Back', 'prev', {}, mode.index === 0 ? 'dim' : 'soft');
  button(g, W - 360, H - 150, 300, 96, mode.index < real.length - 1 ? 'Next ▸' : '✓ Done', 'next', {}, 'primary');
}

// ---------- the recipe notepad (editor) ----------
const FIELDS = [
  { name: 'title', label: 'TITLE', big: true, place: 'Recipe name' },
  { name: 'category', label: 'MEAL', pick: true },
  { name: 'minutes', label: 'MINUTES', num: true, half: 'L', place: '30' },
  { name: 'servings', label: 'SERVES', num: true, half: 'R', place: '2' },
  { name: 'description', label: 'SHORT DESCRIPTION', multi: true, place: 'What makes it good…' },
  { name: 'ingredients', label: 'INGREDIENTS · one per line', multi: true, place: '200 g chicken thighs\n1 tbsp soy sauce' },
  { name: 'steps', label: 'STEPS · one per line', multi: true, place: 'Season the chicken.\nCook 6 minutes a side.' },
  { name: 'calories', label: 'CALORIES', num: true, half: 'L', place: '—' },
  { name: 'protein', label: 'PROTEIN G', num: true, half: 'R', place: '—' },
  { name: 'carbs', label: 'CARBS G', num: true, half: 'L', place: '—' },
  { name: 'fat', label: 'FAT G', num: true, half: 'R', place: '—' },
  { name: 'cost', label: 'COST OF THE WHOLE RECIPE ($)', num: true, place: 'e.g. 12.50' },
  { name: 'note', label: 'NOTES', multi: true, place: 'Anything to remember…' },
  { name: 'tags', label: 'TAGS · separate with commas', place: 'Japanese, high protein' },
  { name: 'sourceUrl', label: 'LINK TO THE ORIGINAL', place: 'https://' },
];

function valueOf(d, name) {
  if (name === 'ingredients' || name === 'steps') return (d[name] || []).join('\n');
  if (name === 'tags') return (d.tags || []).join(', ');
  if (['calories', 'protein', 'carbs', 'fat'].includes(name)) return d.nutrition?.[name] ?? '';
  if (name === 'cost') return d.cost?.total ?? '';
  return d[name] ?? '';
}

function hiddenForm() {
  const d = editing.draft;
  const canDelete = d.id && !isBuiltIn(d.id) && getItem(d.id);
  return `<form class="stand-form" data-form="editor" novalidate>
    ${FIELDS.map(f => f.pick ? `<input type="hidden" name="${f.name}" value="${escape(d.category || 'Dinner')}" />`
      : f.multi ? `<textarea class="lib-hidden-input" name="${f.name}" aria-label="${escape(f.label)}" autocapitalize="sentences">${escape(String(valueOf(d, f.name)))}</textarea>`
        : `<input class="lib-hidden-input" name="${f.name}" aria-label="${escape(f.label)}" value="${escape(String(valueOf(d, f.name)))}" ${f.num ? 'inputmode="decimal"' : f.name === 'sourceUrl' ? 'inputmode="url" autocapitalize="off"' : 'autocapitalize="sentences"'} />`).join('')}
    <input type="file" accept="image/*" data-action="photo" hidden />
    <button type="button" class="lib-hidden-input" data-action="remove-photo" tabindex="-1">Remove</button>
    ${canDelete ? `<button type="button" class="lib-hidden-input" data-action="delete" data-id="${escape(d.id)}" tabindex="-1">Delete</button>` : ''}
    <p id="form-error" hidden></p>
  </form>`;
}

function bindForm() {
  S.form = S.root.querySelector('form');
  const redraw = () => draw();
  for (const el of S.form.querySelectorAll('input, textarea')) {
    S.on(el, 'input', redraw);
    S.on(el, 'focus', () => { S.caretOn = true; S.focusName = el.name; scrollToField(el.name); draw(); });
    S.on(el, 'blur', () => setTimeout(() => { if (S && !S.form.contains(document.activeElement)) { S.focusName = ''; draw(); } }, 0));
    S.on(el, 'keyup', redraw);
  }
  S.on(document, 'selectionchange', () => { if (S?.form?.contains(document.activeElement)) draw(); });
  S.blink = setInterval(() => { if (S?.form?.contains(document.activeElement)) { S.caretOn = !S.caretOn; draw(); } }, 530);
  S.mo = new MutationObserver(redraw);
  S.mo.observe(S.form, { attributes: true, subtree: true, childList: true, characterData: true });
  if (window.visualViewport) S.on(window.visualViewport, 'resize', () => { if (S?.focusName) scrollToField(S.focusName); draw(); });
}

function scrollToField(name) {
  const f = S.fieldPos?.[name]; if (!f) return;
  // keep the field near the top of the pad so the keyboard doesn't cover it
  const vv = window.visualViewport;
  const visible = vv ? Math.max(0.35, Math.min(1, vv.height / (S.stage.clientHeight || vv.height))) : 1;
  const viewTop = 150, viewBottom = S.CH * visible - 80;
  if (f.y0 - S.scroll < viewTop || f.y1 - S.scroll > viewBottom) S.scroll = Math.max(0, Math.min(S.maxScroll || 0, f.y0 - viewTop - 20));
}

function caretWrite(g, text, x, y, w, lh, font, color, focused, caretAt, maxLines = 99) {
  g.font = font;
  const lines = layout(g, text, w);
  g.fillStyle = color;
  lines.slice(0, maxLines).forEach((l, i) => g.fillText(l.text, x, y + i * lh));
  if (focused && S.caretOn) {
    let li = lines.length - 1;
    for (let i = 0; i < lines.length; i++) if (lines[i].start <= caretAt) li = i;
    const l = lines[li] || { text: '', start: 0 };
    const cx = x + g.measureText(l.text.slice(0, Math.max(0, caretAt - l.start))).width;
    g.fillStyle = '#7a3b1e'; g.fillRect(cx + 1, y + li * lh - lh * 0.72, 3, lh * 0.85);
  }
  return Math.max(1, Math.min(lines.length, maxLines));
}

function drawEdit() {
  const g = S.ctx, W = S.CW, H = S.CH;
  const d = editing.draft;
  S.regions = [];
  // legal-pad paper
  g.fillStyle = '#fbf3c8'; g.fillRect(0, 0, W, H);
  g.save();
  g.translate(0, -S.scroll);
  const M = 56, CW = W - M * 2;
  let y = 150;
  S.fieldPos = {};
  const regionsContent = [];
  if (editing.banner) { g.font = 'italic 26px Georgia, serif'; g.fillStyle = '#6a4a30'; layout(g, editing.banner, CW).forEach(l => { y += 34; g.fillText(l.text, M, y); }); y += 20; }
  // photo
  const ph = 300;
  g.fillStyle = 'rgba(120, 90, 50, .1)'; g.fillRect(M, y, CW, ph);
  const src = d.photo?.src;
  if (src) {
    S.img = S.img?.src === new URL(src, location.href).href ? S.img : Object.assign(new Image(), { crossOrigin: /^https?:/.test(src) ? 'anonymous' : null, onload: () => draw(), onerror() { this.failed = true; draw(); }, src });
    const img = S.img;
    if (img.complete && img.naturalWidth && !img.failed) { const s = Math.max(CW / img.naturalWidth, ph / img.naturalHeight); const sw = CW / s, sh = ph / s; g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, M, y, CW, ph); }
  } else { g.fillStyle = FADED; g.font = 'italic 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('📷  Tap to add a photo', W / 2, y + ph / 2 + 10); g.textAlign = 'left'; }
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(M, y, CW, ph);
  regionsContent.push({ x0: M, x1: W - M, y0: y, y1: y + ph - (src ? 70 : 0), act: 'photo' });
  if (src) {
    g.save(); g.translate(0, 0);
    const bx = W - M - 360, by = y + ph - 66;
    g.fillStyle = 'rgba(30, 20, 10, .6)'; rr(g, bx, by, 170, 52, 26); g.fill(); rr(g, bx + 184, by, 170, 52, 26); g.fill();
    g.fillStyle = '#fff6e0'; g.font = '600 22px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Change', bx + 85, by + 34); g.fillText('Remove', bx + 269, by + 34); g.textAlign = 'left';
    regionsContent.push({ x0: bx, x1: bx + 170, y0: by, y1: by + 52, act: 'photo' }, { x0: bx + 184, x1: bx + 354, y0: by, y1: by + 52, act: 'remove-photo' });
    g.restore();
  }
  y += ph + 30;
  // fields
  const focus = document.activeElement;
  let rowY = y, rowH = 0;
  for (const f of FIELDS) {
    const el = S.form.elements[f.name];
    const val = el?.value ?? '';
    const half = f.half;
    const x = half === 'R' ? W / 2 + 10 : M;
    const w = half ? CW / 2 - 10 : CW;
    if (half !== 'R') { y = rowY + rowH; rowY = y; rowH = 0; }
    const top = rowY + 34;
    g.fillStyle = LABEL; g.font = '600 22px system-ui, sans-serif'; g.fillText(f.label, x, top);
    const lh = f.big ? 56 : 44;
    const font = f.big ? `600 46px Georgia, serif` : `32px ${HAND}`;
    const focused = focus === el;
    let lines;
    const ty = top + (f.big ? 60 : 50);
    if (f.pick) {
      const cats = [...new Set([...RECIPE_CATEGORIES, val || 'Dinner'])];
      let cx = x;
      let cy = top + 16;
      g.font = '600 24px system-ui, sans-serif';
      for (const c of cats) {
        const cw = g.measureText(c).width + 40;
        if (cx + cw > x + w) { cx = x; cy += 64; }
        const on = c === val;
        g.fillStyle = on ? '#2f6f4f' : 'rgba(201, 164, 106, .25)'; rr(g, cx, cy, cw, 50, 25); g.fill();
        g.fillStyle = on ? '#fff6e0' : '#5a3a1e'; g.textAlign = 'center'; g.fillText(c, cx + cw / 2, cy + 33); g.textAlign = 'left';
        regionsContent.push({ x0: cx, x1: cx + cw, y0: cy, y1: cy + 50, act: 'pick', value: c });
        cx += cw + 12;
      }
      lines = 0;
      rowH = Math.max(rowH, cy + 50 - rowY + 24);
      continue;
    }
    if (val) lines = caretWrite(g, val, x + 4, ty, w - 8, lh, font, INK, focused, el.selectionStart ?? val.length);
    else {
      lines = caretWrite(g, f.place || '', x + 4, ty, w - 8, lh, f.big ? 'italic 600 46px Georgia, serif' : `italic 30px ${HAND}`, 'rgba(74, 48, 32, .35)', false, 0, 3);
      if (focused && S.caretOn) { g.fillStyle = '#7a3b1e'; g.fillRect(x + 5, ty - lh * 0.72, 3, lh * 0.85); }
    }
    const boxH = Math.max(lines, f.multi ? 3 : 1) * lh + 22;
    // ruled lines under the writing
    g.strokeStyle = focused ? '#c96f4a' : 'rgba(90, 120, 160, .35)'; g.lineWidth = focused ? 3 : 2;
    for (let i = 0; i < Math.max(lines, f.multi ? 3 : 1); i++) { g.beginPath(); g.moveTo(x, ty + i * lh + 12); g.lineTo(x + w, ty + i * lh + 12); g.stroke(); }
    S.fieldPos[f.name] = { y0: rowY, y1: ty + boxH };
    regionsContent.push({ x0: x, x1: x + w, y0: rowY + 4, y1: ty + boxH - 10, act: 'field', name: f.name });
    rowH = Math.max(rowH, ty + boxH - rowY);
  }
  y = rowY + rowH + 30;
  // error and delete
  const err = S.form.querySelector('#form-error');
  if (err && !err.hidden && err.textContent) { g.fillStyle = '#a8342a'; g.font = '600 28px system-ui, sans-serif'; layout(g, err.textContent, CW).forEach(l => { y += 36; g.fillText(l.text, M, y); }); y += 20; }
  const del = S.form.querySelector('[data-action="delete"]');
  if (del) {
    const confirm = del.dataset.confirm;
    g.fillStyle = confirm ? '#a8342a' : 'rgba(168, 52, 42, .12)'; rr(g, M, y, CW, 80, 40); g.fill();
    g.fillStyle = confirm ? '#fff6e0' : '#a8342a'; g.font = '600 30px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(confirm ? 'Tap again to delete' : '🗑  Delete this recipe', W / 2, y + 51); g.textAlign = 'left';
    regionsContent.push({ x0: M, x1: W - M, y0: y, y1: y + 80, act: 'delete' });
    y += 110;
  }
  y += 60;
  g.restore();
  S.maxScroll = Math.max(0, y - H);
  for (const r of regionsContent) { const y0 = r.y0 - S.scroll, y1 = r.y1 - S.scroll; if (y1 > 120 && y0 < H) S.regions.push({ ...r, y0: Math.max(120, y0), y1 }); }
  // header bar, fixed at the top of the pad
  g.fillStyle = '#f3e3a6'; g.fillRect(0, 0, W, 120);
  g.strokeStyle = 'rgba(179, 38, 42, .5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 120); g.lineTo(W, 120); g.stroke();
  button(g, 30, 28, 170, 64, '✕ Cancel', 'cancel');
  button(g, W - 200, 28, 170, 64, 'Save', 'save', {}, 'primary');
  g.fillStyle = INK; g.font = '600 34px Georgia, serif'; g.textAlign = 'center';
  g.fillText(!d.id ? (editing.origin === 'import' ? 'Check and save' : 'New recipe') : 'Edit recipe', W / 2, 72); g.textAlign = 'left';
  // scroll hint
  if (S.maxScroll > 0) { const frac = S.scroll / S.maxScroll; g.fillStyle = 'rgba(90, 60, 30, .25)'; rr(g, W - 14, 130 + frac * (H - 230), 8, 90, 4); g.fill(); }
}

function editAct(reg) {
  const form = S.form;
  if (reg.act === 'field') {
    const el = form.elements[reg.name];
    el.focus({ preventScroll: true });
    const end = el.value.length; try { el.setSelectionRange(end, end); } catch { /* number-ish inputs */ }
    return;
  }
  if (reg.act === 'pick') { form.elements.category.value = reg.value; draw(); return; }
  if (reg.act === 'photo') { form.querySelector('[data-action="photo"]').click(); return; }
  if (reg.act === 'remove-photo') { form.querySelector('[data-action="remove-photo"]').click(); return; }
  if (reg.act === 'delete') { form.querySelector('[data-action="delete"]').click(); setTimeout(draw, 0); return; }
  if (reg.act === 'cancel') { const d = editing.draft; location.hash = d?.id ? `#/item/${encodeURIComponent(d.id)}` : '#/recipes'; return; }
  if (reg.act === 'save') { document.activeElement?.blur?.(); form.requestSubmit(); }
}

function draw() {
  if (!S?.ctx) return;
  if (S.kind === 'cook') drawCook(); else drawEdit();
  S.tex.needsUpdate = true;
}
export const redraw = () => draw();
