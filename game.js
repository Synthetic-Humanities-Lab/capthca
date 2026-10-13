export const GRID_SIZE = 9;

export function validateLibrary(library) {
  if (!Array.isArray(library) || library.length < GRID_SIZE * 2) {
    throw new Error('The image library needs at least nine complete subject pairs.');
  }
  const ids = new Set();
  const subjects = new Map();
  for (const image of library) {
    if (!image.id || ids.has(image.id) || typeof image.human !== 'boolean' || !image.subject || !image.src) {
      throw new Error('Every image needs a unique ID, subject, source, and verified origin.');
    }
    ids.add(image.id);
    const pair = subjects.get(image.subject) ?? [];
    pair.push(image);
    subjects.set(image.subject, pair);
  }
  for (const pair of subjects.values()) {
    if (pair.length !== 2 || pair[0].human === pair[1].human) {
      throw new Error('Each subject needs one photograph and one generated image.');
    }
  }
  return subjects;
}

function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function challengeKey(challenge) {
  return challenge.map(image => image.id).sort().join(',');
}

export function createChallenge(library, random = Math.random, previousKey = '') {
  const subjects = validateLibrary(library);
  const sample = shuffled([...subjects.keys()], random).slice(0, GRID_SIZE);
  const humanCount = 3 + Math.floor(random() * 4);
  const challenge = sample.map((subject, index) => (
    subjects.get(subject).find(image => image.human === (index < humanCount))
  ));

  // Even a repeated random draw must produce a different set on the next visit.
  if (challengeKey(challenge) === previousKey) {
    const index = humanCount === 6 ? 0 : humanCount;
    const previous = challenge[index];
    challenge[index] = subjects.get(previous.subject).find(image => image.human !== previous.human);
  }
  return shuffled(challenge, random);
}

export function verifySelection(challenge, selection) {
  if (challenge.length !== GRID_SIZE || new Set(challenge.map(image => image.id)).size !== GRID_SIZE) {
    throw new Error('A verification requires nine distinct images.');
  }
  const selected = new Set(selection);
  const expected = challenge.filter(image => image.human).map(image => image.id);
  return selected.size === expected.length && expected.every(id => selected.has(id));
}
