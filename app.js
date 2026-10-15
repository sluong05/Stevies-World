import { recipes, articles } from './content.js';
import { recipeEstimates } from './estimates.js';
import { budgetMeals, budgetCriteria } from './budget-meals.js';
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
let budgetOnly = false;
let visibleRecipeCount = 18;
let activeDetail = null;
let estimateBasis = 'serving';
let expandedEstimates = new Set();
let toastTimeout;
const budgetGroups = ['Breakfast', 'Lunch', 'Dinner'].map(category => budgetMeals.filter(item => item.category === category));
const budgetBrowseMeals = Array.from({ length: Math.max(...budgetGroups.map(group => group.length)) }, (_, index) => budgetGroups.map(group => group[index]).filter(Boolean)).flat();
const allRecipes = () => [...recipes.map(x => ({ ...x, ...recipeEstimates[x.id], type: 'recipe' })), ...budgetBrowseMeals.map(x => ({ ...x, type: 'recipe' })), ...library.entries.filter(x => x.type === 'recipe')];
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
function mealArt(item) {
  const styles = {
    breakfast: '<ellipse cx="160" cy="103" rx="85" ry="50" fill="#fffaf2"/><ellipse cx="160" cy="96" rx="70" ry="36" fill="#d6bb91"/><path d="M117 99q40-30 89 5" fill="none" stroke="#fbf8e8" stroke-width="15" stroke-linecap="round"/><g fill="#7b4776"><circle cx="131" cy="83" r="9"/><circle cx="149" cy="72" r="8"/><circle cx="120" cy="105" r="8"/></g><g fill="#e9d967"><circle cx="177" cy="86" r="13"/><circle cx="192" cy="99" r="13"/><circle cx="203" cy="112" r="12"/></g>',
    bowl: '<ellipse cx="160" cy="102" rx="88" ry="52" fill="#faf8ee"/><ellipse cx="160" cy="95" rx="74" ry="38" fill="#e4d6bb"/><path d="m130 66 22 8-8 22-22-9zm-20 25 21 8-8 22-21-9zm42 8 23 9-8 21-23-8z" fill="#c2976c"/><path d="M171 68q46-17 42 22-30 4-42-22m10 35q50-9 32 24-33 6-32-24" fill="#6c8b58"/><g fill="#c56e58"><circle cx="117" cy="79" r="10"/><circle cx="153" cy="115" r="9"/></g>',
    salad: '<ellipse cx="160" cy="102" rx="88" ry="52" fill="#fbfaf2"/><path d="M98 99q-12-38 29-31 17-31 40-6 41-13 44 20 32 18 6 39-33 31-67 14-41 21-52-14z" fill="#70985f"/><g fill="#c5d090"><circle cx="121" cy="102" r="17"/><circle cx="180" cy="112" r="17"/></g><g fill="#d68468"><circle cx="160" cy="82" r="13"/><circle cx="202" cy="94" r="10"/></g><g fill="#eadca8"><circle cx="140" cy="116" r="8"/><circle cx="152" cy="104" r="7"/><circle cx="183" cy="77" r="8"/></g>',
    wrap: '<ellipse cx="160" cy="128" rx="91" ry="27" fill="#c7baaa" opacity=".35"/><path d="m91 96 25-45q39-9 69 29l-28 53q-42 0-66-37" fill="#d6b984"/><path d="m150 111 28-49q41-7 65 29l-27 49q-42 1-66-29" fill="#e5c994"/><path d="m112 58q25-6 59 22m6-9q34-5 53 23" fill="none" stroke="#72915c" stroke-width="12"/><path d="m123 61 12 7m55 7 13 7" stroke="#cf765c" stroke-width="10" stroke-linecap="round"/><path d="m108 101 28 14m39 4 24 11" stroke="#b39869" stroke-width="3"/>',
    pasta: '<ellipse cx="160" cy="103" rx="88" ry="51" fill="#fcfaf2"/><path d="M111 84c64-26 105 33 30 37-42 1-37-44 11-48 60-5 60 58-2 55-48-2-43-44 8-43 49 1 25 43-13 25" fill="none" stroke="#c7a963" stroke-width="8" stroke-linecap="round"/><g fill="#bd7158"><circle cx="128" cy="86" r="9"/><circle cx="191" cy="104" r="9"/></g><path d="M159 65q-4-20 18-17 6 18-18 17m-20 57q-18 4-14 22 22 0 14-22" fill="#6c8e5a"/>',
    skillet: '<path d="m229 104 52-19" stroke="#59635b" stroke-width="16" stroke-linecap="round"/><ellipse cx="157" cy="103" rx="87" ry="52" fill="#59635b"/><ellipse cx="157" cy="97" rx="72" ry="37" fill="#d9bc84"/><g fill="#be7a5f"><rect x="108" y="77" width="28" height="22" rx="6" transform="rotate(-12 122 88)"/><rect x="165" y="105" width="29" height="21" rx="6" transform="rotate(17 180 115)"/></g><g fill="#759458"><circle cx="177" cy="78" r="15"/><circle cx="132" cy="115" r="13"/></g><path d="m147 79 9 19m47-6 8 17" stroke="#e6d894" stroke-width="8" stroke-linecap="round"/>',
    soup: '<ellipse cx="160" cy="113" rx="87" ry="48" fill="#fbf9ef"/><ellipse cx="160" cy="103" rx="73" ry="34" fill="#c78359"/><g fill="#e8cd91"><circle cx="131" cy="91" r="9"/><circle cx="166" cy="117" r="10"/><circle cx="194" cy="98" r="8"/></g><path d="m148 88 13 9m-41 14 12 7m51-2 10 9" stroke="#65865a" stroke-width="8" stroke-linecap="round"/><path d="M139 52q-12-14 0-25m35 25q-12-14 0-25" stroke="#a7a99a" fill="none" stroke-width="3" stroke-linecap="round"/>',
    toast: '<ellipse cx="160" cy="123" rx="89" ry="34" fill="#f8f5eb"/><path d="m98 93 51-45q18-8 29 7l40 49-51 44z" fill="#b3895b"/><path d="m108 93 44-36q12-6 18 4l36 42-41 34z" fill="#e3c697"/><path d="m122 91 36-24 30 36-27 21z" fill="#f1edda"/><path d="m124 98q4-23 25-15m19 23q10-21 24-4" stroke="#729260" stroke-width="11" fill="none"/><circle cx="157" cy="96" r="14" fill="#e9cd65"/>',
  };
  const tone = item.tags?.includes('Plant based') ? 'green' : item.tags?.includes('Pescatarian') ? 'blue' : item.tags?.includes('Vegetarian') ? 'yellow' : 'lilac';
  return `<span class="meal-art meal-art-${tone}" aria-hidden="true"><svg viewBox="0 0 320 190">${styles[item.cover] || styles.bowl}</svg></span>`;
}
function qualifiesForBudget(item) { return item.type !== 'article' && item.nutrition?.protein >= budgetCriteria.minProtein && item.cost?.currency === 'USD' && item.cost.total / item.servings <= budgetCriteria.maxCost; }
function recipeCard(item) {
  return `<article class="recipe-card"><div class="recipe-image-wrap"><button class="image-open" data-open="${escape(item.id)}" aria-label="Read ${escape(item.title)}">${item.imageKey ? `<img src="/assets/${escape(item.imageKey)}.jpg" alt="${escape(imageNames[item.imageKey])}" loading="lazy" />` : item.cover ? mealArt(item) : `<span class="recipe-placeholder">${icon('food')}</span>`}</button><span class="image-category">${escape(item.category)}</span>${saveButton(item)}</div><div class="recipe-meta"><span>${icon('clock')}${item.minutes} min</span><span>${escape(item.personal ? 'Your find' : item.tags?.[0] || 'Everyday cooking')}</span></div><h3><button data-open="${escape(item.id)}">${escape(item.title)}</button></h3><p>${escape(item.description)}</p>${item.collection === 'protein-budget' ? `<div class="card-estimates"><span>${amount(item.nutrition.protein)} g protein</span><span>About ${money(item.cost.total / item.servings)} / serving</span></div>` : ''}</article>`;
}
function articleCard(item) {
  return `<article class="article-card tone-${escape(articleIcons[item.category] || 'leaf')}"><div class="article-card-top"><span class="article-icon">${icon(articleIcons[item.category] || 'leaf')}</span>${saveButton(item)}</div><div class="article-meta"><span>${escape(item.category)}</span><span>${item.readMinutes || 2} min read</span></div><h3><button data-open="${escape(item.id)}">${escape(item.title)}</button></h3><p>${escape(item.description)}</p><button class="article-read" data-open="${escape(item.id)}" aria-label="Read ${escape(item.title)}">${item.personal ? 'Read note' : 'Read the guide'}${icon('arrow')}</button></article>`;
}
function filters() {
  const options = view === 'recipes' ? ['All', 'Breakfast', 'Lunch', 'Dinner'] : view === 'health' ? ['All', 'Nutrition', 'Sleep', 'Movement', 'Hydration', 'Food safety'] : [];
  return `<div class="filters">${options.length ? `<div class="filter-chips" aria-label="Filter by category">${options.map(c => `<button class="chip ${c === category ? 'active' : ''}" data-category="${c}" aria-pressed="${c === category}">${c === 'All' ? 'Everything' : c}</button>`).join('')}</div>` : ''}${view !== 'health' ? `<button class="chip budget-toggle ${budgetOnly ? 'active' : ''}" data-action="toggle-budget" aria-pressed="${budgetOnly}">25 g+ protein, $4 or less</button>` : ''}<button class="chip collection-toggle ${collectionOnly ? 'active' : ''}" data-action="toggle-saved" aria-pressed="${collectionOnly}">${icon('bookmark')}Saved only</button></div>`;
}
function matches(item) { const haystack = [item.title, item.description, item.category, ...(item.tags || []), ...(item.ingredients || []), ...(item.sections || []).map(s => s.body)].join(' ').toLowerCase(); return (!query || haystack.includes(query.toLowerCase())) && (category === 'All' || item.category === category) && (!collectionOnly || saved(item.id)) && (!budgetOnly || qualifiesForBudget(item)); }
function emptyState() { return `<div class="empty-state">${icon('search')}<h3>${collectionOnly ? 'A little room for your favorites.' : 'Nothing here just yet.'}</h3><p>${collectionOnly ? 'Save a recipe or guide using its bookmark, and find it here.' : 'Try another search or add a recipe or note of your own.'}</p><button class="button button-outline" data-action="reset">${collectionOnly ? 'Browse everything' : 'Clear filters'}</button></div>`; }
function results() {
  const r = allRecipes().filter(matches), a = allArticles().filter(matches);
  const isLanding = view === 'home' && !query && !collectionOnly && !budgetOnly;
  const count = (view === 'recipes' ? r.length : view === 'health' ? a.length : r.length + a.length);
  let html = !isLanding ? `<p class="result-count" role="status">${count} ${count === 1 ? 'find' : 'finds'}${query ? ` for “${escape(query)}”` : ''}</p>` : '';
  if (!count) return html + emptyState();
  if (view !== 'health' && r.length) html += `<section class="content-section" aria-labelledby="recipe-heading"><div class="section-heading"><div><h2 id="recipe-heading">${isLanding ? 'Something good to cook.' : budgetOnly ? 'High-protein budget meals' : view === 'recipes' ? 'The recipe collection' : 'Recipes'}</h2>${isLanding ? '<p>Simple ingredients. Meals worth making.</p>' : ''}</div>${isLanding ? '<a class="section-link" href="?view=recipes">All recipes ' + icon('arrow') + '</a>' : ''}</div><div class="recipe-grid">${(isLanding ? r.slice(0, 3) : r.slice(0, visibleRecipeCount)).map(recipeCard).join('')}</div>${!isLanding && r.length > visibleRecipeCount ? `<div class="load-more"><p>Showing ${Math.min(visibleRecipeCount, r.length)} of ${r.length} recipes</p><button class="button button-outline" data-action="load-more">Show more recipes</button></div>` : ''}</section>`;
  if (view !== 'recipes' && a.length) html += `<section class="content-section" aria-labelledby="health-heading"><div class="section-heading"><div><h2 id="health-heading">${isLanding ? 'A little knowledge goes a long way.' : view === 'health' ? 'The healthy living collection' : 'Healthy living'}</h2>${isLanding ? '<p>Useful reads for taking care of yourself.</p>' : ''}</div>${isLanding ? '<a class="section-link" href="?view=health">All guides ' + icon('arrow') + '</a>' : ''}</div><div class="article-grid">${(isLanding ? a.slice(0, 3) : a).map(articleCard).join('')}</div></section>`;
  return html;
}
function researchPanel() { return `<section class="research-panel"><div><span class="research-symbol" aria-hidden="true">✳</span><h2>Follow your curiosity.</h2><p>Look up a new dish, dig into a health topic, and bring the useful bits back here.</p></div><div><form id="research-form"><label for="research-query">What would you like to learn?</label><div class="research-input"><input id="research-query" name="research" placeholder="Try “easy lentil recipes”" required maxlength="200" /><button class="icon-button" aria-label="Search the web">${icon('arrow')}</button></div><p class="fine-print">Opens a Google search in a new tab.</p></form><div class="trusted-links">${link('https://www.bbcgoodfood.com/recipes', 'Recipe inspiration')}${link('https://www.cdc.gov/health-topics.html', 'Health topics')}</div></div></section>`; }
function render() {
  document.title = `${view === 'recipes' ? 'Recipes' : view === 'health' ? 'Healthy living' : collectionOnly ? 'My collection' : 'Discover'} — Stevies World`;
  document.querySelectorAll('[data-nav]').forEach(el => { el.classList.toggle('active', el.dataset.nav === view && !collectionOnly); if (el.dataset.nav === view && !collectionOnly) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  const heroRecipe = allRecipes().find(x => x.imageKey === 'chickpea') || allRecipes()[0];
  const home = view === 'home' && !collectionOnly && !budgetOnly;
  $('#main').innerHTML = `${storageError ? `<p class="storage-warning">${escape(storageError)}</p>` : ''}${home ? `<section class="hero"><div class="hero-copy"><div class="welcome-note">Your own little corner of the internet</div><h1>Good food.<br>Feel-good living.</h1><p>A home for recipes you'll love and knowledge that helps you take care of you.</p><a class="button button-dark" href="?view=recipes">Find something delicious ${icon('arrow')}</a><div class="hero-footnote">A little curiosity looks good on you.</div></div><div class="hero-image"><img src="/assets/chickpea.jpg" alt="A colorful bowl of vegetables and chickpeas" fetchpriority="high" /><span class="image-sticker">made for<br><em>everyday you</em><span>✳</span></span><button class="hero-caption" data-open="${escape(heroRecipe.id)}"><span><small>From the recipe collection</small><strong>${escape(heroRecipe.title)}</strong></span>${icon('arrow')}</button></div></section>` : `<section class="page-intro"><span class="intro-icon">${icon(collectionOnly ? 'bookmark' : view === 'recipes' ? 'food' : 'sun')}</span><h1>${collectionOnly ? 'The good things, kept close.' : view === 'recipes' ? 'Make room for good food.' : 'Get to know a healthier you.'}</h1><p>${collectionOnly ? 'Recipes and reads you’ve saved for another day.' : view === 'recipes' ? 'Everyday recipes to explore, make your own, and come back to.' : 'Clear, source-linked information on food, rest, movement, and more.'}</p></section>`}<section class="browse-tools" aria-label="Find information"><div class="search-box">${icon('search')}<label class="sr-only" for="search">Search ${view === 'recipes' ? 'recipes and ingredients' : view === 'health' ? 'healthy living guides' : 'recipes, ingredients, and health topics'}</label><input id="search" type="search" placeholder="${view === 'recipes' ? 'Search recipes or ingredients…' : view === 'health' ? 'Search healthy living topics…' : 'Search recipes, ingredients, or a little inspiration…'}" value="${escape(query)}" /><kbd aria-hidden="true">/</kbd></div>${!home || query ? filters() : '<div class="search-hint">Good things start with curiosity.</div>'}</section>${view !== 'health' && !budgetOnly && !collectionOnly && !query ? `<aside class="budget-banner"><div><h2>More protein. A little less spend.</h2><p>100 meals estimated at 25 g+ protein and $4 or less per serving.</p></div><a class="button button-outline" href="?view=recipes&budget=1">Explore the meals ${icon('arrow')}</a></aside>` : ''}<div id="results">${results()}</div>${!collectionOnly ? researchPanel() : ''}`;
}
function updateUrl() { const params = new URLSearchParams(); if (view !== 'home') params.set('view', view); if (query) params.set('q', query); if (collectionOnly) params.set('saved', '1'); if (category !== 'All') params.set('category', category); if (budgetOnly) params.set('budget', '1'); history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '')); }
function readRoute() { const p = new URLSearchParams(location.search); view = ['recipes', 'health'].includes(p.get('view')) ? p.get('view') : 'home'; query = p.get('q') || ''; collectionOnly = p.get('saved') === '1'; category = p.get('category') || 'All'; budgetOnly = p.get('budget') === '1' && view !== 'health'; visibleRecipeCount = 18; render(); if (p.get('item')) openDetail(p.get('item')); }
function navigate(next, savedOnly = false, budget = false) { view = next; collectionOnly = savedOnly; budgetOnly = budget; visibleRecipeCount = 18; query = ''; category = 'All'; history.pushState(null, '', `?view=${view}${savedOnly ? '&saved=1' : ''}${budgetOnly ? '&budget=1' : ''}`); render(); window.scrollTo({ top: 0, behavior: 'instant' }); $('#main').focus({ preventScroll: true }); }
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
  if (action === 'reset') { query = ''; category = 'All'; collectionOnly = false; budgetOnly = false; visibleRecipeCount = 18; updateUrl(); render(); }
  if (action === 'toggle-budget') { budgetOnly = !budgetOnly; visibleRecipeCount = 18; updateUrl(); render(); }
  if (action === 'load-more') { const before = visibleRecipeCount; visibleRecipeCount += 18; $('#results').innerHTML = results(); queueMicrotask(() => document.querySelectorAll('.recipe-card h3 button')[before]?.focus({ preventScroll: true })); }
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
document.addEventListener('input', event => { if (event.target.id === 'search') { query = event.target.value.trim(); visibleRecipeCount = 18; updateUrl(); $('#results').innerHTML = results(); } });
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
