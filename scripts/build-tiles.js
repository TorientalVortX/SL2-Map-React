/*
Builds the zoom pyramid served to the browser from the sliced source tiles.

Reads   map-source/tiles/subfolder_{R}_{C}/tile_{r}_{c}.{png,webp,jpg}   (output of slice-map.js)
Writes  public/tiles/{version}/{z}/{x}/{y}.webp
        src/generated/tile-index.json   (grid size, zoom range, blank-tile bitsets)
        public/cache-manifest.json, public/cache-version.json   (offline download list)

Each zoom level halves the one above it. Levels are built depth-first from the
native tiles, so only a few tiles are ever held in memory; no full-size stitch.
Uniformly black tiles are never written; the client draws them from the bitset.

Usage: node scripts/build-tiles.js [--force] [--quality 75] [--overview-quality 65]
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { encodeBitset } from '../src/lib/tileBitset.js';

const SCRIPT_REVISION = 3;
const SOURCE_DIR = path.join('map-source', 'tiles');
const PUBLIC_DIR = 'public';
const TILES_DIR = path.join(PUBLIC_DIR, 'tiles');
const INDEX_FILE = path.join('src', 'generated', 'tile-index.json');
const SUBFOLDER_SIZE = 6;
const BLANK_MAX_CHANNEL = 8;
const CHANNELS = 3;
const SOURCE_EXTENSIONS = ['png', 'webp', 'jpg'];

const args = process.argv.slice(2);
const force = args.includes('--force');
const numberArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const quality = numberArg('--quality', 75);
const overviewQuality = numberArg('--overview-quality', 65);

sharp.cache(false);
sharp.concurrency(1);

function sourcePath(row, col) {
  const subfolder = `subfolder_${Math.floor(row / SUBFOLDER_SIZE)}_${Math.floor(col / SUBFOLDER_SIZE)}`;
  const base = path.join(SOURCE_DIR, subfolder, `tile_${row % SUBFOLDER_SIZE}_${col % SUBFOLDER_SIZE}`);
  return SOURCE_EXTENSIONS.map((ext) => `${base}.${ext}`).find((file) => fs.existsSync(file)) ?? `${base}.jpg`;
}

function scanSourceGrid() {
  let gridWidth = 0;
  let gridHeight = 0;
  let sampleFile = null;
  for (const entry of fs.readdirSync(SOURCE_DIR)) {
    const folder = /^subfolder_(\d+)_(\d+)$/.exec(entry);
    if (!folder) continue;
    for (const file of fs.readdirSync(path.join(SOURCE_DIR, entry))) {
      const tile = /^tile_(\d+)_(\d+)\.(?:png|webp|jpg)$/.exec(file);
      if (!tile) continue;
      sampleFile ??= path.join(SOURCE_DIR, entry, file);
      gridHeight = Math.max(gridHeight, Number(folder[1]) * SUBFOLDER_SIZE + Number(tile[1]) + 1);
      gridWidth = Math.max(gridWidth, Number(folder[2]) * SUBFOLDER_SIZE + Number(tile[2]) + 1);
    }
  }
  return { gridWidth, gridHeight, sampleFile };
}

function hashSources(gridWidth, gridHeight) {
  const hash = crypto.createHash('sha1').update(`${SCRIPT_REVISION}:${quality}:${overviewQuality}:${gridWidth}x${gridHeight}`);
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const file = sourcePath(row, col);
      if (fs.existsSync(file)) hash.update(fs.readFileSync(file));
    }
  }
  return hash.digest('hex');
}

function createLimiter(limit) {
  let active = 0;
  const waiting = [];
  const release = () => {
    active--;
    waiting.shift()?.();
  };
  return async (task, { urgent = false } = {}) => {
    if (active >= limit) await new Promise((resolve) => (urgent ? waiting.unshift(resolve) : waiting.push(resolve)));
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}

function isBlank(raw) {
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] > BLANK_MAX_CHANNEL) return false;
  }
  return true;
}

function getContentBounds({ cols, bits }, tileSize) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  bits.forEach((blank, i) => {
    if (blank) return;
    const x = i % cols;
    const y = Math.floor(i / cols);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  if (maxX < 0) return null;
  return { minX: minX * tileSize, minY: minY * tileSize, maxX: (maxX + 1) * tileSize, maxY: (maxY + 1) * tileSize };
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) throw new Error(`Source tiles not found in ${SOURCE_DIR}. Run slice-map first.`);
  const { gridWidth, gridHeight, sampleFile } = scanSourceGrid();
  if (!sampleFile) throw new Error(`No source tiles found in ${SOURCE_DIR}.`);
  const { width: tileSize } = await sharp(sampleFile).metadata();
  const version = hashSources(gridWidth, gridHeight);
  const shortVersion = version.slice(0, 12);
  const outRoot = path.join(TILES_DIR, shortVersion);

  if (!force && fs.existsSync(INDEX_FILE) && fs.existsSync(outRoot)) {
    const existing = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    if (existing.version === version) {
      console.log(`Tiles up to date (${shortVersion}).`);
      return;
    }
  }

  const maxZoom = Math.ceil(Math.log2(Math.max(gridWidth, gridHeight)));
  const half = tileSize / 2;
  const limit = createLimiter(os.availableParallelism?.() ?? os.cpus().length);
  const levels = {};
  const written = [];
  for (let z = 0; z <= maxZoom; z++) {
    const scale = 2 ** (maxZoom - z);
    const cols = Math.ceil(gridWidth / scale);
    const rows = Math.ceil(gridHeight / scale);
    levels[z] = { cols, rows, bits: new Array(cols * rows).fill(true) };
  }

  fs.rmSync(TILES_DIR, { recursive: true, force: true });
  const rawOptions = { raw: { width: tileSize, height: tileSize, channels: CHANNELS } };

  const writeTile = async (z, x, y, raw) => {
    const dir = path.join(outRoot, String(z), String(x));
    await fs.promises.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${y}.webp`);
    const info = await sharp(raw, rawOptions).webp({ quality: z === maxZoom ? quality : overviewQuality, effort: 4 }).toFile(file);
    levels[z].bits[y * levels[z].cols + x] = false;
    written.push({ url: `/tiles/${shortVersion}/${z}/${x}/${y}.webp`, bytes: info.size });
  };

  const readNative = (x, y) => limit(async () => {
    if (x >= gridWidth || y >= gridHeight) return null;
    const file = sourcePath(y, x);
    if (!fs.existsSync(file)) return null;
    const raw = await sharp(file).removeAlpha().resize(tileSize, tileSize, { fit: 'fill' }).raw().toBuffer();
    if (isBlank(raw)) return null;
    await writeTile(maxZoom, x, y, raw);
    return raw;
  });

  const build = async (z, x, y) => {
    if (x >= levels[z].cols || y >= levels[z].rows) return null;
    if (z === maxZoom) return readNative(x, y);
    const children = await Promise.all([
      build(z + 1, 2 * x, 2 * y),
      build(z + 1, 2 * x + 1, 2 * y),
      build(z + 1, 2 * x, 2 * y + 1),
      build(z + 1, 2 * x + 1, 2 * y + 1),
    ]);
    if (children.every((child) => child === null)) return null;
    return limit(async () => {
      const composites = await Promise.all(children.map(async (child, i) => child && {
        input: await sharp(child, rawOptions).resize(half, half, { kernel: 'mitchell' }).raw().toBuffer(),
        raw: { width: half, height: half, channels: CHANNELS },
        left: (i % 2) * half,
        top: Math.floor(i / 2) * half,
      }));
      const raw = await sharp({ create: { width: tileSize, height: tileSize, channels: CHANNELS, background: '#000' } })
        .composite(composites.filter(Boolean))
        .removeAlpha()
        .raw()
        .toBuffer();
      await writeTile(z, x, y, raw);
      return raw;
    }, { urgent: true });
  };

  const started = Date.now();
  console.log(`Building ${maxZoom + 1} zoom levels from ${gridWidth}x${gridHeight} source tiles...`);
  await build(0, 0, 0);

  const index = {
    version,
    tileUrl: `/tiles/${shortVersion}/{z}/{x}/{y}.webp`,
    tileSize,
    width: gridWidth * tileSize,
    height: gridHeight * tileSize,
    maxNativeZoom: maxZoom,
    background: '#000000',
    contentBounds: getContentBounds(levels[maxZoom], tileSize),
    levels: Object.fromEntries(Object.entries(levels).map(([z, level]) => [
      z,
      { cols: level.cols, rows: level.rows, blank: encodeBitset(level.bits) },
    ])),
  };
  await fs.promises.mkdir(path.dirname(INDEX_FILE), { recursive: true });
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));

  written.sort((a, b) => (a.url < b.url ? -1 : 1));
  const totalBytes = written.reduce((sum, tile) => sum + tile.bytes, 0);
  const generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'cache-manifest.json'), JSON.stringify({ version, generatedAt, totalFiles: written.length, totalBytes, tiles: written }));
  fs.writeFileSync(path.join(PUBLIC_DIR, 'cache-version.json'), JSON.stringify({ version, generatedAt }));

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Wrote ${written.length} tiles (${(totalBytes / 1048576).toFixed(1)} MB) in ${seconds}s.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
