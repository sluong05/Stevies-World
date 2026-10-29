import { timingSafeEqual, createHash } from 'node:crypto';

export const passcode = (env = process.env) => (env.STEVIE_PASSCODE || '').trim();

export function checkPasscode(given, env = process.env) {
  const expected = passcode(env);
  if (!expected) return false;
  const a = createHash('sha256').update(String(given || '').trim()).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export const passcodeFrom = req => req.headers?.['x-passcode'] || '';
