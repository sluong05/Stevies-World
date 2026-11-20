// The To-do tab: quick add, smart groups (overdue → today → this week → later → no date),
// lists, steps, repeats and a tidy "done" pile.
import { escape, icon, renderBody, plural } from './ui.js';
import { byType, getItem, saveItem, deleteItem } from './store.js';
import { groupTasks, dueLabel, todayISO, nextDue, parseQuickTask, REPEATS } from '../shared/tasks.js';

export const todoUi = { filter: 'All', quickText: '' };
const SHORT_REPEAT = { daily: 'Daily', weekdays: 'Weekdays', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', yearly: 'Yearly' };
const repeatName = r => REPEATS.find(([v]) => v === r)?.[1] || '';

function dueChip(task, today) {
  if (!task.due) return '';
  const overdue = !task.done && task.due < today;
  return `<span class="due ${overdue ? 'overdue' : task.due === today ? 'is-today' : ''}">${icon('calendar')}${escape(dueLabel(task.due, today))}</span>`;
}

export function taskRow(task, { today = todayISO(), showList = true } = {}) {
  const stepsDone = (task.steps || []).filter(s => s.done).length;
  const meta = [
    dueChip(task, today),
    task.repeat ? `<span>${icon('repeat')}${escape(SHORT_REPEAT[task.repeat] || '')}</span>` : '',
    task.steps?.length ? `<span>${icon('list')}${stepsDone}/${task.steps.length}</span>` : '',
    task.note ? `<span class="has-notes">${icon('note')}Notes</span>` : '',
    showList && task.list ? `<span class="task-list-name">${escape(task.list)}</span>` : '',
  ].filter(Boolean).join('');
  return `<li class="task-row ${task.done ? 'is-done' : ''} ${task.important ? 'is-important' : ''}" data-task="${escape(task.id)}">
    <button class="check" data-action="task-toggle" data-id="${escape(task.id)}" role="checkbox" aria-checked="${task.done}" aria-label="${task.done ? 'Mark not done' : 'Mark done'}: ${escape(task.title)}">${icon('check')}</button>
    <a class="task-main" href="#/item/${encodeURIComponent(task.id)}"><span class="task-title">${escape(task.title)}</span>${meta ? `<span class="task-meta">${meta}</span>` : ''}</a>
    <button class="star ${task.important ? 'on' : ''}" data-action="task-star" data-id="${escape(task.id)}" aria-pressed="${task.important}" aria-label="${task.important ? 'Not important' : 'Mark important'}">${icon('star')}</button>
  </li>`;
}

const GROUPS = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Next 7 days'], ['later', 'Later'], ['someday', 'No date']];

export function todoView() {
  const today = todayISO();
  const all = byType('task');
  const lists = [...new Set(all.map(t => t.list).filter(Boolean))].sort();
  if (!['All', 'Important', ...lists].includes(todoUi.filter)) todoUi.filter = 'All';
  const f = todoUi.filter;
  const visible = all.filter(t => f === 'All' || (f === 'Important' ? t.important : t.list === f));
  const groups = groupTasks(visible, today);
  const open = visible.length - groups.done.length;
  const dueNow = groups.overdue.length + groups.today.length;
  const sub = !all.length ? '' : open === 0 ? 'All done.' : `${plural(open, 'thing')} left${dueNow ? `, ${dueNow} due today${groups.overdue.length ? ` (${groups.overdue.length} overdue)` : ''}` : ''}.`;
  return `<section class="page-head"><div><h1>To-do</h1>${sub ? `<p class="page-sub">${escape(sub)}</p>` : ''}</div>
      <a class="btn btn-ghost btn-small" href="#/new/task">${icon('edit')}With details</a></section>
    <form class="quick-task" data-form="quick-task" autocomplete="off">
      <label class="sr-only" for="quick-task">Add a to-do</label>
      <div class="quick-task-box">${icon('plus')}<input id="quick-task" name="text" enterkeyhint="done" placeholder="Add a to-do…" value="${escape(todoUi.quickText)}" />
        <button class="btn btn-primary btn-small" type="submit">Add</button></div>
      <p class="quick-preview" id="quick-preview">${quickPreview(todoUi.quickText)}</p>
    </form>
    ${all.length ? `<div class="chips" role="group" aria-label="Show">
      ${['All', 'Important', ...lists].map(c => `<button class="chip ${c === f ? 'on' : ''}" data-action="todo-filter" data-value="${escape(c)}" aria-pressed="${c === f}">${c === 'Important' ? icon('star') : ''}${escape(c)}</button>`).join('')}
    </div>` : ''}
    ${GROUPS.map(([key, label]) => groups[key].length ? `<section class="task-group group-${key}"><h2>${label} <span class="count">${groups[key].length}</span></h2>
      <ul class="task-list">${groups[key].map(t => taskRow(t, { today, showList: f === 'All' || f === 'Important' })).join('')}</ul></section>` : '').join('')}
    ${!visible.length ? `<div class="empty-invite"><p>${all.length ? 'Nothing here.' : 'Nothing to do yet. Type above and press Add. Try “call dentist friday #health !” to set a day, a list and a star in one go.'}</p></div>`
      : open === 0 ? `<p class="empty-line all-done">${icon('check')}Everything here is done.</p>` : ''}
    ${groups.done.length ? `<details class="task-group done-group"><summary><h2>Done <span class="count">${groups.done.length}</span></h2></summary>
      <ul class="task-list">${groups.done.slice(0, 60).map(t => taskRow(t, { today })).join('')}</ul>
      <button class="btn btn-ghost btn-small" data-action="clear-done">${icon('trash')}Clear ${plural(groups.done.length, 'done item')}</button></details>` : ''}
    <details class="howto tips"><summary>Quick-add shortcuts</summary>
      <ul>
        <li><strong>When:</strong> today, tomorrow, friday, next fri, next week, in 3 days, 11/20, dec 5</li>
        <li><strong>List:</strong> #school, #errands, #jobhunt</li>
        <li><strong>Important:</strong> end with !</li>
        <li><strong>Repeat:</strong> every day, every weekday, every week, every month</li>
      </ul>
    </details>`;
}

export function quickPreview(text) {
  if (!text.trim()) return '';
  const q = parseQuickTask(text);
  const bits = [];
  if (q.due) bits.push(`${icon('calendar')}${escape(dueLabel(q.due))}`);
  if (q.repeat) bits.push(`${icon('repeat')}${escape(repeatName(q.repeat))}`);
  if (q.list) bits.push(`#${escape(q.list)}`);
  if (q.important) bits.push(`${icon('star')}Important`);
  return bits.length ? bits.map(b => `<span>${b}</span>`).join('') : '';
}

/** Home screen: what's due now, at a glance. */
export function todoShelf() {
  const tasks = byType('task');
  if (!tasks.length) return '';
  const today = todayISO();
  const g = groupTasks(tasks, today);
  const now = [...g.overdue, ...g.today];
  const shown = now.length ? now.slice(0, 5) : [...g.upcoming, ...g.someday.filter(t => t.important)].slice(0, 3);
  const open = tasks.length - g.done.length;
  return `<section class="shelf todo-shelf">
    <div class="shelf-head"><h2>To-do</h2><a class="see-all" href="#/todo">${open ? `All ${open}` : 'Open'}</a></div>
    ${shown.length ? `<p class="shelf-sub">${now.length ? `${plural(now.length, 'thing')} due today${g.overdue.length ? `, ${g.overdue.length} overdue` : ''}` : 'Nothing due today. Coming up:'}</p>
      <ul class="task-list">${shown.map(t => taskRow(t, { today })).join('')}</ul>` : `<p class="shelf-sub">${open ? `Nothing due soon. ${plural(open, 'thing')} with no date.` : 'All done.'}</p>`}
  </section>`;
}

/** Full page for one to-do. */
export function taskView(id) {
  const t = getItem(id);
  const today = todayISO();
  const stepsDone = (t.steps || []).filter(s => s.done).length;
  return `<article class="task-page">
    <div class="task-top"><a class="round-btn" href="#/todo" data-action="back" aria-label="Back">${icon('back')}</a>
      <button class="star big ${t.important ? 'on' : ''}" data-action="task-star" data-id="${escape(t.id)}" aria-pressed="${t.important}" aria-label="${t.important ? 'Not important' : 'Mark important'}">${icon('star')}</button></div>
    <div class="task-heading ${t.done ? 'is-done' : ''}">
      <button class="check big" data-action="task-toggle" data-id="${escape(t.id)}" role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${icon('check')}</button>
      <h1>${escape(t.title)}</h1>
    </div>
    <p class="facts">
      ${t.due ? `<span class="${!t.done && t.due < today ? 'overdue' : ''}">${icon('calendar')}${escape(dueLabel(t.due, today))}${t.due < today && !t.done ? ' (overdue)' : ''}</span>` : `<span>${icon('calendar')}No date</span>`}
      ${t.repeat ? `<span>${icon('repeat')}${escape(repeatName(t.repeat))}</span>` : ''}
      ${t.list ? `<span>${escape(t.list)}</span>` : ''}
      ${t.done && t.doneAt ? `<span>${icon('check')}Done ${escape(new Date(t.doneAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span>` : ''}
    </p>
    <div class="item-actions">
      <button class="btn btn-primary" data-action="task-toggle" data-id="${escape(t.id)}">${icon('check')}${t.done ? 'Mark not done' : t.repeat ? 'Done, schedule the next one' : 'Mark done'}</button>
      <a class="btn btn-ghost" href="#/edit/${encodeURIComponent(t.id)}">${icon('edit')}Edit</a>
      ${t.sourceUrl ? `<a class="btn btn-ghost" href="${escape(t.sourceUrl)}" target="_blank" rel="noopener noreferrer">${icon('link')}Open link</a>` : ''}
    </div>
    ${t.steps?.length ? `<section class="block"><h2>Steps <span class="count">${stepsDone}/${t.steps.length}</span></h2>
      <ul class="steps-check">${t.steps.map((s, i) => `<li class="${s.done ? 'is-done' : ''}"><button class="check small" data-action="step-toggle" data-id="${escape(t.id)}" data-index="${i}" role="checkbox" aria-checked="${s.done}" aria-label="${escape(s.text)}">${icon('check')}</button><span>${escape(s.text)}</span></li>`).join('')}</ul></section>` : ''}
    ${t.note ? `<section class="block"><h2>Notes</h2><div class="prose">${renderBody(t.note)}</div></section>` : `<p class="fine"><a href="#/edit/${encodeURIComponent(t.id)}">Add notes or steps</a></p>`}
  </article>`;
}

// ---------- actions ----------
export async function toggleTask(id) {
  const t = getItem(id);
  if (!t) return '';
  if (!t.done && t.repeat) {
    const due = nextDue(t.due, t.repeat, todayISO());
    await saveItem({ ...t, due, steps: (t.steps || []).map(s => ({ ...s, done: false })) });
    return `Done. Next one ${dueLabel(due).replace(/^(Today|Tomorrow)$/, m => m.toLowerCase()).replace(/^(?!today|tomorrow)/, 'on ')}.`;
  }
  await saveItem({ ...t, done: !t.done, doneAt: t.done ? null : Date.now() });
  return t.done ? 'Moved back to your list' : 'Done';
}
export async function toggleStar(id) {
  const t = getItem(id);
  if (t) await saveItem({ ...t, important: !t.important });
}
export async function toggleStep(id, index) {
  const t = getItem(id);
  if (!t?.steps?.[index]) return;
  const steps = t.steps.map((s, i) => (i === index ? { ...s, done: !s.done } : s));
  await saveItem({ ...t, steps });
}
export async function quickAdd(text) {
  const q = parseQuickTask(text);
  if (!q.title) return null;
  return saveItem({ type: 'task', title: q.title, due: q.due, list: q.list || (['All', 'Important'].includes(todoUi.filter) ? '' : todoUi.filter), important: q.important || todoUi.filter === 'Important', repeat: q.repeat, steps: [], note: '' });
}
export async function clearDone() {
  const done = byType('task').filter(t => t.done);
  for (const t of done) await deleteItem(t.id);
  return done.length;
}
