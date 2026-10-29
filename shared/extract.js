// Pulls recipe/workout information out of fetched web pages without a DOM.
// Order of preference: schema.org JSON-LD (most recipe sites) → page text run through parseText.
import { parseText, cleanTitle, guessCategory } from './parse.js';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', frac12: '½', frac14: '¼', frac34: '¾', deg: '°', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', egrave: 'è', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', times: '×', frasl: '⁄', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™' };
export function decodeEntities(s = '') {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      try { return String.fromCodePoint(n); } catch { return m; }
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}
const stripTags = s => decodeEntities(String(s).replace(/<\/?(?:b|i|em|strong|span|a|u|small|mark)\b[^>]*>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();

export function metaTags(html) {
  const meta = {};
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = {};
    for (const a of tag[0].matchAll(/([a-z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi)) attrs[a[1].toLowerCase()] = a[3] ?? a[4];
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    if (key && attrs.content !== undefined && !(key in meta)) meta[key] = decodeEntities(attrs.content);
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) meta['html:title'] = stripTags(title[1]);
  return meta;
}

export function jsonLdBlocks(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { out.push(JSON.parse(m[1].trim().replace(/^<!--|-->$/g, ''))); } catch { /* broken JSON-LD is common; skip */ }
  }
  return out;
}

const hasType = (node, type) => node && (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).some(t => String(t).toLowerCase() === type.toLowerCase());
export function findNode(data, type) {
  const stack = [data];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) { stack.push(...node); continue; }
    if (hasType(node, type)) return node;
    if (node['@graph']) stack.push(node['@graph']);
    if (node.mainEntity) stack.push(node.mainEntity);
    if (node.itemListElement && !hasType(node, 'HowToSection')) stack.push(node.itemListElement);
  }
  return null;
}

export function isoMinutes(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!m) return null;
  const total = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) + Math.round((+m[4] || 0) / 60);
  return total || null;
}

const text = v => (v === undefined || v === null ? '' : stripTags(typeof v === 'object' ? v.text || v.name || '' : v));
const firstNumber = v => { const m = String(Array.isArray(v) ? v.join(' ') : v ?? '').match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };

export function imageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (Array.isArray(image)) return imageUrl(image[image.length > 1 && typeof image[0] === 'string' ? image.length - 1 : 0]);
  return image.url || image.contentUrl || image['@id'] || '';
}

function instructions(value) {
  const steps = [];
  const walk = (node, section) => {
    if (!node) return;
    if (typeof node === 'string') {
      const t = stripTags(node);
      // Some sites put every step in one string separated by newlines or numbers.
      const parts = t.includes('\n') ? t.split('\n') : [t];
      parts.map(p => p.trim()).filter(Boolean).forEach(p => steps.push(p));
      return;
    }
    if (Array.isArray(node)) { node.forEach(n => walk(n, section)); return; }
    if (hasType(node, 'HowToSection')) {
      if (node.name) steps.push(`${stripTags(node.name).replace(/:$/, '')}:`);
      walk(node.itemListElement, node.name);
      return;
    }
    const t = text(node);
    if (t) steps.push(t);
    else if (node.itemListElement) walk(node.itemListElement, section);
  };
  walk(value);
  return steps;
}

export function recipeFromJsonLd(node, url = '') {
  const nutrition = node.nutrition || {};
  const n = { calories: firstNumber(nutrition.calories), protein: firstNumber(nutrition.proteinContent), carbs: firstNumber(nutrition.carbohydrateContent), fat: firstNumber(nutrition.fatContent) };
  const keywords = Array.isArray(node.keywords) ? node.keywords : String(node.keywords || '').split(',');
  const cuisine = Array.isArray(node.recipeCuisine) ? node.recipeCuisine : [node.recipeCuisine];
  const category = Array.isArray(node.recipeCategory) ? node.recipeCategory[0] : node.recipeCategory;
  const title = cleanTitle(text(node.name));
  const author = Array.isArray(node.author) ? node.author[0] : node.author;
  const draft = {
    type: 'recipe',
    title: title || 'New recipe',
    description: text(node.description).slice(0, 600),
    ingredients: (Array.isArray(node.recipeIngredient) ? node.recipeIngredient : Array.isArray(node.ingredients) ? node.ingredients : []).map(text).filter(Boolean),
    steps: instructions(node.recipeInstructions),
    minutes: isoMinutes(node.totalTime) || ((isoMinutes(node.prepTime) || 0) + (isoMinutes(node.cookTime) || 0)) || null,
    servings: firstNumber(node.recipeYield),
    category: mapCategory(text(category)) || guessCategory(`${title} ${text(node.description)}`),
    tags: [...cuisine.map(text), ...keywords.map(k => text(k))].filter(t => t && t.length < 30).slice(0, 6),
    nutrition: Object.values(n).some(v => v !== null) ? n : null,
    note: '',
    sourceName: text(author?.name || author) || '',
  };
  const img = imageUrl(node.image);
  return { draft, image: img ? new URL(img, url || undefined).href : '' };
}

