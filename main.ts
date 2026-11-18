// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// ---- image-size readers (stdlib only): PNG dimensions live in the IHDR
// chunk (width/height as big-endian uint32 at bytes 16..23), JPEG
// dimensions in the first SOF0/SOF2 frame marker. Returns null when the
// file is neither (the gate only accepts PNG/JPEG screenshots anyway).
function readPngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function readJpegSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // SOF0 (baseline) and SOF2 (progressive) carry the frame size
    if (marker === 0xc0 || marker === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}
function readImageSize(path: string): { w: number; h: number; format: string } | null {
  const buf = readFileSync(path);
  const png = readPngSize(buf);
  if (png) return { ...png, format: 'PNG' };
  const jpg = readJpegSize(buf);
  if (jpg) return { ...jpg, format: 'JPEG' };
  return null;
}

// Pre-build validation: the dossier shows exactly these four screenshots,
// in this order, and the gate refuses any shot over 256 KiB — so fail fast
// here with the file's name instead of shipping a rejected bundle.
const EXPECTED_SHOTS = ['shot1-chase.png', 'shot2-drive.png', 'shot3-mission.png', 'shot4-menu.jpg'];
const MAX_SHOT_BYTES = 262144;
// Gate caps for a single screenshot (RULES.txt): long side at most 1280,
// short side at least 480 — a 4K render or a tiny thumbnail is refused.
const MAX_SHOT_LONG_SIDE = 1280;
const MIN_SHOT_SHORT_SIDE = 480;
for (const shot of EXPECTED_SHOTS) {
  const shotPath = join(here, 'screenshots', shot);
  if (!existsSync(shotPath)) {
    throw new Error('missing screenshot: ' + shot + ' (expected at ' + shotPath + ')');
  }
  const size = statSync(shotPath).size;
  if (size > MAX_SHOT_BYTES) {
    throw new Error('screenshot over 256 KiB: ' + shot + ' is ' + size + ' bytes (max ' + MAX_SHOT_BYTES + ')');
  }
  const dims = readImageSize(shotPath);
  if (!dims) {
    throw new Error('screenshot is not a readable PNG or JPEG: ' + shot);
  }
  const longSide = Math.max(dims.w, dims.h);
  const shortSide = Math.min(dims.w, dims.h);
  if (longSide > MAX_SHOT_LONG_SIDE) {
    throw new Error('screenshot too large: ' + shot + ' is ' + dims.w + 'x' + dims.h + ' (long side max ' + MAX_SHOT_LONG_SIDE + ')');
  }
  if (shortSide < MIN_SHOT_SHORT_SIDE) {
    throw new Error('screenshot too small: ' + shot + ' is ' + dims.w + 'x' + dims.h + ' (short side min ' + MIN_SHOT_SHORT_SIDE + ')');
  }
  console.log('  shot OK: ' + shot + ' (' + dims.format + ' ' + dims.w + 'x' + dims.h + ', ' + size + ' bytes)');
}

// The dossier's shots must also exist as the in-game copies under
// game/screenshots/ — the menu screen shows them, so a missing or stale
// copy would leave the gallery blank even though the dossier is fine.
for (const shot of EXPECTED_SHOTS) {
  const inGame = join(here, 'game', 'screenshots', shot);
  if (!existsSync(inGame)) {
    throw new Error('missing in-game screenshot: ' + shot + ' (expected at ' + inGame + ')');
  }
  if (statSync(inGame).size !== statSync(join(here, 'screenshots', shot)).size) {
    throw new Error('in-game screenshot differs from the dossier copy: ' + shot + ' (re-take both from the same render)');
  }
}

// The game/ tree must hold the full entry: the page, the vendored engine
// and every system module. A missing module fails silently in the browser
// (a script tag 404s and the game never boots), so refuse here instead.
const EXPECTED_GAME_FILES = [
  'game/index.html',
  'game/vendor/three.min.js',
  'game/js/main.js', 'game/js/world.js', 'game/js/player.js',
  'game/js/vehicle.js', 'game/js/camera.js', 'game/js/traffic.js',
  'game/js/police.js', 'game/js/missions.js', 'game/js/combat.js',
  'game/js/hud.js', 'game/js/audio.js', 'game/js/input.js',
  'game/js/utils.js',
];
for (const rel of EXPECTED_GAME_FILES) {
  const p = join(here, rel);
  if (!existsSync(p)) {
    throw new Error('missing game file: ' + rel + ' (expected at ' + p + ')');
  }
  if (statSync(p).size === 0) {
    throw new Error('empty game file: ' + rel + ' — a zero-byte module never boots');
  }
}
// index.html is the boot page: it must load the vendored engine and every
// module above, or the browser silently runs half a game.
const indexHtml = readFileSync(join(here, 'game/index.html'), 'utf8');
for (const rel of EXPECTED_GAME_FILES) {
  if (rel === 'game/index.html') continue; // the boot page cannot reference itself
  const tag = rel.replace(/^game\//, '');
  if (!indexHtml.includes(tag)) {
    throw new Error('game/index.html does not reference ' + tag + ' — the page would boot without it');
  }
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Build summary: what the grader will see, in one place.
function countTree(dir) {
  let files = 0, bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) { const sub = countTree(p); files += sub.files; bytes += sub.bytes; }
    else if (entry.isFile()) { files += 1; bytes += statSync(p).size; }
  }
  return { files, bytes };
}
const gameStats = countTree(join(out, 'game'));
const shotStats = countTree(join(out, 'screenshots'));
const dossierBytes = statSync(dossierPath).size;
console.log('Solmaris Bay build OK');
console.log('  game/: ' + gameStats.files + ' files, ' + gameStats.bytes + ' bytes');
console.log('  screenshots/: ' + shotStats.files + ' files (' + EXPECTED_SHOTS.join(', ') + '), ' + shotStats.bytes + ' bytes');
console.log('  dossier.json: ' + dossierBytes + ' bytes -> ' + out);

