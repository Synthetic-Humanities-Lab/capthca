import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageLibrary } from '../assets.js';

// Optional macOS asset preparation. Normal builds use the checked-in JPEGs.
const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'capthca-images-'));
const photosPath = join(root, 'sources/photographs.json');
const generationsPath = join(root, 'sources/generation.json');
const photos = JSON.parse(await readFile(photosPath, 'utf8'));
const generations = JSON.parse(await readFile(generationsPath, 'utf8'));
await mkdir(join(root, 'assets/tiles'), { recursive: true });
for (const record of generations) record.tiles = [];

try {
  for (const image of imageLibrary) {
    const record = image.human
      ? photos.find(photo => Number(photo.id) === image.sourcePhotoId)
      : generations.find(record => (record.asset ?? record.local_atlas) === image.sourceAtlas);
    if (!record) throw new Error(`Missing source record for ${image.id}`);
    const original = image.human ? `assets/p${record.id}.jpg` : record.original;
    const cell = image.sourceCell;
    const sourceWidth = image.human ? 384 : record.width;
    const sourceHeight = image.human ? 384 : record.height;
    const columns = cell?.columns ?? 1;
    const rows = cell?.rows ?? 1;
    const x = Math.round((cell?.column ?? 0) * sourceWidth / columns) + 2;
    const y = Math.round((cell?.row ?? 0) * sourceHeight / rows) + 2;
    const right = Math.round(((cell?.column ?? 0) + 1) * sourceWidth / columns) - 2;
    const bottom = Math.round(((cell?.row ?? 0) + 1) * sourceHeight / rows) - 2;
    const intermediate = join(temporary, `${image.id}.png`);
    await run('sips', ['-c', String(bottom - y), String(right - x), '--cropOffset', String(y), String(x), '-s', 'format', 'png', join(root, original), '--out', intermediate]);
    await run('sips', ['-z', '256', '256', '-s', 'format', 'jpeg', '-s', 'formatOptions', '82', intermediate, '--out', join(root, image.src)]);
    const bytes = await readFile(join(root, image.src));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (image.human) {
      record.original_asset = original;
      record.original_sha256 ??= record.sha256;
      record.asset = image.src;
      record.sha256 = sha256;
    } else {
      record.tiles.push({ id: image.id, asset: image.src, cell, sha256, bytes: bytes.length });
    }
  }
  for (const record of generations) {
    record.local_atlas ??= record.asset;
    record.atlas_sha256 ??= record.published_sha256;
    delete record.asset;
    delete record.published_sha256;
    record.encoding = 'Each source cell trimmed by 2px, resized to 256 by 256, and JPEG encoded at quality 82 using macOS sips; same treatment as photographs.';
  }
  await writeFile(photosPath, `${JSON.stringify(photos, null, 2)}\n`);
  await writeFile(generationsPath, `${JSON.stringify(generations, null, 2)}\n`);
  console.log(`Prepared ${imageLibrary.length} individual 256px JPEG tiles.`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
