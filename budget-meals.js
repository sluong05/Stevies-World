import { ingredients } from './data/ingredients.js';
import { mealPlans } from './data/meal-plans.js';

export const budgetCriteria = { minProtein: 25, maxCost: 4, currency: 'USD' };
const round = (value, places = 0) => Math.round((value + Number.EPSILON) * 10 ** places) / 10 ** places;
const number = value => String(round(value, 1));
const fdc = key => ({ label: `USDA · ${ingredients[key].name}`, url: `https://fdc.nal.usda.gov/food-details/${ingredients[key].fdcId}/nutrients` });
const safety = { label: 'FoodSafety.gov · Safe cooking temperatures', url: 'https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures' };
const method = { label: 'Ingredient amounts, prices & calculation method', url: 'https://github.com/sluong05/Stevies-World/blob/main/BUDGET-MEALS.md' };

export function calculateMeal(plan) {
  const nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let perServingCost = 0.03; // Small allowance for salt and pepper, not full containers.
  for (const [key, grams] of plan.amounts) {
    const food = ingredients[key];
    if (!food || !Number.isFinite(grams) || grams <= 0) throw new Error(`Invalid ingredient in ${plan.id}: ${key}`);
    for (const nutrient of Object.keys(nutrition)) nutrition[nutrient] += food.per100g[nutrient] * grams / 100;
    perServingCost += food.pricePer100g * grams / 100;
  }
  return { nutrition, perServingCost, recipeCost: perServingCost * plan.servings };
}

function ingredientLabel(key, grams) {
  const food = ingredients[key];
  if (key === 'eggs') return `${number(grams / 50)} large ${grams === 50 ? 'egg' : 'eggs'} (${number(grams)} g without shells)`;
  if (['bread', 'pita', 'tortilla'].includes(key)) return `${number(grams)} g ${food.name} (check the package weight)`;
  return `${number(grams)} g ${food.name}`;
}

function mealNote(plan) {
  const keys = plan.amounts.map(([key]) => key);
  const allergens = [];
  if (keys.some(key => ['yogurt', 'cottage', 'cheddar', 'feta', 'milk'].includes(key))) allergens.push('milk');
  if (keys.some(key => ['eggs', 'eggWhites'].includes(key))) allergens.push('egg');
  if (keys.some(key => ['bread', 'pita', 'tortilla', 'pasta', 'soy'].includes(key))) allergens.push('wheat');
  if (keys.some(key => ['tofu', 'edamame', 'soy'].includes(key))) allergens.push('soy');
  if (keys.includes('peanutButter')) allergens.push('peanut');
  if (keys.includes('sesameOil')) allergens.push('sesame');
  if (keys.some(key => ['tuna', 'salmon'].includes(key))) allergens.push('fish');
  let note = `Original Stevies World recipe; not kitchen-tested. ${allergens.length ? `Contains ${allergens.join(', ')}; check packaged ingredient labels. ` : ''}`;
  if (keys.some(key => ['rice', 'brownRice', 'quinoa', 'lentils'].includes(key))) note += 'Time starts with the listed grains or lentils already cooked. Cook them ahead or allow extra time. ';
  if (keys.some(key => ['blackBeans', 'whiteBeans', 'kidneyBeans', 'chickpeas'].includes(key))) note += 'Drain and rinse canned beans. ';
  note += 'Refrigerate perishables within 2 hours. Use refrigerated leftovers within 3–4 days and reheat hot leftovers to 165°F (74°C).';
  return note;
}

export const budgetMeals = mealPlans.map(plan => {
  const calculated = calculateMeal(plan);
  const keys = plan.amounts.map(([key]) => key);
  const primary = keys[0];
  const nutritionNote = `Estimated per serving from the listed ingredient weights and USDA SR Legacy data; raw meats, dry oats/pasta, and cooked grains/legumes are distinguished in the ingredient list. ${keys.includes('tofu') ? 'Firm tofu is modeled at about 9 g protein per 100 g; brands vary. ' : ''}All listed oil and sauces are included. These are recipe calculations, not lab-tested nutrition labels.`;
  const costNote = `Estimated US ingredient cost in USD, using consumed amounts and a small seasoning allowance. Price examples and explicit budget assumptions reviewed October 14, 2026. ${ingredients[primary].priceBasis}. Buying full packages costs more; local prices, brands, tax, and cooking energy can change what you spend.`;
  const nutrition = { calories: round(calculated.nutrition.calories / 10) * 10, protein: round(calculated.nutrition.protein, 1), carbs: round(calculated.nutrition.carbs, 1), fat: round(calculated.nutrition.fat, 1), note: nutritionNote, sources: [fdc(primary), method] };
  const cost = { total: round(calculated.recipeCost, 2), currency: 'USD', note: costNote, sources: [{ label: ingredients[primary].priceSource.includes('github.com') ? 'Budget price assumptions' : 'Representative grocery price reference', url: ingredients[primary].priceSource }, ...(ingredients[primary].priceSource === method.url ? [] : [method])] };
  return {
    id: plan.id, title: plan.title, description: plan.description, category: plan.category,
    minutes: plan.minutes, servings: plan.servings, tags: [...plan.tags, 'High protein', 'Budget friendly', plan.proteinType],
    cover: plan.cover, proteinType: plan.proteinType, collection: 'protein-budget',
    ingredients: [...plan.amounts.map(([key, grams]) => ingredientLabel(key, grams * plan.servings)), 'Salt and black pepper to taste; optional'],
    steps: plan.steps, note: mealNote(plan), sources: [safety], nutrition, cost,
  };
});
