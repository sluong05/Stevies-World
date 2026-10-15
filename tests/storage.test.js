import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, safeUrl, validateLibrary, mergeLibraries } from '../storage.js';

const recipe = (overrides = {}) => ({
  id: 'personal-recipe', type: 'recipe', title: 'Lentil bowl',
  description: 'A useful recipe to keep.', category: 'Lunch',
  minutes: 25, servings: 2, ingredients: ['1 cup lentils'],
  steps: ['Cook the lentils.'], tags: ['vegetarian'],
  note: 'Serve warm.', sourceUrl: 'https://example.com/recipe',
  ...overrides,
});
const article = (overrides = {}) => ({
  id: 'personal-article', type: 'article', title: 'Sleep reading',
  description: 'Notes from an article.', category: 'Sleep',
  sections: [{ heading: 'What I learned', body: 'A consistent bedtime can help.' }],
  ...overrides,
});
const backup = (entries = [], saved = []) => ({ version: 1, entries, saved });
const nutrition = (overrides = {}) => ({ calories: 420, protein: 24.5, carbs: 56, fat: 11.2, ...overrides });
const cost = (overrides = {}) => ({ total: 8.75, currency: 'USD', ...overrides });

test('empty libraries are independent, valid starting points', () => {
  const first = emptyLibrary();
  first.saved.push('example');
  assert.deepEqual(emptyLibrary(), backup());
  assert.deepEqual(validateLibrary(emptyLibrary()), backup());
});

test('only complete http and https URLs survive URL validation', () => {
  assert.equal(safeUrl('https://example.com/recipes?q=rice&sort=new'), 'https://example.com/recipes?q=rice&sort=new');
  assert.equal(safeUrl('HTTP://EXAMPLE.COM'), 'http://example.com/');
  for (const value of ['', 'not a url', '/recipes', '//example.com', 'javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'blob:https://example.com/id', 'mailto:test@example.com', null, undefined]) {
    assert.equal(safeUrl(value), '', String(value));
  }
});

test('recipe and article backups round-trip, normalize URLs, and deduplicate bookmarks', () => {
  const result = validateLibrary(backup([recipe({ sourceUrl: 'https://EXAMPLE.com' }), article()], ['personal-recipe', 'balanced-meals', 'personal-recipe']));
  assert.deepEqual(result.saved, ['personal-recipe', 'balanced-meals']);
  assert.equal(result.entries[0].sourceUrl, 'https://example.com/');
  assert.equal(result.entries[0].personal, true);
  assert.equal(result.entries[1].readMinutes, 1);
  assert.deepEqual(result.entries[1].tags, []);
  assert.equal(result.entries[1].note, '');
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(result))), result);
});

test('malicious backup properties are discarded at every supported object level', () => {
  const payload = JSON.parse(JSON.stringify(backup([recipe(), article()])));
  payload.admin = true;
  payload.__proto__ = { isAdmin: true };
  payload.entries[0].imageKey = '../../private';
  payload.entries[0].sources = [{ url: 'javascript:alert(1)' }];
  payload.entries[0].personal = false;
  payload.entries[0].sourceUrl = 'javascript:alert(1)';
  payload.entries[1].readMinutes = '<img src=x onerror=alert(1)>';
  payload.entries[1].sections[0].html = '<script>alert(1)</script>';
  const result = validateLibrary(payload);
  assert.deepEqual(Object.keys(result).sort(), ['entries', 'saved', 'version']);
  assert.deepEqual(Object.keys(result.entries[0]).sort(), ['category', 'description', 'id', 'ingredients', 'minutes', 'note', 'personal', 'servings', 'sourceUrl', 'steps', 'tags', 'title', 'type']);
  assert.deepEqual(Object.keys(result.entries[1].sections[0]).sort(), ['body', 'heading']);
  assert.equal(result.entries[0].sourceUrl, '');
  assert.equal(result.entries[0].personal, true);
  assert.equal(result.entries[1].readMinutes, 1);
  assert.equal(Object.prototype.isAdmin, undefined);
});

