// To-do helpers: local dates, due labels, repeats, grouping and quick-add shortcuts.
// Dates are plain 'YYYY-MM-DD' strings in your local time zone, so "today" never drifts.

export const REPEATS = [['', 'Doesn’t repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month'], ['yearly', 'Every year']];
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = n => String(n).padStart(2, '0');
export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = (now = new Date()) => toISO(now);
export const isISODate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromISO(s).getTime());
export function fromISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
export function addMonths(iso, n) {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toISO(d);
}
export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86_400_000);

/** "Today", "Tomorrow", "Yesterday", "Fri", "Nov 20", "Nov 20, 2027". */
export function dueLabel(iso, today = todayISO()) {
  if (!isISODate(iso)) return '';
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = fromISO(iso);
  if (diff > 1 && diff < 7) return SHORT_DAYS[d.getDay()];
  const sameYear = d.getFullYear() === fromISO(today).getFullYear();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : `, ${d.getFullYear()}`}`;
}

/** Next due date after completing a repeating task. Counts from the due date, never landing in the past. */
export function nextDue(iso, repeat, today = todayISO()) {
  if (!repeat) return '';
  let d = isISODate(iso) ? iso : today;
  const step = x => {
    switch (repeat) {
      case 'daily': return addDays(x, 1);
      case 'weekdays': { let n = addDays(x, 1); while ([0, 6].includes(fromISO(n).getDay())) n = addDays(n, 1); return n; }
      case 'weekly': return addDays(x, 7);
      case 'biweekly': return addDays(x, 14);
      case 'monthly': return addMonths(x, 1);
      case 'yearly': return addMonths(x, 12);
      default: return '';
    }
  };
  d = step(d);
  for (let guard = 0; d && d < today && guard < 1000; guard++) d = step(d);
  return d;
}

/** Overdue → Today → Upcoming (next 7 days) → Later → No date, then Done. Important first within a group. */
export function groupTasks(tasks, today = todayISO()) {
  const groups = { overdue: [], today: [], upcoming: [], later: [], someday: [], done: [] };
  for (const t of tasks) {
    if (t.done) groups.done.push(t);
    else if (!isISODate(t.due)) groups.someday.push(t);
    else if (t.due < today) groups.overdue.push(t);
    else if (t.due === today) groups.today.push(t);
    else if (daysBetween(today, t.due) <= 7) groups.upcoming.push(t);
    else groups.later.push(t);
  }
  const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || Number(Boolean(b.important)) - Number(Boolean(a.important)) || (a.createdAt || 0) - (b.createdAt || 0);
  for (const key of ['overdue', 'today', 'upcoming', 'later', 'someday']) groups[key].sort(byDue);
  groups.someday.sort((a, b) => Number(Boolean(b.important)) - Number(Boolean(a.important)) || (a.createdAt || 0) - (b.createdAt || 0));
  groups.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return groups;
}

/**
 * Quick add: "Email professor about project tomorrow #school !"
 *   today / tonight / tomorrow / tmr / mon…sun / next week / in 3 days / 11/20 → due date
 *   #word → list,  ! or !! at the end → important,  "every day/week/month/weekday" → repeat
 */
export function parseQuickTask(input, today = todayISO()) {
  let text = ` ${String(input || '').trim()} `;
  const out = { title: '', due: '', list: '', important: false, repeat: '' };
  const take = (re, fn) => { const m = text.match(re); if (m) { fn(m); text = text.replace(m[0], ' '); } };

  take(/\s!{1,3}(?=\s|$)|\s(?:important|urgent)(?=\s|$)/i, () => { out.important = true; });
  take(/\s#([\p{L}\p{N}_-]{1,30})(?=\s|$)/u, m => { out.list = m[1].replace(/[_-]/g, ' ').replace(/^\p{Ll}/u, c => c.toUpperCase()); });
  take(/\s(?:every|each)\s+(day|weekday|week|2 weeks|other week|month|year)(?=\s|$)/i, m => {
    out.repeat = { day: 'daily', weekday: 'weekdays', week: 'weekly', '2 weeks': 'biweekly', 'other week': 'biweekly', month: 'monthly', year: 'yearly' }[m[1].toLowerCase()];
  });
  take(/\s(?:daily)(?=\s|$)/i, () => { out.repeat = out.repeat || 'daily'; });

  const dayIdx = name => DAY_NAMES.findIndex(d => d.startsWith(name.toLowerCase().slice(0, 3)));
  const nextWeekday = idx => {
    const diff = (idx - fromISO(today).getDay() + 7) % 7 || 7;
    return addDays(today, diff);
  };
  take(/\s(?:due\s+|by\s+|on\s+)?(today|tonight|tomorrow|tmrw?|tmw)(?=\s|$)/i, m => { out.due = /^(today|tonight)$/i.test(m[1]) ? today : addDays(today, 1); });
  if (!out.due) take(/\s(?:due\s+|by\s+)?next\s+week(?=\s|$)/i, () => { out.due = nextWeekday(1); });
  if (!out.due) take(/\s(?:due\s+|by\s+)?in\s+(\d{1,3})\s+(days?|weeks?)(?=\s|$)/i, m => { out.due = addDays(today, Number(m[1]) * (/^w/i.test(m[2]) ? 7 : 1)); });
  // Weekdays only count at the start or end ("friday call mom", "call mom fri"), so "Read the Sunday paper" stays as typed.
  const DAY = '(?:due\\s+|by\\s+|on\\s+)?(?:next\\s+|this\\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?';
  if (!out.due) take(new RegExp(`\\s${DAY}\\s*$`, 'i'), m => { out.due = nextWeekday(dayIdx(m[1])); });
  if (!out.due) take(new RegExp(`^\\s*${DAY}(?=\\s)`, 'i'), m => { out.due = nextWeekday(dayIdx(m[1])); });
  if (!out.due) take(/\s(?:due\s+|by\s+|on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/, m => {
    const t = fromISO(today);
    let y = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : t.getFullYear();
    const candidate = new Date(y, Number(m[1]) - 1, Number(m[2]));
    if (candidate.getMonth() !== Number(m[1]) - 1) return;
    if (!m[3] && daysBetween(toISO(candidate), today) > 60) candidate.setFullYear(y + 1);
    out.due = toISO(candidate);
  });
  if (!out.due) take(/\s(?:due\s+|by\s+|on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s|$)/i, m => {
    const t = fromISO(today);
    const month = MONTHS.findIndex(x => x.toLowerCase() === m[1].slice(0, 3).toLowerCase());
    const candidate = new Date(t.getFullYear(), month, Number(m[2]));
    if (daysBetween(toISO(candidate), today) > 60) candidate.setFullYear(t.getFullYear() + 1);
    out.due = toISO(candidate);
  });
  if (out.repeat && !out.due) out.due = today;
  out.title = text.replace(/\s+/g, ' ').trim().replace(/\s+(?:due|by|on)$/i, '');
  if (out.title) out.title = out.title[0].toUpperCase() + out.title.slice(1);
  return out;
}

/** Steps typed one per line; "[x] " or "x " keeps a step checked. */
export function parseSteps(text, previous = []) {
  const done = new Map(previous.map(s => [s.text.toLowerCase(), s.done]));
  return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 50).map(line => {
    const m = line.match(/^(?:\[(x| )\]|[-*•])\s*(.*)$/i);
    const t = (m ? m[2] : line).trim();
    return { text: t.slice(0, 300), done: m?.[1] ? m[1].toLowerCase() === 'x' : done.get(t.toLowerCase()) || false };
  }).filter(s => s.text);
}
export const formatSteps = steps => (steps || []).map(s => `${s.done ? '[x] ' : ''}${s.text}`).join('\n');
