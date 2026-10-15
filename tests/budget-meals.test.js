import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetMeals, budgetCriteria, calculateMeal } from '../budget-meals.js';
import { mealPlans } from '../data/meal-plans.js';
import { ingredients } from '../data/ingredients.js';
import { recipes, articles } from '../content.js';
import { validateLibrary, safeUrl } from '../storage.js';

test('the collection adds exactly 100 distinct meals without replacing the existing recipes', () => {
  assert.equal(budgetMeals.length, 100);
  assert.equal(recipes.length, 6);
  assert.equal(new Set([...recipes, ...budgetMeals, ...articles].map(x => x.id)).size, recipes.length + budgetMeals.length + articles.length);
  assert.equal(new Set(budgetMeals.map(x => x.title.toLowerCase())).size, 100);
  const combinations = mealPlans.map(x => JSON.stringify([...x.amounts].sort(([a], [b]) => a.localeCompare(b))));
  assert.equal(new Set(combinations).size, 100, 'meals must not be renamed duplicates with identical ingredient quantities');
  assert.deepEqual(budgetMeals.reduce((counts, item) => { counts[item.category] = (counts[item.category] || 0) + 1; return counts; }, {}), { Breakfast: 20, Lunch: 40, Dinner: 40 });
});

test('every budget meal meets both targets before rounding', () => {
  for (const plan of mealPlans) {
    const result = calculateMeal(plan);
    assert.ok(result.nutrition.protein >= budgetCriteria.minProtein, `${plan.id}: protein ${result.nutrition.protein}`);
    assert.ok(result.perServingCost <= budgetCriteria.maxCost, `${plan.id}: cost ${result.perServingCost}`);
    assert.ok(result.perServingCost > 0);
    assert.equal(result.recipeCost, result.perServingCost * plan.servings);
  }
});

test('nutrition and costs use the right serving basis and include all ingredients', () => {
  for (let i = 0; i < mealPlans.length; i++) {
    const plan = mealPlans[i], recipe = budgetMeals[i];
    const raw = calculateMeal(plan);
    for (const key of ['protein', 'carbs', 'fat']) assert.ok(Math.abs(recipe.nutrition[key] - raw.nutrition[key]) <= 0.051, `${plan.id}: ${key}`);
    assert.ok(Math.abs(recipe.nutrition.calories - raw.nutrition.calories) <= 5.01, plan.id);
    assert.ok(Math.abs(recipe.cost.total - raw.recipeCost) <= 0.0051, plan.id);
    const independentProtein = plan.amounts.reduce((sum, [key, grams]) => sum + ingredients[key].per100g.protein * grams / 100, 0);
    assert.ok(Math.abs(independentProtein - raw.nutrition.protein) < 0.000001);
    assert.equal(recipe.ingredients.length, plan.amounts.length + 1);
    assert.ok(recipe.nutrition.note.includes('per serving'));
    assert.ok(recipe.cost.note.includes('consumed amounts'));
  }
});

test('a two-serving calculation does not double per-serving macros or omit pantry costs', () => {
  const plan = { id: 'test', servings: 2, amounts: [['yogurt', 200], ['oats', 50]] };
  const result = calculateMeal(plan);
  assert.equal(result.nutrition.protein, ingredients.yogurt.per100g.protein * 2 + ingredients.oats.per100g.protein / 2);
  const cost = ingredients.yogurt.pricePer100g * 2 + ingredients.oats.pricePer100g / 2 + 0.03;
  assert.ok(Math.abs(result.perServingCost - cost) < 1e-10);
  assert.ok(Math.abs(result.recipeCost - cost * 2) < 1e-10);
});

test('all meals have usable instructions, valid covers, and portable estimates', () => {
  const covers = new Set(['breakfast', 'bowl', 'salad', 'wrap', 'pasta', 'skillet', 'soup', 'toast']);
  for (const recipe of budgetMeals) {
    assert.ok(covers.has(recipe.cover), recipe.id);
    assert.ok(recipe.description.length > 25, recipe.id);
    assert.ok(recipe.steps.length >= 3 && recipe.steps.every(step => step.length > 20), recipe.id);
    assert.ok(Number.isInteger(recipe.servings) && recipe.servings >= 1);
    assert.ok(recipe.note.includes('not kitchen-tested'));
    assert.doesNotThrow(() => validateLibrary({ version: 1, saved: [], entries: [{ ...recipe, id: `personal-${recipe.id}`, type: 'recipe' }] }), recipe.id);
    for (const source of [...recipe.sources, ...recipe.nutrition.sources, ...recipe.cost.sources]) assert.equal(safeUrl(source.url), source.url, recipe.id);
  }
});

test('raw meat and egg recipes have explicit safe cooking instructions', () => {
  for (const plan of mealPlans) {
    const keys = plan.amounts.map(([key]) => key);
    const instructions = plan.steps.join(' ');
    if (keys.some(key => ['chicken', 'turkey'].includes(key))) assert.match(instructions, /165°F/, plan.id);
    if (keys.includes('beef')) assert.match(instructions, /160°F/, plan.id);
    if (keys.includes('eggs') || keys.includes('eggWhites')) assert.match(instructions, /160°F|165°F|fully set|completely set|yolks are firm/, plan.id);
  }
});

test('ingredient data has traceable USDA IDs, finite nutrients, and explicit price assumptions', () => {
  for (const [key, food] of Object.entries(ingredients)) {
    assert.match(food.fdcId, /^\d+$/, key);
    assert.ok(food.usdaDescription.trim().length > 0, key);
    for (const value of Object.values(food.per100g)) assert.ok(Number.isFinite(value) && value >= 0, key);
    assert.ok(Number.isFinite(food.pricePer100g) && food.pricePer100g > 0, key);
    assert.ok(food.priceBasis.length > 10, key);
    assert.equal(safeUrl(food.priceSource), food.priceSource, key);
  }
  assert.ok(ingredients.tofu.per100g.protein < 10, 'use the documented conservative firm-tofu entry');
});
