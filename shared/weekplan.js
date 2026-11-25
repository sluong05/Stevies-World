// "Plan my week": a list of recipe ids (one meal a day), kept on this device under its own key.
// Saved recipes are never changed.
export const PLAN_KEY = 'sw-week-plan';
export const PLAN_MAX = 14;

export function readPlan(storage = globalThis.localStorage) {
  try { const v = JSON.parse(storage?.getItem(PLAN_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, PLAN_MAX) : []; } catch { return []; }
}
export function writePlan(ids, storage = globalThis.localStorage) {
  try { storage?.setItem(PLAN_KEY, JSON.stringify([...new Set(ids)].slice(0, PLAN_MAX))); } catch { /* private mode */ }
}

/** Totals for the planned recipes: one serving a day each. */
export function planSummary(recipes) {
  const withCost = recipes.filter(r => Number.isFinite(r?.cost?.total));
  const withProtein = recipes.filter(r => Number.isFinite(r?.nutrition?.protein));
  const cost = withCost.reduce((s, r) => s + r.cost.total, 0);
  const perServing = withCost.reduce((s, r) => s + r.cost.total / (r.servings || 1), 0);
  return {
    days: recipes.length,
    cost, // cooking every recipe in full
    costPerDay: withCost.length ? perServing / withCost.length : null,
    proteinPerDay: withProtein.length ? withProtein.reduce((s, r) => s + r.nutrition.protein, 0) / withProtein.length : null,
    missingCost: recipes.length - withCost.length,
    missingProtein: recipes.length - withProtein.length,
  };
}

/** A random week: favorites first if there are enough, no repeats. */
export function randomWeek(pool, isFav = () => false, n = 7, rnd = Math.random) {
  const favs = pool.filter(r => isFav(r.id));
  const rest = pool.filter(r => !isFav(r.id));
  const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return [...shuffle(favs), ...shuffle(rest)].slice(0, n).map(r => r.id);
}
