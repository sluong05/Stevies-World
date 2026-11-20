// Full-screen, one-thing-at-a-time views for cooking and training. Keeps the screen awake.
import { escape, icon } from './ui.js';
import { getItem } from './store.js';

export const mode = { index: 0, id: '', kind: '', showIngredients: false, timer: null, timerLeft: 0, timerTotal: 0, sets: {}, startedAt: 0 };

// When each workout was last finished, kept on this device only.
const DONE_KEY = 'sw-workout-done';
const readDone = () => { try { return JSON.parse(localStorage.getItem(DONE_KEY) || '{}') || {}; } catch { return {}; } };
export const lastDone = id => readDone()[id] || 0;
export function markDone(id) { const d = readDone(); d[id] = Date.now(); try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch { /* private mode */ } }
export function agoLabel(ts) {
  if (!ts) return '';
  const day = 864e5, start = new Date(); start.setHours(0, 0, 0, 0);
  const days = Math.ceil((start.getTime() - ts) / day);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}
let wakeLock = null;

export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not supported or denied */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && mode.kind) keepAwake(true); });

export function enterMode(kind, id) {
  if (mode.id !== id || mode.kind !== kind) Object.assign(mode, { index: 0, showIngredients: false, sets: {}, startedAt: Date.now() });
  mode.id = id; mode.kind = kind;
  keepAwake(true);
}
export function exitMode() { stopTimer(); mode.kind = ''; keepAwake(false); }

export const parseSeconds = rest => {
  const m = String(rest || '').match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minutes)?/i);
  if (!m) return 90;
  return Math.round(Number(m[1]) * (m[2] ? 60 : 1)) || 90;
};

let timerEnd = 0;
// Nudge a running rest timer by a few seconds (never below 5s left).
export function addTime(sec) {
  if (!mode.timer) return;
  timerEnd = Math.max(Date.now() + 5000, timerEnd + sec * 1000);
  mode.timerLeft = Math.round((timerEnd - Date.now()) / 1000);
  mode.timerTotal = Math.max(mode.timerTotal + sec, mode.timerLeft);
}
export function startTimer(seconds, onTick) {
  stopTimer();
  mode.timerTotal = mode.timerLeft = seconds;
  timerEnd = Date.now() + seconds * 1000;
  mode.timer = setInterval(() => {
    mode.timerLeft = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    onTick();
    if (!mode.timerLeft) { stopTimer(); try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ } onTick(); }
  }, 250);
  onTick();
}
export function stopTimer() { if (mode.timer) clearInterval(mode.timer); mode.timer = null; }
const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function modeView() {
  const item = getItem(mode.id);
  if (!item) return '<p class="empty-line">Not found.</p>';
  const back = `#/item/${encodeURIComponent(item.id)}`;
  if (mode.kind === 'cook') {
    let n = 0;
    const steps = (item.steps || []).map(s => (/:\s*$/.test(s) && s.length < 60 ? { head: s.replace(/:\s*$/, '') } : { text: s, n: ++n }));
    const real = steps.filter(s => s.text);
    mode.index = Math.min(Math.max(0, mode.index), real.length - 1);
    const step = real[mode.index];
    const heading = [...steps.slice(0, steps.indexOf(step))].reverse().find(s => s.head)?.head;
    return `<div class="mode mode-cook">
      <header class="mode-head"><a class="round-btn" href="${back}" aria-label="Close cook mode">${icon('close')}</a><p class="mode-title">${escape(item.title)}</p>
        <button class="btn btn-ghost btn-small" data-action="toggle-ingredients" aria-expanded="${mode.showIngredients}">${icon('list')}Ingredients</button></header>
      ${mode.showIngredients ? `<section class="mode-ingredients"><ul>${(item.ingredients || []).map(l => `<li class="${/:\s*$/.test(l) ? 'subhead' : ''}">${escape(l.replace(/:\s*$/, ''))}</li>`).join('')}</ul></section>` : ''}
      <main class="mode-main" aria-live="polite">
        <p class="mode-count">Step ${mode.index + 1} of ${real.length}${heading ? ` <span>${escape(heading)}</span>` : ''}</p>
        <p class="mode-step">${escape(step?.text || '')}</p>
      </main>
      <div class="mode-progress"><span style="width:${((mode.index + 1) / real.length) * 100}%"></span></div>
      <footer class="mode-nav">
        <button class="btn btn-ghost" data-action="mode-prev" ${mode.index === 0 ? 'disabled' : ''}>${icon('back')}Back</button>
        ${mode.index < real.length - 1 ? `<button class="btn btn-primary" data-action="mode-next">Next${icon('next')}</button>` : `<a class="btn btn-primary" href="${back}">${icon('check')}Done</a>`}
      </footer>
    </div>`;
  }
  const flat = (item.blocks || []).flatMap(b => b.exercises.map(e => ({ ...e, block: b.name })));
  mode.index = Math.min(Math.max(0, mode.index), flat.length - 1);
  const ex = flat[mode.index];
  const nextEx = flat[mode.index + 1];
  const scheme = ex ? [ex.sets && `${ex.sets} sets`, ex.reps && (ex.sets ? `of ${ex.reps}` : ex.reps)].filter(Boolean).join(' ') : '';
  const timerOn = Boolean(mode.timer) || mode.timerLeft > 0 && mode.timerTotal;
  return `<div class="mode mode-workout">
    <header class="mode-head"><a class="round-btn" href="${back}" aria-label="Close workout">${icon('close')}</a><p class="mode-title">${escape(item.title)}</p><span></span></header>
    <main class="mode-main" aria-live="polite">
      <p class="mode-count">${mode.index + 1} of ${flat.length}${ex?.block ? ` <span>${escape(ex.block)}</span>` : ''}</p>
      <h2 class="mode-ex">${escape(ex?.name || '')}</h2>
      ${scheme ? `<p class="mode-scheme">${escape(scheme)}</p>` : ''}
      ${ex?.note ? `<p class="mode-note">${escape(ex.note)}</p>` : ''}
      <div class="rest">
        ${timerOn ? `<p class="rest-clock ${mode.timerLeft === 0 ? 'done' : ''}" id="rest-clock">${mode.timerLeft === 0 ? 'Go' : clock(mode.timerLeft)}</p>
          <button class="btn btn-ghost btn-small" data-action="timer-stop">${mode.timerLeft === 0 ? 'Close timer' : 'Stop'}</button>`
          : `<button class="btn btn-soft" data-action="timer-start" data-seconds="${parseSeconds(ex?.rest)}">${icon('timer')}Rest ${escape(ex?.rest || '90s')}</button>`}
      </div>
      ${nextEx ? `<p class="mode-up-next">Next: ${escape(nextEx.name)}</p>` : ''}
    </main>
    <div class="mode-progress"><span style="width:${((mode.index + 1) / flat.length) * 100}%"></span></div>
    <footer class="mode-nav">
      <button class="btn btn-ghost" data-action="mode-prev" ${mode.index === 0 ? 'disabled' : ''}>${icon('back')}Back</button>
      ${mode.index < flat.length - 1 ? `<button class="btn btn-primary" data-action="mode-next">Next${icon('next')}</button>` : `<a class="btn btn-primary" href="${back}">${icon('check')}Finish</a>`}
    </footer>
  </div>`;
}
