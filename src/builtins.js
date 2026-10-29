// Your cookbook recipes and the healthy-living guides, converted to the library item shape.
import { recipes, articles } from '../data/cookbook.js';

const photo = p => p && ({
  src: p.src === '/assets/beef-udon.png' ? '/assets/beef-udon.jpg' : p.src,
  alt: p.alt || '',
  ...(p.author ? { credit: p.author } : {}),
  ...(p.caption ? { caption: p.caption } : {}),
  ...(p.license ? { license: p.license } : {}),
  ...(p.sourceUrl ? { sourceUrl: p.sourceUrl } : {}),
  ...(p.licenseUrl ? { licenseUrl: p.licenseUrl } : {}),
});

export const builtins = [
  ...recipes.map((r, i) => ({
    id: r.id, type: 'recipe', builtIn: true,
    title: r.title, description: r.description, category: r.category,
    minutes: r.minutes, servings: r.servings, tags: r.tags || [],
    ingredients: r.ingredients, steps: r.steps, note: r.note || '',
    photo: photo(r.photo), sources: r.sources || [],
    ...(r.nutrition ? { nutrition: r.nutrition } : {}),
    ...(r.cost ? { cost: r.cost } : {}),
    sourceUrl: '', sourceName: 'Your cookbook',
    createdAt: Date.UTC(2026, 9, 15) - i, updatedAt: Date.UTC(2026, 9, 15) - i,
  })),
  ...articles.map((a, i) => ({
    id: a.id, type: 'note', builtIn: true,
    title: a.title, description: a.description, category: 'Healthy living', tags: [a.category],
    body: a.sections.map(s => `## ${s.heading}\n${s.body}`).join('\n\n'),
    sources: a.sources || [], note: a.reviewedOn ? `General adult information, not personal medical advice. Sources checked ${a.reviewedOn}.` : '',
    sourceUrl: '', sourceName: '',
    createdAt: Date.UTC(2026, 9, 13) - i, updatedAt: Date.UTC(2026, 9, 13) - i,
  })),
];
