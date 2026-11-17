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

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Pre-build validation: the dossier shows exactly these four screenshots,
// in this order, and the gate refuses any shot over 256 KiB — so fail fast
// here with the file's name instead of shipping a rejected bundle.
const EXPECTED_SHOTS = ['shot1-chase.png', 'shot2-drive.png', 'shot3-mission.png', 'shot4-menu.jpg'];
const MAX_SHOT_BYTES = 262144;
for (const shot of EXPECTED_SHOTS) {
  const shotPath = join(here, 'screenshots', shot);
  if (!existsSync(shotPath)) {
    throw new Error('missing screenshot: ' + shot + ' (expected at ' + shotPath + ')');
  }
  const size = statSync(shotPath).size;
  if (size > MAX_SHOT_BYTES) {
    throw new Error('screenshot over 256 KiB: ' + shot + ' is ' + size + ' bytes (max ' + MAX_SHOT_BYTES + ')');
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
