import { recipes, articles } from './content.js';
import { recipeEstimates } from './estimates.js';
import { STORAGE_KEY, emptyLibrary, safeUrl, validateLibrary, mergeLibraries } from './storage.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icons = {
  search: '<circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 5 5"/>',
  bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  leaf: '<path d="M19 4C8 3 3 8 6 15s14 4 13-11Z"/><path d="M4 21 15 10"/>',
  moon: '<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',
  movement: '<circle cx="15" cy="4" r="2"/><path d="m11 8 4 2 4 1M5 12l5-4 2 6-5 7m5-7 5 6"/>',
  water: '<path d="M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z"/>',
  food: '<path d="M7 3v7M4 3v5a3 3 0 0 0 6 0V3M7 11v10M19 3v18m0-18c-5 3-5 10 0 10"/>',
  external: '<path d="M14 4h6v6m0-6-9 9M10 4H4v16h16v-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>'
};
const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
const imageNames = { oats: 'A bowl of oats with fruit', salmon: 'A cooked salmon dish', chickpea: 'A colorful vegetable and chickpea bowl', noodles: 'Noodles with fresh vegetables', eggs: 'Eggs on toast', soup: 'A bowl of vegetable soup' };
const articleIcons = { Nutrition: 'leaf', Sleep: 'moon', Movement: 'movement', Hydration: 'water', 'Food safety': 'food' };
let library = emptyLibrary();
let storageError = '';
let recoveryRaw = null;
try { recoveryRaw = localStorage.getItem(STORAGE_KEY); if (recoveryRaw) library = validateLibrary(JSON.parse(recoveryRaw)); recoveryRaw = null; } catch { storageError = 'Your browser library could not be read. Saving is paused to protect it. Export the original data from Your library & backups, or import a valid backup to restore it.'; }
let view = 'home';
let query = '';
let category = 'All';
let collectionOnly = false;
let activeDetail = null;
let estimateBasis = 'serving';
let expandedEstimates = new Set();
let toastTimeout;
const allRecipes = () => [...recipes.map(x => ({ ...x, ...recipeEstimates[x.id], type: 'recipe' })), ...library.entries.filter(x => x.type === 'recipe')];
const allArticles = () => [...articles.map(x => ({ ...x, type: 'article' })), ...library.entries.filter(x => x.type === 'article')];
const allItems = () => [...allRecipes(), ...allArticles()];
const saved = id => library.saved.includes(id);
const link = (url, text, cls = '') => safeUrl(url) ? `<a class="${cls}" href="${escape(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escape(text)} ${icon('external')}</a>` : '';

