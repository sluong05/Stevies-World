import { getRedis } from '../lib/redis.js';
import { readPhoto } from '../lib/library.js';

// GET /api/photo?k=<token>. Tokens are long and random, and change whenever a photo changes,
// so responses can be cached forever.
export default async function handler(req, res) {
  const redis = getRedis();
  if (!redis) return res.status(404).end();
  try {
    const photo = await readPhoto(redis, req.query?.k);
    if (!photo) return res.status(404).end();
    res.setHeader('Content-Type', photo.type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(photo.bytes);
  } catch (error) {
    console.error(error);
    return res.status(500).end();
  }
}
