// Turns free text (a TikTok/Instagram caption, a YouTube description, a pasted note)
// into a draft recipe, workout or note. No AI: just patterns that real captions use.
// Shared by the browser (pasted text) and the import API (fetched captions).

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]/gu;
const FRACTIONS = '½¼¾⅓⅔⅛⅜⅝⅞';
const UNITS = 'g|grams?|kg|mg|ml|l|liters?|litres?|oz|ounces?|lbs?|pounds?|cups?|c|tbsps?|tablespoons?|tbs|tsps?|teaspoons?|pinch(?:es)?|dash(?:es)?|cloves?|cans?|tins?|packs?|packets?|pkgs?|slices?|pieces?|sticks?|bunch(?:es)?|handfuls?|scoops?|sprigs?|stalks?|heads?|sheets?|fl ?oz|qt|quarts?|pints?';
const QTY_START = new RegExp(`^(?:\\d|[${FRACTIONS}]|(?:a|an|one|two|three|four|five|six|half|some|few)\\s+(?:${UNITS}|bit|little|few|handful|pinch|splash|dash|squeeze|drizzle)\\b|(?:pinch|dash|splash|drizzle|handful|squeeze|juice|zest)\\s+of\\b|salt\\b|pepper\\b|salt and pepper|optional\\b)`, 'i');
const COOK_VERBS = /^(?:preheat|heat|add|mix|stir|combine|bake|cook|place|pour|whisk|season|serve|chop|dice|mince|cut|slice|boil|bring|simmer|fry|air[- ]?fry|saut[eé]|blend|top|transfer|remove|let|marinate|meanwhile|once|then|next|finally|first|in a|on a|using|toss|roll|spread|layer|drain|rinse|soak|garnish|sprinkle|fold|knead|grill|roast|sear|flip|plate|assemble|microwave|refrigerate|chill|freeze|wrap|shape|form|line|grease|beat|cream|melt|reduce|deglaze|scoop|divide|enjoy|steam|toast|crack|squeeze|pat|coat|dip|dredge|shred|mash|puree|pulse|process)\b/i;

const RECIPE_HEAD = /^(?:ingredients?(?: list)?|what you(?:'|’)?ll need|you(?:'|’)?ll need|you will need|what you need|shopping list|grocery list)$/i;
const SUB_HEAD = /^(?:for (?:the )?[a-z][a-z &'’-]{1,30}|[a-z][a-z &'’-]{1,24} (?:sauce|marinade|dressing|topping|toppings|glaze|filling|base|batter|dough|crust|seasoning|rub|bowl|garnish))$/i;
const STEP_HEAD = /^(?:instructions?|directions?|method|steps?|how to(?: make(?: it)?)?|preparation|prep|to make|recipe|cooking instructions|assembly)$/i;
const NOTE_HEAD = /^(?:notes?|tips?|macros?(?: per serving)?|nutrition(?: info| facts)?|storage|substitutions?|equipment)$/i;
const BLOCK_HEAD = /^(?:warm[\s-]?up|cool[\s-]?down|stretch(?:es|ing)?|main (?:workout|set|lift)|workout|the workout|exercises?|routine|circuit(?: [a-z0-9]+)?|superset(?: [a-z0-9]+)?|tri-?set(?: [a-z0-9]+)?|giant set|finisher|core finisher|accessor(?:y|ies)|cardio|day [0-9a-z]+.*|block [a-z0-9]+|round [0-9]+|part [0-9]+|emom.*|amrap.*|tabata.*|(?:push|pull|leg|legs|upper|lower|chest|back|arm|arms|shoulder|shoulders|glute|glutes|core|abs|full body)(?: day| workout| focus)?)$/i;

const GENERIC_TAGS = new Set(['fyp', 'foryou', 'foryoupage', 'fy', 'viral', 'trending', 'reels', 'reel', 'instagood', 'tiktok', 'explore', 'explorepage', 'recipe', 'recipes', 'food', 'foodie', 'foodtok', 'cooking', 'workout', 'gym', 'gymtok', 'fitness', 'fitnesstok', 'fittok', 'easyrecipe', 'easyrecipes', 'yummy', 'delicious', 'instafood', 'love', 'like', 'follow', 'share', 'shorts', 'youtubeshorts', 'cookingtiktok', 'recipesoftiktok', 'tiktokfood', 'foryourpage', 'xyzbca', 'capcut']);