test('the library envelope and bookmarks reject malformed or oversized inputs', () => {
  const invalid = [null, false, [], {}, { version: 2, entries: [], saved: [] }, { version: 1, entries: {}, saved: [] }, { version: 1, entries: [], saved: {} }, backup([], [null]), backup([], [4]), backup([], ['x'.repeat(161)]), backup([], Array(2001).fill('x')), backup(Array.from({ length: 1001 }, (_, i) => article({ id: `personal-${i}` })))];
  for (const value of invalid) assert.throws(() => validateLibrary(value));
});

test('required entry fields reject missing, invalid, and oversized data', () => {
  for (const fields of [
    { id: 'built-in-id' }, { id: 1 }, { id: `personal-${'x'.repeat(160)}` },
    { type: 'script' }, { title: '' }, { title: '   ' }, { title: 'x'.repeat(151) },
    { description: undefined }, { description: {} }, { description: 'x'.repeat(701) },
    { category: undefined }, { category: [] }, { category: 'x'.repeat(81) },
    { tags: ['x'.repeat(2001)] }, { tags: Array(101).fill('x') },
    { note: 'x'.repeat(12001) }, { sourceUrl: 'x'.repeat(2001) },
  ]) assert.throws(() => validateLibrary(backup([recipe(fields)])), JSON.stringify(fields));
  assert.throws(() => validateLibrary(backup([null])));
});

test('optional fields reject malformed types even when falsy', () => {
  for (const fields of [{ tags: 0 }, { tags: false }, { tags: '' }, { note: false }, { note: 0 }, { sourceUrl: false }, { sourceUrl: 0 }]) {
    assert.throws(() => validateLibrary(backup([recipe(fields)])), JSON.stringify(fields));
  }
});

test('recipe imports require bounded timing, portions, and complete instructions', () => {
  for (const fields of [
    { minutes: 0 }, { minutes: 1441 }, { minutes: Infinity }, { minutes: NaN }, { minutes: '20' },
    { servings: 0 }, { servings: 101 }, { servings: 1.5 }, { servings: '2' },
    { ingredients: undefined }, { ingredients: [] }, { ingredients: 'rice' },
    { ingredients: [null] }, { ingredients: Array(101).fill('rice') },
    { steps: undefined }, { steps: [] }, { steps: [{ body: 'cook' }] },
    { steps: ['x'.repeat(2001)] },
  ]) assert.throws(() => validateLibrary(backup([recipe(fields)])), JSON.stringify(fields));
});

test('blank ingredients, steps, and article bodies cannot create empty saved content', () => {
  for (const fields of [{ ingredients: [''] }, { ingredients: ['   '] }, { steps: [''] }, { steps: ['\n\t'] }]) {
    assert.throws(() => validateLibrary(backup([recipe(fields)])), JSON.stringify(fields));
  }
  for (const body of ['', '  \n\t']) assert.throws(() => validateLibrary(backup([article({ sections: [{ heading: 'Note', body }] })])));
});

test('article imports reject missing, malformed, and oversized sections', () => {
  for (const sections of [undefined, [], 'body', [null], [{}], [{ heading: 'Note', body: 12 }], [{ heading: 'x'.repeat(201), body: 'text' }], [{ heading: 'Note', body: 'x'.repeat(12001) }], Array(51).fill({ heading: 'Note', body: 'text' })]) {
    assert.throws(() => validateLibrary(backup([article({ sections })])));
  }
});

test('duplicate entry IDs fail, including duplicates across recipe and article types', () => {
  assert.throws(() => validateLibrary(backup([recipe(), recipe()])), /duplicate/i);
  assert.throws(() => validateLibrary(backup([recipe(), article({ id: 'personal-recipe' })])), /duplicate/i);
});

