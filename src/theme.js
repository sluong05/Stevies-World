// Themes are pure CSS (see styles.css [data-theme]); this file picks one and loads its fonts.
export const THEMES = [
  { id: 'meadow', name: 'Meadow', blurb: 'Painted skies, rolling hills and warm paper. The sky follows the time of day.', fonts: 'Kiwi+Maru:wght@400;500&family=Zen+Maru+Gothic:wght@400;500;700' },
  { id: 'night', name: 'Firefly night', blurb: 'The meadow after dark, lit by lanterns. Easy on the eyes at night.', fonts: 'Kiwi+Maru:wght@400;500&family=Zen+Maru+Gothic:wght@400;500;700' },
  { id: 'retro', name: 'Retro desktop', blurb: 'Bevelled grey windows, pixel headings and a teal desktop.', fonts: 'Pixelify+Sans:wght@400;600' },
  { id: 'plain', name: 'Plain paper', blurb: 'Quiet and simple, with no scenery. Gets out of the way.', fonts: 'Atkinson+Hyperlegible:wght@400;700' },
];
const KEY = 'sw.theme';
const DARK_KEY = 'sw.autoNight';
const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export const chosenTheme = () => (THEMES.some(t => t.id === get(KEY)) ? get(KEY) : 'meadow');
export const autoNight = () => get(DARK_KEY) !== '0';
// Meadow turns into Firefly night by the clock (8 PM to 5 AM), the same hours the greeting and
// the painted sky use, rather than by the phone's dark mode, so the scene and "Good afternoon"
// always agree. Keep in step with the inline script in index.html.
export const isNightHour = (date = new Date()) => { const h = date.getHours(); return h >= 20 || h < 5; };

export function activeTheme() {
  const chosen = chosenTheme();
  return chosen === 'meadow' && autoNight() && isNightHour() ? 'night' : chosen;
}

const loaded = new Set();
function loadFonts(theme) {
  const t = THEMES.find(x => x.id === theme);
  if (!t?.fonts || loaded.has(t.fonts)) return;
  loaded.add(t.fonts);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${t.fonts}&display=swap`;
  document.head.append(link);
}

export function applyTheme() {
  const theme = activeTheme();
  document.documentElement.dataset.theme = theme;
  loadFonts(theme);
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bar').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color || '#f6f0de');
  return theme;
}
export function setTheme(id) { set(KEY, id); return applyTheme(); }
export function setAutoNight(on) { set(DARK_KEY, on ? '1' : '0'); return applyTheme(); }
// Switch over at 8 PM / 5 AM while the app is open, and when coming back to it.
let lastActive = null;
const recheck = () => { const now = activeTheme(); if (lastActive && now !== lastActive) { applyTheme(); window.dispatchEvent(new Event('themechange')); } lastActive = now; };
if (typeof window !== 'undefined') { setInterval(recheck, 60_000); document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); }); recheck(); }
