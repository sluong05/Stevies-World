import { mkdir, rm, cp, readFile, writeFile, readdir } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'shared', 'data', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
// Cache the entire current module graph before activating an update, including
// newly added recipe-data modules that an older installed app has never requested.
async function modules(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => {
    const file = `${dir}/${entry.name}`;
    return entry.isDirectory() ? modules(file) : /\.m?js$/.test(file) ? [`/${file}`] : [];
  }));
  return nested.flat();
}
const core = ['/', '/index.html', '/styles.css', '/manifest.webmanifest', '/assets/icon.svg',
  ...(await Promise.all(['src', 'shared', 'data'].map(modules))).flat().sort()];
// Stamp the service worker so each deploy refreshes the cached app.
const sw = await readFile('sw.js', 'utf8');
await writeFile('dist/sw.js', sw.replace('__VERSION__', Date.now().toString(36)).replace(/const CORE = \[[^\]]*\];/, `const CORE = ${JSON.stringify(core)};`));
console.log('Built Stevies World in dist/');