function toast(message) { clearTimeout(toastTimeout); $('#toast').textContent = message; $('#toast').classList.add('visible'); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
function persist(next) {
  if (storageError) { toast('Saving is paused. Open Your library & backups to export the original data or restore a valid backup.'); return false; }
  try { const valid = validateLibrary(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(valid)); library = valid; return true; }
  catch (error) { toast(`Couldn't save: ${error.message}. Export a backup or free browser storage.`); return false; }
}
function saveButton(item, long = false) { return `<button class="${long ? 'button button-outline' : 'save-button icon-button'} ${saved(item.id) ? 'is-saved' : ''}" data-save="${escape(item.id)}" aria-pressed="${saved(item.id)}" aria-label="${saved(item.id) ? 'Unsave' : 'Save'} ${escape(item.title)}">${icon('bookmark')}${long ? saved(item.id) ? 'Saved to collection' : 'Save to collection' : ''}</button>`; }
function recipeCard(item) {
  return `<article class="recipe-card"><div class="recipe-image-wrap"><button class="image-open" data-open="${escape(item.id)}" aria-label="Read ${escape(item.title)}">${item.imageKey ? `<img src="/assets/${escape(item.imageKey)}.jpg" alt="${escape(imageNames[item.imageKey])}" loading="lazy" />` : `<span class="recipe-placeholder">${icon('food')}</span>`}</button><span class="image-category">${escape(item.category)}</span>${saveButton(item)}</div><div class="recipe-meta"><span>${icon('clock')}${item.minutes} min</span><span>${escape(item.personal ? 'Your find' : item.tags?.[0] || 'Everyday cooking')}</span></div><h3><button data-open="${escape(item.id)}">${escape(item.title)}</button></h3><p>${escape(item.description)}</p></article>`;
}
function articleCard(item) {
  return `<article class="article-card tone-${escape(articleIcons[item.category] || 'leaf')}"><div class="article-card-top"><span class="article-icon">${icon(articleIcons[item.category] || 'leaf')}</span>${saveButton(item)}</div><div class="article-meta"><span>${escape(item.category)}</span><span>${item.readMinutes || 2} min read</span></div><h3><button data-open="${escape(item.id)}">${escape(item.title)}</button></h3><p>${escape(item.description)}</p><button class="article-read" data-open="${escape(item.id)}" aria-label="Read ${escape(item.title)}">${item.personal ? 'Read note' : 'Read the guide'}${icon('arrow')}</button></article>`;
}
function filters() {
  const options = view === 'recipes' ? ['All', 'Breakfast', 'Lunch', 'Dinner'] : view === 'health' ? ['All', 'Nutrition', 'Sleep', 'Movement', 'Hydration', 'Food safety'] : [];
  return `<div class="filters">${options.length ? `<div class="filter-chips" aria-label="Filter by category">${options.map(c => `<button class="chip ${c === category ? 'active' : ''}" data-category="${c}" aria-pressed="${c === category}">${c === 'All' ? 'Everything' : c}</button>`).join('')}</div>` : ''}<button class="chip collection-toggle ${collectionOnly ? 'active' : ''}" data-action="toggle-saved" aria-pressed="${collectionOnly}">${icon('bookmark')}Saved only</button></div>`;
}
function matches(item) { const haystack = [item.title, item.description, item.category, ...(item.tags || []), ...(item.ingredients || []), ...(item.sections || []).map(s => s.body)].join(' ').toLowerCase(); return (!query || haystack.includes(query.toLowerCase())) && (category === 'All' || item.category === category) && (!collectionOnly || saved(item.id)); }
function emptyState() { return `<div class="empty-state">${icon('search')}<h3>${collectionOnly ? 'A little room for your favorites.' : 'Nothing here just yet.'}</h3><p>${collectionOnly ? 'Save a recipe or guide using its bookmark, and find it here.' : 'Try another search or add a recipe or note of your own.'}</p><button class="button button-outline" data-action="reset">${collectionOnly ? 'Browse everything' : 'Clear filters'}</button></div>`; }
function results() {
  const r = allRecipes().filter(matches), a = allArticles().filter(matches);
  const isLanding = view === 'home' && !query && !collectionOnly;
  const count = (view === 'recipes' ? r.length : view === 'health' ? a.length : r.length + a.length);
  let html = !isLanding ? `<p class="result-count" role="status">${count} ${count === 1 ? 'find' : 'finds'}${query ? ` for “${escape(query)}”` : ''}</p>` : '';
  if (!count) return html + emptyState();
  if (view !== 'health' && r.length) html += `<section class="content-section" aria-labelledby="recipe-heading"><div class="section-heading"><div><h2 id="recipe-heading">${isLanding ? 'Something good to cook.' : view === 'recipes' ? 'The recipe collection' : 'Recipes'}</h2>${isLanding ? '<p>Simple ingredients. Meals worth making.</p>' : ''}</div>${isLanding ? '<a class="section-link" href="?view=recipes">All recipes ' + icon('arrow') + '</a>' : ''}</div><div class="recipe-grid">${(isLanding ? r.slice(0, 3) : r).map(recipeCard).join('')}</div></section>`;
  if (view !== 'recipes' && a.length) html += `<section class="content-section" aria-labelledby="health-heading"><div class="section-heading"><div><h2 id="health-heading">${isLanding ? 'A little knowledge goes a long way.' : view === 'health' ? 'The healthy living collection' : 'Healthy living'}</h2>${isLanding ? '<p>Useful reads for taking care of yourself.</p>' : ''}</div>${isLanding ? '<a class="section-link" href="?view=health">All guides ' + icon('arrow') + '</a>' : ''}</div><div class="article-grid">${(isLanding ? a.slice(0, 3) : a).map(articleCard).join('')}</div></section>`;
  return html;
}
function researchPanel() { return `<section class="research-panel"><div><span class="research-symbol" aria-hidden="true">✳</span><h2>Follow your curiosity.</h2><p>Look up a new dish, dig into a health topic, and bring the useful bits back here.</p></div><div><form id="research-form"><label for="research-query">What would you like to learn?</label><div class="research-input"><input id="research-query" name="research" placeholder="Try “easy lentil recipes”" required maxlength="200" /><button class="icon-button" aria-label="Search the web">${icon('arrow')}</button></div><p class="fine-print">Opens a Google search in a new tab.</p></form><div class="trusted-links">${link('https://www.bbcgoodfood.com/recipes', 'Recipe inspiration')}${link('https://www.cdc.gov/health-topics.html', 'Health topics')}</div></div></section>`; }
function render() {
  document.title = `${view === 'recipes' ? 'Recipes' : view === 'health' ? 'Healthy living' : collectionOnly ? 'My collection' : 'Discover'} — Stevies World`;
  document.querySelectorAll('[data-nav]').forEach(el => { el.classList.toggle('active', el.dataset.nav === view && !collectionOnly); if (el.dataset.nav === view && !collectionOnly) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  const heroRecipe = allRecipes().find(x => x.imageKey === 'chickpea') || allRecipes()[0];
  const home = view === 'home' && !collectionOnly;
  $('#main').innerHTML = `${storageError ? `<p class="storage-warning">${escape(storageError)}</p>` : ''}${home ? `<section class="hero"><div class="hero-copy"><div class="welcome-note">Your own little corner of the internet</div><h1>Good food.<br>Feel-good living.</h1><p>A home for recipes you'll love and knowledge that helps you take care of you.</p><a class="button button-dark" href="?view=recipes">Find something delicious ${icon('arrow')}</a><div class="hero-footnote">A little curiosity looks good on you.</div></div><div class="hero-image"><img src="/assets/chickpea.jpg" alt="A colorful bowl of vegetables and chickpeas" fetchpriority="high" /><span class="image-sticker">made for<br><em>everyday you</em><span>✳</span></span><button class="hero-caption" data-open="${escape(heroRecipe.id)}"><span><small>From the recipe collection</small><strong>${escape(heroRecipe.title)}</strong></span>${icon('arrow')}</button></div></section>` : `<section class="page-intro"><span class="intro-icon">${icon(collectionOnly ? 'bookmark' : view === 'recipes' ? 'food' : 'sun')}</span><h1>${collectionOnly ? 'The good things, kept close.' : view === 'recipes' ? 'Make room for good food.' : 'Get to know a healthier you.'}</h1><p>${collectionOnly ? 'Recipes and reads you’ve saved for another day.' : view === 'recipes' ? 'Everyday recipes to explore, make your own, and come back to.' : 'Clear, source-linked information on food, rest, movement, and more.'}</p></section>`}<section class="browse-tools" aria-label="Find information"><div class="search-box">${icon('search')}<label class="sr-only" for="search">Search ${view === 'recipes' ? 'recipes and ingredients' : view === 'health' ? 'healthy living guides' : 'recipes, ingredients, and health topics'}</label><input id="search" type="search" placeholder="${view === 'recipes' ? 'Search recipes or ingredients…' : view === 'health' ? 'Search healthy living topics…' : 'Search recipes, ingredients, or a little inspiration…'}" value="${escape(query)}" /><kbd aria-hidden="true">/</kbd></div>${!home || query ? filters() : '<div class="search-hint">Good things start with curiosity.</div>'}</section><div id="results">${results()}</div>${!collectionOnly ? researchPanel() : ''}`;
}
function updateUrl() { const params = new URLSearchParams(); if (view !== 'home') params.set('view', view); if (query) params.set('q', query); if (collectionOnly) params.set('saved', '1'); if (category !== 'All') params.set('category', category); history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '')); }
function readRoute() { const p = new URLSearchParams(location.search); view = ['recipes', 'health'].includes(p.get('view')) ? p.get('view') : 'home'; query = p.get('q') || ''; collectionOnly = p.get('saved') === '1'; category = p.get('category') || 'All'; render(); if (p.get('item')) openDetail(p.get('item')); }
function navigate(next, savedOnly = false) { view = next; collectionOnly = savedOnly; query = ''; category = 'All'; history.pushState(null, '', `?view=${view}${savedOnly ? '&saved=1' : ''}`); render(); window.scrollTo({ top: 0, behavior: 'instant' }); $('#main').focus({ preventScroll: true }); }
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const amount = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
function estimateSources(estimate) {
  return estimate?.sources?.length ? `<div class="estimate-sources">${estimate.sources.map(source => link(source.url, source.label)).join('')}</div>` : '';
}
function estimateDetails(item) {
  const whole = estimateBasis === 'recipe';
  const multiplier = whole ? item.servings : 1;
  const portion = whole ? `whole recipe (${item.servings} ${item.servings === 1 ? 'serving' : 'servings'})` : 'serving';
  const nutrition = item.nutrition;
  const cost = item.cost;
  return `<div class="estimate-heading"><div><h3>A closer look</h3><p>Open the details you’re curious about.</p></div><label class="estimate-basis">Amounts<select id="estimate-basis" aria-label="Estimate amounts"><option value="serving" ${!whole ? 'selected' : ''}>Per serving</option><option value="recipe" ${whole ? 'selected' : ''}>Whole recipe</option></select></label></div>
    <details class="estimate-panel" data-estimate="nutrition" ${expandedEstimates.has('nutrition') ? 'open' : ''}><summary><span>Macros<small>Calories, protein, carbs & fat</small></span><span class="estimate-chevron" aria-hidden="true">+</span></summary><div class="estimate-body">${nutrition ? `<p class="estimate-caption">Estimated ${whole ? 'for the' : 'per'} ${portion}</p><dl class="macro-grid" aria-label="Estimated nutrition"><div><dt>Calories</dt><dd>${amount(nutrition.calories * multiplier)}<span>kcal</span></dd></div><div><dt>Protein</dt><dd>${amount(nutrition.protein * multiplier)}<span>g</span></dd></div><div><dt>Carbs</dt><dd>${amount(nutrition.carbs * multiplier)}<span>g</span></dd></div><div><dt>Fat</dt><dd>${amount(nutrition.fat * multiplier)}<span>g</span></dd></div></dl><p class="estimate-note">${escape(nutrition.note || 'Values entered by you, per serving. Brands, ingredient amounts, and substitutions affect the result.')}</p>${estimateSources(nutrition)}` : `<p class="estimate-note">No macro estimate added yet. Enter calories, protein, carbs, and fat per serving from your recipe source or food labels.</p><button class="text-button" data-edit="${escape(item.id)}">Add macro estimates</button>`}</div></details>
    <details class="estimate-panel cost-panel" data-estimate="cost" ${expandedEstimates.has('cost') ? 'open' : ''}><summary><span>Estimated cost<small>Ingredients used, in US dollars</small></span><span class="estimate-chevron" aria-hidden="true">+</span></summary><div class="estimate-body">${cost ? `<p class="estimate-caption">Estimated ${whole ? 'for the' : 'per'} ${portion}</p><div class="meal-price">${money(whole ? cost.total : cost.total / item.servings)}<span>USD</span></div><p class="cost-comparison">${whole ? `${money(cost.total / item.servings)} per serving` : `${money(cost.total)} for the whole recipe (${item.servings} ${item.servings === 1 ? 'serving' : 'servings'})`}</p><p class="estimate-note">${escape(cost.note || 'Estimate entered by you for the ingredients used in the whole recipe. Prices vary by store and location; buying full packages can cost more.')}</p>${estimateSources(cost)}` : `<p class="estimate-note">No cost estimate added yet. Add the cost of the ingredients used in the whole recipe; we’ll work out the cost per serving.</p><button class="text-button" data-edit="${escape(item.id)}">Add a cost estimate</button>`}</div></details>
    <p class="estimate-footnote">Estimates are a guide, not exact nutrition labels or live prices. Optional extras may change the totals.</p>`;
}
function estimateEditor(entry) {
  return `<details class="editor-estimates" ${entry?.nutrition || entry?.cost ? 'open' : ''}><summary>Macros & meal cost <span>Optional</span></summary><p>Enter macros for <strong>one serving</strong>. Fill in all four values, or leave all four blank. These are saved as your estimates.</p><div class="estimate-input-grid"><label>Calories (kcal)<input name="calories" type="number" min="0" max="20000" step="any" placeholder="e.g. 450" value="${entry?.nutrition?.calories ?? ''}" /></label><label>Protein (g)<input name="protein" type="number" min="0" max="5000" step="any" placeholder="e.g. 25" value="${entry?.nutrition?.protein ?? ''}" /></label><label>Carbs (g)<input name="carbs" type="number" min="0" max="5000" step="any" placeholder="e.g. 55" value="${entry?.nutrition?.carbs ?? ''}" /></label><label>Fat (g)<input name="fat" type="number" min="0" max="5000" step="any" placeholder="e.g. 15" value="${entry?.nutrition?.fat ?? ''}" /></label></div><label>Whole recipe cost (USD)<input name="costTotal" type="number" min="0" max="1000000" step="any" placeholder="e.g. 6.50" value="${entry?.cost?.total ?? ''}" /></label><p>Use the cost of the ingredient amounts used, rather than full packages. The cost per serving is calculated from your recipe’s serving count. Leave blank if unknown.</p></details>`;
}
function openDetail(id) {
  const item = allItems().find(x => x.id === id); if (!item) return;
  if (activeDetail !== id) { estimateBasis = 'serving'; expandedEstimates = new Set(); }
  activeDetail = id;
  const isRecipe = item.type === 'recipe';
  const sources = [...(item.sources || []), ...(item.sourceUrl ? [{ label: 'Original source', url: item.sourceUrl }] : [])];
  $('#detail-content').innerHTML = `<button class="dialog-close icon-button" data-close aria-label="Close">×</button>${isRecipe && item.imageKey ? `<img class="detail-image" src="/assets/${escape(item.imageKey)}.jpg" alt="${escape(imageNames[item.imageKey])}" />` : ''}<div class="dialog-body"><span class="small-tag">${escape(item.category)}${item.personal ? ' / Your find' : ''}</span><h2 id="detail-title">${escape(item.title)}</h2><p class="detail-description">${escape(item.description)}</p><div class="detail-toolbar"><span>${icon(isRecipe ? 'clock' : articleIcons[item.category])}${isRecipe ? `${item.minutes} minutes / Serves ${item.servings}` : `${item.readMinutes || 2} minute read`}</span>${saveButton(item, true)}</div>${isRecipe ? `<section id="recipe-estimates" class="recipe-estimates" aria-label="Recipe macros and estimated cost">${estimateDetails(item)}</section><div class="recipe-detail-columns"><section><h3>What you'll need</h3><ul class="ingredients">${item.ingredients.map(x => `<li>${escape(x)}</li>`).join('')}</ul></section><section><h3>Let's make it</h3><ol class="method">${item.steps.map(x => `<li>${escape(x)}</li>`).join('')}</ol></section></div>${item.note ? `<aside class="recipe-note"><strong>A little note</strong><p>${escape(item.note)}</p></aside>` : ''}` : `<div class="article-body">${item.sections.map(s => `<section><h3>${escape(s.heading)}</h3><p>${escape(s.body)}</p></section>`).join('')}</div>`}${sources.length ? `<section class="sources"><h3>${item.personal ? 'Where you found it' : 'Go a little deeper'}</h3>${sources.map(s => link(s.url, s.label)).join('')}</section>` : ''}${!isRecipe && !item.personal ? `<p class="fine-print">Sources reviewed October 13, 2026. General information for adults; your needs may differ. A qualified clinician can help with advice specific to you.</p>` : ''}${isRecipe && item.imageKey ? '<p class="fine-print">Photo shows serving inspiration; your finished recipe may look different.</p>' : ''}${item.personal ? `<div class="personal-actions"><button class="button button-outline" data-edit="${escape(id)}">Edit your find</button><button class="text-button delete-button" data-delete="${escape(id)}">Delete this find</button></div>` : ''}</div>`;
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
function openEditor(type = 'recipe', entry = null) {
  $('#detail-dialog').close();
  const recipe = type === 'recipe';
  const choices = recipe ? ['Breakfast', 'Lunch', 'Dinner'] : ['Nutrition', 'Sleep', 'Movement', 'Hydration', 'Food safety', 'General'];
  $('#edit-content').innerHTML = `<div class="dialog-body"><button class="dialog-close icon-button" data-close aria-label="Close">×</button><span class="small-tag">${entry ? 'Make it your own' : 'Keep something good'}</span><h2 id="edit-title">${entry ? 'Edit your find.' : 'Add a little inspiration.'}</h2><p>Keep a recipe or a useful note, with a link back to where you found it.</p>${!entry ? `<div class="editor-tabs"><button class="chip ${recipe ? 'active' : ''}" data-editor="recipe" aria-pressed="${recipe}">A recipe</button><button class="chip ${!recipe ? 'active' : ''}" data-editor="article" aria-pressed="${!recipe}">A health note</button></div>` : ''}<form id="entry-form" data-type="${type}" data-id="${escape(entry?.id || '')}"><label>Title<input name="title" required maxlength="150" value="${escape(entry?.title || '')}" placeholder="${recipe ? 'The perfect weeknight pasta' : 'What I learned about sleep'}" /></label><label>A short description<textarea name="description" rows="2" maxlength="700" required placeholder="What makes this one worth keeping?">${escape(entry?.description || '')}</textarea></label><div class="form-row"><label>Category<select name="category">${choices.map(c => `<option ${entry?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>${recipe ? `<label>Total minutes<input name="minutes" type="number" min="1" max="1440" value="${entry?.minutes || 20}" required /></label><label>Servings<input name="servings" type="number" min="1" max="100" value="${entry?.servings || 2}" required /></label>` : ''}</div>${recipe ? `<label>Ingredients <span>One per line, including quantities</span><textarea name="ingredients" rows="5" required maxlength="18000" placeholder="1 cup cooked lentils&#10;2 handfuls baby spinach">${escape(entry?.ingredients?.join('\n') || '')}</textarea></label><label>Method <span>One step per line</span><textarea name="steps" rows="5" required maxlength="18000" placeholder="Write each step on its own line…">${escape(entry?.steps?.join('\n') || '')}</textarea></label><label>Your notes <span>Optional</span><textarea name="note" rows="2" maxlength="12000">${escape(entry?.note || '')}</textarea></label>` : `${(entry?.sections || [{ heading: 'Your notes', body: '' }]).map((section, i) => `<label>Section heading<input name="heading-${i}" maxlength="200" value="${escape(section.heading)}" /></label><label>What you learned<textarea name="body-${i}" rows="6" required maxlength="12000" placeholder="Keep the useful details in your own words…">${escape(section.body)}</textarea></label>`).join('')}`}${recipe ? estimateEditor(entry) : ''}<label>Source link <span>Optional</span><input name="sourceUrl" type="url" maxlength="2000" placeholder="https://…" value="${escape(entry?.sourceUrl || '')}" /></label><label>Tags <span>Optional, separated by commas</span><input name="tags" maxlength="300" placeholder="quick, vegetarian, weeknight" value="${escape(entry?.tags?.join(', ') || '')}" /></label><p class="fine-print">Saved in this browser. Export your library to keep a backup.</p><div id="form-error" class="form-error" role="alert"></div><button class="button button-dark" type="submit">${entry ? 'Save changes' : 'Add to my library'} ${icon('arrow')}</button></form></div>`;
  if (!$('#edit-dialog').open) $('#edit-dialog').showModal();
}

document.addEventListener('click', event => {
  const target = event.target.closest('button, a'); if (!target) return;
  const focusParent = target.closest('dialog')?.id;
  const focusKeys = ['save', 'category', 'action', 'confirmDelete', 'editor'];
  const focusKey = focusKeys.find(key => target.dataset[key] !== undefined);
  const focusValue = focusKey ? target.dataset[focusKey] : '';
  queueMicrotask(() => {
    if (!target.isConnected && focusKey) {
      const container = focusParent && document.getElementById(focusParent)?.open ? document.getElementById(focusParent) : document;
      const replacement = [...container.querySelectorAll('button')].find(el => el.dataset[focusKey] === focusValue);
      (replacement || document.querySelector('dialog[open] button') || $('#search') || $('#main'))?.focus({ preventScroll: true });
    }
  });
  if (target.matches('a[href^="?view="]')) { event.preventDefault(); navigate(new URL(target.href).searchParams.get('view')); }
  if (target.dataset.close !== undefined) target.closest('dialog').close();
  if (target.dataset.open) openDetail(target.dataset.open);
  if (target.dataset.save) {
    const id = target.dataset.save;
    const wasSaved = saved(id);
    if (persist({ ...library, saved: wasSaved ? library.saved.filter(x => x !== id) : [...library.saved, id] })) { const y = window.scrollY; render(); window.scrollTo(0, y); if ($('#detail-dialog').open) openDetail(activeDetail); toast(wasSaved ? 'Removed from your collection' : 'Saved to your collection'); }
  }
  if (target.dataset.category) { category = target.dataset.category; updateUrl(); render(); }
  if (target.dataset.editor) openEditor(target.dataset.editor);
  if (target.dataset.edit) { const entry = library.entries.find(x => x.id === target.dataset.edit); openEditor(entry.type, entry); }
  if (target.dataset.delete) { target.outerHTML = `<button class="button button-outline delete-button" data-confirm-delete="${escape(target.dataset.delete)}">Confirm delete</button>`; }
  if (target.dataset.confirmDelete) { const id = target.dataset.confirmDelete; if (persist({ ...library, entries: library.entries.filter(x => x.id !== id), saved: library.saved.filter(x => x !== id) })) { $('#detail-dialog').close(); render(); toast('Your find was deleted'); } }
  const action = target.dataset.action;
  if (action === 'add') openEditor();
  if (action === 'collection') navigate('home', true);
  if (action === 'library') $('#library-dialog').showModal();
  if (action === 'toggle-saved') { collectionOnly = !collectionOnly; updateUrl(); render(); }
  if (action === 'reset') { query = ''; category = 'All'; collectionOnly = false; updateUrl(); render(); }
  if (action === 'import') $('#import-file').click();
  if (action === 'export') { const blob = new Blob([recoveryRaw ?? JSON.stringify(library, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stevies-world-library-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast(recoveryRaw ? 'Original library exported for recovery' : 'Library backup exported'); }
});
document.addEventListener('toggle', event => {
  if (event.target.matches?.('details[data-estimate]') && event.target.isConnected) {
    if (event.target.open) expandedEstimates.add(event.target.dataset.estimate);
    else expandedEstimates.delete(event.target.dataset.estimate);
  }
}, true);
document.addEventListener('change', event => {
  if (event.target.id === 'estimate-basis') {
    estimateBasis = event.target.value === 'recipe' ? 'recipe' : 'serving';
    const item = allRecipes().find(item => item.id === activeDetail);
    if (!item) return;
    const scroll = $('#detail-dialog').scrollTop;
    $('#recipe-estimates').innerHTML = estimateDetails(item);
    $('#estimate-basis').focus({ preventScroll: true });
    $('#detail-dialog').scrollTop = scroll;
  }
});
document.addEventListener('input', event => { if (event.target.id === 'search') { query = event.target.value.trim(); updateUrl(); $('#results').innerHTML = results(); } });
document.addEventListener('submit', event => {
  if (event.target.id === 'research-form') { event.preventDefault(); const value = new FormData(event.target).get('research').trim(); if (value) window.open('https://www.google.com/search?q=' + encodeURIComponent(value), '_blank', 'noopener,noreferrer'); }
  if (event.target.id === 'entry-form') {
    event.preventDefault(); const form = event.target; const data = new FormData(form); const get = name => String(data.get(name) || '').trim(); const type = form.dataset.type;
    const entry = { id: form.dataset.id || 'personal-' + crypto.randomUUID(), type, personal: true, title: get('title'), description: get('description'), category: get('category'), tags: get('tags').split(',').map(x => x.trim()).filter(Boolean), sourceUrl: get('sourceUrl'), note: get('note') };
    if (entry.sourceUrl && !safeUrl(entry.sourceUrl)) { $('#form-error').textContent = 'Use a complete http:// or https:// source link.'; return; }
    if (type === 'recipe') Object.assign(entry, { minutes: Number(get('minutes')), servings: Number(get('servings')), ingredients: get('ingredients').split('\n').map(x => x.trim()).filter(Boolean), steps: get('steps').split('\n').map(x => x.trim()).filter(Boolean) });
    else Object.assign(entry, { sections: [...data.keys()].filter(key => key.startsWith('body-')).map(key => ({ heading: get('heading-' + key.slice(5)), body: get(key) })) });
    if (type === 'recipe') {
      const keys = ['calories', 'protein', 'carbs', 'fat'];
      const present = keys.filter(key => get(key) !== '');
      if (present.length && present.length !== keys.length) { $('#form-error').textContent = 'For macros, fill in calories, protein, carbs, and fat, or leave all four blank.'; $('#form-error').scrollIntoView({ block: 'nearest' }); return; }
      const previous = library.entries.find(item => item.id === entry.id);
      if (present.length) {
        entry.nutrition = Object.fromEntries(keys.map(key => [key, Number(get(key))]));
        if (previous?.nutrition && keys.every(key => previous.nutrition[key] === entry.nutrition[key])) entry.nutrition = { ...previous.nutrition };
      }
      if (get('costTotal') !== '') {
        entry.cost = { total: Number(get('costTotal')), currency: 'USD' };
        if (previous?.cost?.total === entry.cost.total) entry.cost = { ...previous.cost };
      }
    }
    try { const checked = validateLibrary({ ...library, entries: [...library.entries.filter(x => x.id !== entry.id), entry], saved: [...new Set([...library.saved, entry.id])] }); if (persist(checked)) { $('#edit-dialog').close(); render(); openDetail(entry.id); toast('Your find is saved'); } } catch (error) { $('#form-error').textContent = error.message; }
  }
});
$('#import-file').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 5_000_000) throw new Error('Choose a backup smaller than 5 MB.'); const incoming = validateLibrary(JSON.parse(await file.text())); if (storageError) { if (recoveryRaw !== null) localStorage.setItem(STORAGE_KEY + '.recovery', recoveryRaw); localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming)); library = incoming; recoveryRaw = null; storageError = ''; render(); toast('Your library was restored'); } else { const next = mergeLibraries(library, incoming); if (persist(next)) { render(); toast('Your library was imported'); } } } catch (error) { toast('Import failed: ' + error.message); } finally { event.target.value = ''; } });
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); $('#search').focus(); } });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
window.addEventListener('popstate', () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); readRoute(); });
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { try { library = event.newValue ? validateLibrary(JSON.parse(event.newValue)) : emptyLibrary(); render(); if ($('#detail-dialog').open) { if (allItems().some(x => x.id === activeDetail)) openDetail(activeDetail); else $('#detail-dialog').close(); } } catch { toast('Could not read the library change from another tab.'); } } });
readRoute();