test('merge preserves current finds and bookmarks while incoming matching IDs update entries', () => {
  const current = validateLibrary(backup([recipe(), article()], ['personal-recipe', 'sleep-basics']));
  const incoming = backup([recipe({ title: 'Updated lentil bowl' }), article({ id: 'personal-new', title: 'A new read' })], ['sleep-basics', 'personal-new']);
  const before = JSON.stringify([current, incoming]);
  const merged = mergeLibraries(current, incoming);
  assert.equal(merged.entries.length, 3);
  assert.equal(merged.entries.find(x => x.id === 'personal-recipe').title, 'Updated lentil bowl');
  assert.equal(merged.entries.find(x => x.id === 'personal-article').title, 'Sleep reading');
  assert.deepEqual(merged.saved, ['personal-recipe', 'sleep-basics', 'personal-new']);
  assert.equal(JSON.stringify([current, incoming]), before, 'merge must not mutate either input');
  assert.deepEqual(mergeLibraries(merged, backup()), merged);
});

test('invalid imports and merged size limits never mutate the existing library', () => {
  const current = validateLibrary(backup([recipe()], ['personal-recipe']));
  const before = JSON.stringify(current);
  assert.throws(() => mergeLibraries(current, backup([article({ sections: [] })])));
  assert.equal(JSON.stringify(current), before);
  const full = backup(Array.from({ length: 1000 }, (_, i) => article({ id: `personal-${i}` })));
  assert.throws(() => mergeLibraries(full, backup([recipe()])));
  assert.equal(full.entries.length, 1000);
});

test('older exports remain valid without adding empty nutrition or cost properties', () => {
  const result = validateLibrary(backup([recipe(), article()]));
  for (const entry of result.entries) {
    assert.equal(Object.hasOwn(entry, 'nutrition'), false);
    assert.equal(Object.hasOwn(entry, 'cost'), false);
  }
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(result))), result);
});

test('optional recipe estimates round-trip with provenance and only known properties', () => {
  const result = validateLibrary(backup([recipe({
    nutrition: nutrition({ note: 'Per serving, using the ingredients listed.', sources: [{ label: 'Nutrition reference', url: 'https://EXAMPLE.com/nutrition', html: '<script>bad()</script>' }], servingSize: 'unknown' }),
    cost: cost({ note: 'Full recipe, using the portion of each ingredient.', sources: [{ label: 'Price reference', url: 'https://EXAMPLE.com/prices', retailSecret: true }], region: 'unknown' }),
  })]));
  assert.deepEqual(result.entries[0].nutrition, nutrition({ note: 'Per serving, using the ingredients listed.', sources: [{ label: 'Nutrition reference', url: 'https://example.com/nutrition' }] }));
  assert.deepEqual(result.entries[0].cost, cost({ note: 'Full recipe, using the portion of each ingredient.', sources: [{ label: 'Price reference', url: 'https://example.com/prices' }] }));
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(result))), result);
  const bare = validateLibrary(backup([recipe({ nutrition: nutrition(), cost: cost() })])).entries[0];
  assert.deepEqual(bare.nutrition, nutrition());
  assert.deepEqual(bare.cost, cost());
});

