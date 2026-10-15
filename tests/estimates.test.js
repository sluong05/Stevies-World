import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes } from '../content.js';
import { recipeEstimates } from '../estimates.js';
import { safeUrl, validateLibrary } from '../storage.js';

test('every starter recipe has a complete, bounded nutrition and cost estimate', () => {
  assert.deepEqual(Object.keys(recipeEstimates).sort(), recipes.map(recipe => recipe.id).sort());
  for (const recipe of recipes) {
    const estimates = recipeEstimates[recipe.id];
    assert.ok(estimates.nutrition, `${recipe.id}: missing nutrition`);
    assert.ok(estimates.cost, `${recipe.id}: missing cost`);
    const normalized = validateLibrary({
      version: 1, saved: [],
      entries: [{ ...recipe, ...estimates, id: `personal-${recipe.id}`, type: 'recipe' }],
    }).entries[0];
    assert.deepEqual(normalized.nutrition, estimates.nutrition, recipe.id);
    assert.deepEqual(normalized.cost, estimates.cost, recipe.id);
    assert.equal(normalized.cost.currency, 'USD');
    assert.ok(normalized.cost.total > 0, `${recipe.id}: full recipe has a positive ingredient cost`);
    assert.ok(normalized.nutrition.calories > 0, `${recipe.id}: serving has calories`);
    for (const field of ['protein', 'carbs', 'fat']) {
      assert.ok(Number.isFinite(normalized.nutrition[field]) && normalized.nutrition[field] >= 0, `${recipe.id}: ${field}`);
    }
  }
});

test('starter estimates explain assumptions and include safe, descriptive source links', () => {
  for (const [id, estimates] of Object.entries(recipeEstimates)) {
    for (const kind of ['nutrition', 'cost']) {
      const estimate = estimates[kind];
      assert.ok(estimate.note?.trim(), `${id}: ${kind} needs an estimate note`);
      assert.ok(Array.isArray(estimate.sources) && estimate.sources.length > 0, `${id}: ${kind} needs references`);
      for (const source of estimate.sources) {
        assert.ok(source.label?.trim(), `${id}: ${kind} needs a descriptive source label`);
        assert.equal(safeUrl(source.url), source.url, `${id}: ${kind} source URL`);
        assert.equal(new URL(source.url).protocol, 'https:', `${id}: ${kind} source protocol`);
      }
    }
  }
});

test('starter serving estimates are internally consistent with their energy values', () => {
  for (const [id, { nutrition }] of Object.entries(recipeEstimates)) {
    // The 4/4/9 check allows normal differences from fiber and rounded nutrient data.
    const macroCalories = 4 * nutrition.protein + 4 * nutrition.carbs + 9 * nutrition.fat;
    assert.ok(Math.abs(macroCalories - nutrition.calories) <= nutrition.calories * 0.2, `${id}: calories and macros must use the same serving basis`);
  }
});
