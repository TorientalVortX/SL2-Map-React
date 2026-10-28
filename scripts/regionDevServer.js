import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import {
  LAYOUT_FILE, REFERENCE_FILE, REGIONS_DIR, REGION_LIST_FILE, TILE_SIZE, listRegionFiles, readJson, validateLayout, writeJson,
} from './regionLayout.js';

const PREVIEW_DIR = path.join(REGIONS_DIR, '.previews');
const PREVIEW_SIZE = 600;
const MAX_BODY_BYTES = 1024 * 1024;
const run = promisify(execFile);

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function sendFile(res, file, type) {
  res.setHeader('content-type', type);
  res.setHeader('cache-control', 'no-cache');
  fs.createReadStream(file).pipe(res);
}

export async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function ensurePreview(file) {
  const source = path.join(REGIONS_DIR, file);
  const preview = path.join(PREVIEW_DIR, `${file}.webp`);
  if (fs.existsSync(preview) && fs.statSync(preview).mtimeMs >= fs.statSync(source).mtimeMs) return preview;
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  await sharp(source).resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'fill' }).webp({ quality: 80 }).toFile(preview);
  return preview;
}

async function getState() {
  const layout = readJson(LAYOUT_FILE, { regions: [] });
  const modified = new Map(readJson(REGION_LIST_FILE, []).map((entry) => [entry.name, entry.modified]));
  const files = listRegionFiles();
  const regions = await Promise.all(files.map(async (file) => {
    const meta = await sharp(path.join(REGIONS_DIR, file)).metadata();
    return { file, width: meta.width, height: meta.height, modified: modified.get(file) ?? null };
  }));
  return { tileSize: TILE_SIZE, layout, regions, hasReference: fs.existsSync(REFERENCE_FILE) };
}

async function handle(req, res, next) {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/state') return sendJson(res, 200, await getState());
    if (req.method === 'GET' && url.pathname === '/reference.webp' && fs.existsSync(REFERENCE_FILE)) return sendFile(res, REFERENCE_FILE, 'image/webp');
    if (req.method === 'GET' && url.pathname.startsWith('/preview/')) {
      const file = decodeURIComponent(url.pathname.slice('/preview/'.length));
      if (path.basename(file) !== file || !listRegionFiles().includes(file)) return sendJson(res, 404, { error: 'Unknown region' });
      return sendFile(res, await ensurePreview(file), 'image/webp');
    }
    if (req.method === 'PUT' && url.pathname === '/layout') {
      const layout = validateLayout(await readBody(req));
      const known = new Set(listRegionFiles());
      const unknown = layout.regions.find((region) => !known.has(region.file));
      if (unknown) return sendJson(res, 400, { error: `Unknown region ${unknown.file}` });
      writeJson(LAYOUT_FILE, layout);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/apply') {
      const compose = await run(process.execPath, ['scripts/compose-regions.js'], { maxBuffer: 10 * 1024 * 1024 });
      const tiles = await run(process.execPath, ['scripts/build-tiles.js'], { maxBuffer: 10 * 1024 * 1024 });
      return sendJson(res, 200, { ok: true, log: `${compose.stdout}${tiles.stdout}` });
    }
  } catch (error) {
    return sendJson(res, 400, { error: error.stderr || error.message });
  }
  return next();
}

export default function regionArranger() {
  return {
    name: 'region-arranger',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__regions', handle);
    },
  };
}