test('nutrition and cost can be stored independently and accept zero and their upper limits', () => {
  const nutritionOnly = validateLibrary(backup([recipe({ nutrition: nutrition({ calories: 0, protein: 0, carbs: 0, fat: 0 }) })])).entries[0];
  assert.deepEqual(nutritionOnly.nutrition, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(Object.hasOwn(nutritionOnly, 'cost'), false);
  const costOnly = validateLibrary(backup([recipe({ cost: cost({ total: 0 }) })])).entries[0];
  assert.equal(costOnly.cost.total, 0);
  assert.equal(Object.hasOwn(costOnly, 'nutrition'), false);
  assert.doesNotThrow(() => validateLibrary(backup([recipe({ nutrition: nutrition({ calories: 20000, protein: 5000, carbs: 5000, fat: 5000 }), cost: cost({ total: 1000000 }) })])));
});

test('estimate objects reject malformed values, even when falsy', () => {
  for (const field of ['nutrition', 'cost']) {
    for (const value of [undefined, null, false, true, 0, '', '400', [], [nutrition()], {}]) {
      assert.throws(() => validateLibrary(backup([recipe({ [field]: value })])), new RegExp(field), `${field}: ${String(value)}`);
    }
  }
});

test('nutrition requires all four bounded numeric values without coercion', () => {
  for (const field of ['calories', 'protein', 'carbs', 'fat']) {
    for (const value of [undefined, null, false, '', '25', -0.1, NaN, Infinity, -Infinity, field === 'calories' ? 20000.01 : 5000.01]) {
      assert.throws(() => validateLibrary(backup([recipe({ nutrition: nutrition({ [field]: value }) })])), /nutrition/, `${field}: ${String(value)}`);
    }
    const incomplete = nutrition();
    delete incomplete[field];
    assert.throws(() => validateLibrary(backup([recipe({ nutrition: incomplete })])), /nutrition/, `missing ${field}`);
  }
});

test('cost requires a bounded numeric full-recipe total and explicit USD currency', () => {
  for (const total of [undefined, null, false, '', '8.75', -0.01, NaN, Infinity, -Infinity, 1000000.01]) {
    assert.throws(() => validateLibrary(backup([recipe({ cost: cost({ total }) })])), /cost/, `total: ${String(total)}`);
  }
  for (const currency of [undefined, null, false, 0, '', 'usd', 'EUR']) {
    assert.throws(() => validateLibrary(backup([recipe({ cost: cost({ currency }) })])), /cost/, `currency: ${String(currency)}`);
  }
});

test('estimate notes and source links are bounded and reject unsafe or malformed provenance', () => {
  for (const [field, estimate] of [['nutrition', nutrition], ['cost', cost]]) {
    for (const note of [undefined, null, false, 0, [], 'x'.repeat(1201)]) {
      assert.throws(() => validateLibrary(backup([recipe({ [field]: estimate({ note }) })])), new RegExp(field));
    }
    for (const sources of [undefined, null, false, '', {}, [null], [[]], [{}], [{ label: '', url: 'https://example.com' }], [{ label: ' ', url: 'https://example.com' }], [{ label: 'x'.repeat(201), url: 'https://example.com' }], [{ label: 'Reference', url: 'javascript:alert(1)' }], [{ label: 'Reference', url: '/relative' }], [{ label: 'Reference', url: 5 }], [{ label: 'Reference', url: `https://example.com/${'x'.repeat(2000)}` }], Array(101).fill({ label: 'Reference', url: 'https://example.com' })]) {
      assert.throws(() => validateLibrary(backup([recipe({ [field]: estimate({ sources }) })])), new RegExp(field));
    }
    assert.doesNotThrow(() => validateLibrary(backup([recipe({ [field]: estimate({ note: '', sources: [] }) })])));
    assert.doesNotThrow(() => validateLibrary(backup([recipe({ [field]: estimate({ note: 'x'.repeat(1200), sources: [{ label: 'x'.repeat(200), url: 'http://example.com/' }] }) })])));
  }
});

test('merging imports preserves estimates and updates matching recipes without mutating inputs', () => {
  const current = validateLibrary(backup([recipe({ nutrition: nutrition(), cost: cost() }), recipe({ id: 'personal-keep', nutrition: nutrition({ calories: 510 }) })], ['personal-recipe']));
  const incoming = backup([recipe({ nutrition: nutrition({ calories: 450 }), cost: cost({ total: 10.25, note: 'Updated grocery prices.' }) }), recipe({ id: 'personal-legacy' })]);
  const before = JSON.stringify([current, incoming]);
  const result = mergeLibraries(current, incoming);
  assert.deepEqual(result.entries.find(entry => entry.id === 'personal-recipe').nutrition, nutrition({ calories: 450 }));
  assert.deepEqual(result.entries.find(entry => entry.id === 'personal-recipe').cost, cost({ total: 10.25, note: 'Updated grocery prices.' }));
  assert.deepEqual(result.entries.find(entry => entry.id === 'personal-keep').nutrition, nutrition({ calories: 510 }));
  assert.equal(Object.hasOwn(result.entries.find(entry => entry.id === 'personal-legacy'), 'nutrition'), false);
  assert.deepEqual(mergeLibraries(result, backup()), result);
  assert.equal(JSON.stringify([current, incoming]), before);
  assert.throws(() => mergeLibraries(current, backup([recipe({ nutrition: nutrition({ fat: -1 }) })])), /nutrition/);
  assert.equal(JSON.stringify([current, incoming]), before);
});
