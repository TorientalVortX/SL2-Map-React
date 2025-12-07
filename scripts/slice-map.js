/*
One-time slicer for a large world map image into optimized tiles.
Reads an input image and writes 800x800 JPEG tiles into 6x6 subfolders
like `public/tiles/subfolder_{R}_{C}/tile_{r}_{c}.jpg` to match GameMap.js.

Usage:
  node scripts/slice-map.js --input "c:/path/to/mapfile.png" --outDir "public/tiles" --tileSize 800 --subfolderSize 6 --quality 75

Notes:
- If the image dimensions are not exact multiples of tileSize, the script will pad the edges.
- By default, derives grid size from image dimensions: gridWidth = ceil(width/tileSize), gridHeight = ceil(height/tileSize)
- Uses Sharp with mozjpeg for efficient JPEG output.
*/

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
// Allow very large input images (world map) and optimize IO
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
      if (next && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      } else {
        opts[key] = true;
      }
    }
  }
  return opts;
}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function main() {
  const opts = parseArgs();
  const input = opts.input || opts.i;
  const outDir = opts.outDir || path.join('public', 'tiles');
  const tileSize = Number(opts.tileSize || 800);
  const subfolderSize = Number(opts.subfolderSize || 6);
  const quality = Number(opts.quality || 75);
  const format = (opts.format || 'jpg').toLowerCase();

  if (!input) {
    console.error('Error: --input path/to/mapfile.png is required');
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(`Error: input file not found: ${input}`);
    process.exit(1);
  }

  await ensureDir(outDir);

  const img = sharp(input, { sequentialRead: true, limitInputPixels: false });
  const meta = await img.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) {
    console.error('Error: Unable to read image dimensions');
    process.exit(1);
  }

  const gridWidth = Math.ceil(width / tileSize);
  const gridHeight = Math.ceil(height / tileSize);

  console.log(`Input: ${input}`);
  console.log(`Dimensions: ${width}x${height}`);
  console.log(`Tile size: ${tileSize}`);
  console.log(`Grid: ${gridWidth} x ${gridHeight}`);
  console.log(`Writing to: ${outDir}`);

  // Pre-pad image if needed so tiles are exact
  const paddedWidth = gridWidth * tileSize;
  const paddedHeight = gridHeight * tileSize;
  const padRight = paddedWidth - width;
  const padBottom = paddedHeight - height;

  let prepped = img;
  if (padRight > 0 || padBottom > 0) {
    prepped = img.extend({
      top: 0,
      left: 0,
      right: padRight,
      bottom: padBottom,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });
  }

  // Materialize the prepped image into a buffer to ensure extend is applied
  const preppedBuffer = await prepped.png().toBuffer();
  const pipeline = sharp(preppedBuffer, { sequentialRead: true, limitInputPixels: false });

  // Slice tiles row/col and write into subfolders
  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const left = col * tileSize;
      const top = row * tileSize;
      const extractWidth = Math.min(tileSize, Math.max(0, paddedWidth - left));
      const extractHeight = Math.min(tileSize, Math.max(0, paddedHeight - top));

      const subfolderRow = Math.floor(row / subfolderSize);
      const subfolderCol = Math.floor(col / subfolderSize);
      const localRow = row % subfolderSize;
      const localCol = col % subfolderSize;
      const subfolderName = `subfolder_${subfolderRow}_${subfolderCol}`;
      const subfolderPath = path.join(outDir, subfolderName);
      await ensureDir(subfolderPath);

      const baseName = `tile_${localRow}_${localCol}.${format}`;
      const outPath = path.join(subfolderPath, baseName);

      let tile = pipeline.clone().extract({ left, top, width: extractWidth, height: extractHeight });
      if (extractWidth !== tileSize || extractHeight !== tileSize) {
        // extend to full tile size if clamped at edges
        tile = tile.extend({
          top: 0,
          left: 0,
          right: tileSize - extractWidth,
          bottom: tileSize - extractHeight,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        });
      }
      if (format === 'jpg' || format === 'jpeg') {
        tile = tile.jpeg({ quality, progressive: true, chromaSubsampling: '4:4:4', mozjpeg: true });
      } else if (format === 'png') {
        // paletted PNG with compression
        tile = tile.png({ compressionLevel: 9, palette: true });
      } else if (format === 'webp') {
        tile = tile.webp({ quality });
      } else {
        console.warn(`Unknown format '${format}', defaulting to jpg`);
        tile = tile.jpeg({ quality, progressive: true, chromaSubsampling: '4:4:4', mozjpeg: true });
      }

      await tile.toFile(outPath);
    }
    // Light progress output per row
    console.log(`Row ${row + 1}/${gridHeight} complete`);
  }

  console.log('Slicing complete.');
}

main().catch((err) => {
  console.error('Error during slicing:', err);
  process.exit(1);
});
