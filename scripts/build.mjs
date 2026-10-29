import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'shared', 'data', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
// Stamp the service worker so each deploy refreshes the cached app.
const sw = await readFile('sw.js', 'utf8');
await writeFile('dist/sw.js', sw.replace('__VERSION__', Date.now().toString(36)));
console.log('Built Stevies World in dist/');
