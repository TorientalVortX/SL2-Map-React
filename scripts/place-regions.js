/*
Makes a first guess at where each region image belongs by matching a thumbnail
of it against map-source/reference.webp (the previous world map at 1/16 scale).
Writes map-source/layout.json; refine it in the dev arranger (npm run dev, then ?arrange).

Well-matched 4800px blocks snap to the block grid detected from the matches; everything
else snaps to the 48px cell grid and is flagged for review. Overlapping files that share a
BTT number (e.g. BTT17C 42024 / BTT17C 5282026) are treated as versions: only the newest is enabled.

The reference is built from map-source/tiles the first time this runs, so run it
before compose-regions replaces those tiles.

Usage: node scripts/place-regions.js [--all]   (--all re-guesses regions already in the layout)
*/

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  LAYOUT_FILE, REFERENCE_FILE, REFERENCE_SCALE, REGIONS_DIR, REGION_LIST_FILE, SOURCE_TILES_DIR, SUBFOLDER_SIZE, TILE_SIZE,
  listRegionFiles, readJson, writeJson,
} from './regionLayout.js';

const MATCH_SCALE = 32;
const STEP = TILE_SIZE / MATCH_SCALE;
const REFINE_CANDIDATES = 5;
const BLOCK_SIZE = 4800;
const CELL_SIZE = 48;
const GOOD_MATCH = 25;
const REVIEW_SCORE = 30;
const GRID_VOTE_TOLERANCE = 64;
const SNAP_TOLERANCE = 240;
const redoAll = process.argv.includes('--all');

async function buildReference() {
  const cell = TILE_SIZE / REFERENCE_SCALE;
  const parts = [];
  let cols = 0;
  let rows = 0;
  for (const folder of fs.readdirSync(SOURCE_TILES_DIR)) {
    const block = /^subfolder_(\d+)_(\d+)$/.exec(folder);
    if (!block) continue;
    for (const file of fs.readdirSync(path.join(SOURCE_TILES_DIR, folder))) {
      const tile = /^tile_(\d+)_(\d+)\./.exec(file);
      if (!tile) continue;
      const row = Number(block[1]) * SUBFOLDER_SIZE + Number(tile[1]);
      const col = Number(block[2]) * SUBFOLDER_SIZE + Number(tile[2]);
      rows = Math.max(rows, row + 1);
      cols = Math.max(cols, col + 1);
      parts.push({ input: await sharp(path.join(SOURCE_TILES_DIR, folder, file)).resize(cell, cell).toBuffer(), left: col * cell, top: row * cell });
    }
  }
  await sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: '#000' } })
    .composite(parts)
    .webp({ quality: 80 })
    .toFile(REFERENCE_FILE);
  console.log(`Wrote ${REFERENCE_FILE} (${cols}x${rows} tiles at 1/${REFERENCE_SCALE}).`);
}

async function loadRgba(input, width, height) {
  return sharp(input).ensureAlpha().resize(width, height, { fit: 'fill' }).raw().toBuffer();
}

function scoreAt(reference, refWidth, region, width, height, left, top) {
  let total = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    let r = y * width * 4;
    let f = ((top + y) * refWidth + left) * 4;
    for (let x = 0; x < width; x++, r += 4, f += 4) {
      if (region[r + 3] < 128) continue;
      total += Math.abs(region[r] - reference[f]) + Math.abs(region[r + 1] - reference[f + 1]) + Math.abs(region[r + 2] - reference[f + 2]);
      count++;
    }
  }
  return count ? total / (count * 3) : Infinity;
}

