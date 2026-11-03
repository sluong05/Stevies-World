// Shu mai: prices checked November 2, 2026. Whole-batch quantities; US dollars.
// Nutrition is the recipe author's published estimate, not a new ingredient calculation.
export const shumaiRecipeSource = { label: 'RecipeTin Eats · Nagi’s Siu Mai recipe and per-dumpling nutrition', url: 'https://www.recipetineats.com/siu-mai-shumai-steamed-dumplings/' };
export const shumaiYield = 24;
export const shumaiServings = 4;
export const shumaiPerDumpling = { calories: 69, protein: 5, carbs: 3, fat: 4 };
export const shumaiCostRows = [
  { ingredient: 'Ground pork', quantity: 350, unit: 'g', price: 6.92, packageQuantity: 680.388555, label: 'Walmart · Ground pork, 1.5 lb tray', url: 'https://www.walmart.com/c/kp/ground-pork', basis: '$6.92 / 1.5 lb. The 85/15 tray is a price proxy; fattier butcher mince may cost more.' },
  { ingredient: 'Peeled raw shrimp', quantity: 150, unit: 'g', price: 6.76, packageQuantity: 340.1942775, label: 'Walmart · Small raw peeled tail-off shrimp, 12 oz', url: 'https://www.walmart.com/c/best-sellers/shrimp-prawns', basis: '$6.76 / 12 oz. Counts peeled, tail-off edible weight.' },
  { ingredient: 'Dried shiitake', quantity: 9, unit: 'g', price: 10.99, packageQuantity: 138, label: 'Weee! · Dried shiitake, 138 g', url: 'https://www.sayweee.com/en/product/Premium-Dried-Shiitake-Mushrooms-Grade-AAA/2879934', basis: '$10.99 / 138 g. Assumes 3 g per dried mushroom (9 g total).' },
  { ingredient: 'Wonton wrappers', quantity: 144, unit: 'g', price: 2.99, packageQuantity: 340.1942775, label: 'Kroger · Dynasty wonton wrappers, 12 oz', url: 'https://www.kroger.com/p/dynasty-won-ton-wrappers/0001115223004', basis: '$2.99 / 12 oz listed benchmark; unavailable at the displayed store. Assumes 24 wrappers at 6 g each. Use yellow egg wrappers; this listing is only a price proxy.' },
  { ingredient: 'Shaoxing cooking wine', quantity: 22.5, unit: 'ml', price: 3.79, packageQuantity: 750, label: 'Weee! · Liang Shao Hsing wine, 750 ml price range', url: 'https://www.weee.com/en/grocery-near-me/lang-en/explore/chinese-cooking-wine', basis: '$3.79 / 750 ml, the upper end of the listed $2.29–$3.79 range.' },
  { ingredient: 'Scallion whites', quantity: 12, unit: 'g', price: .78, packageQuantity: 100, label: 'Super 1 Foods · Green onion bunch', url: 'https://www.super1foods.com/sm/pickup/rsid/610/categories/vegetables/onions-garlic-id-C20109806', basis: '$0.78 / bunch; assumes 100 g usable bunch and 12 g for 2 tbsp.' },
  { ingredient: 'Sugar', quantity: 10.4166666667, unit: 'g', price: .03, packageQuantity: 12.5, basis: 'Pantry allowance: $0.03 / tablespoon (12.5 g).' },
  { ingredient: 'Light soy sauce', quantity: 5, unit: 'ml', price: .45, packageQuantity: 60, basis: 'Pantry allowance: $0.45 / 60 ml.' },
  { ingredient: 'Salt', quantity: 1, unit: 'allowance', price: .01, packageQuantity: 1, basis: '$0.01 pantry allowance for ¾ tsp.' },
  { ingredient: 'Flying fish roe', quantity: 50, unit: 'g', price: 5, packageQuantity: 56.69904625, label: 'Svenfish · Tobiko roe, 2 oz', url: 'https://svenfish.com/products/tobiko-fish-roe-2oz', basis: '$5.00 / 2 oz. Includes the full 50 g garnish listed by the recipe.' },
];
export const shumaiCost = includeRoe => Math.round(shumaiCostRows.filter(row => includeRoe || row.ingredient !== 'Flying fish roe').reduce((sum, row) => sum + row.price * row.quantity / row.packageQuantity, 0) * 100) / 100;
export const shumaiNutrition = Object.fromEntries(Object.entries(shumaiPerDumpling).map(([key, value]) => [key, value * shumaiYield / shumaiServings]));
export const shumaiCostSources = shumaiCostRows.filter(row => row.url).map(({ label, url }) => ({ label, url }));
