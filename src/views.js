import { escape, icon, formatMinutes, exerciseCount, plural, renderBody, greeting, timeOfDay } from './ui.js';
import { allItems, byType, getItem, isSaved, search, isBuiltIn, isEditedBuiltIn, syncState } from './store.js';
import { scenery } from './scenery.js';
import { activeTheme } from './theme.js';

const SECTION = { recipe: { path: 'recipes', name: 'Recipes', icon: 'bowl' }, workout: { path: 'workouts', name: 'Workouts', icon: 'dumbbell' }, note: { path: 'notes', name: 'Notes', icon: 'leaf' } };
export const ui = { query: '', filters: { recipes: 'All', workouts: 'All', notes: 'All' }, quick: { recipes: '', workouts: '' }, sort: { recipes: 'new' } };

const newest = (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0);
const protein = i => i.nutrition?.protein ?? null;

// ---------- small pieces ----------
const photoEl = (item, cls = '') => item.photo?.src
  ? `<img class="${cls}" src="${escape(item.photo.src)}" alt="${escape(item.photo.alt || '')}" loading="lazy" decoding="async" />`
  : '';

export function heartButton(item, cls = '') {
  const on = isSaved(item.id);
  return `<button class="heart ${cls} ${on ? 'on' : ''}" data-action="save" data-id="${escape(item.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from favorites' : 'Add to favorites'}">${icon('heart')}</button>`;
}

const metaBits = item => {
  const bits = [];
  if (item.minutes) bits.push(`${icon('clock')}${formatMinutes(item.minutes)}`);
  if (item.type === 'recipe' && protein(item) !== null) bits.push(`${icon('flame')}${Math.round(protein(item))} g protein`);
  if (item.type === 'workout') bits.push(`${icon('list')}${plural(exerciseCount(item), 'exercise')}`);
  return bits.map(b => `<span>${b}</span>`).join('');
};

export const scheme = e => (e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.reps ? (/^[\d.-]+$/.test(e.reps) ? `${e.reps} reps` : e.reps) : e.sets ? `${e.sets} sets` : '');
const FOCUS_CLASS = f => ({ 'Lower body': 'legs', Legs: 'legs', 'Upper body': 'upper', Push: 'upper', Pull: 'upper', Core: 'core', Cardio: 'cardio', Mobility: 'core' }[f] || 'full');

