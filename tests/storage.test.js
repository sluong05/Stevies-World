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
