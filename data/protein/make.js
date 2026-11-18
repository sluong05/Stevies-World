// Builds one high-protein budget recipe in the cookbook shape.
import { commonsPhoto } from '../protein-photos.js';

const lines = text => text.split('\n').map(s => s.trim()).filter(Boolean);

export const NUTRITION_NOTE = 'Rough estimate per serving, worked out from typical USDA values for the main ingredients as listed (including the rice, bread or pasta named in the ingredients). Brands, cuts and portion sizes change the numbers.';
export const COST_NOTE = 'Rough estimate for the whole recipe at typical US supermarket prices in late 2026 (store brands, regular-size packs), counting only the amounts used. Spices, oil, salt and other pantry staples are mostly left out. Prices vary by store and region.';

export function R(id, title, cuisine, category, minutes, servings, [calories, protein, carbs, fat], cost, description, ingredients, steps) {
  return {
    id, title, description, category, minutes, servings,
    tags: ['High protein', 'Budget', cuisine],
    photo: commonsPhoto(id, `${title}, a real photo of the dish`),
    ingredients: lines(ingredients),
    steps: lines(steps),
    nutrition: { calories, protein, carbs, fat, note: NUTRITION_NOTE },
    cost: { total: cost, currency: 'USD', note: COST_NOTE },
    sourceName: 'High-protein budget collection',
  };
}