// Stage 8 guards: the dossier text is capped at text_max_bytes, and the
// builder truncates it silently — so warn while there is still headroom,
// and refuse outright if the game/ tree is about to hit a gate cap.
const dossierJson = JSON.parse(readFileSync(dossierPath, 'utf8'));
const dossierTextBytes = Buffer.byteLength(dossierJson.text ?? '', 'utf8');
console.log('  dossier text: ' + dossierTextBytes + ' bytes (cap 163840)');
const dossierHeadroom = 163840 - dossierTextBytes;
console.log('  dossier text headroom: ' + dossierHeadroom + ' bytes before the cap cuts the text');
if (dossierTextBytes > 163840 * 0.99) {
  console.log('  WARNING: dossier text is within 1% of the 163840 cap — the next addition will be cut from the text');
}
if (gameStats.files > 900) {
  console.log('  WARNING: game/ holds ' + gameStats.files + ' files (gate cap 993)');
}
if (gameStats.bytes > 50331648 * 0.9) {
  console.log('  WARNING: game/ is ' + gameStats.bytes + ' bytes (gate cap 50331648)');
}
if (shotStats.files !== 4) {
  throw new Error('expected exactly 4 screenshots in /output, found ' + shotStats.files);
}

// Post-build hard guards: the warnings above are advice, these are the
// gate's actual caps — a build that crosses one is refused here, not by
// the scorer after the submit. (The copy + buildDossier calls above are
// untouched; these checks only read what they produced.)
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const DOSSIER_MAX_BYTES = 1572864; // 1.5 MiB dossier cap
if (gameStats.files > GAME_MAX_FILES) {
  throw new Error('game/ holds ' + gameStats.files + ' files (gate cap ' + GAME_MAX_FILES + ')');
}
if (gameStats.bytes > GAME_MAX_BYTES) {
  throw new Error('game/ is ' + gameStats.bytes + ' bytes (gate cap ' + GAME_MAX_BYTES + ')');
}
if (dossierBytes > DOSSIER_MAX_BYTES) {
  throw new Error('dossier.json is ' + dossierBytes + ' bytes (cap ' + DOSSIER_MAX_BYTES + ')');
}
if (dossierTextBytes > 163840) {
  // buildDossier truncates the text to the cap itself, so reaching this
  // means the truncation measured differently than this check — warn
  // loudly rather than refusing a build the scorer would accept.
  console.log('  WARNING: dossier text is ' + dossierTextBytes + ' bytes (cap 163840) — the builder truncated it, verify the cut');
}
// The dossier must show exactly the four validated screenshots, in the
// same order they were checked above — a mismatch means the copy step
// shipped a different set than the one that passed validation.
const dossierImages = (dossierJson as any).images;
if (!Array.isArray(dossierImages) || dossierImages.length !== EXPECTED_SHOTS.length) {
  throw new Error('dossier images mismatch: expected ' + EXPECTED_SHOTS.length + ' images, found ' + (Array.isArray(dossierImages) ? dossierImages.length : 'none'));
}
for (let i = 0; i < EXPECTED_SHOTS.length; i++) {
  const name = typeof dossierImages[i] === 'string' ? dossierImages[i] : dossierImages[i]?.name ?? dossierImages[i]?.file ?? '';
  if (!String(name).endsWith(EXPECTED_SHOTS[i])) {
    throw new Error('dossier image #' + (i + 1) + ' is "' + name + '", expected "' + EXPECTED_SHOTS[i] + '" in that position');
  }
}
console.log('  dossier images: ' + EXPECTED_SHOTS.join(', ') + ' (in order)');
console.log('  dossier.json: ' + dossierBytes + ' bytes (cap ' + DOSSIER_MAX_BYTES + ') — OK');
console.log('  all validations passed');
