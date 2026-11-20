// Groups recipes into cookbooks for the Kitchen shelf. Favorites always get their own
// books (on their own shelf), so a favorite never shares a book with the rest.
import { cuisineOf } from './cuisine.js';

export const GROUPINGS = [
  { key: 'cuisine', label: 'Cuisine' },
  { key: 'meal', label: 'Meal' },
  { key: 'protein', label: 'Protein' },
  { key: 'time', label: 'Time' },
];

const PROTEINS = [
  ['Chicken', /\b(chicken|turkey|duck)\b/i],
  ['Beef', /\b(beef|steak|brisket|oxtail|ground chuck|short ribs?)\b/i],
  ['Pork', /\b(pork|bacon|ham|sausage|chorizo|prosciutto|pancetta|char siu)\b/i],
  ['Seafood', /\b(shrimp|prawns?|fish|salmon|tuna|cod|crab|lobster|scallops?|squid|clams?|mussels?|anchov\w*|tilapia|halibut|mackerel)\b/i],
  ['Lamb', /\b(lamb|mutton|goat)\b/i],
  ['Tofu & beans', /\b(tofu|tempeh|lentils?|chickpeas?|beans?|edamame|seitan)\b/i],
  ['Eggs', /\beggs?\b/i],
];

export function proteinOf(r) {
  const tags = (r.tags || []).join(' ');
  for (const [name, re] of PROTEINS) if (re.test(tags) || re.test(r.title || '')) return name;
  const ing = (r.ingredients || []).join('\n');
  for (const [name, re] of PROTEINS) if (re.test(ing)) return name;
  return 'Veggie & more';
}

const timeOf = r => (!r.minutes ? 'Any time' : r.minutes <= 20 ? '20 minutes or less' : r.minutes <= 45 ? 'Under 45 minutes' : r.minutes <= 90 ? 'About an hour' : 'Slow & low');
const TIME_ORDER = ['20 minutes or less', 'Under 45 minutes', 'About an hour', 'Slow & low', 'Any time'];
const MEAL_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drinks', 'Other'];

export function groupOf(r, by) {
  if (by === 'meal') return r.category || 'Other';
  if (by === 'protein') return proteinOf(r);
  if (by === 'time') return timeOf(r);
  return cuisineOf(r) || 'Everyday';
}

function orderOf(name, by) {
  const list = by === 'meal' ? MEAL_ORDER : by === 'time' ? TIME_ORDER : null;
  if (list) return list.indexOf(name) === -1 ? 99 : list.indexOf(name);
  return /^(Everyday|Veggie & more)$/.test(name) ? 99 : 0;
}

/**
 * Returns { favorites: [book], others: [book] } where each book is
 * { key, title, favorite, recipes }. Recipes in a book are sorted A to Z.
 */
export function cookbooks(recipes, by = 'cuisine', isFav = () => false) {
  const shelves = { favorites: new Map(), others: new Map() };
  for (const r of recipes) {
    const fav = Boolean(isFav(r.id));
    const title = groupOf(r, by);
    const map = fav ? shelves.favorites : shelves.others;
    if (!map.has(title)) map.set(title, { key: `${fav ? 'fav' : 'all'}-${by}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title, favorite: fav, recipes: [] });
    map.get(title).recipes.push(r);
  }
  const done = map => [...map.values()]
    .map(b => ({ ...b, recipes: b.recipes.sort((a, c) => a.title.localeCompare(c.title)) }))
    .sort((a, b) => orderOf(a.title, by) - orderOf(b.title, by) || a.title.localeCompare(b.title));
  return { favorites: done(shelves.favorites), others: done(shelves.others) };
}
