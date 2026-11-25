// Wikimedia Commons photos are saved as Special:FilePath links. Those redirect through
// commons.wikimedia.org, which doesn't allow the 3D pages to read the pixels (CORS), so the
// cookbook couldn't paint them. upload.wikimedia.org does allow it: these build its direct URLs.

// Small MD5 (RFC 1321), enough to find a file's folder on upload.wikimedia.org.
function md5(str) {
  const bytes = new TextEncoder().encode(str);
  const n = (((bytes.length + 8) >> 6) + 1) * 16;
  const w = new Uint32Array(n);
  for (let i = 0; i < bytes.length; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[bytes.length >> 2] |= 0x80 << ((bytes.length % 4) * 8);
  w[n - 2] = bytes.length * 8;
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const R = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < n; o += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      const r = i >> 4;
      let f, g;
      if (r === 0) { f = (b & c) | (~b & d); g = i; }
      else if (r === 1) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; }
      else if (r === 2) { f = b ^ c ^ d; g = (3 * i + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const s = R[r * 4 + (i % 4)];
      const t = (a + f + K[i] + w[o + g]) >>> 0;
      a = d; d = c; c = b;
      b = (b + ((t << s) | (t >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map(v => [0, 8, 16, 24].map(s => ((v >>> s) & 255).toString(16).padStart(2, '0')).join('')).join('');
}

/** Direct, CORS-readable URLs to try for a photo, best first. Other URLs come back as they are. */
export function readableSources(src, width = 960) {
  const m = String(src || '').match(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?#]+)/);
  if (!m) return [src];
  const name = decodeURIComponent(m[1]).replace(/ /g, '_');
  const h = md5(name), enc = encodeURIComponent(name).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')');
  const base = `https://upload.wikimedia.org/wikipedia/commons`;
  const thumb = `${base}/thumb/${h[0]}/${h.slice(0, 2)}/${enc}/${width}px-${enc}${/\.(tiff?|svg)$/i.test(name) ? '.jpg' : ''}`;
  return [thumb, `${base}/${h[0]}/${h.slice(0, 2)}/${enc}`];
}
export { md5 as _md5 };
