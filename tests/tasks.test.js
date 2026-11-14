import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickTask, nextDue, dueLabel, groupTasks, addMonths, parseSteps, formatSteps } from '../shared/tasks.js';
import { normalizeItem, searchText } from '../shared/schema.js';

const today = '2026-11-13'; // a Friday

test('quick add understands days, lists, stars and repeats', () => {
  assert.deepEqual(parseQuickTask('call dentist tomorrow #health !', today), { title: 'Call dentist', due: '2026-11-14', list: 'Health', important: true, repeat: '' });
  assert.equal(parseQuickTask('submit FAFSA friday', today).due, '2026-11-20', 'same weekday means next week');
  assert.equal(parseQuickTask('laundry mon', today).due, '2026-11-16');
  assert.equal(parseQuickTask('plan trip next week', today).due, '2026-11-16');
  assert.equal(parseQuickTask('return library book in 3 days', today).due, '2026-11-16');
  assert.equal(parseQuickTask('rent due 12/1', today).due, '2026-12-01');
  assert.equal(parseQuickTask('taxes 4/15', today).due, '2027-04-15', 'dates long past roll to next year');
  assert.equal(parseQuickTask('pay rent 11/10', today).due, '2026-11-10', 'a few days ago stays this year, as overdue');
  assert.equal(parseQuickTask('mom birthday dec 5th', today).due, '2026-12-05');
  assert.deepEqual(parseQuickTask('stretch every day', today), { title: 'Stretch', due: today, list: '', important: false, repeat: 'daily' });
  assert.equal(parseQuickTask('Buy milk #errands', today).list, 'Errands');
  assert.deepEqual([parseQuickTask('Monday finish resume', today).title, parseQuickTask('Monday finish resume', today).due], ['Finish resume', '2026-11-16']);
  assert.deepEqual(parseQuickTask('Read the Sunday paper', today), { title: 'Read the Sunday paper', due: '', list: '', important: false, repeat: '' }, 'day names mid-sentence are left alone');
  assert.equal(parseQuickTask('Call grandma next friday', today).due, '2026-11-20');
});

test('repeating to-dos move forward and never land in the past', () => {
  assert.equal(nextDue('2026-11-13', 'daily', today), '2026-11-14');
  assert.equal(nextDue('2026-11-13', 'weekdays', today), '2026-11-16');
  assert.equal(nextDue('2026-11-13', 'weekly', today), '2026-11-20');
  assert.equal(nextDue('2026-10-01', 'weekly', today), '2026-11-19', 'catches up from an old due date');
  assert.equal(nextDue('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28');
  assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
  assert.equal(nextDue('', 'monthly', today), '2026-12-13');
});

test('due labels read naturally', () => {
  assert.equal(dueLabel(today, today), 'Today');
  assert.equal(dueLabel('2026-11-14', today), 'Tomorrow');
  assert.equal(dueLabel('2026-11-12', today), 'Yesterday');
  assert.equal(dueLabel('2026-11-17', today), 'Tue');
  assert.equal(dueLabel('2026-12-25', today), 'Dec 25');
  assert.equal(dueLabel('2027-01-02', today), 'Jan 2, 2027');
});

test('to-dos are grouped overdue → today → week → later → no date → done', () => {
  const t = (id, due, extra = {}) => ({ id, due, createdAt: 1, ...extra });
  const g = groupTasks([t('a', '2026-11-10'), t('b', today), t('c', today, { important: true }), t('d', '2026-11-18'), t('e', '2026-12-30'), t('f', ''), t('g', today, { done: true, doneAt: 5 })], today);
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map(x => x.id)])), { overdue: ['a'], today: ['c', 'b'], upcoming: ['d'], later: ['e'], someday: ['f'], done: ['g'] });
});

test('steps keep their ticks through editing', () => {
  const steps = parseSteps('[x] Find form\nFill it out\n- Mail it');
  assert.deepEqual(steps, [{ text: 'Find form', done: true }, { text: 'Fill it out', done: false }, { text: 'Mail it', done: false }]);
  assert.deepEqual(parseSteps(formatSteps(steps)), steps);
  assert.equal(parseSteps('Find form\nNew step', steps)[0].done, true, 'unchanged text remembers it was done');
});

test('to-dos are checked like every other item', () => {
  const item = normalizeItem({ id: 'task-abc123', type: 'task', title: 'Renew passport', due: 'soon', repeat: 'hourly', list: 'Errands', important: 1, done: true, steps: ['Photos', { text: 'Form', done: true }, { text: '' }] });
  assert.equal(item.due, '');
  assert.equal(item.repeat, '');
  assert.equal(item.important, true);
  assert.ok(item.doneAt);
  assert.deepEqual(item.steps, [{ text: 'Photos', done: false }, { text: 'Form', done: true }]);
  assert.match(searchText(item), /errands.*photos/);
});
