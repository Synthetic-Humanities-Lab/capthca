import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { imageLibrary } from '../assets.js';
import { GRID_SIZE, challengeKey, createChallenge, validateLibrary, verifySelection } from '../game.js';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 2 ** 32;
  };
}

test('every subject has exactly one documented photograph and one generated image', async () => {
  assert.equal(imageLibrary.length, 100);
  assert.equal(validateLibrary(imageLibrary).size, 50);
  assert.equal(imageLibrary.filter(image => image.human).length, 50);
  assert.equal(imageLibrary.filter(image => !image.human).length, 50);
  const photos = JSON.parse(await readFile(new URL('../sources/photographs.json', import.meta.url), 'utf8'));
  for (const image of imageLibrary.filter(image => image.human)) {
    const source = photos.find(photo => photo.asset === image.src);
    assert.ok(source?.author);
    assert.match(source?.url, /^https:\/\/unsplash\.com\/photos\//);
  }
});

test('every generated tile occupies a unique documented atlas cell', async () => {
  const generations = JSON.parse(await readFile(new URL('../sources/generation.json', import.meta.url), 'utf8'));
  assert.equal(generations.reduce((sum, record) => sum + record.images, 0), 50);
  const cells = new Set();
  for (const image of imageLibrary.filter(image => !image.human)) {
    const record = generations.find(record => record.local_atlas === image.sourceAtlas);
    assert.ok(record?.prompt);
    assert.equal(image.sourceCell.columns, record.columns);
    assert.equal(image.sourceCell.rows, record.rows);
    assert.ok(image.sourceCell.column >= 0 && image.sourceCell.column < record.columns);
    assert.ok(image.sourceCell.row >= 0 && image.sourceCell.row < record.rows);
    assert.ok(record.tiles.find(tile => tile.asset === image.src && tile.id === image.id));
    cells.add(`${image.sourceAtlas}:${image.sourceCell.row}:${image.sourceCell.column}`);
  }
  assert.equal(cells.size, 50);
});

test('source records match shipped files and photographs are not duplicated', async () => {
  const photos = JSON.parse(await readFile(new URL('../sources/photographs.json', import.meta.url), 'utf8'));
  const generations = JSON.parse(await readFile(new URL('../sources/generation.json', import.meta.url), 'utf8'));
  assert.equal(photos.length, 50);
  assert.equal(new Set(photos.map(photo => photo.sha256)).size, 50);
  for (const record of [...photos, ...generations.flatMap(record => record.tiles)]) {
    const bytes = await readFile(new URL(`../${record.asset}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
  }
});

function jpegDimensions(buffer) {
  for (let offset = 2; offset < buffer.length;) {
    assert.equal(buffer[offset], 0xff, 'Expected a JPEG marker');
    const marker = buffer[offset + 1];
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  throw new Error('JPEG dimensions not found');
}

test('all 100 phone-ready tiles are distinct 256px JPEGs and nine downloads stay below 350 kB', async () => {
  assert.equal(new Set(imageLibrary.map(image => image.src)).size, 100);
  const sizes = [];
  const hashes = new Set();
  for (const image of imageLibrary) {
    const bytes = await readFile(new URL(`../${image.src}`, import.meta.url));
    assert.deepEqual(jpegDimensions(bytes), [256, 256]);
    sizes.push(bytes.length);
    hashes.add(createHash('sha256').update(bytes).digest('hex'));
  }
  assert.equal(hashes.size, 100);
  assert.ok(sizes.sort((a, b) => b - a).slice(0, 9).reduce((sum, size) => sum + size, 0) < 350000);
});

test('all referenced image files exist and have the expected file signatures', async () => {
  for (const src of new Set(imageLibrary.map(image => image.src))) {
    const url = new URL(`../${src}`, import.meta.url);
    assert.ok((await stat(url)).size > 1000);
    const buffer = await readFile(url);
    if (src.endsWith('.jpg')) assert.equal(buffer.subarray(0, 2).toString('hex'), 'ffd8');
    else assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});

test('fresh challenges have nine distinct subjects and an undisclosed mix of three to six photographs', () => {
  const keys = new Set();
  const counts = new Set();
  const seen = new Set();
  for (let seed = 0; seed < 1000; seed += 1) {
    const challenge = createChallenge(imageLibrary, seededRandom(seed));
    assert.equal(challenge.length, GRID_SIZE);
    assert.equal(new Set(challenge.map(image => image.id)).size, GRID_SIZE);
    assert.equal(new Set(challenge.map(image => image.subject)).size, GRID_SIZE);
    const count = challenge.filter(image => image.human).length;
    assert.ok(count >= 3 && count <= 6);
    counts.add(count);
    keys.add(challengeKey(challenge));
    challenge.forEach(image => seen.add(image.id));
  }
  assert.equal(counts.size, 4);
  assert.ok(keys.size > 990);
  assert.equal(seen.size, 100);
});

test('repeated random draws cannot repeat the preceding challenge set', () => {
  for (const constant of [0, .3, .6, .999999]) {
    const random = () => constant;
    const first = createChallenge(imageLibrary, random);
    const next = createChallenge(imageLibrary, random, challengeKey(first));
    assert.notEqual(challengeKey(first), challengeKey(next));
    assert.equal(new Set(next.map(image => image.subject)).size, GRID_SIZE);
    const humanCount = next.filter(image => image.human).length;
    assert.ok(humanCount >= 3 && humanCount <= 6);
  }
});

test('only the complete photograph selection passes, regardless of click order', () => {
  const challenge = createChallenge(imageLibrary, seededRandom(17));
  const correct = challenge.filter(image => image.human).map(image => image.id);
  assert.equal(verifySelection(challenge, correct), true);
  assert.equal(verifySelection(challenge, [...correct].reverse()), true);
  assert.equal(verifySelection(challenge, []), false);
  assert.equal(verifySelection(challenge, challenge.map(image => image.id)), false);
  assert.equal(verifySelection(challenge, correct.slice(1)), false);
  assert.equal(verifySelection(challenge, [...correct, challenge.find(image => !image.human).id]), false);
  assert.equal(verifySelection(challenge, [...correct.slice(1), 'unknown']), false);
});

test('invalid libraries and incomplete challenges cannot silently yield a verdict', () => {
  assert.throws(() => validateLibrary([]), /nine complete/);
  assert.throws(() => validateLibrary([...imageLibrary, imageLibrary[0]]), /unique ID/);
  assert.throws(() => validateLibrary(imageLibrary.slice(1)), /one photograph/);
  assert.throws(() => validateLibrary(imageLibrary.map((image, i) => i === 0 ? { ...image, human: undefined } : image)), /verified origin/);
  assert.throws(() => verifySelection([], []), /nine distinct/);
  assert.throws(() => verifySelection(Array(9).fill(imageLibrary[0]), []), /nine distinct/);
});
