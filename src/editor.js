import { escape, icon, compressImage, toast, plural } from './ui.js';
import { getItem, saveItem, deleteItem, isBuiltIn, allItems, passcodeHeader } from './store.js';
import { parseText, parseWorkoutBlocks, formatWorkoutBlocks } from '../shared/parse.js';
import { RECIPE_CATEGORIES, WORKOUT_FOCUS, newId } from '../shared/schema.js';

// The draft being edited (new, imported or existing). Kept in memory so the type
// switch and photo picker don't lose what you typed.
export const editing = { draft: null, raw: '', origin: '', banner: '', importState: { busy: false, error: '', needsText: false, url: '', image: null, type: '' } };

const URL_RE = /https?:\/\/[^\s<>"']+/i;
export const firstUrl = text => (String(text).match(URL_RE)?.[0] || '').replace(/[),.;!?]+$/, '');

const blank = type => ({ id: '', type, title: '', description: '', tags: [], sourceUrl: '', sourceName: '', note: '',
  ...(type === 'recipe' ? { category: 'Dinner', minutes: null, servings: null, ingredients: [], steps: [], nutrition: null } : {}),
  ...(type === 'workout' ? { focus: 'Full body', minutes: null, equipment: '', blocks: [] } : {}),
  ...(type === 'note' ? { category: 'General', body: '' } : {}) });

export function startNew(type) {
  editing.draft = blank(type);
  editing.raw = ''; editing.origin = 'new'; editing.banner = '';
}
export function startEdit(id) {
  const item = getItem(id);
  if (!item) return false;
  editing.draft = structuredClone(item);
  editing.raw = ''; editing.origin = 'edit'; editing.banner = isBuiltIn(id) ? 'Edits to cookbook entries are saved as your own version. You can restore the original later.' : '';
  return true;
}

function fromParsed(parsed, extra = {}) {
  const d = { ...blank(parsed.type), ...parsed, ...extra };
  if (d.type === 'recipe' && d.nutrition && Object.values(d.nutrition).every(v => v === null)) d.nutrition = null;
  return d;
}

/** Text pasted directly (not a link): parse on the device. */
export function draftFromText(text, { type, sourceUrl = '', sourceName = '', image = null } = {}) {
  const parsed = parseText(text, { type });
  editing.draft = fromParsed(parsed, { sourceUrl, sourceName });
  if (image) editing.draft.photo = { src: image, alt: parsed.title };
  editing.raw = text; editing.origin = 'import';
  const found = parsed.type === 'recipe' ? `${plural(parsed.ingredients.length, 'ingredient')} and ${plural(parsed.steps.length, 'step')}` : parsed.type === 'workout' ? plural(parsed.blocks.reduce((n, b) => n + b.exercises.length, 0), 'exercise') : 'a note';
  editing.banner = `Found ${found}. Check it over, fix anything that looks off, then save.`;
}

export async function importFromLink(url, type) {
  const st = editing.importState;
  Object.assign(st, { busy: true, error: '', needsText: false, url, image: null, type: type || '' });
  try {
    const res = await fetch('/api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', ...passcodeHeader() }, body: JSON.stringify({ url, type: type || undefined }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 422 && data.needsText) { Object.assign(st, { needsText: true, error: data.error, image: data.image }); return false; }
    if (res.status === 404) throw new Error('Link import needs the site to be running on Vercel (or `npm run dev`). Paste the caption text instead.');
    if (!res.ok) throw new Error(data.error || 'That link couldn’t be imported.');
    let photo = null;
    if (data.image) { try { photo = { src: await compressImage(data.image), alt: data.draft.title }; } catch { /* keep going without */ } }
    editing.draft = fromParsed(data.draft);
    if (photo) editing.draft.photo = photo;
    editing.raw = data.raw || ''; editing.origin = 'import';
    const d = editing.draft;
    const where = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube' }[data.platform] || 'the page';
    const found = d.type === 'recipe' ? `${plural(d.ingredients.length, 'ingredient')} and ${plural(d.steps.length, 'step')}` : d.type === 'workout' ? plural(d.blocks.reduce((n, b) => n + b.exercises.length, 0), 'exercise') : 'a note';
    editing.banner = `Pulled ${found} from ${where}. Check it over, then save.`;
    if (d.type === 'recipe' && !d.ingredients.length && !d.steps.length) editing.banner = `${where === 'the page' ? 'That page' : `The ${where} caption`} didn’t list ingredients or steps. Fill them in below, or switch the type to Note.`;
    return true;
  } catch (error) {
    st.error = navigator.onLine === false ? 'You’re offline. Connect to import links, or paste the caption text.' : error.message;
    return false;
  } finally { st.busy = false; }
}