const WORKOUT_WORDS = /\b(?:sets?|reps?|superset|rest|rounds?|amrap|emom|tabata|workout|squats?|deadlifts?|rdls?|bench|press(?:es)?|curls?|rows?|pull[- ]?ups?|push[- ]?ups?|chin[- ]?ups?|lunges?|planks?|thrusts?|bridges?|dips?|raises?|extensions?|flys?|flyes?|pulldowns?|pushdowns?|crunch(?:es)?|burpees?|kettlebell|dumbbells?|barbell|glutes?|hamstrings?|quads?|biceps?|triceps?|lats?|delts?|abs|core|cardio|hiit|sprints?|mobility|stretch(?:es)?|step[- ]?ups?|split squats?|hip hinge|sled|rower|treadmill|incline|failure|tempo|pr|1rm)\b/gi;
const RECIPE_WORDS = /\b(?:ingredients?|tbsp|tsp|tablespoons?|teaspoons?|cups?|grams?|oven|bake|baked|cook|cooked|fry|fried|air ?fryer|sauce|salt|pepper|garlic|onion|butter|olive oil|flour|sugar|chicken|beef|pork|tofu|rice|pasta|noodles|eggs?|cheese|serve|servings?|recipe|marinade|simmer|boil|minutes|mins|pan|skillet|bowl|whisk|stir|season|kcal|calories|protein)\b/gi;

const clean = s => s.replace(/\s+/g, ' ').trim();
const count = (text, re) => (text.match(re) || []).length;

export function normalizeText(text = '') {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/(\d)️?⃣/g, '\n$1. ') // keycap numbers 1️⃣ → numbered lines
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n');
}

export function extractHashtags(text = '') {
  const tags = [];
  for (const match of String(text).matchAll(/(?:^|\s)#([\p{L}\p{N}_]{2,40})/gu)) {
    const tag = match[1];
    if (GENERIC_TAGS.has(tag.toLowerCase())) continue;
    const pretty = tag.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    if (!tags.some(t => t.toLowerCase() === pretty.toLowerCase())) tags.push(pretty);
  }
  return tags.slice(0, 6);
}

const stripHashtags = line => line.replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, ' ').replace(/(?:^|\s)@[\w.]+/g, m => m);

/** Strip bullets, numbering, emoji and decoration from the start of a line. */
export function stripMarker(line) {
  let s = line.replace(EMOJI, ' ').trim();
  s = s.replace(/^(?:[-–—*•▪◦·●○■□►▶︎>✓✔☐☑+~]+\s*)+/, '');
  s = s.replace(/^(?:step\s*)?\d{1,2}\s*[.):\-]\s+/i, '');
  s = s.replace(/^(?:step\s+\d{1,2}\s*[:.-]?\s*)/i, '');
  s = s.replace(/^[a-h][.)]\s+/i, m => (/^[a-h][.)]\s+[a-z]/i.test(line.trim()) ? '' : m));
  return clean(s);
}

const isNumbered = line => /^\s*(?:step\s*)?\d{1,2}\s*[.):]\s*\S/i.test(line.replace(EMOJI, '').trim());
const headerText = line => clean(stripMarker(line).replace(/[:：]\s*$/, '').replace(/^\*+|\*+$/g, ''));
const looksLikeHeader = line => {
  const raw = stripMarker(line);
  if (!raw || raw.length > 42) return false;
  return /[:：]\s*$/.test(raw) || raw === raw.toUpperCase() && /[A-Z]/.test(raw) || RECIPE_HEAD.test(headerText(line)) || STEP_HEAD.test(headerText(line)) || NOTE_HEAD.test(headerText(line)) || BLOCK_HEAD.test(headerText(line));
};

// ---------- exercises ----------
const TIME_UNIT = '(?:seconds?|secs?|minutes?|mins?|steps|meters?|metres?|miles?|yards?|yds?|calories|cals?|km|s|m)(?![a-z])';
const EACH = '(?:\\s*(?:/|per|each|a)\\s*(?:side|leg|arm|direction|way))';
const RANGE = '\\d+(?:\\.\\d+)?(?:\\s*(?:-|–|to)\\s*\\d+(?:\\.\\d+)?)?';

