// Reviewed October 15, 2026. Units are explicit; quantities are for the WHOLE recipe.
// Retailer references are representative US online prices, not a local checkout quote.
const fdc = id => `https://fdc.nal.usda.gov/food-details/${id}/nutrients`;
const source = (label, url) => ({ label, url });
const food = (unit, calories, protein, carbs, fat, nutritionSource, price, priceQuantity, priceSource, priceBasis) => ({ unit, nutrition: { calories, protein, carbs, fat }, nutritionSource, price, priceQuantity, priceSource, priceBasis });
export const ingredientReferences = {
  curry: food('92 g box', 450, 5, 45, 25, source('S&B · Golden Curry Mild nutrition', 'https://www.sbfoods-worldwide.com/products/search/004.html'), 2.92, 1, source('Walmart · S&B Golden Curry small box', 'https://www.walmart.com/c/kp/s-b-golden-curry'), '$2.92 per 92 g box; 5 label servings per box, rather than scaling the rounded 18 g serving weight.'),
  potato: food('g', .77, .0205, .1749, .0009, source('USDA · Raw potatoes', fdc(170026)), 3.24, 2267.96185, source('Walmart · Russet potatoes, 5 lb', 'https://www.walmart.com/c/kp/russet-potatoes-5-lb'), '$3.24 per 5 lb bag.'),
  onion: food('g', .4, .011, .0934, .001, source('USDA · Raw onions', fdc(170000)), 2.84, 1360.77711, source('Walmart · Yellow onions, 3 lb', 'https://www.walmart.com/c/best-sellers/bag-of-yellow-onions'), '$2.84 per 3 lb bag.'),
  carrot: food('g', .41, .0093, .0958, .0024, source('USDA · Raw carrots', fdc(170393)), 1.99, 907.18474, source('Walmart · Whole carrots, 2 lb', 'https://www.walmart.com/c/kp/two-pounds'), '$1.99 per 2 lb bag.'),
  oil: food('g', 8.84, 0, 0, 1, source('USDA · Cooking oil reference (olive oil)', fdc(171413)), .10, 13.5, null, 'Pantry allowance: $0.10 per tablespoon (13.5 g). Nutrition uses olive oil as a cooking-oil proxy.'),
  rice: food('g dry', 3.6, .0661, .7934, .0058, source('USDA · Dry medium-grain white rice', fdc(169760)), 9.97, 2267.96185, source('Walmart · Nishiki medium-grain rice, 5 lb', 'https://www.walmart.com/c/brand/brand-nishiki'), '$9.97 per 5 lb bag. 200 g dry rice for 4 portions (50 g dry per person); cooking water changes weight, not the counted macros.'),
  chicken: food('g', 1.2, .225, 0, .0262, source('USDA · Raw boneless skinless chicken breast', fdc(171077)), 2.97, 453.59237, source('Walmart · Boneless skinless chicken breast price reference', 'https://www.walmart.com/browse/chicken/chicken-breasts/976759_9569500_1001443_8161643'), '$2.97 per lb representative tray price; 600 g raw chicken for 4 portions.'),
  flour: food('g', 3.64, .1033, .7631, .0098, source('USDA · All-purpose unbleached flour', fdc(168936)), 2.38, 2267.96185, source('Walmart · All-purpose unbleached flour, 5 lb', 'https://www.walmart.com/ip/178921158'), '$2.38 per 5 lb bag; all 60 g prepared for dredging is counted.'),
  egg: food('g', 1.43, .1256, .0072, .0951, source('USDA · Whole egg', fdc(171287)), 1.67, 600, source('Walmart · Large eggs, 12 count', 'https://www.walmart.com/c/kp/eggs-12-count-great-value'), '$1.67 per dozen; 50 g edible weight per egg. All 2 eggs prepared for coating are counted.'),
  panko: food('g', 110 / 30, 4 / 30, 24 / 30, 0, source('Kikkoman · Panko nutrition', 'https://kikkomanusa.com/products/panko/'), 2.59, 226.796185, source('Target · Kikkoman panko, 8 oz', 'https://www.target.com/p/-/A-14774632'), '$2.59 per 8 oz pack. Nutrition uses the current manufacturer label (110 kcal per 30 g); labels can vary by version. All 100 g prepared are counted.'),
  fryingOil: food('g', 8.84, 0, 0, 1, source('USDA · Cooking oil macronutrient proxy', fdc(171413)), 3.82, 48 * 29.5735296 * .91, source('Walmart · Vegetable oil, 48 fl oz', 'https://www.walmart.com/c/kp/vegetable-oil-great-value'), '$3.82 per 48 US fl oz bottle; density assumed 0.91 g/ml. Estimate includes 40 g absorbed frying oil (10 g per cutlet), not all oil filling the pot. Actual oil absorption varies.'),
  beef: food('g', 100 / 56.69904625, 11 / 56.69904625, 0, 6 / 56.69904625, source('Kroger · Shaved beef label', 'https://www.kroger.com/p/kroger-beef-shaved-steak/0001111034567'), 7.99, 396.89332375, source('Kroger · Shaved steak, 14 oz', 'https://www.kroger.com/p/kroger-beef-shaved-steak/0001111034567'), '$7.99 per 14 oz package; nutrition label: 100 kcal, 11 g protein and 6 g fat per 2 oz.'),
  udon: food('g', 1.5, .04, .32, 0, source('KA-ME · Ready-to-use udon nutrition', 'https://kame.com/products/udon-stir-fry-noodles'), 3.62, 400, source('Walmart · KA-ME two-pouch udon', 'https://www.walmart.com/c/kp/udon-noodles-stir-fry'), '$3.62 per approximately 400 g two-pouch pack. Nutrition uses the current KA-ME label: 150 kcal per 100 g.'),
  soy: food('ml', 10 / 15, 2 / 15, 1 / 15, 0, source('Kikkoman · Soy sauce nutrition', 'https://kikkomanusa.com/products/soy-sauce-non-gmo/'), .45, 60, null, 'Pantry allowance: $0.45 for 4 tablespoons (60 ml) soy sauce.'),
  sugar: food('g', 3.87, 0, .9998, 0, source('USDA · Granulated sugar', fdc(169655)), .03, 12.5, null, 'Pantry allowance: $0.03 per tablespoon (12.5 g).'),
  mirin: food('ml', 70 / 30, 0, 14 / 30, 0, source('USDA · Kikkoman Aji-Mirin branded label', fdc(2084844)), 2.98, 295.735296, source('Walmart · Mirin, 10 fl oz', 'https://www.walmart.com/c/kp/mirin-kikkoman'), '$2.98 per 10 US fl oz bottle. Branded label: 70 kcal and 14 g carbohydrate per 30 ml. Alcohol energy is not subtracted.'),
  ginger: food('g', .8, .0182, .1777, .0075, source('USDA · Fresh ginger', fdc(169231)), .02, 1, null, 'Pantry allowance: $0.02 for 1 g grated ginger.'),
  hondashi: food('g', 2.4, .27, .30, .005, source('Ajinomoto · Hondashi nutrition', 'https://www.ajinomoto.co.jp/products/detail/?ProductName=hondashi'), 9.99, 64.92, source('Walmart · Hondashi 2.29 oz price reference', 'https://business.walmart.com/ip/Ajinomoto-Bonito-Fish-Soup-Stock-2-29oz/10543625'), '$9.99 per 2.29 oz jar online benchmark (listing may be out of stock). 1 tsp assumed 3 g. Fat uses midpoint of manufacturer range 0–0.01 g per gram.'),
};
export const estimatePlans = {
  'japanese-curry-for-katsu': { servings: 4, amounts: [['curry', 1], ['potato', 340], ['onion', 150], ['carrot', 61], ['oil', 13.5], ['chicken', 600], ['flour', 60], ['egg', 100], ['panko', 100], ['fryingOil', 40], ['rice', 200]] },
  'beef-udon-niku-udon': { servings: 2, amounts: [['beef', 200], ['udon', 400], ['onion', 100], ['oil', 5], ['soy', 60], ['sugar', 12.5], ['mirin', 52.5], ['ginger', 1], ['hondashi', 4.5]] },
};
export function calculateEstimates(id) {
  const plan = estimatePlans[id];
  if (!plan) throw new Error('Unknown recipe estimate.');
  const totalNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  let totalCost = 0;
  for (const [key, quantity] of plan.amounts) {
    const reference = ingredientReferences[key];
    for (const nutrient of Object.keys(totalNutrition)) totalNutrition[nutrient] += reference.nutrition[nutrient] * quantity;
    totalCost += reference.price / reference.priceQuantity * quantity;
  }
  return { totalNutrition, totalCost, nutrition: Object.fromEntries(Object.entries(totalNutrition).map(([key, value]) => [key, Math.round(value / plan.servings * (key === 'calories' ? 1 : 10)) / (key === 'calories' ? 1 : 10)])) };
}
const unique = values => [...new Map(values.filter(Boolean).map(value => [value.url, value])).values()];
export function researchedEstimates(id) {
  const plan = estimatePlans[id], calculation = calculateEstimates(id);
  return {
    nutrition: { ...calculation.nutrition, sources: unique(plan.amounts.map(([key]) => ingredientReferences[key].nutritionSource)) },
    cost: { total: Math.round(calculation.totalCost * 100) / 100, currency: 'USD', sources: unique(plan.amounts.map(([key]) => ingredientReferences[key].priceSource)) },
  };
}