// ---------- add view ----------
export function addView(params) {
  const st = editing.importState;
  const type = params.get('type') || st.type || '';
  return `<section class="page-head"><h1>Add something</h1></section>
  <form class="add-form" data-form="import">
    <label class="field-label" for="import-input">Paste a link or the caption text</label>
    <textarea id="import-input" name="input" rows="${st.needsText ? 8 : 3}" placeholder="https://www.tiktok.com/@… or an Instagram, YouTube or recipe link" autocapitalize="off" spellcheck="false">${escape(params.get('input') || '')}</textarea>
    ${st.error ? `<p class="form-msg ${st.needsText ? 'msg-info' : 'msg-error'}" role="alert">${escape(st.error)}</p>` : ''}
    ${st.error && !st.needsText ? `<p class="hint">You can also paste the caption or recipe text into the box instead.</p>` : ''}
    ${st.needsText ? `<p class="hint">The link is remembered, so the saved item will still point back to the original.</p>` : ''}
    <fieldset class="type-pick"><legend>It’s a…</legend>
      ${[['', 'Let it guess'], ['recipe', 'Recipe'], ['workout', 'Workout'], ['note', 'Note']].map(([v, l]) => `<label class="seg"><input type="radio" name="type" value="${v}" ${v === type ? 'checked' : ''}/><span>${l}</span></label>`).join('')}
    </fieldset>
    <div class="add-actions">
      <button type="button" class="btn btn-ghost" data-action="clipboard">${icon('paste')}Paste</button>
      <button type="submit" class="btn btn-primary" ${st.busy ? 'disabled' : ''}>${st.busy ? '<span class="spinner"></span>Reading…' : st.needsText ? 'Use this text' : 'Import'}</button>
    </div>
  </form>
  <section class="from-scratch"><h2>Or start from scratch</h2>
    <div class="scratch-row">
      <a class="scratch" href="#/new/recipe">${icon('bowl')}<span>Recipe</span></a>
      <a class="scratch" href="#/new/workout">${icon('dumbbell')}<span>Workout</span></a>
      <a class="scratch" href="#/new/note">${icon('leaf')}<span>Note</span></a>
    </div>
  </section>`;
}