function bestPlacement(reference, refWidth, refHeight, region, width, height) {
  const candidates = [];
  for (let top = 0; top + height <= refHeight; top += STEP) {
    for (let left = 0; left + width <= refWidth; left += STEP) {
      candidates.push({ left, top, score: scoreAt(reference, refWidth, region, width, height, left, top) });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  let best = candidates[0] ?? { left: 0, top: 0, score: Infinity };
  for (const candidate of candidates.slice(0, REFINE_CANDIDATES)) {
    for (let top = Math.max(0, candidate.top - STEP); top <= Math.min(refHeight - height, candidate.top + STEP); top++) {
      for (let left = Math.max(0, candidate.left - STEP); left <= Math.min(refWidth - width, candidate.left + STEP); left++) {
        const score = scoreAt(reference, refWidth, region, width, height, left, top);
        if (score < best.score) best = { left, top, score };
      }
    }
  }
  return { x: best.left * MATCH_SCALE, y: best.top * MATCH_SCALE, score: best.score };
}

const circularDistance = (value, origin) => {
  const d = (((value - origin) % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE;
  return Math.min(d, BLOCK_SIZE - d);
};

const isBlock = (region) => Math.abs(region.width - BLOCK_SIZE) <= 16 && Math.abs(region.height - BLOCK_SIZE) <= 16;

function bestOrigin(values) {
  let best = { origin: 0, votes: -1, spread: Infinity };
  for (let origin = 0; origin < BLOCK_SIZE; origin += CELL_SIZE) {
    const near = values.map((value) => circularDistance(value, origin)).filter((d) => d <= GRID_VOTE_TOLERANCE);
    const spread = near.reduce((sum, d) => sum + d, 0);
    if (near.length > best.votes || (near.length === best.votes && spread < best.spread)) best = { origin, votes: near.length, spread };
  }
  return best.origin;
}

function detectBlockGrid(regions) {
  const blocks = regions.filter((region) => isBlock(region) && region.matchScore <= GOOD_MATCH);
  return {
    block: BLOCK_SIZE,
    cell: CELL_SIZE,
    originX: bestOrigin(blocks.map((region) => region.x)),
    originY: bestOrigin(blocks.map((region) => region.y)),
  };
}

function snapRegion(region, grid) {
  const toCell = (value) => Math.max(0, Math.round(value / grid.cell) * grid.cell);
  const toBlock = (value, origin) => Math.max(0, origin + Math.round((value - origin) / grid.block) * grid.block);
  const onGrid = isBlock(region)
    && circularDistance(region.x, grid.originX) <= SNAP_TOLERANCE
    && circularDistance(region.y, grid.originY) <= SNAP_TOLERANCE;
  region.x = onGrid ? toBlock(region.x, grid.originX) : toCell(region.x);
  region.y = onGrid ? toBlock(region.y, grid.originY) : toCell(region.y);
  region.review = !onGrid || region.matchScore > REVIEW_SCORE;
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function versionGroup(file) {
  const match = /^BTT[A-Z]*\s*(\d+)([a-z]*)/.exec(file);
  return match ? `${match[1]}${match[2]}` : file;
}

async function main() {
  if (!fs.existsSync(REFERENCE_FILE)) await buildReference();
  const refMeta = await sharp(REFERENCE_FILE).metadata();
  const refWidth = Math.round((refMeta.width * REFERENCE_SCALE) / MATCH_SCALE);
  const refHeight = Math.round((refMeta.height * REFERENCE_SCALE) / MATCH_SCALE);
  const reference = await loadRgba(REFERENCE_FILE, refWidth, refHeight);

  const modifiedByName = new Map(readJson(REGION_LIST_FILE, []).map((entry) => [entry.name, entry.modified]));
  const layout = readJson(LAYOUT_FILE, { regions: [] });
  const placed = new Map(layout.regions.map((region) => [region.file, region]));
  layout.reference = { file: 'reference.webp', scale: REFERENCE_SCALE, width: refMeta.width * REFERENCE_SCALE, height: refMeta.height * REFERENCE_SCALE };

  for (const file of listRegionFiles()) {
    const meta = await sharp(path.join(REGIONS_DIR, file)).metadata();
    if (placed.has(file) && !redoAll) {
      placed.set(file, { ...placed.get(file), width: meta.width, height: meta.height });
      continue;
    }
    const width = Math.max(1, Math.round(meta.width / MATCH_SCALE));
    const height = Math.max(1, Math.round(meta.height / MATCH_SCALE));
    const region = await loadRgba(path.join(REGIONS_DIR, file), width, height);
    const guess = bestPlacement(reference, refWidth, refHeight, region, width, height);
    const entry = { file, x: guess.x, y: guess.y, width: meta.width, height: meta.height, enabled: true, matchScore: Number(guess.score.toFixed(1)), modified: modifiedByName.get(file) ?? null };
    placed.set(file, { ...placed.get(file), ...entry });
    console.log(`${file}: (${guess.x}, ${guess.y}) score ${entry.matchScore}`);
  }

  const regions = [...placed.values()].sort((a, b) => (a.modified ?? '').localeCompare(b.modified ?? '') || (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const guessed = new Set(regions.filter((region) => redoAll || !layout.regions.some((existing) => existing.file === region.file)).map((region) => region.file));
  layout.grid ??= detectBlockGrid(regions);
  for (const region of regions) {
    if (guessed.has(region.file)) snapRegion(region, layout.grid);
  }
  for (const region of regions) {
    if (!guessed.has(region.file)) continue;
    const group = versionGroup(region.file);
    region.enabled = !regions.some((other) => other !== region
      && versionGroup(other.file) === group
      && regions.indexOf(other) > regions.indexOf(region)
      && overlaps(region, other));
  }
  layout.regions = regions.map(({ width, height, ...region }) => region);
  console.log(`Block grid: ${layout.grid.block}px from (${layout.grid.originX}, ${layout.grid.originY}).`);
  writeJson(LAYOUT_FILE, layout);
  console.log(`Wrote ${LAYOUT_FILE} with ${regions.length} regions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
