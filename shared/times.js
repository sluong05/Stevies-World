// Hands-off time hidden in a recipe's steps (marinating, resting, soaking, chilling, rising).
// A recipe's saved `minutes` is the time you're cooking; this finds the waiting on top of it,
// so the page can show active time and total time separately. Nothing saved is changed.
const PASSIVE = /\b(marinat\w*|rest(?!\s+of\b)\w*|soak\w*|chill\w*|refrigerat\w*|brin(?:e|ing)|stand(?:s|ing)?|sit(?:s|ting)?|cool\w*|rise|rising|proof(?!\s*pan)\w*|freez\w*|steep\w*)\b/i;
const AMOUNT = /(?:at least|about|for|up to)?\s*(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?\s*(hours?|hrs?|h|minutes?|mins?)(?![a-z])/i;

/** Minutes of waiting in one step, or 0. Only an amount that follows the waiting word counts. */
export function stepPassiveMinutes(step) {
  const text = String(step || '');
  const m = text.match(PASSIVE);
  if (!m) return 0;
  const after = text.slice(m.index + m[0].length, m.index + m[0].length + 70);
  const a = after.match(AMOUNT);
  // "30 minutes or overnight" counts the shorter wait; a bare "overnight" counts 8 hours
  if (!a) return /\bovernight\b/i.test(after) ? 480 : 0;
  // "rest 5 minutes, then sear 10 minutes": stop at the next sentence or clause
  if (/[.;]|,\s*then\b/i.test(after.slice(0, a.index))) return 0;
  const n = Number(a[1]);
  return Math.round(/^h/i.test(a[2]) ? n * 60 : n);
}

export function passiveMinutes(recipe) {
  return (recipe?.steps || []).reduce((sum, s) => sum + stepPassiveMinutes(s), 0);
}

/** { active, passive, total } in minutes; active is the saved time. */
export function recipeTimes(recipe) {
  const active = Number(recipe?.minutes) || 0;
  const passive = recipe?.type === 'workout' ? 0 : passiveMinutes(recipe);
  return { active, passive, total: active + passive };
}
