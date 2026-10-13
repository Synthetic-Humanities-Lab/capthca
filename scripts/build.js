import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { imageLibrary } from '../assets.js';
import { validateLibrary } from '../game.js';

validateLibrary(imageLibrary);
const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
await rm(output, { recursive: true, force: true });
await mkdir(new URL('assets/', output), { recursive: true });

const files = [
  'index.html', 'style.css', 'app.js', 'game.js', 'assets.js', 'favicon.svg',
  ...new Set(imageLibrary.map(image => image.src)),
];
for (const file of files) await cp(new URL(file, root), new URL(file, output));
await writeFile(new URL('.nojekyll', output), '');
console.log(`Built ${imageLibrary.length} images in ${fileURLToPath(output)}`);
