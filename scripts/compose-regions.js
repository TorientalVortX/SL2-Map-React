/*
Replaces map-source/tiles with 800x800 tiles composed from the enabled regions in
map-source/layout.json. Regions may sit at any pixel position and be any size;
later regions in the layout are drawn on top, respecting transparency.
Works one 800px row at a time so only a strip of each region is in memory.
Fully black tiles are not written. Run `npm run tiles` afterwards (dev and build do it automatically).

Usage: node scripts/compose-regions.js [--quality 85] [--out <dir>]   (--out writes elsewhere, e.g. to preview)
*/

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { LAYOUT_FILE, REGIONS_DIR, SOURCE_TILES_DIR, SUBFOLDER_SIZE, TILE_SIZE, readJson, validateLayout } from './regionLayout.js';

const BLANK_MAX_CHANNEL = 8;
const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const quality = Number(argValue('--quality') ?? 85);
const outDir = argValue('--out') ?? SOURCE_TILES_DIR;

sharp.cache(false);

function tileFile(dir, row, col) {
  const subfolder = `subfolder_${Math.floor(row / SUBFOLDER_SIZE)}_${Math.floor(col / SUBFOLDER_SIZE)}`;
  return path.join(dir, subfolder, `tile_${row % SUBFOLDER_SIZE}_${col % SUBFOLDER_SIZE}.webp`);
}

function isBlank(raw) {
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] > BLANK_MAX_CHANNEL) return false;
  }
  return true;
}

async function readStrip(region, bandTop) {
  const top = Math.max(0, bandTop - region.y);
  const bottom = Math.min(region.height, bandTop + TILE_SIZE - region.y);
  const { data, info } = await sharp(path.join(REGIONS_DIR, region.file), { limitInputPixels: false })
    .extract({ left: 0, top, width: region.width, height: bottom - top })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { region, data, info, offsetY: region.y + top - bandTop };
}

async function composeTile(strips, col) {
  const tileLeft = col * TILE_SIZE;
  const layers = [];
  for (const strip of strips) {
    const left = Math.max(tileLeft, strip.region.x);
    const right = Math.min(tileLeft + TILE_SIZE, strip.region.x + strip.region.width);
    if (left >= right) continue;
    const input = await sharp(strip.data, { raw: { width: strip.info.width, height: strip.info.height, channels: 4 } })
      .extract({ left: left - strip.region.x, top: 0, width: right - left, height: strip.info.height })
      .raw()
      .toBuffer();
    layers.push({ input, raw: { width: right - left, height: strip.info.height, channels: 4 }, left: left - tileLeft, top: strip.offsetY });
  }
  if (!layers.length) return null;
  const raw = await sharp({ create: { width: TILE_SIZE, height: TILE_SIZE, channels: 3, background: '#000' } })
    .composite(layers)
    .removeAlpha()
    .raw()
    .toBuffer();
  return isBlank(raw) ? null : raw;
}

async function main() {
  const layout = validateLayout(readJson(LAYOUT_FILE, null));
  const regions = layout.regions.filter((region) => region.enabled);
  if (!regions.length) throw new Error('No enabled regions in the layout.');
  for (const region of regions) {
    const meta = await sharp(path.join(REGIONS_DIR, region.file)).metadata();
    region.width = meta.width;
    region.height = meta.height;
  }
  const cols = Math.ceil(Math.max(...regions.map((region) => region.x + region.width)) / TILE_SIZE);
  const rows = Math.ceil(Math.max(...regions.map((region) => region.y + region.height)) / TILE_SIZE);

  const staging = `${outDir}.staging`;
  fs.rmSync(staging, { recursive: true, force: true });
  let written = 0;
  for (let row = 0; row < rows; row++) {
    const bandTop = row * TILE_SIZE;
    const inBand = regions.filter((region) => region.y < bandTop + TILE_SIZE && region.y + region.height > bandTop);
    const strips = await Promise.all(inBand.map((region) => readStrip(region, bandTop)));
    for (let col = 0; col < cols; col++) {
      const raw = await composeTile(strips, col);
      if (!raw) continue;
      const file = tileFile(staging, row, col);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await sharp(raw, { raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 3 } }).webp({ quality, effort: 4 }).toFile(file);
      written++;
    }
    process.stdout.write(`\rRow ${row + 1}/${rows}`);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.renameSync(staging, outDir);
  console.log(`\nWrote ${written} source tiles (${cols}x${rows} grid) from ${regions.length} regions to ${outDir}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