export function card(item, { size = '' } = {}) {
  const href = `#/item/${encodeURIComponent(item.id)}`;
  if (item.type === 'recipe') {
    return `<article class="card card-recipe ${size}">
      <a class="card-link" href="${href}"><div class="card-photo">${photoEl(item) || `<div class="photo-empty">${icon('bowl')}</div>`}</div>
      <div class="card-body"><h3>${escape(item.title)}</h3><p class="meta">${metaBits(item)}</p></div></a>
      ${heartButton(item, 'on-photo')}</article>`;
  }
  if (item.type === 'workout') {
    return `<article class="card card-workout ${size} focus-${FOCUS_CLASS(item.focus)}">
      <a class="card-link" href="${href}"><div class="card-band">${item.photo?.src ? photoEl(item) : `<span class="band-icon">${icon('dumbbell')}</span>`}<span class="band-label">${escape(item.focus || 'Workout')}</span></div>
      <div class="card-body"><h3>${escape(item.title)}</h3><p class="meta">${metaBits(item)}</p>${item.equipment ? `<p class="equipment">${escape(item.equipment)}</p>` : ''}</div></a>
      ${heartButton(item, 'on-band')}</article>`;
  }
  const excerpt = (item.description || item.body || '').replace(/^#+\s.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 140);
  return `<article class="card card-note ${size}"><a class="card-link" href="${href}">
    <span class="note-category">${escape(item.category || 'Note')}</span><h3>${escape(item.title)}</h3>${excerpt ? `<p>${escape(excerpt)}</p>` : ''}</a>
    ${heartButton(item, 'on-note')}</article>`;
}

const shelf = (title, items, link, empty) => `
  <section class="shelf">
    <div class="shelf-head"><h2>${title}</h2>${link && items.length ? `<a class="see-all" href="${link}">See all</a>` : ''}</div>
    ${items.length ? `<div class="shelf-row">${items.map(i => card(i, { size: 'card-shelf' })).join('')}</div>` : empty}
  </section>`;

const emptyInvite = (type, text) => `<div class="empty-invite"><p>${text}</p><div class="empty-actions"><a class="btn btn-primary" href="#/add">${icon('paste')}Paste a link</a><a class="btn btn-ghost" href="#/new/${type}">Write one</a></div></div>`;

// ---------- home ----------
export function homeView() {
  const theme = activeTheme();
  const time = theme === 'night' ? 'night' : theme === 'retro' ? 'day' : timeOfDay();
  const q = ui.query.trim();
  const items = allItems();
  const favs = items.filter(i => isSaved(i.id)).sort(newest);
  const recipes = byType('recipe').sort(newest);
  const workouts = byType('workout').sort(newest);
  const notes = byType('note').sort(newest);
  const sync = syncState();
  const hero = theme === 'plain'
    ? `<section class="hero hero-plain"><h1>${greeting()}, Steven.</h1></section>`
    : `<section class="hero"><div class="hero-window">${theme === 'retro' ? `<div class="titlebar"><span>stevies_world.exe</span><span class="titlebar-buttons" aria-hidden="true"><i></i><i></i><i></i></span></div>` : ''}
        <div class="hero-scene">${scenery(time)}</div>
        <h1 class="hero-greeting">${greeting()}, Steven.</h1></div></section>`;
  return `${hero}
  <div class="home-search">${searchBox('Search recipes, workouts, notes…')}</div>
  ${!sync.available || sync.connected || !sync.hasPasscode ? '' : `<p class="sync-note">${escape(sync.error || 'Syncing…')}</p>`}
  ${q ? resultsList(search(q, items)) : `
    <section class="quick-add">
      <div><h2>Saw something good?</h2><p>Paste a recipe or workout from TikTok, Instagram, YouTube or any recipe site.</p></div>
      <button class="btn btn-primary" data-action="paste-link">${icon('paste')}Paste a link</button>
    </section>
    <div class="decide">
      <button class="btn btn-soft" data-action="pick" data-type="recipe" ${recipes.length ? '' : 'disabled'}>${icon('shuffle')}Pick a meal</button>
      <button class="btn btn-soft" data-action="pick" data-type="workout" ${workouts.length ? '' : 'disabled'}>${icon('shuffle')}Pick a workout</button>
    </div>
    ${favs.length ? shelf('Favorites', favs.slice(0, 12), '', '') : ''}
    ${shelf('Recipes', recipes.slice(0, 10), '#/recipes', emptyInvite('recipe', 'No recipes yet.'))}
    ${shelf('Workouts', workouts.slice(0, 10), '#/workouts', emptyInvite('workout', 'Save a workout here and it’s ready whenever you are. Paste one from TikTok or Instagram, or write your own.'))}
    ${shelf('Notes', notes.slice(0, 8), '#/notes', emptyInvite('note', 'Keep anything else here: sizes, gear, routines, links.'))}
  `}`;
}

export function searchBox(placeholder) {
  return `<label class="search">${icon('search')}<span class="sr-only">Search</span><input id="search" type="search" enterkeyhint="search" autocomplete="off" placeholder="${escape(placeholder)}" value="${escape(ui.query)}" /></label>`;
}

function resultsList(items) {
  if (!items.length) return `<p class="empty-line">Nothing matches “${escape(ui.query)}”. Try fewer words, or <a href="#/add">add it</a>.</p>`;
  return `<div class="grid">${items.map(i => card(i)).join('')}</div>`;
}

// ---------- section pages ----------
export function listView(type) {
  const sec = SECTION[type];
  const key = sec.path;
  let items = byType(type);
  const categoryOf = i => (type === 'workout' ? i.focus : i.category) || 'Other';
  const cats = ['All', 'Favorites', ...[...new Set(items.map(categoryOf))].sort()];
  if (!cats.includes(ui.filters[key])) ui.filters[key] = 'All';
  const active = ui.filters[key];
  if (active === 'Favorites') items = items.filter(i => isSaved(i.id));
  else if (active !== 'All') items = items.filter(i => categoryOf(i) === active);
  if (ui.query.trim()) items = search(ui.query, items);
  const quick = ui.quick[key];
  if (quick === 'fast') items = items.filter(i => i.minutes && i.minutes <= 30);
  if (quick === 'protein') items = items.filter(i => (protein(i) ?? 0) >= 30);
  if (quick === 'short') items = items.filter(i => i.minutes && i.minutes <= 30);
  if (quick === 'noequip') items = items.filter(i => !i.equipment || /bodyweight/i.test(i.equipment));
  const sort = ui.sort[key] || 'new';
  items.sort(sort === 'quick' ? (a, b) => (a.minutes || 9999) - (b.minutes || 9999) : sort === 'protein' ? (a, b) => (protein(b) ?? -1) - (protein(a) ?? -1) : sort === 'az' ? (a, b) => a.title.localeCompare(b.title) : newest);
  const quickChips = type === 'recipe'
    ? [['fast', '30 min or less'], ['protein', '30 g+ protein']]
    : type === 'workout' ? [['short', '30 min or less'], ['noequip', 'No equipment']] : [];
  const sorts = type === 'recipe' ? [['new', 'Newest'], ['quick', 'Quickest'], ['protein', 'Most protein'], ['az', 'A to Z']] : [['new', 'Newest'], ['az', 'A to Z'], ...(type === 'workout' ? [['quick', 'Shortest']] : [])];
  return `<section class="page-head">
      <h1>${sec.name}</h1>
      <div class="page-actions">
        ${type !== 'note' ? `<button class="btn btn-soft btn-small" data-action="pick" data-type="${type}" ${items.length ? '' : 'disabled'}>${icon('shuffle')}Pick one</button>` : ''}
        <a class="btn btn-primary btn-small" href="#/add?type=${type}">${icon('plus')}Add</a>
      </div>
    </section>
    <div class="list-tools">
      ${searchBox(`Search ${sec.name.toLowerCase()}…`)}
      <div class="chips" role="group" aria-label="Filter">
        ${cats.map(c => `<button class="chip ${c === active ? 'on' : ''}" data-action="filter" data-key="${key}" data-value="${escape(c)}" aria-pressed="${c === active}">${c === 'Favorites' ? icon('heart') : ''}${escape(c)}</button>`).join('')}
      </div>
      <div class="chips chips-secondary">
        ${quickChips.map(([v, label]) => `<button class="chip chip-outline ${quick === v ? 'on' : ''}" data-action="quick" data-key="${key}" data-value="${v}" aria-pressed="${quick === v}">${label}</button>`).join('')}
        <label class="sort">Sort<select data-action="sort" data-key="${key}">${sorts.map(([v, l]) => `<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
    </div>
    ${items.length ? `<div class="grid grid-${type}">${items.map(i => card(i)).join('')}</div>` : byType(type).length ? `<p class="empty-line">Nothing here with these filters.</p>` : emptyInvite(type, type === 'workout' ? 'Save a workout here and it’s ready whenever you are.' : type === 'note' ? 'Keep anything else here: sizes, gear, routines, links.' : 'No recipes yet.')}`;
}

// ---------- item page ----------
function nutritionBlock(item) {
  const n = item.nutrition;
  if (!n && !item.cost) return '';
  const servings = item.servings || 1;
  const stat = (v, unit, label) => (v === null || v === undefined ? '' : `<div class="stat"><strong>${Math.round(v)}<small>${unit}</small></strong><span>${label}</span></div>`);
  return `<section class="block"><h2>Per serving</h2>
    <div class="stats">${n ? stat(n.calories, '', 'calories') + stat(n.protein, 'g', 'protein') + stat(n.carbs, 'g', 'carbs') + stat(n.fat, 'g', 'fat') : ''}
    ${item.cost ? `<div class="stat"><strong>$${(item.cost.total / servings).toFixed(2)}</strong><span>cost</span></div>` : ''}</div>
    ${n?.note || item.cost?.note ? `<details class="fine"><summary>How these were estimated</summary>${n?.note ? `<p>${escape(n.note)}</p>` : ''}${item.cost?.note ? `<p>${escape(item.cost.note)}</p>` : ''}${[...(n?.sources || []), ...(item.cost?.sources || [])].length ? `<ul class="sources">${[...(n?.sources || []), ...(item.cost?.sources || [])].map(s => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a></li>`).join('')}</ul>` : ''}</details>` : ''}
  </section>`;
}

const lineList = (lines, ordered) => {
  let n = 0;
  const out = lines.map(l => (/:\s*$/.test(l) && l.length < 60
    ? `<li class="subhead">${escape(l.replace(/:\s*$/, ''))}</li>`
    : `<li>${ordered ? `<span class="step-num">${++n}</span>` : ''}<span>${escape(l)}</span></li>`)).join('');
  return ordered ? `<ol class="steps">${out}</ol>` : `<ul class="ingredients">${out}</ul>`;
};

export function itemView(id) {
  const item = getItem(id);
  if (!item) return `<section class="page-head"><h1>Not found</h1></section><p class="empty-line">This item was deleted or hasn’t synced to this device yet. <a href="#/">Go home</a></p>`;
  const sec = SECTION[item.type];
  const builtIn = isBuiltIn(item.id);
  const primary = item.type === 'recipe' && item.steps?.length ? `<a class="btn btn-primary" href="#/item/${encodeURIComponent(item.id)}/cook">${icon('play')}Cook mode</a>`
    : item.type === 'workout' && exerciseCount(item) ? `<a class="btn btn-primary" href="#/item/${encodeURIComponent(item.id)}/go">${icon('play')}Start workout</a>` : '';
  const source = item.sourceUrl ? `<a class="btn btn-ghost" href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${icon('link')}${escape(item.sourceName ? `Open on ${item.sourceName.replace(/^.* on /, '')}` : 'Open original')}</a>` : '';
  const facts = [];
  if (item.minutes) facts.push(`${icon('clock')}${formatMinutes(item.minutes)}`);
  if (item.type === 'recipe' && item.servings) facts.push(`${icon('people')}Serves ${item.servings}`);
  if (item.type === 'workout') facts.push(`${icon('dumbbell')}${escape(item.focus || 'Workout')}`);
  if (item.type === 'workout' && item.equipment) facts.push(escape(item.equipment));
  if (item.type === 'note') facts.push(escape(item.category || 'Note'));
  let content = '';
  if (item.type === 'recipe') {
    content = `${item.ingredients?.length ? `<section class="block"><h2>Ingredients</h2>${lineList(item.ingredients, false)}</section>` : ''}
      ${item.steps?.length ? `<section class="block"><h2>Steps</h2>${lineList(item.steps, true)}</section>` : ''}
      ${nutritionBlock(item)}`;
  } else if (item.type === 'workout') {
    content = (item.blocks || []).map(b => `<section class="block"><h2>${escape(b.name || 'Exercises')}</h2><ul class="exercises">${b.exercises.map(e => `<li><div class="ex-main"><span class="ex-name">${escape(e.name)}</span>${e.sets || e.reps ? `<span class="ex-scheme">${escape(scheme(e))}</span>` : ''}</div>${e.rest || e.note ? `<div class="ex-sub">${e.rest ? `<span>${icon('timer')}Rest ${escape(e.rest)}</span>` : ''}${e.note ? `<span>${escape(e.note)}</span>` : ''}</div>` : ''}</li>`).join('')}</ul></section>`).join('')
      || `<p class="empty-line">No exercises yet. <a href="#/edit/${encodeURIComponent(item.id)}">Add some</a>.</p>`;
  } else {
    content = `<section class="block prose">${renderBody(item.body || '')}</section>`;
  }
  const sources = item.sources?.length ? `<section class="block fine"><h2>Sources</h2><ul class="sources">${item.sources.map(s => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.label)}</a></li>`).join('')}</ul></section>` : '';
  const credit = item.photo?.credit || item.photo?.caption ? `<p class="photo-credit">${escape([item.photo.caption, item.photo.credit && `Photo: ${item.photo.credit}${item.photo.license ? ` (${item.photo.license})` : ''}`].filter(Boolean).join(' '))}</p>` : '';
  return `<article class="item item-${item.type}">
    <div class="item-top ${item.photo?.src ? 'has-photo' : `no-photo ${item.type === 'workout' ? `focus-${FOCUS_CLASS(item.focus)}` : ''}`}">
      ${item.photo?.src ? photoEl(item, 'item-photo') : activeTheme() === 'plain' ? '' : `<div class="item-scene">${scenery(activeTheme() === 'night' ? 'night' : activeTheme() === 'retro' ? 'day' : timeOfDay())}</div>`}
      <a class="round-btn back" href="#/${sec.path}" data-action="back" aria-label="Back">${icon('back')}</a>
      ${heartButton(item, 'round-btn heart-top')}
    </div>
    <div class="item-sheet">
      <p class="kicker">${builtIn ? (item.type === 'recipe' ? 'From your cookbook' : 'Healthy-living guide') : escape(item.sourceName || sec.name.slice(0, -1))}</p>
      <h1>${escape(item.title)}</h1>
      ${item.description ? `<p class="lede">${escape(item.description)}</p>` : ''}
      ${facts.length ? `<p class="facts">${facts.map(f => `<span>${f}</span>`).join('')}</p>` : ''}
      <div class="item-actions">${primary}${source}<a class="btn btn-ghost" href="#/edit/${encodeURIComponent(item.id)}">${icon('edit')}Edit</a></div>
      ${content}
      ${item.note ? `<section class="block"><h2>Notes</h2><div class="prose">${renderBody(item.note)}</div></section>` : ''}
      ${item.tags?.length ? `<p class="tags">${item.tags.map(t => `<button class="tag" data-action="tag" data-value="${escape(t)}">${escape(t)}</button>`).join('')}</p>` : ''}
      ${sources}${credit}
      ${isEditedBuiltIn(item.id) ? `<p class="fine">You edited this cookbook entry. <button class="link-btn" data-action="revert" data-id="${escape(item.id)}">Restore the original</button></p>` : ''}
    </div>
  </article>`;
}
