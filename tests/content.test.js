import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { recipes, articles } from '../data/cookbook.js';
import { builtins } from '../src/builtins.js';
import { normalizeItem } from '../shared/schema.js';

test('only your cookbook recipes ship with the site, alongside the healthy-living notes', () => {
  assert.deepEqual(recipes.map(item => item.id), ['japanese-curry-for-katsu', 'beef-udon-niku-udon', 'thai-tea-french-press']);
  assert.ok(articles.length > 0);
  const ids = builtins.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every built-in item passes the same checks as items you add', () => {
  for (const item of builtins) {
    const clean = normalizeItem(item);
    assert.equal(clean.title, item.title, item.id);
    if (item.type === 'recipe') {
      assert.ok(clean.ingredients.length && clean.steps.length, item.id);
      assert.ok(clean.photo?.src, `${item.id} has a photo`);
    } else {
      assert.ok(clean.body.includes('## '), item.id);
      assert.ok(clean.sources.length > 0, item.id);
    }
  }
});

test('built-in photos exist on disk', async () => {
  for (const item of builtins.filter(i => i.photo)) await access(new URL(`..${item.photo.src}`, import.meta.url));
});
