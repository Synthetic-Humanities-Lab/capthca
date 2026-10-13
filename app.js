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

function loadPicture(picture, src) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Image load timed out: ${src}`)), 20000);
    picture.onload = async () => {
      try { await picture.decode(); resolve(); }
      catch { reject(new Error(`Image failed to decode: ${src}`)); }
      finally { clearTimeout(timer); }
    };
    picture.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Image failed to load: ${src}`));
    };
    picture.src = src;
  });
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

  return loadPicture(picture, image.src);
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
