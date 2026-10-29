// Tiny Upstash Redis REST client (no dependencies). Works with the env vars the
// Vercel Marketplace "Upstash for Redis" integration adds to the project.

export function redisConfig(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '';
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function createRedis(config, fetchImpl = fetch) {
  async function call(path, body) {
    const res = await fetchImpl(`${config.url}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error(`Storage request failed (${res.status}).`);
    return data;
  }
  return {
    async cmd(...args) {
      const data = await call('', args);
      if (data.error) throw new Error(data.error);
      return data.result;
    },
    async pipeline(commands) {
      if (!commands.length) return [];
      const data = await call('/pipeline', commands);
      return data.map(r => { if (r.error) throw new Error(r.error); return r.result; });
    },
  };
}

// In-memory stand-in used by tests and by `npm run dev` when no Upstash env vars are set
// but SW_DEV_MEMORY=1 is (so the sync flow can be tried locally).
export function memoryRedis() {
  const strings = new Map(), hashes = new Map(), sets = new Map();
  const h = k => (hashes.has(k) ? hashes.get(k) : hashes.set(k, new Map()).get(k));
  const s = k => (sets.has(k) ? sets.get(k) : sets.set(k, new Set()).get(k));
  const run = ([name, ...a]) => {
    switch (name.toUpperCase()) {
      case 'GET': return strings.get(a[0]) ?? null;
      case 'SET': strings.set(a[0], String(a[1])); return 'OK';
      case 'DEL': return a.reduce((n, k) => n + (strings.delete(k) || hashes.delete(k) || sets.delete(k) ? 1 : 0), 0);
      case 'INCR': { const v = Number(strings.get(a[0]) || 0) + 1; strings.set(a[0], String(v)); return v; }
      case 'HSET': { let n = 0; for (let i = 1; i < a.length; i += 2) { if (!h(a[0]).has(a[i])) n++; h(a[0]).set(a[i], String(a[i + 1])); } return n; }
      case 'HGET': return h(a[0]).get(a[1]) ?? null;
      case 'HDEL': return a.slice(1).reduce((n, f) => n + (h(a[0]).delete(f) ? 1 : 0), 0);
      case 'HVALS': return [...h(a[0]).values()];
      case 'HLEN': return h(a[0]).size;
      case 'SADD': return a.slice(1).reduce((n, m) => n + (s(a[0]).has(m) ? 0 : (s(a[0]).add(m), 1)), 0);
      case 'SREM': return a.slice(1).reduce((n, m) => n + (s(a[0]).delete(m) ? 1 : 0), 0);
      case 'SMEMBERS': return [...s(a[0])];
      default: throw new Error(`memoryRedis: ${name} not supported`);
    }
  };
  return { async cmd(...args) { return run(args); }, async pipeline(cmds) { return cmds.map(run); } };
}

let shared;
export function getRedis(env = process.env) {
  if (shared) return shared;
  const config = redisConfig(env);
  if (config) return (shared = createRedis(config));
  if (env.SW_DEV_MEMORY === '1') return (shared = memoryRedis());
  return null;
}
