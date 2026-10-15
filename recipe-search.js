export const rangeFields = ['priceMin', 'priceMax', 'proteinMin', 'proteinMax', 'calMin', 'calMax', 'densityMin', 'densityMax', 'timeMax'];
export const sortOptions = {
  default: 'Original order', price: 'Lowest price', protein: 'Most protein', calories: 'Fewest calories', density: 'Most protein per calorie', time: 'Quickest meals',
};
export function normalizeFilters(input = {}) {
  const result = { sort: Object.hasOwn(sortOptions, input.sort) ? input.sort : 'default' };
  for (const key of rangeFields) {
    const raw = input[key];
    if (raw === '' || raw === null || raw === undefined || !['number', 'string'].includes(typeof raw)) continue;
    const value = typeof raw === 'string' && raw.trim() === '' ? NaN : Number(raw);
    if (Number.isFinite(value) && value >= 0) result[key] = value;
  }
  return result;
}
export function filterErrors(filters) {
  const errors = [];
  for (const [low, high, label] of [['priceMin', 'priceMax', 'price'], ['proteinMin', 'proteinMax', 'protein'], ['calMin', 'calMax', 'calories'], ['densityMin', 'densityMax', 'protein density']]) {
    if (filters[low] !== undefined && filters[high] !== undefined && filters[low] > filters[high]) errors.push(`Minimum ${label} must be no higher than maximum ${label}.`);
  }
  return errors;
}
export const filterCount = input => { const filters = normalizeFilters(input); return rangeFields.filter(key => filters[key] !== undefined).length + (filters.sort !== 'default' ? 1 : 0); };
const nonnegative = value => Number.isFinite(value) && value >= 0 ? value : null;
export function recipeMetrics(recipe) {
  const calories = nonnegative(recipe.nutrition?.calories);
  const protein = nonnegative(recipe.nutrition?.protein);
  const total = recipe.cost?.currency === 'USD' ? nonnegative(recipe.cost.total) : null;
  const servings = Number.isFinite(recipe.servings) && recipe.servings > 0 ? recipe.servings : null;
  return {
    calories, protein,
    price: total !== null && servings !== null ? total / servings : null,
    density: calories !== null && calories > 0 && protein !== null ? protein / calories * 100 : null,
    time: nonnegative(recipe.minutes),
  };
}
export function matchesRecipeFilters(recipe, input = {}) {
  const filters = normalizeFilters(input);
  if (filterErrors(filters).length) return false;
  const metrics = recipeMetrics(recipe);
  for (const [metric, min, max] of [['price', 'priceMin', 'priceMax'], ['protein', 'proteinMin', 'proteinMax'], ['calories', 'calMin', 'calMax'], ['density', 'densityMin', 'densityMax'], ['time', null, 'timeMax']]) {
    const low = min ? filters[min] : undefined, high = filters[max], value = metrics[metric];
    if ((low !== undefined || high !== undefined) && value === null) return false;
    if (low !== undefined && value < low || high !== undefined && value > high) return false;
  }
  return true;
}
export function sortRecipes(recipes, input = {}) {
  const { sort } = normalizeFilters(input);
  if (sort === 'default') return [...recipes];
  const descending = ['protein', 'density'].includes(sort);
  return [...recipes].sort((a, b) => {
    const first = recipeMetrics(a)[sort], second = recipeMetrics(b)[sort];
    if (first === null && second === null) return 0;
    if (first === null) return 1;
    if (second === null) return -1;
    return descending ? second - first : first - second;
  });
}
export function filtersFromParams(params) {
  return normalizeFilters(Object.fromEntries([...rangeFields, 'sort'].map(key => [key, params.get(key)])));
}
export function addFiltersToParams(params, input) {
  const filters = normalizeFilters(input);
  for (const key of [...rangeFields, 'sort']) {
    params.delete(key);
    if (filters[key] !== undefined && !(key === 'sort' && filters[key] === 'default')) params.set(key, String(filters[key]));
  }
}