// ---------- editor ----------
const lines = arr => escape((arr || []).join('\n'));
const field = (label, input, hint = '') => `<label class="field"><span class="field-label">${label}</span>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
const num = (name, value, attrs = '') => `<input type="number" inputmode="decimal" name="${name}" value="${value ?? ''}" min="0" ${attrs}/>`;

export function editorView() {
  const d = editing.draft;
  if (!d) return `<p class="empty-line">Nothing to edit. <a href="#/add">Add something</a>.</p>`;
  const isNew = !d.id;
  const types = [['recipe', 'Recipe'], ['workout', 'Workout'], ['note', 'Note']];
  const categories = [...new Set([...allItems().filter(i => i.type === 'note').map(i => i.category), 'General', 'Healthy living', 'Gear', 'Links', 'Lists'])].filter(Boolean);
  let body = '';
  if (d.type === 'recipe') {
    body = `
      <div class="field-row">
        ${field('Category', `<select name="category">${[...new Set([...RECIPE_CATEGORIES, d.category])].map(c => `<option ${c === d.category ? 'selected' : ''}>${escape(c)}</option>`).join('')}</select>`)}
        ${field('Minutes', num('minutes', d.minutes, 'max="2880"'))}
        ${field('Serves', num('servings', d.servings, 'max="100"'))}
      </div>
      ${field('Ingredients', `<textarea name="ingredients" rows="8" placeholder="200 g chicken thighs&#10;1 tbsp soy sauce&#10;For the sauce:&#10;2 tbsp honey">${lines(d.ingredients)}</textarea>`, 'One per line. A line ending in a colon becomes a small heading.')}
      ${field('Steps', `<textarea name="steps" rows="8" placeholder="Season the chicken.&#10;Cook for 6 minutes per side.">${lines(d.steps)}</textarea>`, 'One step per line.')}
      <fieldset class="macros"><legend>Per serving <span class="optional">optional</span></legend>
        ${field('Calories', num('calories', d.nutrition?.calories))}${field('Protein g', num('protein', d.nutrition?.protein))}${field('Carbs g', num('carbs', d.nutrition?.carbs))}${field('Fat g', num('fat', d.nutrition?.fat))}
      </fieldset>`;
  } else if (d.type === 'workout') {
    const text = formatWorkoutBlocks(d.blocks);
    body = `
      <div class="field-row">
        ${field('Focus', `<select name="focus">${[...new Set([...WORKOUT_FOCUS, d.focus])].map(c => `<option ${c === d.focus ? 'selected' : ''}>${escape(c)}</option>`).join('')}</select>`)}
        ${field('Minutes', num('minutes', d.minutes, 'max="600"'))}
      </div>
      ${field('Equipment', `<input name="equipment" value="${escape(d.equipment)}" placeholder="Dumbbells, bench" />`)}
      ${field('Exercises', `<textarea name="exercises" rows="10" placeholder="Warm-up:&#10;Bike 5 min&#10;&#10;Main:&#10;Goblet squat 3x10 rest 60s&#10;Push-ups 3x12 (slow down)">${escape(text)}</textarea>`, 'One per line, like “Goblet squat 3x10 rest 60s (notes)”. A line ending in a colon starts a new section.')}
      <p class="parse-preview" id="parse-preview">${previewText(d.blocks)}</p>`;
  } else {
    body = `
      ${field('Category', `<input name="category" list="note-cats" value="${escape(d.category)}" /><datalist id="note-cats">${categories.map(c => `<option value="${escape(c)}"></option>`).join('')}</datalist>`)}
      ${field('Note', `<textarea name="body" rows="12" placeholder="Write anything. Start a line with “## ” for a heading or “- ” for a list.">${escape(d.body)}</textarea>`)}`;
  }
  return `<form class="editor" data-form="editor" novalidate>
    <header class="editor-head">
      <a class="round-btn" href="${d.id ? `#/item/${encodeURIComponent(d.id)}` : '#/add'}" aria-label="Cancel">${icon('close')}</a>
      <h1>${isNew ? (editing.origin === 'import' ? 'Check and save' : `New ${d.type}`) : 'Edit'}</h1>
      <button class="btn btn-primary btn-small" type="submit">Save</button>
    </header>
    ${editing.banner ? `<p class="form-msg msg-info">${escape(editing.banner)}</p>` : ''}
    ${isNew ? `<fieldset class="type-pick type-pick-tight"><legend class="sr-only">Type</legend>${types.map(([v, l]) => `<label class="seg"><input type="radio" name="type" value="${v}" ${v === d.type ? 'checked' : ''} data-action="switch-type"/><span>${l}</span></label>`).join('')}</fieldset>` : ''}
    <div class="photo-pick">
      ${d.photo?.src ? `<img src="${escape(d.photo.src)}" alt="" />` : `<div class="photo-empty">${icon('camera')}</div>`}
      <div class="photo-buttons">
        <label class="btn btn-ghost btn-small">${icon('camera')}${d.photo?.src ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" data-action="photo" hidden /></label>
        ${d.photo?.src ? `<button type="button" class="btn btn-ghost btn-small" data-action="remove-photo">Remove</button>` : ''}
      </div>
    </div>
    ${field('Title', `<input name="title" value="${escape(d.title)}" required maxlength="150" />`)}
    ${field('Short description', `<textarea name="description" rows="2" maxlength="1000">${escape(d.description)}</textarea>`)}
    ${body}
    ${d.type !== 'note' ? field('Notes', `<textarea name="note" rows="3">${escape(d.note)}</textarea>`) : ''}
    ${field('Tags', `<input name="tags" value="${escape((d.tags || []).join(', '))}" placeholder="high protein, meal prep" />`, 'Separate with commas.')}
    ${field('Link to the original', `<input name="sourceUrl" type="url" inputmode="url" value="${escape(d.sourceUrl)}" placeholder="https://" />`)}
    <p class="form-msg msg-error" id="form-error" role="alert" hidden></p>
    <div class="editor-foot">
      <button class="btn btn-primary" type="submit">Save</button>
      ${d.id && !isBuiltIn(d.id) && getItem(d.id) ? `<button type="button" class="btn btn-danger" data-action="delete" data-id="${escape(d.id)}">${icon('trash')}Delete</button>` : ''}
    </div>
  </form>`;
}

function previewText(blocks) {
  const n = blocks.reduce((s, b) => s + b.exercises.length, 0);
  return n ? `Reads as ${plural(n, 'exercise')}${blocks.length > 1 ? ` in ${plural(blocks.length, 'section')}` : ''}.` : 'No exercises recognised yet.';
}

/** Copy form fields into the draft (used before re-rendering and before saving). */
export function readForm(form) {
  const d = editing.draft;
  const f = new FormData(form);
  const val = k => (f.has(k) ? String(f.get(k)) : undefined);
  const numOrNull = k => { const v = val(k); return v === undefined || v.trim() === '' ? null : Number(v); };
  if (val('title') !== undefined) d.title = val('title');
  if (val('description') !== undefined) d.description = val('description');
  if (val('note') !== undefined) d.note = val('note');
  if (val('tags') !== undefined) d.tags = val('tags').split(',').map(t => t.trim()).filter(Boolean);
  if (val('sourceUrl') !== undefined) d.sourceUrl = val('sourceUrl').trim();
  if (d.type === 'recipe') {
    if (val('category') !== undefined) d.category = val('category');
    d.minutes = numOrNull('minutes'); d.servings = numOrNull('servings');
    if (val('ingredients') !== undefined) d.ingredients = val('ingredients').split('\n').map(s => s.trim()).filter(Boolean);
    if (val('steps') !== undefined) d.steps = val('steps').split('\n').map(s => s.trim()).filter(Boolean);
    const n = { calories: numOrNull('calories'), protein: numOrNull('protein'), carbs: numOrNull('carbs'), fat: numOrNull('fat') };
    d.nutrition = Object.values(n).some(v => v !== null) ? { ...(d.nutrition || {}), ...n } : null;
  } else if (d.type === 'workout') {
    if (val('focus') !== undefined) d.focus = val('focus');
    d.minutes = numOrNull('minutes');
    if (val('equipment') !== undefined) d.equipment = val('equipment');
    if (val('exercises') !== undefined) d.blocks = parseWorkoutBlocks(val('exercises'));
  } else {
    if (val('category') !== undefined) d.category = val('category');
    if (val('body') !== undefined) d.body = val('body');
  }
  return d;
}

export function switchType(form, type) {
  readForm(form);
  const d = editing.draft;
  if (d.type === type) return;
  // Re-read the original caption with the new type when we have it; otherwise carry text over.
  const text = editing.raw || [d.title, d.description, ...(d.ingredients || []), ...(d.steps || []), formatWorkoutBlocks(d.blocks || []), d.body, d.note].filter(Boolean).join('\n');
  const keep = { sourceUrl: d.sourceUrl, sourceName: d.sourceName, photo: d.photo, title: d.title, tags: d.tags };
  const parsed = parseText(text, { type, title: d.title });
  editing.draft = { ...blank(type), ...parsed, ...keep };
  if (type === 'note' && !editing.draft.body) editing.draft.body = text;
}

export function updatePreview(form) {
  const ta = form.querySelector('textarea[name="exercises"]');
  const el = form.querySelector('#parse-preview');
  if (ta && el) el.textContent = previewText(parseWorkoutBlocks(ta.value));
}

export async function setPhoto(file) {
  editing.draft.photo = { src: await compressImage(file), alt: editing.draft.title || 'Photo' };
}

export async function saveDraft(form) {
  const d = readForm(form);
  if (!d.title.trim()) throw new Error('Add a title before saving.');
  if (d.photo && !d.photo.alt) d.photo.alt = d.title;
  const saved = await saveItem({ ...d, id: d.id || newId(d.type) });
  editing.draft = null; editing.banner = '';
  Object.assign(editing.importState, { error: '', needsText: false, url: '', image: null });
  return saved;
}

export async function removeItem(id) {
  await deleteItem(id);
  editing.draft = null;
  toast('Deleted');
}
