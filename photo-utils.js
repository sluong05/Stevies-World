export const MAX_PHOTO_LENGTH = 600000;
export function safePhotoSource(value, { allowLocal = true } = {}) {
  if (typeof value !== 'string' || value.length > MAX_PHOTO_LENGTH) return '';
  if (allowLocal && /^\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/.test(value) && !value.includes('..')) return value;
  if (value.startsWith('data:')) {
    const match = value.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || match[2].length % 4 !== 0) return '';
    try {
      const header = atob(match[2].slice(0, 64));
      if (match[1] === 'jpeg' && header.charCodeAt(0) === 255 && header.charCodeAt(1) === 216 && header.charCodeAt(2) === 255) return value;
      if (match[1] === 'png' && header.startsWith('\x89PNG\r\n\x1a\n')) return value;
      if (match[1] === 'webp' && header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return value;
    } catch { return ''; }
    return '';
  }
  if (value.length > 2000) return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function validatePhoto(photo, { required = false } = {}) {
  if (photo === undefined && !required) return undefined;
  if (!photo || typeof photo !== 'object' || Array.isArray(photo)) throw new Error('Add a recipe photo before saving.');
  const src = safePhotoSource(photo.src);
  if (!src) throw new Error('Use a valid HTTPS photo link or a JPEG, PNG, or WebP upload.');
  if (typeof photo.alt !== 'string' || !photo.alt.trim() || photo.alt.length > 300) throw new Error('Add a short description of the recipe photo.');
  const result = { src, alt: photo.alt.trim() };
  for (const key of ['author', 'license', 'caption']) {
    if (Object.hasOwn(photo, key)) {
      if (typeof photo[key] !== 'string' || photo[key].length > 1000) throw new Error('The photo credit is too long or invalid.');
      result[key] = photo[key];
    }
  }
  for (const key of ['sourceUrl', 'licenseUrl']) {
    if (Object.hasOwn(photo, key)) {
      const url = safePhotoSource(photo[key], { allowLocal: false });
      if (!url || !url.startsWith('https:')) throw new Error('Use an HTTPS link for photo credits.');
      result[key] = url;
    }
  }
  return result;
}
