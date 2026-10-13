import { imageLibrary } from './assets.js';
import { challengeKey, createChallenge, verifySelection } from './game.js';

const card = document.querySelector('.captcha');
const grid = document.querySelector('.grid');
const verify = document.querySelector('.verify');
const notice = document.querySelector('.notice');
const verdict = document.querySelector('.verdict');
const result = document.querySelector('#result');
const selection = new Set();
const buttons = [];
let phase = 'loading';

function readPreviousKey() {
  try { return sessionStorage.getItem('capthca.previous') ?? ''; }
  catch { return ''; }
}

function savePreviousKey(key) {
  try { sessionStorage.setItem('capthca.previous', key); }
  catch { /* Storage is optional; blocked storage must not block play. */ }
}

const challenge = createChallenge(imageLibrary, Math.random, readPreviousKey());
const sources = new Map();

function loadSource(src) {
  if (!sources.has(src)) {
    sources.set(src, new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => reject(new Error(`Image load timed out: ${src}`)), 12000);
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); reject(new Error(`Image failed to load: ${src}`)); };
      image.src = src;
    }));
  }
  return sources.get(src);
}

// Give every tile the same dimensions and JPEG treatment, regardless of origin.
function tileImage(source, cell) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image rendering is unavailable.');
  const width = source.naturalWidth / (cell?.columns ?? 1);
  const height = source.naturalHeight / (cell?.rows ?? 1);
  // Trim the same small edge from every source, including atlas cell seams.
  const inset = 2;
  context.drawImage(source, (cell?.column ?? 0) * width + inset, (cell?.row ?? 0) * height + inset, width - inset * 2, height - inset * 2, 0, 0, 256, 256);
  return canvas.toDataURL('image/jpeg', .82);
}

const loads = challenge.map((image, index) => {
  const button = document.createElement('button');
  button.className = 'tile';
  button.type = 'button';
  button.disabled = true;
  button.setAttribute('aria-label', `Image ${index + 1}: ${image.description}`);
  button.setAttribute('aria-pressed', 'false');
  const picture = document.createElement('img');
  picture.className = 'picture';
  picture.alt = '';
  picture.draggable = false;
  const checkmark = document.createElement('span');
  checkmark.className = 'checkmark';
  checkmark.setAttribute('aria-hidden', 'true');
  checkmark.innerHTML = '<svg viewBox="0 0 18 18"><path d="m3 9 4 4 8-8"/></svg>';
  button.append(picture, checkmark);
  grid.append(button);
  buttons.push(button);

  button.addEventListener('click', () => {
    if (phase !== 'selecting') return;
    if (selection.has(image.id)) selection.delete(image.id);
    else selection.add(image.id);
    button.setAttribute('aria-pressed', String(selection.has(image.id)));
  });

  return loadSource(image.src).then(async source => {
    picture.src = tileImage(source, image.cell);
    await picture.decode();
  });
});

Promise.all(loads).then(() => {
  phase = 'selecting';
  grid.classList.add('ready');
  grid.setAttribute('aria-busy', 'false');
  buttons.forEach(button => { button.disabled = false; });
  verify.disabled = false;
  notice.textContent = '';
  savePreviousKey(challengeKey(challenge));
}).catch(error => {
  phase = 'error';
  grid.setAttribute('aria-busy', 'false');
  notice.classList.add('error');
  notice.textContent = 'The images could not be loaded. Reload the page to try again.';
  console.error(error);
});

verify.addEventListener('click', () => {
  if (phase !== 'selecting') return;
  phase = 'verifying';
  verify.disabled = true;
  verify.textContent = 'Verifying…';
  card.setAttribute('aria-busy', 'true');
  buttons.forEach(button => { button.disabled = true; });
  const passed = verifySelection(challenge, selection);
  setTimeout(() => {
    phase = 'finished';
    result.textContent = passed ? 'Yes, you are human.' : 'No, you’re not human.';
    card.hidden = true;
    verdict.hidden = false;
    result.focus();
  }, 700);
});
