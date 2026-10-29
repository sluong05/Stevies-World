import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFromHtml, instagramCaption, metaTags, youtubeDetails, isoMinutes, pageText } from '../shared/extract.js';
import { importLink, NeedsText, platformOf } from '../lib/importer.js';
import { isPrivateAddress, assertPublicUrl } from '../lib/safe-fetch.js';

const recipePage = `<!doctype html><html><head><title>Best Chili | Some Blog</title>
<meta property="og:image" content="https://cdn.example.com/chili.jpg"><meta property="og:site_name" content="Some Blog">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},{"@type":["Recipe"],"name":"Best Turkey Chili &amp; Beans","description":"Cozy &quot;weeknight&quot; chili.","image":["https://cdn.example.com/a.jpg","https://cdn.example.com/b.jpg"],"recipeYield":["6","6 bowls"],"totalTime":"PT1H5M","recipeCategory":"Dinner","recipeCuisine":"American","keywords":"chili, turkey","author":{"@type":"Person","name":"Sam"},
"recipeIngredient":["1 lb ground turkey","1 can beans"],"recipeInstructions":[{"@type":"HowToSection","name":"Make the base","itemListElement":[{"@type":"HowToStep","text":"Brown the turkey."},{"@type":"HowToStep","text":"Add <b>beans</b>."}]},{"@type":"HowToStep","text":"Simmer 30 minutes."}],
"nutrition":{"@type":"NutritionInformation","calories":"410 kcal","proteinContent":"38 g","carbohydrateContent":"30 g","fatContent":"12 g"}}]}</script></head><body><p>story…</p></body></html>`;

test('recipe sites: schema.org JSON-LD becomes a full recipe', () => {
  const { draft, image, method } = extractFromHtml(recipePage, 'https://blog.example.com/chili');
  assert.equal(method, 'recipe-card');
  assert.equal(draft.title, 'Best Turkey Chili & Beans');
  assert.equal(draft.description, 'Cozy "weeknight" chili.');
  assert.deepEqual(draft.ingredients, ['1 lb ground turkey', '1 can beans']);
  assert.deepEqual([draft.steps[0], draft.steps[1], draft.steps[3]], ['Make the base:', 'Brown the turkey.', 'Simmer 30 minutes.']);
  assert.equal(draft.steps[2], 'Add beans.');
  assert.equal(draft.minutes, 65);
  assert.equal(draft.servings, 6);
  assert.equal(draft.category, 'Dinner');
  assert.deepEqual(draft.nutrition, { calories: 410, protein: 38, carbs: 30, fat: 12 });
  assert.equal(draft.sourceName, 'Sam');
  assert.equal(image, 'https://cdn.example.com/b.jpg');
});

test('pages without a recipe card fall back to reading the text', () => {
  const html = `<html><head><meta property="og:title" content="My push day"></head><body><nav>menu</nav><article><h2>Exercises</h2><ul><li>Bench press 4x8</li><li>Incline DB press 3x10</li><li>Dips 3x12</li></ul><p>Rest 2 minutes between sets of the main lift and go heavy on the bench and press.</p></article></body></html>`;
  const { draft } = extractFromHtml(html, 'https://example.com/push');
  assert.equal(draft.type, 'workout');
  assert.equal(draft.title, 'My push day');
  assert.equal(draft.blocks[0].exercises.length, 3);
  assert.ok(!pageText(html).includes('menu'));
});