export function parseExerciseLine(input) {
  let line = stripMarker(input);
  if (!line) return null;
  const ex = { name: '', sets: '', reps: '', rest: '', note: '' };
  const paren = line.match(/\(([^()]{1,120})\)\s*$/);
  if (paren) { ex.note = clean(paren[1]); line = line.slice(0, paren.index).trim(); }
  const rest = line.match(new RegExp(`[,;|·-]?\\s*\\brest(?:ing)?\\s*(?:for\\s*)?:?\\s*(${RANGE}\\s*${TIME_UNIT}?)`, 'i'));
  if (rest) { ex.rest = clean(rest[1]); line = (line.slice(0, rest.index) + ' ' + line.slice(rest.index + rest[0].length)).trim(); }
  const patterns = [
    [new RegExp(`(\\d{1,2})\\s*(?:sets?|rounds?)?\\s*[x×X*]\\s*(${RANGE})\\s*(reps?|${TIME_UNIT})?(${EACH})?`, 'i'), m => [m[1], m[2], m[3], m[4]]],
    [new RegExp(`(\\d{1,2})\\s*(?:sets?|rounds?)\\s*(?:of\\s*|,\\s*|:\\s*)?(${RANGE})\\s*(reps?|${TIME_UNIT})?(${EACH})?`, 'i'), m => [m[1], m[2], m[3], m[4]]],
    [new RegExp(`(${RANGE})\\s*(reps?)(${EACH})?(?:\\s*[x×X]\\s*(\\d{1,2})\\s*(?:sets?|rounds?)?)?`, 'i'), m => [m[4] || '', m[1], m[2], m[3]]],
    [new RegExp(`(?:^|\\s)[x×]\\s*(${RANGE})\\s*(reps?|${TIME_UNIT})?(${EACH})?`, 'i'), m => ['', m[1], m[2], m[3]]],
    [new RegExp(`(${RANGE})\\s*(${TIME_UNIT})(${EACH})?(?:\\s*[x×X]\\s*(\\d{1,2}))?\\b`, 'i'), m => [m[4] || '', m[1], m[2], m[3]]],
  ];
  for (const [re, pick] of patterns) {
    const m = line.match(re);
    if (!m) continue;
    const [sets, amount, unit = '', each = ''] = pick(m);
    ex.sets = sets || '';
    const u = (unit || '').toLowerCase();
    const unitText = !u || /^reps?$/.test(u) ? '' : /^(s|secs?|seconds?)$/.test(u) ? 's' : /^(mins?|minutes?)$/.test(u) ? ' min' : u === 'm' ? 'm' : ` ${u}`;
    ex.reps = clean(`${amount.replace(/\s*(?:-|–|to)\s*/, '-')}${unitText}${each ? ' ' + clean(each).replace(/^\/\s*/, 'per ') : ''}`);
    line = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).trim();
    break;
  }
  if (!ex.sets) {
    const sets = line.match(/\b(\d{1,2})\s*(?:sets?|rounds?)\b/i);
    if (sets) { ex.sets = sets[1]; line = (line.slice(0, sets.index) + ' ' + line.slice(sets.index + sets[0].length)).trim(); }
  }
  ex.name = clean(line.replace(/\s*[-–—:|,;=@]+\s*$/, '').replace(/^\s*[-–—:|,;=]+\s*/, '').replace(/\s+[-–—:|,]\s+/g, ' – ').replace(/\s+(?:for|of|x)\s*$/i, ''));
  if (!/[a-z]{2}/i.test(ex.name) || ex.name.length > 90) return null;
  ex.name = ex.name[0].toUpperCase() + ex.name.slice(1);
  return ex;
}

export function formatExercise(ex) {
  let s = ex.name;
  if (ex.sets && ex.reps) s += ` ${ex.sets}x${ex.reps}`;
  else if (ex.reps) s += /^[\d.-]+$/.test(ex.reps.split(' ')[0]) && /[a-z]/i.test(ex.reps) && !/^\S+\s+(?:each|per)\b/i.test(ex.reps) ? ` ${ex.reps}` : ` x${ex.reps}`;
  else if (ex.sets) s += ` ${ex.sets} sets`;
  if (ex.rest) s += ` rest ${ex.rest}`;
  if (ex.note) s += ` (${ex.note})`;
  return s;
}

