// One item shape for everything in the library: recipes, workouts and notes.
// Used by the browser (before saving) and the API (before storing) so bad data never lands.

export const TYPES = ['recipe', 'workout', 'note'];
export const RECIPE_CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drinks', 'Other'];
export const WORKOUT_FOCUS = ['Full body', 'Upper body', 'Lower body', 'Push', 'Pull', 'Legs', 'Core', 'Cardio', 'Mobility', 'Other'];

export class ItemError extends Error {}
const fail = msg => { throw new ItemError(msg); };

export function safeUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2000) return '';
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export const MAX_PHOTO_DATA = 900_000;
export function safePhotoSrc(value) {
  if (typeof value !== 'string') return '';
  if (/^\/assets\/[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp|svg)$/.test(value)) return value;
  if (/^\/api\/photo\?k=[A-Za-z0-9_-]{16,64}$/.test(value)) return value;
  if (value.startsWith('data:')) return value.length <= MAX_PHOTO_DATA && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : '';
  const url = safeUrl(value);
  return url.startsWith('https:') ? url : '';
}

const str = (value, max, label, { required = false, multiline = false } = {}) => {
  if (value === undefined || value === null) value = '';
  if (typeof value === 'number') value = String(value);
  if (typeof value !== 'string') fail(`${label} should be text.`);
  let v = multiline ? value.replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trim() : value.replace(/\s+/g, ' ').trim();
  if (v.length > max) v = v.slice(0, max).trim();
  if (required && !v) fail(`Add ${label.toLowerCase()}.`);
  return v;
};
const list = (value, maxItems, maxLen, label) => {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') value = value.split('\n');
  if (!Array.isArray(value)) fail(`${label} should be a list.`);
  return value.map(x => str(x, maxLen, label)).filter(Boolean).slice(0, maxItems);
};
const optNum = (value, max, label) => {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > max) fail(`${label} should be a number between 0 and ${max}.`);
  return Math.round(n * 10) / 10;
};
const sources = value => (Array.isArray(value) ? value : []).slice(0, 30).map(s => ({ label: str(s?.label, 200, 'Source'), url: safeUrl(s?.url) })).filter(s => s.label && s.url);

export function normalizePhoto(photo) {
  if (!photo || typeof photo !== 'object') return null;
  const src = safePhotoSrc(photo.src);
  if (!src) return null;
  const out = { src, alt: str(photo.alt, 300, 'Photo description') };
  for (const key of ['credit', 'caption', 'license']) if (photo[key]) out[key] = str(photo[key], 600, 'Photo credit');
  for (const key of ['sourceUrl', 'licenseUrl']) if (safeUrl(photo[key])) out[key] = safeUrl(photo[key]);
  return out;
}

export function normalizeItem(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('That item is empty.');
  const type = TYPES.includes(raw.type) ? raw.type : fail('Choose recipe, workout or note.');
  const id = str(raw.id, 80, 'ID', { required: true });
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/i.test(id)) fail('That item has an invalid ID.');
  const item = {
    id, type,
    title: str(raw.title, 150, 'A title', { required: true }),
    description: str(raw.description, 1000, 'Description'),
    tags: [...new Set(list(raw.tags, 12, 40, 'Tags'))],
    sourceUrl: safeUrl(raw.sourceUrl),
    sourceName: str(raw.sourceName, 120, 'Source name'),
    note: str(raw.note, 12000, 'Notes', { multiline: true }),
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : now,
  };
  const photo = normalizePhoto(raw.photo);
  if (photo) item.photo = photo;
  const src = sources(raw.sources);
  if (src.length) item.sources = src;
  if (type === 'recipe') {
    item.category = str(raw.category, 40, 'Category') || 'Other';
    item.minutes = optNum(raw.minutes, 2880, 'Time');
    item.servings = optNum(raw.servings, 100, 'Servings');
    item.ingredients = list(raw.ingredients, 150, 400, 'Ingredients');
    item.steps = list(raw.steps, 80, 3000, 'Steps');
    if (raw.nutrition && typeof raw.nutrition === 'object') {
      const n = { calories: optNum(raw.nutrition.calories, 20000, 'Calories'), protein: optNum(raw.nutrition.protein, 2000, 'Protein'), carbs: optNum(raw.nutrition.carbs, 2000, 'Carbs'), fat: optNum(raw.nutrition.fat, 2000, 'Fat') };
      if (Object.values(n).some(v => v !== null)) {
        item.nutrition = n;
        if (raw.nutrition.note) item.nutrition.note = str(raw.nutrition.note, 1500, 'Nutrition note');
        const ns = sources(raw.nutrition.sources); if (ns.length) item.nutrition.sources = ns;
      }
    }
    if (raw.cost && typeof raw.cost === 'object' && optNum(raw.cost.total, 100000, 'Cost') !== null) {
      item.cost = { total: optNum(raw.cost.total, 100000, 'Cost'), currency: 'USD' };
      if (raw.cost.note) item.cost.note = str(raw.cost.note, 1500, 'Cost note');
      const cs = sources(raw.cost.sources); if (cs.length) item.cost.sources = cs;
    }
  } else if (type === 'workout') {
    item.focus = str(raw.focus, 40, 'Focus') || 'Full body';
    item.minutes = optNum(raw.minutes, 600, 'Time');
    item.equipment = str(raw.equipment, 200, 'Equipment');
    const blocks = Array.isArray(raw.blocks) ? raw.blocks : [];
    item.blocks = blocks.slice(0, 20).map(b => ({
      name: str(b?.name, 80, 'Section name'),
      exercises: (Array.isArray(b?.exercises) ? b.exercises : []).slice(0, 60).map(e => ({
        name: str(e?.name, 120, 'Exercise'), sets: str(e?.sets, 20, 'Sets'), reps: str(e?.reps, 40, 'Reps'), rest: str(e?.rest, 30, 'Rest'), note: str(e?.note, 300, 'Exercise note'),
      })).filter(e => e.name),
    })).filter(b => b.exercises.length);
  } else {
    item.category = str(raw.category, 40, 'Category') || 'General';
    item.body = str(raw.body, 40000, 'Note text', { multiline: true });
  }
  return item;
}

export function newId(type = 'item') {
  const rand = typeof crypto !== 'undefined' && crypto.getRandomValues ? [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(36).padStart(2, '0')).join('') : Math.random().toString(36).slice(2, 12);
  return `${type}-${Date.now().toString(36)}-${rand}`;
}

/** Plain text used for search. */
export function searchText(item) {
  const parts = [item.title, item.description, item.category, item.focus, item.equipment, item.note, item.body, item.sourceName, ...(item.tags || []), ...(item.ingredients || []), ...(item.blocks || []).flatMap(b => [b.name, ...b.exercises.map(e => e.name)])];
  return parts.filter(Boolean).join(' ').toLowerCase();
}
