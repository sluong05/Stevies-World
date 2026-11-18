import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { recipes, articles } from '../data/cookbook.js';
import { builtins } from '../src/builtins.js';
import { normalizeItem } from '../shared/schema.js';

test('only your cookbook recipes ship with the site, alongside the healthy-living notes', () => {
  assert.deepEqual(recipes.map(item => item.id), ['japanese-curry-for-katsu', 'beef-udon-niku-udon', 'thai-tea-french-press', 'shu-mai-pork-shrimp']);
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
  for (const item of builtins.filter(i => i.photo?.src.startsWith('/'))) await access(new URL(`..${item.photo.src}`, import.meta.url));
});

test('the high-protein budget collection has 100+ recipes with real, credited photos and estimates', async () => {
  const { proteinRecipes } = await import('../data/protein/index.js');
  assert.ok(proteinRecipes.length >= 100);
  assert.ok(new Set(proteinRecipes.map(r => r.tags[2])).size >= 30, 'variety of cuisines');
  for (const r of proteinRecipes) {
    assert.match(r.photo.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, r.id);
    assert.ok(r.photo.author && r.photo.license && r.photo.sourceUrl, `${r.id} photo is credited`);
    assert.ok(r.nutrition.protein >= 19, `${r.id} is high protein`);
    assert.ok(r.cost.total / r.servings <= 4, `${r.id} is low cost`);
  }
});
