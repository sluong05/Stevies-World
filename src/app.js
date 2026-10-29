import { $, $$, toast } from './ui.js';
import * as store from './store.js';
import { applyTheme, setTheme, setAutoNight } from './theme.js';
import { homeView, listView, itemView, ui } from './views.js';
import { editing, addView, editorView, startNew, startEdit, draftFromText, importFromLink, firstUrl, readForm, switchType, updatePreview, setPhoto, saveDraft, removeItem } from './editor.js';
import { mode, modeView, enterMode, exitMode, startTimer, stopTimer } from './modes.js';
import { settingsView } from './settings.js';

applyTheme();
const main = $('#main');
let lastRoute = '';
let lastListRoute = '#/';

function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = hash.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(qs), path };
}

function render({ keepScroll = false } = {}) {
  const { parts, params, path } = parseRoute();
  const [a, b, c] = parts;
  const routeKey = path;
  const changed = routeKey !== lastRoute;
  if (changed && mode.kind && !(a === 'item' && (c === 'cook' || c === 'go'))) exitMode();
  let html;
  let tab = '';
  document.body.classList.toggle('in-mode', a === 'item' && (c === 'cook' || c === 'go'));
  if (!a) { html = homeView(); tab = 'home'; }
  else if (a === 'recipes') { html = listView('recipe'); tab = 'recipes'; }
  else if (a === 'workouts') { html = listView('workout'); tab = 'workouts'; }
  else if (a === 'notes') { html = listView('note'); tab = 'notes'; }
  else if (a === 'item' && b && (c === 'cook' || c === 'go')) { enterMode(c === 'cook' ? 'cook' : 'workout', b); html = modeView(); }
  else if (a === 'item' && b) { html = itemView(b); tab = { recipe: 'recipes', workout: 'workouts', note: 'notes' }[store.getItem(b)?.type] || ''; }
  else if (a === 'add') { html = addView(params); tab = 'add'; }
  else if (a === 'new' && ['recipe', 'workout', 'note'].includes(b)) { if (changed || !editing.draft) startNew(b); html = editorView(); }
  else if (a === 'edit' && b) { if (changed || !editing.draft) startEdit(b); html = editorView(); }
  else if (a === 'draft') { html = editorView(); }
  else if (a === 'settings') { html = settingsView(); tab = 'settings'; }
  else { html = homeView(); tab = 'home'; }

  const focused = document.activeElement?.id === 'search' ? document.activeElement : null;
  const caret = focused?.selectionStart;
  main.innerHTML = html;
  main.dataset.view = a || 'home';
  $$('[data-tab]').forEach(el => (el.dataset.tab === tab ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current')));
  if (focused) { const s = $('#search'); s?.focus(); try { s?.setSelectionRange(caret, caret); } catch { /* ignore */ } }
  if (changed) {
    if (['recipes', 'workouts', 'notes'].includes(a) || !a) lastListRoute = location.hash || '#/';
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  lastRoute = routeKey;
}

store.onChange(() => {
  const { parts } = parseRoute();
  // Don't rebuild a form while someone is typing in it.
  if (['new', 'edit', 'draft', 'add'].includes(parts[0])) return;
  if (parts[0] === 'settings' && document.activeElement?.name === 'passcode') return;
  const y = window.scrollY;
  render({ keepScroll: true });
  window.scrollTo(0, y);
});
let inAppSteps = 0;
window.addEventListener('hashchange', () => { inAppSteps++; render(); });
window.addEventListener('themechange', () => render({ keepScroll: true }));

// ---------- actions ----------
async function runImport(input, type) {
  const text = input.trim();
  if (!text) { toast('Paste a link or some text first'); return; }
  const url = firstUrl(text);
  const st = editing.importState;
  const isJustUrl = url && text.replace(url, '').trim().length < 20;
  if (st.needsText && !isJustUrl) {
    draftFromText(text.replace(st.url, ''), { type, sourceUrl: st.url, image: st.image && await import('./ui.js').then(m => m.compressImage(st.image)).catch(() => null) });
    Object.assign(st, { needsText: false, error: '' });
    location.hash = '#/draft';
    return;
  }
  if (isJustUrl) {
    const pending = importFromLink(url, type);
    render();
    const ok = await pending;
    if (ok) location.hash = '#/draft';
    else { location.hash = `#/add?input=${encodeURIComponent(st.needsText ? '' : text)}${type ? `&type=${type}` : ''}`; render(); }
    return;
  }
  draftFromText(text, { type, sourceUrl: url || '' });
  location.hash = '#/draft';
}

async function readClipboard() {
  try { return await navigator.clipboard.readText(); } catch { return ''; }
}

document.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (['theme', 'save', 'filter', 'quick', 'pick', 'paste-link', 'clipboard', 'back', 'tag', 'revert', 'delete', 'remove-photo', 'mode-next', 'mode-prev', 'toggle-ingredients', 'timer-start', 'timer-stop', 'sync-now', 'forget-pass', 'export'].includes(action)) event.preventDefault();
  switch (action) {
    case 'save': { const on = await store.toggleSaved(el.dataset.id); toast(on ? 'Added to favorites' : 'Removed from favorites'); break; }
    case 'filter': ui.filters[el.dataset.key] = el.dataset.value; render({ keepScroll: true }); break;
    case 'quick': ui.quick[el.dataset.key] = ui.quick[el.dataset.key] === el.dataset.value ? '' : el.dataset.value; render({ keepScroll: true }); break;
    case 'pick': {
      const pool = store.byType(el.dataset.type);
      const favs = pool.filter(i => store.isSaved(i.id));
      const from = favs.length >= 2 ? favs : pool;
      if (from.length) location.hash = `#/item/${encodeURIComponent(from[Math.floor(Math.random() * from.length)].id)}`;
      break;
    }
    case 'paste-link': {
      const text = await readClipboard();
      if (text && firstUrl(text)) { location.hash = '#/add'; await runImport(text, ''); }
      else location.hash = `#/add${text ? `?input=${encodeURIComponent(text.slice(0, 4000))}` : ''}`;
      break;
    }
    case 'clipboard': {
      const text = await readClipboard();
      const ta = $('#import-input');
      if (text && ta) { ta.value = text; ta.focus(); } else toast('Long-press the box and choose Paste');
      break;
    }
    case 'back': if (inAppSteps > 0) history.back(); else location.hash = lastListRoute; break;
    case 'tag': ui.query = el.dataset.value; location.hash = '#/'; break;
    case 'revert': await store.deleteItem(el.dataset.id); toast('Original restored'); break;
    case 'theme': setTheme(el.dataset.value); render({ keepScroll: true }); break;
    case 'switch-type': switchType(el.form, el.value); render({ keepScroll: true }); break;
    case 'remove-photo': readForm(el.form); delete editing.draft.photo; render({ keepScroll: true }); break;
    case 'delete':
      if (el.dataset.confirm) { const d = editing.draft; await removeItem(el.dataset.id); location.hash = `#/${{ recipe: 'recipes', workout: 'workouts', note: 'notes' }[d?.type] || ''}`; }
      else { el.dataset.confirm = '1'; el.lastChild.textContent = 'Tap again to delete'; el.classList.add('confirming'); setTimeout(() => { if (el.isConnected) { delete el.dataset.confirm; el.lastChild.textContent = 'Delete'; el.classList.remove('confirming'); } }, 4000); }
      break;
    case 'mode-next': mode.index++; stopTimer(); mode.timerLeft = 0; mode.timerTotal = 0; render({ keepScroll: true }); break;
    case 'mode-prev': mode.index--; stopTimer(); mode.timerLeft = 0; mode.timerTotal = 0; render({ keepScroll: true }); break;
    case 'toggle-ingredients': mode.showIngredients = !mode.showIngredients; render({ keepScroll: true }); break;
    case 'timer-start': startTimer(Number(el.dataset.seconds) || 90, () => { const clock = $('#rest-clock'); if (clock && mode.timerLeft) clock.textContent = `${Math.floor(mode.timerLeft / 60)}:${String(mode.timerLeft % 60).padStart(2, '0')}`; else render({ keepScroll: true }); }); break;
    case 'timer-stop': stopTimer(); mode.timerLeft = 0; mode.timerTotal = 0; render({ keepScroll: true }); break;
    case 'sync-now': { const ok = await store.pull({ force: true }); toast(ok ? 'Synced' : 'Couldn’t sync'); render({ keepScroll: true }); break; }
    case 'forget-pass': await store.setPasscode(''); toast('Signed out on this device'); render({ keepScroll: true }); break;
    case 'export': {
      const blob = new Blob([JSON.stringify(store.exportLibrary(), null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `stevies-world-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      break;
    }
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'search') { ui.query = event.target.value; render({ keepScroll: true }); }
  if (event.target.name === 'exercises') updatePreview(event.target.form);
});

document.addEventListener('change', async event => {
  const el = event.target;
  const action = el.dataset.action;
  if (action === 'sort') { ui.sort[el.dataset.key] = el.value; render({ keepScroll: true }); }
  if (action === 'auto-night') { setAutoNight(el.checked); render({ keepScroll: true }); }
  if (action === 'photo' && el.files?.[0]) {
    readForm(el.form);
    try { await setPhoto(el.files[0]); } catch (error) { toast(error.message); }
    render({ keepScroll: true });
  }
  if (action === 'import-file' && el.files?.[0]) {
    try {
      if (el.files[0].size > 60_000_000) throw new Error('That file is too large.');
      const n = await store.importLibrary(JSON.parse(await el.files[0].text()));
      toast(`Loaded ${n} item${n === 1 ? '' : 's'}`);
    } catch (error) { toast(error.message || 'That backup couldn’t be read'); }
    el.value = '';
  }
});

document.addEventListener('submit', async event => {
  const form = event.target;
  event.preventDefault();
  if (form.dataset.form === 'import') {
    await runImport(form.input.value, form.type?.value || '');
  } else if (form.dataset.form === 'editor') {
    const err = $('#form-error');
    try {
      const saved = await saveDraft(form);
      toast('Saved');
      location.hash = `#/item/${encodeURIComponent(saved.id)}`;
    } catch (error) { err.hidden = false; err.textContent = error.message; err.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  } else if (form.dataset.form === 'passcode') {
    const code = form.passcode.value.trim();
    if (!code) { toast('Enter your passcode'); return; }
    const ok = await store.setPasscode(code);
    toast(ok ? 'Connected. Your library is syncing.' : 'That passcode didn’t work');
    render({ keepScroll: true });
  }
});

document.addEventListener('keydown', event => {
  if (!mode.kind) return;
  if (event.key === 'ArrowRight') $('[data-action="mode-next"]')?.click();
  if (event.key === 'ArrowLeft') $('[data-action="mode-prev"]')?.click();
});

// ---------- share target / ?add= links ----------
async function handleIncoming() {
  const params = new URLSearchParams(location.search);
  const incoming = params.get('add') || params.get('url') || params.get('text') || '';
  if (!incoming) return false;
  const title = params.get('title') || '';
  history.replaceState(null, '', `/${location.hash || '#/add'}`);
  const text = [incoming, params.get('text') && params.get('text') !== incoming ? params.get('text') : ''].filter(Boolean).join('\n');
  location.hash = '#/add';
  render();
  await runImport(firstUrl(text) ? firstUrl(text) : `${title}\n${text}`, '');
  return true;
}

await store.init();
render();
handleIncoming();

if ('serviceWorker' in navigator && location.hostname !== '127.0.0.1' && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
