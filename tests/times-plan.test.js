import test from 'node:test';
import assert from 'node:assert/strict';
import { stepPassiveMinutes, recipeTimes } from '../shared/times.js';
import { planSummary, randomWeek, readPlan, writePlan } from '../shared/weekplan.js';
import { builtins as BUILTINS } from '../src/builtins.js';

test('finds waiting time in steps', () => {
  assert.equal(stepPassiveMinutes('Mix the marinade, add the beef and onion and marinate at least 20 minutes.'), 20);
  assert.equal(stepPassiveMinutes('Marinate the chops 1 hour.'), 60);
  assert.equal(stepPassiveMinutes('Marinate the pork at least 2 hours.'), 120);
  assert.equal(stepPassiveMinutes('Cover and chill overnight.'), 480);
  assert.equal(stepPassiveMinutes('Sear the beef 2 minutes a side.'), 0);
  assert.equal(stepPassiveMinutes('Heat the proof pan 6 minutes.'), 0);
  assert.equal(stepPassiveMinutes('Rest. Then bake 20 minutes.'), 0);
});

test('recipe times: active stays the saved time', () => {
  const t = recipeTimes({ type: 'recipe', minutes: 30, steps: ['Marinate the beef 30 minutes.', 'Sear 4 minutes.'] });
  assert.deepEqual(t, { active: 30, passive: 30, total: 60 });
});

test('Bò Lúc Lắc counts its marinade', () => {
  const r = BUILTINS.find(x => x.id === 'bo-luc-lac');
  if (!r) return;
  assert.ok(recipeTimes(r).passive >= 20, JSON.stringify(r.steps));
});

test('week plan totals', () => {
  const s = planSummary([
    { cost: { total: 12 }, servings: 4, nutrition: { protein: 40 } },
    { cost: { total: 8 }, servings: 2, nutrition: { protein: 20 } },
    { servings: 2 },
  ]);
  assert.equal(s.days, 3); assert.equal(s.cost, 20); assert.equal(s.costPerDay, 3.5); assert.equal(s.proteinPerDay, 30); assert.equal(s.missingCost, 1);
  const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const w = randomWeek(pool, id => id === 'c', 2);
  assert.equal(w[0], 'c'); assert.equal(new Set(w).size, 2);
  const mem = new Map(); const st = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  writePlan(['a', 'a', 'b'], st); assert.deepEqual(readPlan(st), ['a', 'b']);
});

import { readableSources, _md5 } from '../shared/commons.js';
import { createHash } from 'node:crypto';
test('commons photos get direct upload.wikimedia.org URLs', () => {
  for (const s of ['', 'a', 'Product_Shots_of_Food-Bo_Luc_Lac.jpg', '番茄炒蛋2.PNG', 'x'.repeat(130)]) assert.equal(_md5(s), createHash('md5').update(s).digest('hex'));
  const [thumb, full] = readableSources('https://commons.wikimedia.org/wiki/Special:FilePath/Product_Shots_of_Food-Bo_Luc_Lac.jpg?width=1100');
  assert.equal(thumb, 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Product_Shots_of_Food-Bo_Luc_Lac.jpg/960px-Product_Shots_of_Food-Bo_Luc_Lac.jpg');
  assert.equal(full, 'https://upload.wikimedia.org/wikipedia/commons/7/78/Product_Shots_of_Food-Bo_Luc_Lac.jpg');
  assert.deepEqual(readableSources('/assets/x.jpg'), ['/assets/x.jpg']);
});
