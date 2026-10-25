import test from 'node:test';
import assert from 'node:assert/strict';
import { recipes, articles } from '../content.js';
import { safeUrl, validateLibrary } from '../storage.js';
import { readFile } from 'node:fs/promises';
import { validatePhoto } from '../photo-utils.js';

test('only the supplied cookbook recipes are included alongside the health guides', () => {
  assert.deepEqual(recipes.map(item => item.id), ['japanese-curry-for-katsu', 'beef-udon-niku-udon', 'thai-tea-french-press']);
  assert.ok(articles.length > 0);
  const ids = [...recipes, ...articles].map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!id.startsWith('personal-'), 'starter and imported IDs must not collide');
  }
});

test('health guides have readable sections, source attribution, and review dates', () => {
  for (const item of articles) {
    assert.ok(['Nutrition', 'Sleep', 'Movement', 'Hydration', 'Food safety'].includes(item.category), item.id);
    assert.ok(Number.isInteger(item.readMinutes) && item.readMinutes >= 1, item.id);
    assert.ok(item.sections.every(section => section.heading.trim() && section.body.trim()), item.id);
    assert.ok(item.sources.length > 0, item.id);
    assert.match(item.reviewedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(Date.parse(item.reviewedOn)), item.id);
    assert.doesNotThrow(() => validateLibrary({ version: 1, saved: [], entries: [{ ...item, id: `personal-${item.id}`, type: 'article' }] }), item.id);
  }
});

test('all source links have descriptive labels and complete HTTPS URLs', () => {
  for (const item of [...recipes, ...articles]) {
    assert.ok(Array.isArray(item.sources), item.id);
    for (const source of item.sources) {
      assert.ok(source.label.trim(), item.id);
      assert.equal(safeUrl(source.url), source.url, item.id);
      assert.equal(new URL(source.url).protocol, 'https:', item.id);
    }
  }
});

test('supplied recipes keep complete instructions, working local photos and sources for any estimates', async () => {
  for (const item of recipes) {
    assert.ok(item.note.includes('handwritten cookbook'));
    assert.ok(item.ingredients.length && item.steps.length);
    assert.doesNotThrow(() => validateLibrary({ version: 1, saved: [], entries: [{ ...item, id: `personal-${item.id}`, type: 'recipe' }] }, { requireRecipePhotos: true }));
    assert.doesNotThrow(() => validatePhoto(item.photo, { required: true }));
    const bytes = await readFile(new URL(`..${item.photo.src}`, import.meta.url));
    assert.ok(bytes.length > 1000);
    assert.ok(bytes.subarray(0, 3).equals(Buffer.from([255,216,255])) || bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    if (item.nutrition) assert.ok(item.nutrition.sources.length);
    if (item.cost) assert.ok(item.cost.sources.length);
  }
});
