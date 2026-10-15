import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safePhotoSource, validatePhoto, MAX_PHOTO_LENGTH } from '../photo-utils.js';
import { validateLibrary } from '../storage.js';
import { seedPhotos } from '../data/seed-photos.js';

test('photo sources reject scripts, untrusted formats, traversal, and credentials', () => {
  assert.equal(safePhotoSource('https://EXAMPLE.com/food.jpg'), 'https://example.com/food.jpg');
  assert.equal(safePhotoSource('/assets/recipes/meal-001.jpg'), '/assets/recipes/meal-001.jpg');
  for (const source of ['http://example.com/food.jpg', '//example.com/food.jpg', 'javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.com/photo', '/assets/../private.jpg', '/assets/food.svg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,dGV4dA==', 'x'.repeat(MAX_PHOTO_LENGTH + 1)]) assert.equal(safePhotoSource(source), '', source.slice(0, 60));
  assert.equal(safePhotoSource('/assets/soup.jpg', { allowLocal: false }), '');
});

test('uploads require bounded data with a matching raster signature', () => {
  for (const [format, bytes] of [['jpeg', [255,216,255,224]], ['png', [137,80,78,71,13,10,26,10]], ['webp', [82,73,70,70,0,0,0,0,87,69,66,80]]]) {
    const source = `data:image/${format};base64,${Buffer.from(bytes).toString('base64')}`;
    assert.equal(safePhotoSource(source), source);
    assert.equal(safePhotoSource(source.replace(`image/${format}`, `image/${format === 'png' ? 'jpeg' : 'png'}`)), '');
  }
});

test('photo contracts require a photo and alt text and discard unexpected properties', () => {
  assert.equal(validatePhoto(undefined), undefined);
  for (const input of [undefined, null, [], {}, { src: 'https://example.com/a.jpg', alt: '' }]) assert.throws(() => validatePhoto(input, { required: true }));
  const photo = { src: 'https://example.com/a.jpg', alt: ' Food photo ', author: 'Photographer', sourceUrl: 'https://example.com/source', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', caption: 'Serving inspiration.', onclick: 'bad' };
  const clean = validatePhoto(photo, { required: true });
  assert.equal(clean.alt, 'Food photo');
  assert.equal(Object.hasOwn(clean, 'onclick'), false);
  assert.throws(() => validatePhoto({ ...photo, sourceUrl: 'javascript:alert(1)' }));
  assert.throws(() => validatePhoto({ ...photo, author: 'x'.repeat(1001) }));
});

test('photos survive library backups; older libraries still load', () => {
  const entry = { id: 'personal-photo', type: 'recipe', title: 'My lentil bowl', description: 'A recipe of my own.', category: 'Lunch', minutes: 20, servings: 2, ingredients: ['1 cup cooked lentils'], steps: ['Warm and serve.'] };
  const backup = { version: 1, entries: [entry], saved: [] };
  assert.doesNotThrow(() => validateLibrary(backup));
  assert.throws(() => validateLibrary(backup, { requireRecipePhotos: true }));
  entry.photo = { src: '/assets/oats.jpg', alt: 'Oats with fruit', author: 'Photographer', sourceUrl: 'https://example.com/source' };
  const checked = validateLibrary(backup, { requireRecipePhotos: true });
  assert.deepEqual(checked.entries[0].photo, entry.photo);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(checked))), checked);
});

test('home and legacy fallback photographs have local raster files and source credits', async () => {
  const credits = await readFile(new URL('../assets/CREDITS.md', import.meta.url), 'utf8');
  for (const photo of Object.values(seedPhotos)) {
    assert.doesNotThrow(() => validatePhoto(photo, { required: true }));
    assert.ok(photo.author && photo.sourceUrl && photo.license && photo.licenseUrl);
    assert.match(photo.src, /^\/assets\//);
    const bytes = await readFile(new URL(`..${photo.src}`, import.meta.url));
    assert.ok(bytes.length > 1000);
    assert.ok(bytes.subarray(0, 3).equals(Buffer.from([255,216,255])));
    assert.ok(credits.includes(photo.sourceUrl));
  }
});