function mapCategory(c) {
  const t = (c || '').toLowerCase();
  if (!t) return '';
  if (/breakfast|brunch/.test(t)) return 'Breakfast';
  if (/lunch|salad|sandwich/.test(t)) return 'Lunch';
  if (/dinner|main|entr[eé]e|supper/.test(t)) return 'Dinner';
  if (/dessert|baking|sweet|cake|cookie/.test(t)) return 'Dessert';
  if (/drink|beverage|cocktail|smoothie/.test(t)) return 'Drinks';
  if (/snack|appetizer|starter|side/.test(t)) return 'Snack';
  return '';
}

/** Readable text from an HTML page, keeping list items and headings on their own lines. */
export function pageText(html) {
  let body = html.replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|aside)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const main = body.match(/<(article|main)\b[\s\S]*?<\/\1>/i);
  if (main && main[0].length > 600) body = main[0];
  body = body
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, (m, h, inner) => `\n${stripTags(inner)}:\n`)
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/tr|p|div|section|table)\b[^>]*>/gi, '\n');
  return decodeEntities(body.replace(/<[^>]*>/g, ' '))
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
    .filter((l, i, a) => l !== a[i - 1])
    .join('\n').slice(0, 30000);
}

/** Full page → { draft, image, raw } */
export function extractFromHtml(html, url, hints = {}) {
  const meta = metaTags(html);
  const ogImage = meta['og:image'] || meta['twitter:image'] || '';
  const siteName = meta['og:site_name'] || (url ? new URL(url).hostname.replace(/^www\./, '') : '');
  if (hints.type !== 'workout' && hints.type !== 'note') {
    for (const block of jsonLdBlocks(html)) {
      const node = findNode(block, 'Recipe');
      if (node && (node.recipeIngredient || node.recipeInstructions)) {
        const { draft, image } = recipeFromJsonLd(node, url);
        if (!draft.sourceName) draft.sourceName = siteName;
        return { draft, image: image || ogImage, raw: '', method: 'recipe-card' };
      }
    }
  }
  const title = meta['og:title'] || meta['twitter:title'] || meta['html:title'] || '';
  const description = meta['og:description'] || meta.description || '';
  const raw = pageText(html);
  const draft = parseText(raw, { title, type: hints.type });
  if (!draft.description && description) draft.description = description.slice(0, 600);
  draft.sourceName = siteName;
  // A plain article with no recipe/workout shape becomes a short note that links back.
  if (draft.type === 'note') {
    draft.body = description;
  }
  return { draft, image: ogImage ? new URL(ogImage, url).href : '', raw, method: 'page-text' };
}

/** Instagram puts the caption inside og:description/og:title: `123 likes, 4 comments - user on Date: "caption"`. */
export function instagramCaption(meta) {
  const candidates = [meta['og:description'], meta.description, meta['og:title'], meta['twitter:title']].filter(Boolean);
  for (const c of candidates) {
    const m = c.match(/:\s*[“"]([\s\S]+)[”"]\s*\.?\s*$/);
    if (m && m[1].trim().length > 3) return m[1].trim();
  }
  for (const c of candidates) {
    const m = c.match(/on Instagram:\s*[“"]?([\s\S]+?)[”"]?$/);
    if (m) return m[1].trim();
  }
  return '';
}

/** YouTube watch pages embed the full description in ytInitialPlayerResponse. */
export function youtubeDetails(html) {
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  const t = html.match(/"videoDetails":\{[^}]*?"title":"((?:[^"\\]|\\.)*)"/);
  const a = html.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/) || html.match(/"author":"((?:[^"\\]|\\.)*)"/);
  const decode = s => { try { return JSON.parse(`"${s}"`); } catch { return s; } };
  return { description: m ? decode(m[1]) : '', title: t ? decode(t[1]) : '', author: a ? decode(a[1]) : '' };
}
