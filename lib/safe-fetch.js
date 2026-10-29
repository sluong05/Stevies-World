// Fetches public web pages for the link importer while refusing private/internal
// addresses, following redirects manually so every hop is checked.
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

export async function assertPublicUrl(raw, { resolve = lookup } = {}) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('That doesn’t look like a link.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only web links (http or https) can be imported.');
  if (url.username || url.password) throw new Error('Links with passwords can’t be imported.');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('That link uses an unusual port and can’t be imported.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('That link points to a private address.');
  const addresses = net.isIP(host) ? [{ address: host }] : await resolve(host, { all: true }).catch(() => { throw new Error('That website couldn’t be found.'); });
  if (!addresses.length || addresses.some(a => isPrivateAddress(a.address))) throw new Error('That link points to a private address.');
  return url;
}

export async function safeFetch(raw, { headers = {}, maxBytes = 3_000_000, timeoutMs = 9000, accept = 'text', fetchImpl = fetch, resolve } = {}) {
  let url = await assertPublicUrl(raw, { resolve });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetchImpl(url.href, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: accept === 'text' ? 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8' : 'image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5', ...headers },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = await assertPublicUrl(new URL(res.headers.get('location'), url).href, { resolve });
        continue;
      }
      const length = Number(res.headers.get('content-length') || 0);
      if (length > maxBytes) throw new Error('That page is too large to import.');
      const reader = res.body?.getReader();
      const chunks = [];
      let size = 0;
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > maxBytes) { controller.abort(); break; }
          chunks.push(value);
        }
      }
      const buffer = Buffer.concat(chunks.map(c => Buffer.from(c)));
      return { url: url.href, status: res.status, ok: res.ok, contentType: res.headers.get('content-type') || '', buffer, text: () => buffer.toString('utf8') };
    }
    throw new Error('That link redirects too many times.');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('That website took too long to respond.');
    throw error;
  } finally { clearTimeout(timer); }
}
