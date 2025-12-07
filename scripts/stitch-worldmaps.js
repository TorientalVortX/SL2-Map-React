/*
Stitch existing tiles into larger world map images at multiple resolutions.
Reads tiles from public/tiles/subfolder_{R}_{C}/tile_{r}_{c}.jpg and composes
full-size canvas, then exports downscaled images for tiny/small/medium/large.

Usage:
  node scripts/stitch-worldmaps.js --tilesDir "public/tiles" --tileSize 800 --gridWidth 42 --gridHeight 48 --format jpg --outDir "public"

Notes:
- Uses current GameMap.js defaults unless overridden via CLI.
- Generates: World_Map_Optimized_tiny.jpg, small.jpg, medium.jpg, large.jpg.
- Downscale sizes match those configured in GameMap.js.
*/

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
sharp.cache({ files: 0, items: 0, memory: 0 });
sharp.concurrency(0);
if (typeof sharp.limitInputPixels === 'function') {
  sharp.limitInputPixels(false);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const next = args[i + 1];
      if (next && !next.startsWith('--')) { opts[key] = next; i++; } else { opts[key] = true; }
    }
  }
  return opts;
}

async function ensureDir(dir) { await fs.promises.mkdir(dir, { recursive: true }); }

function tilePath(tilesDir, subfolderSize, row, col, format) {
  const subfolderRow = Math.floor(row / subfolderSize);
  const subfolderCol = Math.floor(col / subfolderSize);
  const localRow = row % subfolderSize;
  const localCol = col % subfolderSize;
  const subfolderName = `subfolder_${subfolderRow}_${subfolderCol}`;
  return path.join(tilesDir, subfolderName, `tile_${localRow}_${localCol}.${format}`);
}

async function composeLevel({ tilesDir, tileSize, gridWidth, gridHeight, subfolderSize, format }, level) {
  const totalWidth = gridWidth * tileSize;
  const totalHeight = gridHeight * tileSize;
  const scaleX = level.width / totalWidth;
  const scaleY = level.height / totalHeight;
  const scaledTileW = Math.max(1, Math.round(tileSize * scaleX));
  const scaledTileH = Math.max(1, Math.round(tileSize * scaleY));
  const composites = [];
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const p = tilePath(tilesDir, subfolderSize, row, col, format);
      if (!fs.existsSync(p)) continue;
      const buf = await sharp(p).resize(scaledTileW, scaledTileH).toBuffer();
      composites.push({ input: buf, left: col * scaledTileW, top: row * scaledTileH });
    }
  }
  const canvas = sharp({ create: { width: level.width, height: level.height, channels: 3, background: { r: 0, g: 0, b: 0 } } });
  const outBuf = await canvas.composite(composites).jpeg({ quality: 80, progressive: true, mozjpeg: true }).toBuffer();
  return outBuf;
}

async function exportLevels(config, outDir) {
  const levels = [
    { name: 'tiny', width: 896, height: 1024 },
    { name: 'small', width: 1792, height: 2048 },
    { name: 'medium', width: 3584, height: 4096 },
    { name: 'large', width: 6720, height: 7680 }
  ];
  await ensureDir(outDir);
  for (const lvl of levels) {
    const outPath = path.join(outDir, `World_Map_Optimized_${lvl.name}.jpg`);
    const buf = await composeLevel(config, lvl);
    await fs.promises.writeFile(outPath, buf);
    console.log(`Wrote ${outPath}`);
  }
}

async function main() {
  const opts = parseArgs();
  const tilesDir = opts.tilesDir || path.join('public', 'tiles');
  const outDir = opts.outDir || 'public';
  const tileSize = Number(opts.tileSize || 800);
  const gridWidth = Number(opts.gridWidth || 47);
  const gridHeight = Number(opts.gridHeight || 54);
  const subfolderSize = Number(opts.subfolderSize || 6);
  const format = (opts.format || 'jpg').toLowerCase();

  console.log(`Stitching from: ${tilesDir}`);
  console.log(`Grid: ${gridWidth} x ${gridHeight}, tile ${tileSize}`);
  const config = { tilesDir, tileSize, gridWidth, gridHeight, subfolderSize, format };
  await exportLevels(config, outDir);
  console.log('Stitching complete.');
}

main().catch((err) => { console.error('Error during stitching:', err); process.exit(1); });
