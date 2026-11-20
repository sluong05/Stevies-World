import test from 'node:test';
import assert from 'node:assert/strict';
import { cookbooks, proteinOf, groupOf } from '../shared/cookbooks.js';

const r = (id, title, extra = {}) => ({ id, type: 'recipe', title, tags: [], ingredients: [], ...extra });
const recipes = [
  r('a', 'Katsu curry', { tags: ['Japanese', 'Chicken'], category: 'Dinner', minutes: 50 }),
  r('b', 'Beef udon', { tags: ['Japanese'], ingredients: ['200 g beef'], category: 'Dinner', minutes: 25 }),
  r('c', 'Pad thai', { tags: ['Thai'], ingredients: ['shrimp', 'egg'], category: 'Lunch', minutes: 15 }),
  r('d', 'Toast', {}),
];

test('favorites and the rest are never in the same book', () => {
  const { favorites, others } = cookbooks(recipes, 'cuisine', id => id === 'a');
  assert.deepEqual(favorites.map(b => [b.title, b.recipes.map(x => x.id)]), [['Japanese', ['a']]]);
  assert.deepEqual(others.map(b => [b.title, b.recipes.map(x => x.id)]), [['Japanese', ['b']], ['Thai', ['c']], ['Everyday', ['d']]]);
  assert.ok(favorites.every(b => b.favorite) && others.every(b => !b.favorite));
  assert.notEqual(favorites[0].key, others[0].key);
});

test('other groupings', () => {
  assert.equal(proteinOf(recipes[0]), 'Chicken');
  assert.equal(proteinOf(recipes[1]), 'Beef');
  assert.equal(proteinOf(recipes[2]), 'Seafood');
  assert.equal(proteinOf(recipes[3]), 'Veggie & more');
  assert.equal(groupOf(recipes[3], 'meal'), 'Other');
  assert.deepEqual(cookbooks(recipes, 'meal').others.map(b => b.title), ['Lunch', 'Dinner', 'Other']);
  assert.deepEqual(cookbooks(recipes, 'time').others.map(b => b.title), ['20 minutes or less', 'Under 45 minutes', 'About an hour', 'Any time']);
});
