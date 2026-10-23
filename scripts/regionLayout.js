import fs from 'fs';
import path from 'path';

export const TILE_SIZE = 800;
export const SUBFOLDER_SIZE = 6;
export const REFERENCE_SCALE = 16;
export const REGIONS_DIR = path.join('map-source', 'regions');
export const REGION_LIST_FILE = path.join('map-source', 'regions.json');
export const LAYOUT_FILE = path.join('map-source', 'layout.json');
export const REFERENCE_FILE = path.join('map-source', 'reference.webp');
export const SOURCE_TILES_DIR = path.join('map-source', 'tiles');

export function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function listRegionFiles() {
  if (!fs.existsSync(REGIONS_DIR)) return [];
  return fs.readdirSync(REGIONS_DIR).filter((name) => /\.png$/i.test(name)).sort();
}

export function validateLayout(layout) {
  if (!layout || !Array.isArray(layout.regions)) throw new Error('layout.regions must be an array');
  for (const region of layout.regions) {
    if (typeof region.file !== 'string' || path.basename(region.file) !== region.file) throw new Error(`Invalid region file: ${region.file}`);
    for (const key of ['x', 'y']) {
      if (!Number.isInteger(region[key]) || region[key] < 0) throw new Error(`${region.file}: ${key} must be a non-negative integer`);
    }
  }
  return layout;
}