const hasScheme = line => /\d\s*[x×X*]\s*\d|\b\d+\s*(?:sets?|reps?|rounds?)\b|(?:^|\s)[x×]\s*\d|\b\d+\s*(?:s|sec|seconds|min|minutes)\b(?!.*\b(?:bake|cook|oven|simmer|boil|fry)\b)/i.test(line);

/** "Warm-up:\nGoblet squat 3x10\n..." → [{name, exercises}] */
export function parseWorkoutBlocks(text) {
  const blocks = [];
  let current = null;
  const ensure = (name = '') => { if (!current) { current = { name, exercises: [] }; blocks.push(current); } return current; };
  for (const rawLine of normalizeText(text).split('\n')) {
    const line = stripHashtags(rawLine).trim();
    if (!stripMarker(line)) continue;
    if (looksLikeHeader(line) && !hasScheme(line)) {
      current = { name: headerText(line), exercises: [] };
      blocks.push(current);
      continue;
    }
    const ex = parseExerciseLine(line);
    if (ex) ensure().exercises.push(ex);
  }
  return blocks.filter(b => b.exercises.length);
}

export function formatWorkoutBlocks(blocks = []) {
  return blocks.map(b => [b.name ? `${b.name}:` : '', ...b.exercises.map(formatExercise)].filter(Boolean).join('\n')).join('\n\n');
}

