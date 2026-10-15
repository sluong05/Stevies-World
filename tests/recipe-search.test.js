import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFilters, filterCount, filterErrors, recipeMetrics, matchesRecipeFilters, sortRecipes, filtersFromParams, addFiltersToParams } from '../recipe-search.js';

const meal = (id, overrides = {}) => ({ id, minutes: 20, servings: 4, nutrition: { calories: 400, protein: 32 }, cost: { total: 8, currency: 'USD' }, ...overrides });

test('filters accept zero and decimals while rejecting malformed route values', () => {
  assert.deepEqual(normalizeFilters({ priceMin: '0', priceMax: '2.25', proteinMin: '30', calMax: '', timeMax: null, densityMin: -1, densityMax: Infinity, sort: 'density', unknown: 5 }), { sort: 'density', priceMin: 0, priceMax: 2.25, proteinMin: 30 });
  for (const value of [false, [], {}, ' ', 'NaN', 'Infinity', -1]) assert.deepEqual(normalizeFilters({ priceMax: value, sort: 'bad' }), { sort: 'default' });
  assert.equal(filterCount({ priceMin: 0, sort: 'price' }), 2);
});

test('price and protein density use per-serving values', () => {
  assert.deepEqual(recipeMetrics(meal('a')), { price: 2, protein: 32, calories: 400, density: 8, time: 20 });
  assert.equal(recipeMetrics(meal('a', { servings: 2 })).price, 4);
  assert.equal(recipeMetrics(meal('a', { nutrition: { protein: 0, calories: 0 } })).density, null);
  assert.equal(recipeMetrics(meal('a', { cost: { total: 2, currency: 'EUR' } })).price, null);
  assert.equal(recipeMetrics(meal('a', { servings: 0 })).price, null);
});

test('all ranges combine with inclusive boundaries and maximum cooking time', () => {
  const exact = { priceMin: 2, priceMax: 2, proteinMin: 32, proteinMax: 32, calMin: 400, calMax: 400, densityMin: 8, densityMax: 8, timeMax: 20 };
  assert.equal(matchesRecipeFilters(meal('a'), exact), true);
  for (const [key, value] of Object.entries({ priceMax: 1.99, priceMin: 2.01, proteinMin: 33, proteinMax: 31, calMin: 401, calMax: 399, densityMin: 8.01, densityMax: 7.99, timeMax: 19 })) assert.equal(matchesRecipeFilters(meal('a'), { ...exact, [key]: value }), false, key);
  assert.equal(filterErrors({ priceMin: 3, priceMax: 2 }).length, 1);
  assert.equal(matchesRecipeFilters(meal('a'), { priceMin: 3, priceMax: 2 }), false);
});

test('unknown estimates are excluded only for a metric that is filtered', () => {
  const unknown = meal('a', { nutrition: undefined, cost: undefined });
  assert.equal(matchesRecipeFilters(unknown), true);
  assert.equal(matchesRecipeFilters(unknown, { timeMax: 20 }), true);
  for (const field of ['priceMin', 'proteinMin', 'calMin', 'densityMin']) assert.equal(matchesRecipeFilters(unknown, { [field]: 0 }), false);
  assert.equal(matchesRecipeFilters(meal('zero', { cost: { total: 0, currency: 'USD' } }), { priceMax: 0 }), true);
});

test('sorts use the correct direction, keep ties stable, put unknowns last, and do not mutate', () => {
  const items = [meal('unknown', { nutrition: undefined, cost: undefined, minutes: undefined }), meal('a'), meal('b', { cost: { total: 4, currency: 'USD' }, nutrition: { protein: 40, calories: 300 }, minutes: 10 }), meal('tie')];
  for (const sort of ['price', 'protein', 'calories', 'density', 'time']) assert.deepEqual(sortRecipes(items, { sort }).map(x => x.id), ['b', 'a', 'tie', 'unknown'], sort);
  assert.deepEqual(items.map(x => x.id), ['unknown', 'a', 'b', 'tie']);
  assert.deepEqual(sortRecipes(items), items);
  assert.notEqual(sortRecipes(items), items);
});

test('URL filters round-trip and clearing them preserves unrelated route state', () => {
  const params = new URLSearchParams('view=recipes&q=chicken&priceMax=9&sort=protein');
  addFiltersToParams(params, { proteinMin: 30, priceMax: 2.5, densityMin: 8, timeMax: 25, sort: 'density' });
  assert.deepEqual(filtersFromParams(params), { sort: 'density', priceMax: 2.5, proteinMin: 30, densityMin: 8, timeMax: 25 });
  addFiltersToParams(params, {});
  assert.equal(params.toString(), 'view=recipes&q=chicken');
});
