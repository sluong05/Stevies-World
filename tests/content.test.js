import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { recipes, articles } from '../content.js';
import { safeUrl, validateLibrary } from '../storage.js';

test('starter content has unique stable IDs across recipes and health guides', () => {
  assert.ok(recipes.length > 0);
  assert.ok(articles.length > 0);
  const ids = [...recipes, ...articles].map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!id.startsWith('personal-'), 'starter and imported IDs must not collide');
  }
});

test('all starter recipes satisfy the editable recipe contract and browse categories', () => {
  for (const item of recipes) {
    assert.ok(['Breakfast', 'Lunch', 'Dinner'].includes(item.category), item.id);
    assert.ok(item.description.trim(), item.id);
    assert.ok(item.ingredients.every(value => value.trim()), item.id);
    assert.ok(item.steps.every(value => value.trim()), item.id);
    assert.doesNotThrow(() => validateLibrary({ version: 1, saved: [], entries: [{ ...item, id: `personal-${item.id}`, type: 'recipe' }] }), item.id);
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

test('every recipe image is a nonempty JPEG with a credit entry', async () => {
  const credits = await readFile(new URL('../assets/CREDITS.md', import.meta.url), 'utf8');
  for (const item of recipes) {
    assert.match(item.imageKey, /^[a-z]+$/);
    const path = new URL(`../assets/${item.imageKey}.jpg`, import.meta.url);
    const info = await stat(path);
    assert.ok(info.isFile() && info.size > 1000, item.imageKey);
    const bytes = await readFile(path);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], item.imageKey);
    assert.ok(credits.includes(`\`${item.imageKey}.jpg\``), `${item.imageKey} must be credited`);
  }
});
