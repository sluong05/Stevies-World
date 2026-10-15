import { recipes, articles } from './content.js';
import { seedPhotos } from './data/seed-photos.js';
import { validatePhoto, safePhotoSource, MAX_PHOTO_LENGTH } from './photo-utils.js';
import { normalizeFilters, filterCount, filterErrors, recipeMetrics, matchesRecipeFilters, sortRecipes, sortOptions, filtersFromParams, addFiltersToParams } from './recipe-search.js';
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
const articleIcons = { Nutrition: 'leaf', Sleep: 'moon', Movement: 'movement', Hydration: 'water', 'Food safety': 'food' };
let library = emptyLibrary();
let storageError = '';
let recoveryRaw = null;
try { recoveryRaw = localStorage.getItem(STORAGE_KEY); if (recoveryRaw) library = validateLibrary(JSON.parse(recoveryRaw)); recoveryRaw = null; } catch { storageError = 'Your browser library could not be read. Saving is paused to protect it. Export the original data from Your library & backups, or import a valid backup to restore it.'; }
let view = 'home';
let query = '';
let category = 'All';
let collectionOnly = false;
let budgetOnly = false;
let visibleRecipeCount = 18;
let recipeFilters = normalizeFilters();
let filterPanelOpen = false;
let draftPhoto = null;
let photoUploadPending = false;
let editorVersion = 0;
let photoVersion = 0;
let activeDetail = null;
let estimateBasis = 'serving';
let expandedEstimates = new Set();
let toastTimeout;
const budgetCriteria = { minProtein: 25, maxCost: 4 };
const allRecipes = () => [...recipes.map(item => ({ ...item, type: 'recipe' })), ...library.entries.filter(item => item.type === 'recipe')];
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
function recipePhoto(item) {
  if (item.photo) return item.photo;
  if (item.imageKey && seedPhotos[item.imageKey]) return seedPhotos[item.imageKey];
  const key = item.category === 'Breakfast' ? 'oats' : /soup|stew|chili/i.test(item.title) ? 'soup' : /pasta|noodle/i.test(item.title) ? 'noodles' : 'chickpea';
  return { ...seedPhotos[key], caption: 'Serving inspiration for an older recipe. Add your own photo when editing.' };
}
function photoCredit(photo) {
  return `<p id="recipe-photo-credit" class="photo-credit">${escape(photo.caption || 'Recipe photo provided by you.')} ${photo.sourceUrl ? link(photo.sourceUrl, photo.author ? `Photo by ${photo.author}` : 'Photo source') : photo.author ? escape(photo.author) : ''} ${photo.licenseUrl ? link(photo.licenseUrl, photo.license || 'Photo license') : ''}</p>`;
}
function cardStatistics(item) {
  const metrics = recipeMetrics(item);
  if (Object.values(metrics).slice(0, 4).every(value => value === null)) return '';
  return `<dl class="recipe-statistics"><div><dt>Protein</dt><dd>${metrics.protein === null ? 'Not added' : `${amount(metrics.protein)} g`}</dd></div><div><dt>Calories</dt><dd>${metrics.calories === null ? 'Not added' : `${amount(metrics.calories)} kcal`}</dd></div><div><dt>Protein / 100 kcal</dt><dd>${metrics.density === null ? 'Not added' : `${amount(metrics.density)} g`}</dd></div><div><dt>Est. cost / serving</dt><dd>${metrics.price === null ? 'Not added' : money(metrics.price)}</dd></div></dl>`;
}
function qualifiesForBudget(item) { return item.type !== 'article' && item.nutrition?.protein >= budgetCriteria.minProtein && item.cost?.currency === 'USD' && item.cost.total / item.servings <= budgetCriteria.maxCost; }
function recipeCard(item) {
  const photo = recipePhoto(item);
  return `<article class="recipe-card"><div class="recipe-image-wrap"><button class="image-open" data-open="${escape(item.id)}" aria-label="Read ${escape(item.title)}"><img class="recipe-photo" src="${escape(photo.src)}" alt="${escape(photo.alt)}" loading="lazy" /></button><span class="image-category">${escape(item.category)}</span>${saveButton(item)}</div><div class="recipe-meta"><span>${icon('clock')}${item.minutes} min</span><span>${escape(item.personal ? 'Your find' : item.tags?.[0] || 'Everyday cooking')}</span></div><h3><button data-open="${escape(item.id)}">${escape(item.title)}</button></h3><p>${escape(item.description)}</p>${cardStatistics(item)}</article>`;
}
function articleCard(item) {
  return `<article class="article-card tone-${escape(articleIcons[item.category] || 'leaf')}"><div class="article-card-top"><span class="article-icon">${icon(articleIcons[item.category] || 'leaf')}</span>${saveButton(item)}</div><div class="article-meta"><span>${escape(item.category)}</span><span>${item.readMinutes || 2} min read</span></div><h3><button data-open="${escape(item.id)}">${escape(item.title)}</button></h3><p>${escape(item.description)}</p><button class="article-read" data-open="${escape(item.id)}" aria-label="Read ${escape(item.title)}">${item.personal ? 'Read note' : 'Read the guide'}${icon('arrow')}</button></article>`;
}
function filters() {
  const options = view === 'recipes' ? ['All', 'Breakfast', 'Lunch', 'Dinner'] : view === 'health' ? ['All', 'Nutrition', 'Sleep', 'Movement', 'Hydration', 'Food safety'] : [];
  return `<div class="filters">${options.length ? `<div class="filter-chips" aria-label="Filter by category">${options.map(c => `<button class="chip ${c === category ? 'active' : ''}" data-category="${c}" aria-pressed="${c === category}">${c === 'All' ? 'Everything' : c}</button>`).join('')}</div>` : ''}${view !== 'health' ? `<button class="chip budget-toggle ${budgetOnly ? 'active' : ''}" data-action="toggle-budget" aria-pressed="${budgetOnly}">25 g+ protein, $4 or less</button>` : ''}${view !== 'health' ? `<button class="chip number-filter-toggle ${filterPanelOpen ? 'active' : ''}" data-action="toggle-filters" aria-controls="recipe-filters" aria-expanded="${filterPanelOpen}">More filters <span id="filter-count" class="filter-badge" ${filterCount(recipeFilters) ? '' : 'hidden'}>${filterCount(recipeFilters)}</span></button>` : ''}<button class="chip collection-toggle ${collectionOnly ? 'active' : ''}" data-action="toggle-saved" aria-pressed="${collectionOnly}">${icon('bookmark')}Saved only</button></div>`;
}
function numberFilters() {
  if (view === 'health') return '';
  const pairs = [
    ['Price per serving (USD)', 'priceMin', 'priceMax', 'Minimum price per serving', 'Maximum price per serving'],
    ['Protein per serving (g)', 'proteinMin', 'proteinMax', 'Minimum protein per serving', 'Maximum protein per serving'],
    ['Calories per serving (kcal)', 'calMin', 'calMax', 'Minimum calories per serving', 'Maximum calories per serving'],
    ['Protein per 100 kcal (g)', 'densityMin', 'densityMax', 'Minimum protein per 100 calories', 'Maximum protein per 100 calories'],
  ];
  return `<section id="recipe-filters" class="number-filters" ${filterPanelOpen ? '' : 'hidden'} aria-label="Recipe number filters"><div class="number-filter-heading"><div><h2>Find your kind of meal.</h2><p>All amounts are estimated per serving. Protein density means grams of protein per 100 calories.</p></div><button class="text-button" data-action="clear-number-filters">Clear number filters</button></div><div class="number-filter-grid">${pairs.map(([label, min, max, minLabel, maxLabel]) => `<fieldset><legend>${label}</legend><div class="filter-range"><label><span class="sr-only">${minLabel}</span><input type="number" min="0" step="any" data-recipe-filter="${min}" value="${recipeFilters[min] ?? ''}" placeholder="Min" aria-label="${minLabel}" /></label><span aria-hidden="true">to</span><label><span class="sr-only">${maxLabel}</span><input type="number" min="0" step="any" data-recipe-filter="${max}" value="${recipeFilters[max] ?? ''}" placeholder="Max" aria-label="${maxLabel}" /></label></div></fieldset>`).join('')}<label class="single-filter">Ready in (minutes)<input type="number" min="0" step="any" data-recipe-filter="timeMax" value="${recipeFilters.timeMax ?? ''}" placeholder="Maximum time" aria-label="Maximum cooking time" /></label><label class="single-filter sort-filter">Sort recipes<select data-recipe-sort aria-label="Sort recipes">${Object.entries(sortOptions).map(([value, label]) => `<option value="${value}" ${recipeFilters.sort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><p class="filter-note">A recipe without a required estimate won’t appear while that number filter is active.</p><p id="filter-error" class="form-error" role="alert">${escape(filterErrors(recipeFilters).join(' '))}</p></section>`;
}
function refreshFilterResults() {
  visibleRecipeCount = 18;
  updateUrl();
  $('#results').innerHTML = results();
  if ($('#filter-error')) $('#filter-error').textContent = filterErrors(recipeFilters).join(' ');
  const badge = $('#filter-count');
  if (badge) { badge.textContent = filterCount(recipeFilters); badge.hidden = !filterCount(recipeFilters); }
}
function matches(item) {
  const haystack = [item.title, item.description, item.category, ...(item.tags || []), ...(item.ingredients || []), ...(item.sections || []).map(s => s.body)].join(' ').toLowerCase();
  const numbers = !filterCount(recipeFilters) || item.type !== 'article' && matchesRecipeFilters(item, recipeFilters);
  return (!query || query.toLowerCase().split(/\s+/).every(word => haystack.includes(word))) && (category === 'All' || item.category === category) && (!collectionOnly || saved(item.id)) && (!budgetOnly || qualifiesForBudget(item)) && numbers;
}
function recipeEmptyState() { return `<div class="empty-state recipe-empty">${icon('food')}<h3>Your recipes start here.</h3><p>Add the meals you want to keep, with a photo, ingredients, and instructions.</p><button class="button button-dark" data-action="add">Add your first recipe ${icon('arrow')}</button></div>`; }
function emptyState() { if (view !== 'health' && !collectionOnly && !allRecipes().length) return recipeEmptyState(); return `<div class="empty-state">${icon('search')}<h3>${collectionOnly ? 'A little room for your favorites.' : 'Nothing here just yet.'}</h3><p>${collectionOnly ? 'Save a recipe or guide using its bookmark, and find it here.' : 'Try another search or add a recipe or note of your own.'}</p><button class="button button-outline" data-action="reset">${collectionOnly ? 'Browse everything' : 'Clear filters'}</button></div>`; }
function results() {
  const r = sortRecipes(allRecipes().filter(matches), recipeFilters), a = allArticles().filter(matches);
  const isLanding = view === 'home' && !query && !collectionOnly && !budgetOnly && !filterCount(recipeFilters);
  const count = (view === 'recipes' ? r.length : view === 'health' ? a.length : r.length + a.length);
  let html = !isLanding ? `<p class="result-count" role="status">${count} ${count === 1 ? 'find' : 'finds'}${query ? ` for “${escape(query)}”` : ''}</p>` : '';
  if (!count) return html + emptyState();
  if (isLanding && !allRecipes().length) html += recipeEmptyState();
  if (view !== 'health' && r.length) html += `<section class="content-section" aria-labelledby="recipe-heading"><div class="section-heading"><div><h2 id="recipe-heading">${isLanding ? 'Something good to cook.' : budgetOnly ? 'High-protein budget meals' : view === 'recipes' ? 'The recipe collection' : 'Recipes'}</h2>${isLanding ? '<p>Simple ingredients. Meals worth making.</p>' : ''}</div>${isLanding ? '<a class="section-link" href="?view=recipes">All recipes ' + icon('arrow') + '</a>' : ''}</div><div class="recipe-grid">${(isLanding ? r.slice(0, 3) : r.slice(0, visibleRecipeCount)).map(recipeCard).join('')}</div>${!isLanding && r.length > visibleRecipeCount ? `<div class="load-more"><p>Showing ${Math.min(visibleRecipeCount, r.length)} of ${r.length} recipes</p><button class="button button-outline" data-action="load-more">Show more recipes</button></div>` : ''}</section>`;
  if (view !== 'recipes' && a.length) html += `<section class="content-section" aria-labelledby="health-heading"><div class="section-heading"><div><h2 id="health-heading">${isLanding ? 'A little knowledge goes a long way.' : view === 'health' ? 'The healthy living collection' : 'Healthy living'}</h2>${isLanding ? '<p>Useful reads for taking care of yourself.</p>' : ''}</div>${isLanding ? '<a class="section-link" href="?view=health">All guides ' + icon('arrow') + '</a>' : ''}</div><div class="article-grid">${(isLanding ? a.slice(0, 3) : a).map(articleCard).join('')}</div></section>`;
  return html;
}
function researchPanel() { return `<section class="research-panel"><div><span class="research-symbol" aria-hidden="true">✳</span><h2>Follow your curiosity.</h2><p>Look up a new dish, dig into a health topic, and bring the useful bits back here.</p></div><div><form id="research-form"><label for="research-query">What would you like to learn?</label><div class="research-input"><input id="research-query" name="research" placeholder="Try “easy lentil recipes”" required maxlength="200" /><button class="icon-button" aria-label="Search the web">${icon('arrow')}</button></div><p class="fine-print">Opens a Google search in a new tab.</p></form><div class="trusted-links">${link('https://www.bbcgoodfood.com/recipes', 'Recipe inspiration')}${link('https://www.cdc.gov/health-topics.html', 'Health topics')}</div></div></section>`; }
function render() {
  document.title = `${view === 'recipes' ? 'Recipes' : view === 'health' ? 'Healthy living' : collectionOnly ? 'My collection' : 'Discover'} — Stevies World`;
  document.querySelectorAll('[data-nav]').forEach(el => { el.classList.toggle('active', el.dataset.nav === view && !collectionOnly); if (el.dataset.nav === view && !collectionOnly) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  const home = view === 'home' && !collectionOnly && !budgetOnly;
  $('#main').innerHTML = `${storageError ? `<p class="storage-warning">${escape(storageError)}</p>` : ''}${home ? `<section class="hero"><div class="hero-copy"><div class="welcome-note">Your own little corner of the internet</div><h1>Good food.<br>Feel-good living.</h1><p>A home for recipes you'll love and knowledge that helps you take care of you.</p><button class="button button-dark" data-action="add">Add a recipe ${icon('arrow')}</button><div class="hero-footnote">A little curiosity looks good on you.</div></div><div class="hero-image"><img src="/assets/chickpea.jpg" alt="A colorful bowl of vegetables and chickpeas" fetchpriority="high" /><span class="image-sticker">made for<br><em>everyday you</em><span>✳</span></span><button class="hero-caption" data-action="add"><span><small>Make this space your own</small><strong>Add a recipe you love</strong></span>${icon('arrow')}</button></div></section>` : `<section class="page-intro"><span class="intro-icon">${icon(collectionOnly ? 'bookmark' : view === 'recipes' ? 'food' : 'sun')}</span><h1>${collectionOnly ? 'The good things, kept close.' : view === 'recipes' ? 'Make room for good food.' : 'Get to know a healthier you.'}</h1><p>${collectionOnly ? 'Recipes and reads you’ve saved for another day.' : view === 'recipes' ? 'Your own recipes, saved together and easy to come back to.' : 'Clear, source-linked information on food, rest, movement, and more.'}</p></section>`}<section class="browse-tools" aria-label="Find information"><div class="search-box">${icon('search')}<label class="sr-only" for="search">Search ${view === 'recipes' ? 'recipes and ingredients' : view === 'health' ? 'healthy living guides' : 'recipes, ingredients, and health topics'}</label><input id="search" type="search" placeholder="${view === 'recipes' ? 'Search recipes or ingredients…' : view === 'health' ? 'Search healthy living topics…' : 'Search recipes, ingredients, or a little inspiration…'}" value="${escape(query)}" /><kbd aria-hidden="true">/</kbd></div>${filters()}</section>${numberFilters()}<div id="results">${results()}</div>${!collectionOnly ? researchPanel() : ''}`;
}
function updateUrl() { const params = new URLSearchParams(); if (view !== 'home') params.set('view', view); if (query) params.set('q', query); if (collectionOnly) params.set('saved', '1'); if (category !== 'All') params.set('category', category); if (budgetOnly) params.set('budget', '1'); addFiltersToParams(params, recipeFilters); history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '')); }
function readRoute() { const p = new URLSearchParams(location.search); view = ['recipes', 'health'].includes(p.get('view')) ? p.get('view') : 'home'; query = p.get('q') || ''; collectionOnly = p.get('saved') === '1'; category = p.get('category') || 'All'; budgetOnly = p.get('budget') === '1' && view !== 'health'; recipeFilters = view === 'health' ? normalizeFilters() : filtersFromParams(p); filterPanelOpen = Boolean(filterCount(recipeFilters)); visibleRecipeCount = 18; render(); if (p.get('item')) openDetail(p.get('item')); }
function navigate(next, savedOnly = false, budget = false) { view = next; collectionOnly = savedOnly; budgetOnly = budget; recipeFilters = normalizeFilters(); filterPanelOpen = false; visibleRecipeCount = 18; query = ''; category = 'All'; history.pushState(null, '', `?view=${view}${savedOnly ? '&saved=1' : ''}${budgetOnly ? '&budget=1' : ''}`); render(); window.scrollTo({ top: 0, behavior: 'instant' }); $('#main').focus({ preventScroll: true }); }
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
  const photo = isRecipe ? recipePhoto(item) : null;
  const sources = [...(item.sources || []), ...(item.sourceUrl ? [{ label: 'Original source', url: item.sourceUrl }] : [])];
  $('#detail-content').innerHTML = `<button class="dialog-close icon-button" data-close aria-label="Close">×</button>${isRecipe ? `<img class="detail-image recipe-photo" src="${escape(photo.src)}" alt="${escape(photo.alt)}" />${photoCredit(photo)}` : ''}<div class="dialog-body"><span class="small-tag">${escape(item.category)}${item.personal ? ' / Your find' : ''}</span><h2 id="detail-title">${escape(item.title)}</h2><p class="detail-description">${escape(item.description)}</p><div class="detail-toolbar"><span>${icon(isRecipe ? 'clock' : articleIcons[item.category])}${isRecipe ? `${item.minutes} minutes / Serves ${item.servings}` : `${item.readMinutes || 2} minute read`}</span>${saveButton(item, true)}</div>${isRecipe ? `<section id="recipe-estimates" class="recipe-estimates" aria-label="Recipe macros and estimated cost">${estimateDetails(item)}</section><div class="recipe-detail-columns"><section><h3>What you'll need</h3><ul class="ingredients">${item.ingredients.map(x => `<li>${escape(x)}</li>`).join('')}</ul></section><section><h3>Let's make it</h3><ol class="method">${item.steps.map(x => `<li>${escape(x)}</li>`).join('')}</ol></section></div>${item.note ? `<aside class="recipe-note"><strong>A little note</strong><p>${escape(item.note)}</p></aside>` : ''}` : `<div class="article-body">${item.sections.map(s => `<section><h3>${escape(s.heading)}</h3><p>${escape(s.body)}</p></section>`).join('')}</div>`}${sources.length ? `<section class="sources"><h3>${item.personal ? 'Where you found it' : 'Go a little deeper'}</h3>${sources.map(s => link(s.url, s.label)).join('')}</section>` : ''}${!isRecipe && !item.personal ? `<p class="fine-print">Sources reviewed October 13, 2026. General information for adults; your needs may differ. A qualified clinician can help with advice specific to you.</p>` : ''}${item.personal ? `<div class="personal-actions"><button class="button button-outline" data-edit="${escape(id)}">Edit your find</button><button class="text-button delete-button" data-delete="${escape(id)}">Delete this find</button></div>` : ''}</div>`;
  if (!$('#detail-dialog').open) $('#detail-dialog').showModal();
}
function photoFields(entry) {
  const photo = entry?.photo;
  return `<fieldset class="photo-editor"><legend>Recipe photo <span>Required</span></legend><p>Add a photo of the meal, or serving inspiration that suits it.</p><label>Photo link<input id="recipe-photo-url" name="photoUrl" type="url" maxlength="2000" placeholder="https://example.com/my-meal.jpg" value="${escape(photo?.src?.startsWith('https:') ? photo.src : '')}" /></label><label class="photo-upload-label">Or upload a photo<input id="recipe-photo-file" type="file" accept="image/jpeg,image/png,image/webp" /></label><p class="photo-help">JPEG, PNG, or WebP. Uploaded photos save in this browser with your library.</p><img id="recipe-photo-preview" ${photo ? `src="${escape(photo.src)}"` : 'hidden'} alt="Your selected recipe photo" /><button type="button" class="text-button" data-action="remove-photo" ${photo ? '' : 'hidden'}>Remove selected photo</button><p id="photo-status" role="status"></p><label>Photo description <span>Uses the recipe title if blank</span><input name="photoAlt" maxlength="300" value="${escape(photo?.alt || '')}" placeholder="A bowl of chicken and rice" /></label><details class="photo-credit-fields"><summary>Photo credit <span>Optional</span></summary><label>Photographer<input name="photoAuthor" maxlength="1000" value="${escape(photo?.author || '')}" /></label><label>Source page<input name="photoSource" type="url" maxlength="2000" placeholder="https://…" value="${escape(photo?.sourceUrl || '')}" /></label></details></fieldset>`;
}
function previewDraftPhoto() {
  const preview = $('#recipe-photo-preview');
  if (!preview) return;
  if (draftPhoto) { preview.src = draftPhoto.src; preview.hidden = false; }
  else { preview.removeAttribute('src'); preview.hidden = true; }
  const remove = document.querySelector('[data-action="remove-photo"]');
  if (remove) remove.hidden = !draftPhoto;
}
function loadPhoto(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => { img.onload = null; img.onerror = null; reject(new Error('The photo did not load. Try an upload or another direct image link.')); }, 12000);
    img.onload = () => { clearTimeout(timer); if (img.naturalWidth > 0 && img.naturalHeight > 0) resolve(img); else reject(new Error('Choose a valid recipe photo.')); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('The photo could not be loaded. Use a direct HTTPS image link or upload a photo.')); };
    img.src = src;
  });
}
async function uploadedPhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (file.size > 15_000_000) throw new Error('Choose a photo smaller than 15 MB.');
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('The photo file could not be read.')); reader.readAsDataURL(file); });
  const img = await loadPhoto(source);
  const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height);
  let output = canvas.toDataURL('image/jpeg', 0.78);
  for (let attempt = 0; output.length > 300000 && attempt < 4; attempt++) {
    const smaller = document.createElement('canvas'); smaller.width = Math.max(1, Math.round(canvas.width * 0.75)); smaller.height = Math.max(1, Math.round(canvas.height * 0.75)); smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas.width = smaller.width; canvas.height = smaller.height; canvas.getContext('2d').drawImage(smaller, 0, 0); output = canvas.toDataURL('image/jpeg', 0.72);
  }
  if (output.length > MAX_PHOTO_LENGTH) throw new Error('This photo is too large to save. Try a smaller photo.');
  return { src: output, alt: 'Recipe photo', caption: 'Recipe photo uploaded by you.' };
}
function openEditor(type = 'recipe', entry = null) {
  editorVersion++; photoVersion++; draftPhoto = entry?.photo ? { ...entry.photo } : null; photoUploadPending = false;
  $('#detail-dialog').close();
  const recipe = type === 'recipe';
  const choices = recipe ? ['Breakfast', 'Lunch', 'Dinner'] : ['Nutrition', 'Sleep', 'Movement', 'Hydration', 'Food safety', 'General'];
  $('#edit-content').innerHTML = `<div class="dialog-body"><button class="dialog-close icon-button" data-close aria-label="Close">×</button><span class="small-tag">${entry ? 'Make it your own' : 'Keep something good'}</span><h2 id="edit-title">${entry ? 'Edit your find.' : 'Add a little inspiration.'}</h2><p>Keep a recipe or a useful note, with a link back to where you found it.</p>${!entry ? `<div class="editor-tabs"><button class="chip ${recipe ? 'active' : ''}" data-editor="recipe" aria-pressed="${recipe}">A recipe</button><button class="chip ${!recipe ? 'active' : ''}" data-editor="article" aria-pressed="${!recipe}">A health note</button></div>` : ''}<form id="entry-form" data-type="${type}" data-id="${escape(entry?.id || '')}"><label>Title<input name="title" required maxlength="150" value="${escape(entry?.title || '')}" placeholder="${recipe ? 'The perfect weeknight pasta' : 'What I learned about sleep'}" /></label><label>A short description<textarea name="description" rows="2" maxlength="700" required placeholder="What makes this one worth keeping?">${escape(entry?.description || '')}</textarea></label>${recipe ? photoFields(entry) : ''}<div class="form-row"><label>Category<select name="category">${choices.map(c => `<option ${entry?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>${recipe ? `<label>Total minutes<input name="minutes" type="number" min="1" max="1440" value="${entry?.minutes || 20}" required /></label><label>Servings<input name="servings" type="number" min="1" max="100" value="${entry?.servings || 2}" required /></label>` : ''}</div>${recipe ? `<label>Ingredients <span>One per line, including quantities</span><textarea name="ingredients" rows="5" required maxlength="18000" placeholder="1 cup cooked lentils&#10;2 handfuls baby spinach">${escape(entry?.ingredients?.join('\n') || '')}</textarea></label><label>Method <span>One step per line</span><textarea name="steps" rows="5" required maxlength="18000" placeholder="Write each step on its own line…">${escape(entry?.steps?.join('\n') || '')}</textarea></label><label>Your notes <span>Optional</span><textarea name="note" rows="2" maxlength="12000">${escape(entry?.note || '')}</textarea></label>` : `${(entry?.sections || [{ heading: 'Your notes', body: '' }]).map((section, i) => `<label>Section heading<input name="heading-${i}" maxlength="200" value="${escape(section.heading)}" /></label><label>What you learned<textarea name="body-${i}" rows="6" required maxlength="12000" placeholder="Keep the useful details in your own words…">${escape(section.body)}</textarea></label>`).join('')}`}${recipe ? estimateEditor(entry) : ''}<label>Source link <span>Optional</span><input name="sourceUrl" type="url" maxlength="2000" placeholder="https://…" value="${escape(entry?.sourceUrl || '')}" /></label><label>Tags <span>Optional, separated by commas</span><input name="tags" maxlength="300" placeholder="quick, vegetarian, weeknight" value="${escape(entry?.tags?.join(', ') || '')}" /></label><p class="fine-print">Saved in this browser. Export your library to keep a backup.</p><div id="form-error" class="form-error" role="alert"></div><button class="button button-dark" type="submit">${entry ? 'Save changes' : 'Add to my library'} ${icon('arrow')}</button></form></div>`;
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
  if (target.matches('a[href^="?view="]')) { event.preventDefault(); const params = new URL(target.href).searchParams; navigate(params.get('view'), false, params.get('budget') === '1'); }
  if (target.dataset.close !== undefined) target.closest('dialog').close();
  if (target.dataset.open) openDetail(target.dataset.open);
  if (target.dataset.save) {
    const id = target.dataset.save;
    const wasSaved = saved(id);
    if (persist({ ...library, saved: wasSaved ? library.saved.filter(x => x !== id) : [...library.saved, id] })) { const y = window.scrollY; render(); window.scrollTo(0, y); if ($('#detail-dialog').open) openDetail(activeDetail); toast(wasSaved ? 'Removed from your collection' : 'Saved to your collection'); }
  }
  if (target.dataset.category) { category = target.dataset.category; visibleRecipeCount = 18; updateUrl(); render(); }
  if (target.dataset.editor) openEditor(target.dataset.editor);
  if (target.dataset.edit) { const entry = library.entries.find(x => x.id === target.dataset.edit); openEditor(entry.type, entry); }
  if (target.dataset.delete) { target.outerHTML = `<button class="button button-outline delete-button" data-confirm-delete="${escape(target.dataset.delete)}">Confirm delete</button>`; }
  if (target.dataset.confirmDelete) { const id = target.dataset.confirmDelete; if (persist({ ...library, entries: library.entries.filter(x => x.id !== id), saved: library.saved.filter(x => x !== id) })) { $('#detail-dialog').close(); render(); toast('Your find was deleted'); } }
  const action = target.dataset.action;
  if (action === 'add') openEditor();
  if (action === 'collection') navigate('home', true);
  if (action === 'library') $('#library-dialog').showModal();
  if (action === 'toggle-saved') { visibleRecipeCount = 18; collectionOnly = !collectionOnly; updateUrl(); render(); }
  if (action === 'reset') { recipeFilters = normalizeFilters(); filterPanelOpen = false; query = ''; category = 'All'; collectionOnly = false; budgetOnly = false; visibleRecipeCount = 18; updateUrl(); render(); }
  if (action === 'toggle-filters') { filterPanelOpen = !filterPanelOpen; render(); }
  if (action === 'clear-number-filters') { recipeFilters = normalizeFilters(); visibleRecipeCount = 18; updateUrl(); render(); }
  if (action === 'toggle-budget') { budgetOnly = !budgetOnly; visibleRecipeCount = 18; updateUrl(); render(); }
  if (action === 'load-more') { const before = visibleRecipeCount; visibleRecipeCount += 18; $('#results').innerHTML = results(); queueMicrotask(() => document.querySelectorAll('.recipe-card h3 button')[before]?.focus({ preventScroll: true })); }
  if (action === 'remove-photo') { photoVersion++; photoUploadPending = false; draftPhoto = null; $('#recipe-photo-url').value = ''; $('#recipe-photo-file').value = ''; $('#photo-status').textContent = 'Add a photo before saving this recipe.'; previewDraftPhoto(); }
  if (action === 'import') $('#import-file').click();
  if (action === 'export') { const blob = new Blob([recoveryRaw ?? JSON.stringify(library, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `stevies-world-library-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast(recoveryRaw ? 'Original library exported for recovery' : 'Library backup exported'); }
});
document.addEventListener('toggle', event => {
  if (event.target.matches?.('details[data-estimate]') && event.target.isConnected) {
    if (event.target.open) expandedEstimates.add(event.target.dataset.estimate);
    else expandedEstimates.delete(event.target.dataset.estimate);
  }
}, true);
document.addEventListener('change', async event => {
  if (event.target.id === 'recipe-photo-file') {
    const file = event.target.files[0]; if (!file) return; const version = editorVersion; const selection = ++photoVersion; photoUploadPending = true; $('#photo-status').textContent = 'Preparing your photo…';
    try { const photo = await uploadedPhoto(file); if (version !== editorVersion || selection !== photoVersion || !$('#edit-dialog').open) return; draftPhoto = photo; $('#recipe-photo-url').value = ''; previewDraftPhoto(); $('#photo-status').textContent = 'Photo ready.'; }
    catch (error) { if (version === editorVersion && selection === photoVersion && $('#photo-status')) $('#photo-status').textContent = error.message; }
    finally { if (version === editorVersion && selection === photoVersion) photoUploadPending = false; }
  }
  if (event.target.id === 'recipe-photo-url') { photoVersion++; photoUploadPending = false; const url = safePhotoSource(event.target.value.trim(), { allowLocal: false }); draftPhoto = url && url.startsWith('https:') ? { ...(draftPhoto?.src === url ? draftPhoto : {}), src: url, alt: draftPhoto?.alt || 'Recipe photo' } : null; $('#photo-status').textContent = draftPhoto ? 'Photo selected. It will be checked before saving.' : 'Add a photo before saving this recipe.'; previewDraftPhoto(); }
  if (event.target.matches('[data-recipe-sort]')) { recipeFilters = normalizeFilters({ ...recipeFilters, sort: event.target.value }); refreshFilterResults(); }
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
document.addEventListener('input', event => { if (event.target.dataset.recipeFilter) { recipeFilters = normalizeFilters({ ...recipeFilters, [event.target.dataset.recipeFilter]: event.target.value }); refreshFilterResults(); } if (event.target.id === 'search') { query = event.target.value.trim(); visibleRecipeCount = 18; updateUrl(); $('#results').innerHTML = results(); } });
document.addEventListener('submit', async event => {
  if (event.target.id === 'research-form') { event.preventDefault(); const value = new FormData(event.target).get('research').trim(); if (value) window.open('https://www.google.com/search?q=' + encodeURIComponent(value), '_blank', 'noopener,noreferrer'); }
  if (event.target.id === 'entry-form') {
    event.preventDefault(); const form = event.target; if (form.dataset.saving === 'true') return; const data = new FormData(form); const get = name => String(data.get(name) || '').trim(); const type = form.dataset.type;
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
    if (type === 'recipe') {
      if (photoUploadPending) { $('#form-error').textContent = 'Wait for the photo to finish preparing, then save.'; return; }
      const version = editorVersion; const selection = photoVersion;
      try {
        const url = get('photoUrl');
        const photo = url ? { ...(draftPhoto?.src === url ? draftPhoto : {}), src: url } : draftPhoto ? { ...draftPhoto } : null;
        if (!photo) throw new Error('A photo is required. Upload a photo or paste a direct HTTPS image link.');
        photo.alt = get('photoAlt') || `Photo for ${entry.title}`;
        if (get('photoAuthor')) photo.author = get('photoAuthor'); else delete photo.author;
        if (get('photoSource')) photo.sourceUrl = get('photoSource'); else delete photo.sourceUrl;
        entry.photo = validatePhoto(photo, { required: true });
        form.dataset.saving = 'true'; const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
        try { await loadPhoto(entry.photo.src); } finally { if (submit.isConnected) submit.disabled = false; form.dataset.saving = ''; }
        if (version !== editorVersion || !form.isConnected || !$('#edit-dialog').open) return;
        if (selection !== photoVersion) throw new Error('The selected photo changed. Save again to use the new photo.');
      } catch (error) { if (form.isConnected) { $('#form-error').textContent = error.message; $('#form-error').scrollIntoView({ block: 'nearest' }); } return; }
    }
    try { const checked = validateLibrary({ ...library, entries: [...library.entries.filter(x => x.id !== entry.id), entry], saved: [...new Set([...library.saved, entry.id])] }); if (persist(checked)) { $('#edit-dialog').close(); render(); openDetail(entry.id); toast('Your find is saved'); } } catch (error) { $('#form-error').textContent = error.message; }
  }
});
$('#import-file').addEventListener('change', async event => { const file = event.target.files[0]; if (!file) return; try { if (file.size > 5_000_000) throw new Error('Choose a backup smaller than 5 MB.'); const incoming = validateLibrary(JSON.parse(await file.text())); if (storageError) { if (recoveryRaw !== null) localStorage.setItem(STORAGE_KEY + '.recovery', recoveryRaw); localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming)); library = incoming; recoveryRaw = null; storageError = ''; render(); toast('Your library was restored'); } else { const next = mergeLibraries(library, incoming); if (persist(next)) { render(); toast('Your library was imported'); } } } catch (error) { toast('Import failed: ' + error.message); } finally { event.target.value = ''; } });
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { event.preventDefault(); $('#search').focus(); } });
$('#edit-dialog').addEventListener('close', () => { editorVersion++; photoUploadPending = false; });
document.addEventListener('error', event => {
  const img = event.target; if (!(img instanceof HTMLImageElement)) return;
  if (img.id === 'recipe-photo-preview' && $('#photo-status')) $('#photo-status').textContent = 'This photo link did not load. Try an upload or a direct image link.';
  if (!img.classList.contains('recipe-photo') || img.dataset.fallback) return;
  const fallback = { ...seedPhotos.chickpea, caption: 'The selected photo could not load. Serving inspiration is shown.' };
  img.dataset.fallback = 'true'; img.src = fallback.src; img.alt = fallback.alt;
  if (img.classList.contains('detail-image') && $('#recipe-photo-credit')) $('#recipe-photo-credit').outerHTML = photoCredit(fallback);
}, true);
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
window.addEventListener('popstate', () => { document.querySelectorAll('dialog[open]').forEach(d => d.close()); readRoute(); });
window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) { try { library = event.newValue ? validateLibrary(JSON.parse(event.newValue)) : emptyLibrary(); render(); if ($('#detail-dialog').open) { if (allItems().some(x => x.id === activeDetail)) openDetail(activeDetail); else $('#detail-dialog').close(); } } catch { toast('Could not read the library change from another tab.'); } } });
readRoute();
