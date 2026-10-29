// Link → draft item. Handles TikTok, Instagram, YouTube and ordinary web pages.
import { safeFetch } from './safe-fetch.js';
import { parseText, cleanTitle } from '../shared/parse.js';
import { extractFromHtml, metaTags, instagramCaption, youtubeDetails } from '../shared/extract.js';

export function platformOf(url) {
  const host = new URL(url).hostname.replace(/^www\.|^m\./, '').toLowerCase();
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)instagram\.com$/.test(host) || host === 'instagr.am') return 'instagram';
  if (/(^|\.)youtube\.com$/.test(host) || host === 'youtu.be') return 'youtube';
  return 'web';
}
export const PLATFORM_NAMES = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', web: 'the website' };

export class NeedsText extends Error {
  constructor(message, partial = {}) { super(message); this.partial = partial; }
}

async function imageData(src, deps) {
  if (!src) return null;
  try {
    const res = await safeFetch(src, { accept: 'image', maxBytes: 2_800_000, timeoutMs: 7000, ...deps });
    const type = res.contentType.split(';')[0].trim();
    if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(type) || !res.buffer.length) return null;
    return `data:${type};base64,${res.buffer.toString('base64')}`;
  } catch { return null; }
}

function finish(draft, { url, platform, author }) {
  draft.sourceUrl = url;
  if (!draft.sourceName) draft.sourceName = author ? `${author} on ${PLATFORM_NAMES[platform]}` : PLATFORM_NAMES[platform] === 'the website' ? new URL(url).hostname.replace(/^www\./, '') : PLATFORM_NAMES[platform];
  return draft;
}

async function fromTikTok(url, hints, deps) {
  // Short links (vm./vt.tiktok.com) redirect to the full video URL first.
  let full = url;
  if (!/\/video\/|\/photo\//.test(new URL(url).pathname)) {
    try { full = (await safeFetch(url, { maxBytes: 200_000, ...deps })).url; } catch { /* oEmbed may still accept it */ }
  }
  const res = await safeFetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(full)}`, deps);
  let data = null;
  try { data = JSON.parse(res.text()); } catch { /* fall through */ }
  if (!res.ok || !data?.title) throw new NeedsText('TikTok didn’t share this video’s caption. Open the video, tap the caption to expand it, copy it, and paste it here.');
  const draft = parseText(data.title, { type: hints.type });
  return { draft: finish(draft, { url: full.split('?')[0], platform: 'tiktok', author: data.author_name }), imageSrc: data.thumbnail_url, raw: data.title };
}

async function fromInstagram(url, hints, deps) {
  const clean = url.split('?')[0];
  const res = await safeFetch(clean, { headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' }, ...deps });
  const meta = metaTags(res.text());
  const caption = instagramCaption(meta);
  const author = (meta['og:title'] || '').match(/^(.+?) on Instagram/)?.[1] || (meta['og:description'] || '').match(/-\s*([\w.]+) on /)?.[1] || '';
  if (!caption) throw new NeedsText('Instagram didn’t share this post’s caption. In the app, tap “more” on the caption, press and hold to copy it, then paste it here.', { imageSrc: meta['og:image'] });
  const draft = parseText(caption, { type: hints.type });
  return { draft: finish(draft, { url: clean, platform: 'instagram', author }), imageSrc: meta['og:image'], raw: caption };
}

async function fromYouTube(url, hints, deps) {
  const u = new URL(url);
  const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v') || u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1];
  const watch = id ? `https://www.youtube.com/watch?v=${id}` : url;
  const res = await safeFetch(watch, deps);
  const { description, title, author } = youtubeDetails(res.text());
  if (!description && !title) throw new NeedsText('YouTube didn’t share this video’s description. Copy it from the video page and paste it here.');
  const draft = parseText(description || title, { type: hints.type, title });
  return { draft: finish(draft, { url: id ? `https://youtu.be/${id}` : url, platform: 'youtube', author }), imageSrc: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '', raw: description };
}

async function fromWeb(url, hints, deps) {
  const res = await safeFetch(url, deps);
  if (!res.ok) throw new NeedsText(`That page answered with an error (${res.status}). If it opens in your browser, copy the recipe or workout text and paste it here.`);
  if (!/html|xml|text\/plain/.test(res.contentType)) throw new Error('That link isn’t a web page.');
  const html = res.text();
  if (/text\/plain/.test(res.contentType)) return { draft: finish(parseText(html, hints), { url: res.url, platform: 'web' }), imageSrc: '', raw: html };
  const { draft, image, raw } = extractFromHtml(html, res.url, hints);
  return { draft: finish(draft, { url: res.url, platform: 'web' }), imageSrc: image, raw };
}

/**
 * @returns {Promise<{draft, image: string|null, platform, raw}>}
 * Throws NeedsText when the platform won't share the caption, so the app can ask for a paste.
 */
export async function importLink(url, hints = {}, deps = {}) {
  const platform = platformOf(url);
  const handler = { tiktok: fromTikTok, instagram: fromInstagram, youtube: fromYouTube, web: fromWeb }[platform];
  let result;
  try {
    result = await handler(url, hints, deps);
  } catch (error) {
    if (error instanceof NeedsText) {
      error.platform = platform;
      error.image = await imageData(error.partial?.imageSrc, deps);
    }
    throw error;
  }
  result.draft.title = cleanTitle(result.draft.title) || result.draft.title;
  const image = await imageData(result.imageSrc, deps);
  return { draft: result.draft, image, platform, raw: (result.raw || '').slice(0, 20000) };
}
