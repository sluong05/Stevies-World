import { mkdir, rm, cp } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'content.js', 'estimates.js', 'storage.js', 'budget-meals.js', 'data', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
console.log('Built Stevies World in dist/');