// ---------- numbers ----------
const num = s => {
  if (!s) return null;
  const n = Number(String(s).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function parseMinutes(text = '', { loose = false } = {}) {
  const t = String(text);
  let total = 0;
  for (const m of t.matchAll(/(?:total(?: time)?|ready in|takes?(?: about| only| just)?|in (?:just|only|under)|done in)\s*:?\s*(?:(\d+)\s*(?:hours?|hrs?|h)(?![a-z]))?\s*(?:(\d+)\s*(?:minutes?|mins?|m)(?![a-z]))?/gi)) {
    if (m[1] || m[2]) return (num(m[1]) || 0) * 60 + (num(m[2]) || 0) || null;
  }
  const prep = t.match(/prep(?:aration)?(?: time)?\s*:?\s*(\d+)\s*(?:minutes|mins?|m)(?![a-z])/i);
  const cook = t.match(/cook(?:ing)?(?: time)?\s*:\s*(\d+)\s*(?:minutes|mins?|m)(?![a-z])/i);
  if (prep || cook) total = (num(prep?.[1]) || 0) + (num(cook?.[1]) || 0);
  if (total) return total;
  if (!loose) return null;
  const anyH = t.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/i);
  const anyM = t.match(/\b(\d+)\s*(?:-|–)?\s*(?:min|mins|minute|minutes)\b/i);
  if (anyM && Number(anyM[1]) <= 240) return Number(anyM[1]);
  if (anyH && Number(anyH[1]) <= 12) return Math.round(Number(anyH[1]) * 60);
  return null;
}

export function parseServings(text = '') {
  const m = String(text).match(/\b(?:serves|servings?|makes|yields?|portions?)\s*:?\s*(?:about\s*)?(\d{1,2})\b/i) || String(text).match(/\b(\d{1,2})\s*(?:servings|portions|people)\b/i);
  return m ? Number(m[1]) : null;
}

export function parseNutrition(text = '') {
  const t = String(text);
  const grab = (names) => {
    for (const name of names) {
      const after = t.match(new RegExp(`\\b${name}\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)\\s*g?\\b`, 'i'));
      if (after) return num(after[1]);
      const before = t.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*g?\\s*(?:of\\s*)?${name}\\b`, 'i'));
      if (before) return num(before[1]);
    }
    return null;
  };
  const kcal = t.match(/(\d{2,4}(?:\.\d+)?)\s*(?:k?cals?|calories)\b/i) || t.match(/\b(?:k?cals?|calories)\s*[:=-]?\s*(\d{2,4})\b/i);
  const result = { calories: kcal ? num(kcal[1]) : null, protein: grab(['protein', 'p']), carbs: grab(['carbs?', 'carbohydrates?', 'c']), fat: grab(['fats?', 'f']) };
  // Single-letter guesses only count when calories or protein were spelled out.
  if (result.calories === null && !/\bprotein\b/i.test(t)) return null;
  if (Object.values(result).every(v => v === null)) return null;
  return result;
}

// ---------- type detection ----------
export function detectType(text = '') {
  const t = String(text);
  const lines = normalizeText(t).split('\n').map(stripMarker).filter(Boolean);
  const schemeLines = lines.filter(hasScheme).filter(l => !/\b(?:bake|cook|oven|simmer|boil|fry|air ?fry|microwave|rest the|let it rest)\b/i.test(l)).length;
  const qtyLines = lines.filter(l => QTY_START.test(l) && l.length < 120).length;
  const workout = count(t, WORKOUT_WORDS) + schemeLines * 3 + (/\bworkout\b/i.test(t) ? 4 : 0);
  const recipe = count(t, RECIPE_WORDS) + qtyLines * 2 + (/\bingredients?\b/i.test(t) ? 6 : 0);
  if (workout < 4 && recipe < 4) return 'note';
  return workout > recipe ? 'workout' : 'recipe';
}

// ---------- title / description ----------
export function cleanTitle(title = '') {
  let t = String(title).replace(EMOJI, ' ').replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, ' ');
  t = t.replace(/\s*[|–—-]\s*(?:TikTok|Instagram|YouTube|Allrecipes|Food Network|NYT Cooking|BBC Good Food)\b.*$/i, '');
  t = t.replace(/^(?:recipe|workout|new recipe|easy recipe)\s*[:\-–]\s*/i, '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  t = t.replace(/\b(?:save (?:this|it)(?: for (?:later|your next [\w ]+|the gym))?|follow (?:me )?for more[\w ]*|(?:comment|dm) ["“]?\w+["”]?(?: for [\w ]+)?|link in bio|recipe below|full recipe below|tag a friend[\w ]*|try this!?)\b[!.]*/gi, ' ');
  t = clean(t.replace(/\(\s*\)|\[\s*\]/g, ' ').replace(/[!.:,;\-–—\s]+$/, '').replace(/^[!.:,;\-–—\s]+/, ''));
  // De-shout ALL-CAPS words (keep short acronyms like RDL, HIIT).
  const KEEP = /^(?:RDL|RDLS|HIIT|AMRAP|EMOM|BBQ|DB|KB|BB|PB|PR|USA|NYC|LA|UK|TV|DIY|OMG|ABS|XL)$/;
  t = t.replace(/\b[A-Z][A-Z'’]{2,}\b/g, w => (KEEP.test(w) ? w : w[0] + w.slice(1).toLowerCase()));
  if (t.length > 90) {
    const cut = t.slice(0, 90);
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf(' – '), cut.lastIndexOf(', '));
    t = (stop > 25 ? cut.slice(0, stop) : cut.slice(0, cut.lastIndexOf(' '))).replace(/[,.!\s–-]+$/, '');
  }
  return t;
}

// ---------- main ----------
/**
 * @param {string} text  caption / description / pasted text
 * @param {{type?: 'recipe'|'workout'|'note', title?: string}} hints
 */
export function parseText(text = '', hints = {}) {
  const normalized = normalizeText(text);
  const type = hints.type || detectType(normalized);
  const tags = extractHashtags(normalized);
  const rawLines = normalized.split('\n').map(l => stripHashtags(l).trim());
  const lines = rawLines.filter(l => stripMarker(l));

  // Title: provided title, else first short line that isn't a header or a list item.
  let title = cleanTitle(hints.title || '');
  let titleLineIndex = -1;
  if (!title || /^(?:tiktok|instagram|youtube|video|reel)$/i.test(title)) {
    titleLineIndex = lines.findIndex(l => !looksLikeHeader(l) && !QTY_START.test(stripMarker(l)) && !isNumbered(l));
    title = titleLineIndex >= 0 ? cleanTitle(stripMarker(lines[titleLineIndex])) : '';
  }

  const draft = { type, title: title || (type === 'workout' ? 'New workout' : type === 'recipe' ? 'New recipe' : 'New note'), description: '', tags };

  if (type === 'note') {
    const body = lines.filter((_, i) => i !== titleLineIndex).map(l => l.replace(EMOJI, '').trim()).join('\n');
    draft.body = clean(body) ? body : '';
    draft.description = clean(lines.filter((_, i) => i !== titleLineIndex)[0]?.replace(EMOJI, '') || '').slice(0, 280);
    if (draft.description === clean(draft.body)) draft.description = '';
    return draft;
  }

  if (type === 'workout') {
    const blocks = [];
    let current = null;
    const intro = [];
    let section = 'intro';
    const notes = [];
    lines.forEach((line, i) => {
      if (i === titleLineIndex) return;
      const head = headerText(line);
      if (looksLikeHeader(line) && !hasScheme(line)) {
        if (NOTE_HEAD.test(head)) { section = 'notes'; return; }
        current = { name: head, exercises: [] }; blocks.push(current); section = 'block';
        return;
      }
      if (section === 'notes') { notes.push(stripMarker(line)); return; }
      const ex = hasScheme(line) || section === 'block' || isNumbered(line) ? parseExerciseLine(line) : null;
      const words = stripMarker(line).split(' ').length;
      const strongScheme = /\d\s*[x×X*]\s*\d|\b\d+\s*sets?\b|\b\d+\s*reps?\b/i.test(line);
      const looksLikeSentence = /^rest\b/i.test(stripMarker(line)) || (words > 9 && !hasScheme(line)) || (words > 12 && !strongScheme);
      if (ex && !looksLikeSentence) {
        if (!current) { current = { name: '', exercises: [] }; blocks.push(current); }
        current.exercises.push(ex);
        section = 'block';
      } else if (section === 'intro') intro.push(stripMarker(line));
      else notes.push(stripMarker(line));
    });
    draft.blocks = blocks.filter(b => b.exercises.length);
    draft.description = clean(intro.join(' ')).slice(0, 280);
    draft.note = notes.join('\n');
    draft.minutes = parseMinutes(normalized) ?? parseMinutes(`${draft.title}\n${draft.description}`, { loose: true });
    draft.focus = guessFocus(normalized);
    draft.equipment = guessEquipment(normalized);
    return draft;
  }

  // recipe
  const ingredients = [];
  const steps = [];
  const intro = [];
  const notes = [];
  let section = 'intro';
  lines.forEach((line, i) => {
    if (i === titleLineIndex) return;
    const stripped = stripMarker(line);
    const head = headerText(line);
    const inline = stripped.match(/^([A-Za-z][A-Za-z '’]{2,30})\s*[:：]\s*(.+)$/);
    if (inline && RECIPE_HEAD.test(clean(inline[1]))) {
      section = 'ingredients';
      const parts = inline[2].split(/\s*[,;]\s*(?![^()]*\))/).map(clean).filter(Boolean);
      ingredients.push(...parts);
      return;
    }
    if (inline && STEP_HEAD.test(clean(inline[1]))) { section = 'steps'; steps.push(clean(inline[2])); return; }
    if (inline && NOTE_HEAD.test(clean(inline[1]))) { section = 'notes'; notes.push(stripped); return; }
    if (looksLikeHeader(line) || RECIPE_HEAD.test(head) || STEP_HEAD.test(head) || NOTE_HEAD.test(head)) {
      if (RECIPE_HEAD.test(head)) { section = 'ingredients'; return; }
      if (STEP_HEAD.test(head)) { section = 'steps'; return; }
      if (NOTE_HEAD.test(head)) { section = 'notes'; return; }
      if (SUB_HEAD.test(head) || section === 'ingredients' || section === 'steps') {
        const target = section === 'steps' ? steps : (section = 'ingredients', ingredients);
        target.push(`${head[0].toUpperCase()}${head.slice(1)}:`);
        return;
      }
    }
    if (section === 'notes') { notes.push(stripped); return; }
    if (section === 'ingredients') {
      if (isNumbered(line) && stripped.length > 30 && COOK_VERBS.test(stripped)) { section = 'steps'; steps.push(stripped); return; }
      if (COOK_VERBS.test(stripped) && stripped.length > 45 && !QTY_START.test(stripped)) { section = 'steps'; steps.push(stripped); return; }
      ingredients.push(stripped);
      return;
    }
    if (section === 'steps') { steps.push(stripped); return; }
    // No header yet: classify by shape.
    if (QTY_START.test(stripped) && stripped.length < 110 && !(isNumbered(line) && COOK_VERBS.test(stripped))) { ingredients.push(stripped); return; }
    if ((isNumbered(line) || COOK_VERBS.test(stripped)) && stripped.length > 18) { steps.push(stripped); return; }
    if (ingredients.length || steps.length) notes.push(stripped); else intro.push(stripped);
  });
  // Notes that are really macro lines stay as notes; everything else in intro becomes the description.
  draft.ingredients = ingredients.filter(x => clean(x).length > 1);
  draft.steps = steps;
  draft.description = clean(intro.join(' ')).slice(0, 280);
  const extraIntro = clean(intro.join(' ')).length > 280 ? clean(intro.join(' ')) : '';
  draft.note = [extraIntro, ...notes].filter(Boolean).join('\n');
  draft.minutes = parseMinutes(normalized) ?? parseMinutes(`${draft.title}\n${lines.slice(0, 2).join('\n')}\n${draft.note}`, { loose: true });
  draft.servings = parseServings(normalized);
  draft.nutrition = parseNutrition(normalized);
  draft.category = guessCategory(`${draft.title} ${normalized}`);
  return draft;
}

export function guessCategory(text = '') {
  const t = text.toLowerCase();
  if (/\b(?:smoothie|latte|tea|coffee|lemonade|drink|shake|matcha|juice|cocktail|mocktail)\b/.test(t) && !/\b(?:chicken|beef|rice)\b/.test(t)) return 'Drinks';
  if (/\b(?:cookies?|cake|brownies?|dessert|ice cream|pudding|pie|cheesecake|muffins?|sweet treat|tiramisu|mochi)\b/.test(t)) return 'Dessert';
  if (/\b(?:breakfast|pancakes?|waffles?|oats|oatmeal|overnight oats|granola|french toast|omelet(?:te)?|scrambled eggs|bagel|brunch)\b/.test(t)) return 'Breakfast';
  if (/\b(?:snack|bites|dip|energy balls?|protein balls?|bars?)\b/.test(t)) return 'Snack';
  if (/\b(?:lunch|sandwich|wrap|salad|bento)\b/.test(t)) return 'Lunch';
  return 'Dinner';
}

export function guessFocus(text = '') {
  const t = text.toLowerCase();
  const score = (re) => (t.match(re) || []).length;
  const lower = score(/\b(?:legs?|glutes?|hamstrings?|quads?|calves|squats?|deadlifts?|rdls?|lunges?|hip thrusts?|lower body|leg day|step[- ]?ups?|leg press)\b/g);
  const upper = score(/\b(?:chest|back|shoulders?|arms?|biceps?|triceps?|lats?|bench|rows?|pull[- ]?ups?|push[- ]?ups?|curls?|upper body|delts?|pulldowns?|overhead press)\b/g);
  const core = score(/\b(?:core|abs|planks?|crunch(?:es)?|obliques?|hollow|dead bugs?)\b/g);
  const cardio = score(/\b(?:cardio|hiit|run|running|sprints?|cycling|bike|rower|jump rope|burpees?|conditioning|zone 2|treadmill)\b/g);
  if (/\bfull[- ]?body\b/.test(t) || (lower >= 2 && upper >= 2)) return 'Full body';
  const best = [['Lower body', lower], ['Upper body', upper], ['Core', core], ['Cardio', cardio]].sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : 'Full body';
}

export function guessEquipment(text = '') {
  const t = text.toLowerCase();
  const found = [];
  if (/\bdumbbells?|\bdbs?\b/.test(t)) found.push('Dumbbells');
  if (/\bbarbell|\bbb\b/.test(t)) found.push('Barbell');
  if (/\bkettlebells?|\bkb\b/.test(t)) found.push('Kettlebell');
  if (/\bbands?\b|resistance band/.test(t)) found.push('Bands');
  if (/\bcables?\b/.test(t)) found.push('Cable machine');
  if (/\bmachines?\b|leg press|smith/.test(t)) found.push('Machines');
  if (!found.length && /\b(?:bodyweight|no equipment|at home|home workout)\b/.test(t)) found.push('Bodyweight');
  return found.join(', ');
}
