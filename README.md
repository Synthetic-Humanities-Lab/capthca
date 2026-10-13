# CAPTHCA

A one-shot image game from the [Synthetic Humanities Lab](https://github.com/Synthetic-Humanities-Lab).

**[Play CAPTHCA](https://synthetic-humanities-lab.github.io/capthca/)**

Select every image that is not AI-generated, then press Verify. A completely correct selection produces “Yes, you are human.” Any mistake produces “No, you’re not human.” The verdict ends the game. Reloading starts a new challenge.

There are no levels, scores, hints, or answer reveals. The test asks you to recognize machine output, then treats your answer as evidence of what you are.

## Run locally

Requires Python 3 for the local server and Node 18 or newer for checks and packaging. CI uses Node 22. No dependencies need to be installed.

```sh
git clone https://github.com/Synthetic-Humanities-Lab/capthca.git
cd capthca
npm start
```

Open <http://127.0.0.1:4177>.

```sh
npm run check
npm test
npm run build
```

The build writes only the game and its referenced images to `dist/`. GitHub Actions checks each push and pull request, then deploys successful `main` builds to GitHub Pages.

## Images and rules

The library has **100 images: 50 photographs and 50 generated images**, organized into 50 matched subjects. Every challenge selects nine different subjects, with three to six photographs. The count is not disclosed. A photograph and its generated counterpart never appear in the same challenge.

All source images receive the same two-pixel edge trim and are rasterized to 256-pixel square JPEGs at identical quality in the browser. The generated atlases are stored as compressed JPEGs to keep downloads small. Photographs and generated images share subject descriptions; neither visible text nor accessible names reveal origin.

The previous challenge's sorted IDs are stored in sessionStorage to avoid an identical set on the next reload. Nothing is transmitted. If storage is blocked, play still works, but the no-repeat guarantee is unavailable. The library is finite: combinations vary, and individual images recur.

Difficulty comes from matched subject matter, small images, and an all-or-nothing decision. The answer key is deterministic. It does not secretly change or reject a correct answer. Difficulty has not been calibrated through a human play study. This is an artwork, not an authentication service; the answer key remains inspectable in its source.

## Sources and attribution

**Photographs:** 50 attributed Unsplash images, retrieved through the stable Picsum IDs recorded in [`sources/photographs.json`](sources/photographs.json). Each record includes the photographer, original photo URL, license link, retrieval date, and SHA-256 of the shipped image. See the [Unsplash license](https://unsplash.com/license). Source-image rights remain governed by their respective terms; this project does not relicense those images.

Origin labels follow the source library's photographic attribution, not an AI detector. Original Unsplash pages returned HTTP 401 during the initial build, so individual publication dates were not independently recovered. A [Wikimedia record for image 10](https://commons.wikimedia.org/wiki/File:Forest%26lake%28byPJrvs%29.jpg) independently documents that same source photo in 2014. Photographic origin does not mean an image has never been color-corrected or edited.

**Generated images:** 50 cells across four atlases, made for this project with the built-in image generation tool. [`sources/generation.json`](sources/generation.json) records the full prompts, atlas dimensions, cell counts, and original and published hashes. Subjects include landscapes, everyday objects, interiors, street scenes, animals, and close-ups. Original PNG outputs are retained locally; the published repository contains the compressed game assets and generation records.

## Implementation

- `game.js`: library validation, sampling, and exact-match grading.
- `assets.js`: image definitions and their origin labels.
- `app.js`: loading, selection, one-way submission, and focus.
- `style.css`: the deliberately ordinary CAPTCHA interface.
- `scripts/build.js`: an explicit allowlist of deployable files.
- `tests/game.test.js`: balance, provenance, file integrity, sampling, and verdict checks.

All nine images must load and decode before selection or verification is enabled. A broken asset produces an explicit loading error, never a verdict. Native buttons support pointer, touch, Tab, Space, and Enter. Motion respects the system reduced-motion setting. The image descriptions name subjects without revealing origin; the game still depends on visual discrimination.

No accounts, analytics, runtime model calls, or third-party asset requests are used during play.
