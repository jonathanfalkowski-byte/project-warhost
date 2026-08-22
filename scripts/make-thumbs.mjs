// Derivatives of the render art, at the size the screen actually draws it.
//
// public/assets holds isometric renders at around three megabytes each. They are dossier
// art — good ones — and nothing that appears on a hover can afford to be three megabytes.
// This writes a small webp beside each of them, and the card reads those.
//
// Run it when the art changes: `npm run thumbs`. The output is committed rather than built
// on demand, because the deploy worker serves public/ as it finds it and a card that waits
// for a resize is a card that flickers.
//
// The width and the format come from src/battle/formationArt.js, which is also what the
// screen imports, so there is exactly one statement of what these files are for.

import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { THUMB_FORMAT, THUMB_QUALITY, THUMB_WIDTH } from "../src/battle/formationArt.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public", "assets");
const OUT = path.join(SOURCE, "thumbs");

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

await mkdir(OUT, { recursive: true });

// The list is whatever is in that one directory, filtered to PNGs. Nothing here reads an
// argument or an environment variable: a script that resizes what it is told to resize is a
// script that can be told to write somewhere else.
const files = (await readdir(SOURCE, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
  .map((entry) => entry.name)
  .sort();

if (files.length === 0) {
  console.error(`no .png art in ${path.relative(ROOT, SOURCE)}`);
  process.exit(1);
}

let before = 0;
let after = 0;

for (const file of files) {
  const from = path.join(SOURCE, file);
  const to = path.join(OUT, `${path.basename(file, ".png")}.${THUMB_FORMAT}`);
  const source = await stat(from);

  await sharp(from)
    // Never upscale: a source narrower than the target is already the right size, and
    // stretching it would spend bytes making it worse.
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .toFormat(THUMB_FORMAT, { quality: THUMB_QUALITY })
    .toFile(to);

  const result = await stat(to);
  before += source.size;
  after += result.size;
  console.log(`  ${file.padEnd(34)} ${kb(source.size).padStart(9)} -> ${kb(result.size).padStart(7)}`);
}

console.log(`\n${files.length} files at ${THUMB_WIDTH}px ${THUMB_FORMAT}: ${kb(before)} -> ${kb(after)}`);
console.log(`written to ${path.relative(ROOT, OUT)}`);