test('Instagram and YouTube captions are found in page metadata', () => {
  const meta = metaTags(`<meta property="og:description" content="1,204 likes, 33 comments - chef.sam on March 3, 2026: &quot;Crispy tofu bowls&#10;Ingredients:&#10;- 1 block tofu&quot;. ">`);
  assert.equal(instagramCaption(meta), 'Crispy tofu bowls\nIngredients:\n- 1 block tofu');
  const yt = youtubeDetails('var ytInitialPlayerResponse = {"videoDetails":{"videoId":"abc","title":"10 min abs","lengthSeconds":"600","shortDescription":"Crunches 3x20\\nPlank 3x45s"},"ownerChannelName":"Coach"};');
  assert.deepEqual(yt, { description: 'Crunches 3x20\nPlank 3x45s', title: '10 min abs', author: 'Coach' });
  assert.equal(isoMinutes('PT45M'), 45);
  assert.equal(isoMinutes('P0DT2H'), 120);
});

const fakeResolve = async () => [{ address: '93.184.216.34' }];
function fakeFetch(routes) {
  return async (url) => {
    const handler = Object.entries(routes).find(([prefix]) => url.startsWith(prefix))?.[1];
    if (!handler) return new Response('nope', { status: 404 });
    const { status = 200, body = '', type = 'text/html', headers = {} } = handler(url);
    return new Response(body, { status, headers: { 'content-type': type, ...headers } });
  };
}

test('TikTok links use the public oEmbed caption', async () => {
  const deps = { resolve: fakeResolve, fetchImpl: fakeFetch({
    'https://www.tiktok.com/oembed': () => ({ type: 'application/json', body: JSON.stringify({ title: 'Lazy girl pasta 🍝\nIngredients:\n- 200g pasta\n- 1 jar pesto\nBoil the pasta then stir through the pesto and serve.', author_name: 'Pasta Pal', thumbnail_url: 'https://p16.tiktokcdn.com/x.jpeg' }) }),
    'https://p16.tiktokcdn.com/': () => ({ type: 'image/jpeg', body: new Uint8Array([255, 216, 255, 224, 0, 16]) }),
  }) };
  const result = await importLink('https://www.tiktok.com/@pastapal/video/7300000000000000000?is_from_webapp=1', {}, deps);
  assert.equal(platformOf('https://vm.tiktok.com/ZMabc/'), 'tiktok');
  assert.equal(result.platform, 'tiktok');
  assert.equal(result.draft.type, 'recipe');
  assert.equal(result.draft.title, 'Lazy girl pasta');
  assert.deepEqual(result.draft.ingredients, ['200g pasta', '1 jar pesto']);
  assert.equal(result.draft.sourceName, 'Pasta Pal on TikTok');
  assert.equal(result.draft.sourceUrl, 'https://www.tiktok.com/@pastapal/video/7300000000000000000');
  assert.match(result.image, /^data:image\/jpeg;base64,/);
});

test('Instagram posts without a readable caption ask for a paste', async () => {
  const deps = { resolve: fakeResolve, fetchImpl: fakeFetch({ 'https://www.instagram.com/': () => ({ body: '<html><head><title>Instagram</title></head></html>' }) }) };
  await assert.rejects(importLink('https://www.instagram.com/reel/Cabc123/', {}, deps), err => err instanceof NeedsText && /paste it here/.test(err.message));
});

test('private network addresses are refused', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.4', '169.254.169.254', '172.20.1.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.equal(isPrivateAddress(ip), true, ip);
  for (const ip of ['93.184.216.34', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
  await assert.rejects(assertPublicUrl('http://localhost/admin'));
  await assert.rejects(assertPublicUrl('http://example.com', { resolve: async () => [{ address: '10.0.0.5' }] }));
  await assert.rejects(assertPublicUrl('ftp://example.com/file'));
  assert.equal((await assertPublicUrl('https://example.com/x', { resolve: fakeResolve })).hostname, 'example.com');
});

test('redirects to private addresses are refused too', async () => {
  const deps = { resolve: async host => [{ address: host === 'evil.example' ? '127.0.0.1' : '93.184.216.34' }], fetchImpl: fakeFetch({ 'https://short.example/': () => ({ status: 302, headers: { location: 'http://evil.example/' } }) }) };
  await assert.rejects(importLink('https://short.example/abc', {}, deps), /private address/);
});
