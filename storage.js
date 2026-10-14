export const STORAGE_KEY = 'stevies-world.library.v1';
export const emptyLibrary = () => ({ version: 1, saved: [], entries: [] });
export const safeUrl = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
};
const string = (value, max = 12000) => typeof value === 'string' && value.length <= max;
const lines = value => Array.isArray(value) && value.length <= 100 && value.every(x => string(x, 2000) && x.trim().length > 0);
export function validateLibrary(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.saved) || !Array.isArray(value.entries) || value.entries.length > 1000 || value.saved.length > 2000) throw new Error('Choose a Stevies World library export (version 1).');
  if (!value.saved.every(x => string(x, 160))) throw new Error('The backup contains invalid saved items.');
  const entries = value.entries.map(entry => {
    if (!entry || !string(entry.id, 160) || !entry.id.startsWith('personal-') || !['recipe', 'article'].includes(entry.type) || !string(entry.title, 150) || !entry.title.trim() || !string(entry.description, 700) || !entry.description.trim() || !string(entry.category, 80) || !entry.category.trim() || !lines(entry.tags === undefined ? [] : entry.tags) || !string(entry.note === undefined ? '' : entry.note) || !string(entry.sourceUrl === undefined ? '' : entry.sourceUrl, 2000)) throw new Error('The backup contains an invalid entry.');
    const result = { id: entry.id, type: entry.type, title: entry.title, description: entry.description, category: entry.category, tags: entry.tags || [], note: entry.note || '', sourceUrl: safeUrl(entry.sourceUrl || ''), personal: true };
    if (entry.type === 'recipe') {
      if (!Number.isFinite(entry.minutes) || entry.minutes < 1 || entry.minutes > 1440 || !Number.isInteger(entry.servings) || entry.servings < 1 || entry.servings > 100 || !lines(entry.ingredients) || !entry.ingredients.length || !lines(entry.steps) || !entry.steps.length) throw new Error('A recipe in this backup is missing valid ingredients, steps, or timing.');
      Object.assign(result, { minutes: entry.minutes, servings: entry.servings, ingredients: entry.ingredients, steps: entry.steps });
    } else {
      if (!Array.isArray(entry.sections) || !entry.sections.length || entry.sections.length > 50 || !entry.sections.every(s => s && string(s.heading, 200) && string(s.body) && s.body.trim().length > 0)) throw new Error('A note in this backup has invalid content.');
      Object.assign(result, { sections: entry.sections.map(s => ({ heading: s.heading, body: s.body })), readMinutes: Math.max(1, Math.ceil(entry.sections.reduce((n, s) => n + s.body.split(/\s+/).length, 0) / 200)) });
    }
    return result;
  });
  if (new Set(entries.map(x => x.id)).size !== entries.length) throw new Error('The backup contains duplicate entries.');
  return { version: 1, saved: [...new Set(value.saved)], entries };
}
export function mergeLibraries(current, incoming) {
  const valid = validateLibrary(incoming);
  const entries = new Map(current.entries.map(item => [item.id, item]));
  for (const item of valid.entries) entries.set(item.id, item);
  return validateLibrary({ version: 1, entries: [...entries.values()], saved: [...new Set([...current.saved, ...valid.saved])] });
}
