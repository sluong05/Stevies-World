import test from 'node:test';
import assert from 'node:assert/strict';
import { ingredientReferences, estimatePlans, calculateEstimates } from '../data/recipe-estimates.js';
import { recipes } from '../content.js';
import { recipeMetrics } from '../recipe-search.js';

test('the combined katsu curry includes chicken, coating, absorbed oil and the requested rice', () => {
  assert.deepEqual(ingredientReferences.curry.nutrition, { calories: 450, protein: 5, carbs: 45, fat: 25 });
  assert.equal(estimatePlans['japanese-curry-for-katsu'].servings, 4);
  const amounts = Object.fromEntries(estimatePlans['japanese-curry-for-katsu'].amounts);
  assert.deepEqual([amounts.chicken, amounts.flour, amounts.egg, amounts.panko, amounts.fryingOil, amounts.oil, amounts.rice], [600, 60, 100, 100, 40, 13.5, 200]);
  assert.equal(recipes.find(item => item.id === 'japanese-curry-for-katsu').title, 'Chicken Katsu Curry');
  assert.equal(estimatePlans['japanese-curry-for-katsu'].amounts.some(([key]) => /salad|sugar/.test(key)), false);
  assert.deepEqual(calculateEstimates('japanese-curry-for-katsu').nutrition, { calories: 859, protein: 48.6, carbs: 102.4, fat: 26.5 });
});

test('udon counts beef sauce and broth seasonings together, with optional eggs excluded', () => {
  const plan = estimatePlans['beef-udon-niku-udon'];
  assert.equal(plan.servings, 2);
  assert.equal(plan.amounts.find(([key]) => key === 'soy')[1], 60);
  assert.equal(plan.amounts.find(([key]) => key === 'mirin')[1], 52.5);
  assert.equal(plan.amounts.find(([key]) => key === 'udon')[1], 400);
  assert.equal(plan.amounts.find(([key]) => key === 'beef')[1], 200);
  assert.equal(plan.amounts.some(([key]) => /egg|garnish/.test(key)), false);
  assert.deepEqual(calculateEstimates('beef-udon-niku-udon').nutrition, { calories: 630, protein: 32.6, carbs: 89.9, fat: 13.1 });
});

test('published estimates round only after summing and filters use full-recipe cost divided by servings', () => {
  for (const recipe of recipes.filter(item => item.nutrition && item.cost)) {
    const calculation = calculateEstimates(recipe.id), plan = estimatePlans[recipe.id];
    assert.equal(recipe.cost.total, Math.round(calculation.totalCost * 100) / 100);
    for (const nutrient of ['protein', 'carbs', 'fat']) assert.ok(Math.abs(recipe.nutrition[nutrient] - calculation.totalNutrition[nutrient] / plan.servings) <= .05);
    assert.equal(recipeMetrics(recipe).price, recipe.cost.total / recipe.servings);
    assert.equal(recipeMetrics(recipe).density, recipe.nutrition.protein / recipe.nutrition.calories * 100);
  }
});
