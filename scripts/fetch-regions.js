/*
Downloads the region images (4800x4800 PNG, one 6x6 tile block each) from the
public Google Drive folder into map-source/regions/, which is gitignored.
Also writes map-source/regions.json with each file's Drive id and modified date.

Usage: node scripts/fetch-regions.js [--folder <driveFolderId>] [--force]
*/

import fs from 'fs';
import path from 'path';

const DEFAULT_FOLDER = '1NNqE56aDp3zxx4lVDkqxvOAXwXCNcXs7';
const OUT_DIR = path.join('map-source', 'regions');
const LIST_FILE = path.join('map-source', 'regions.json');
const CONCURRENCY = 3;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const args = process.argv.slice(2);
const force = args.includes('--force');
const folderArg = args.indexOf('--folder');
const folderId = folderArg >= 0 ? args[folderArg + 1] : DEFAULT_FOLDER;

function parseModified(text) {
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(text);
  if (numeric) return new Date(Date.UTC(2000 + Number(numeric[3]), Number(numeric[1]) - 1, Number(numeric[2]))).toISOString().slice(0, 10);
  const short = /^([A-Za-z]{3}) (\d{1,2})$/.exec(text);
  if (short) return new Date(Date.UTC(new Date().getUTCFullYear(), MONTHS.indexOf(short[1].toLowerCase()), Number(short[2]))).toISOString().slice(0, 10);
  return null;
}

function decodeHtml(text) {
  return text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

async function listFolder(id) {
  const response = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`);
  if (!response.ok) throw new Error(`Drive folder listing failed: HTTP ${response.status}`);
  const html = await response.text();
  const entries = [];
  for (const block of html.split('<div class="flip-entry" id="entry-').slice(1)) {
    const fileId = /^[A-Za-z0-9_-]+/.exec(block)?.[0];
    const name = /flip-entry-title">([^<]*)</.exec(block)?.[1];
    const modified = /flip-entry-last-modified"><div>([^<]*)</.exec(block)?.[1];
    if (!fileId || !name || block.includes('/drive/folders/')) continue;
    entries.push({ id: fileId, name: decodeHtml(name), modified: parseModified(modified ?? '') });
  }
  return entries;
}

async function download(entry) {
  const target = path.join(OUT_DIR, entry.name);
  if (!force && fs.existsSync(target)) return 'kept';
  const response = await fetch(`https://drive.usercontent.google.com/download?id=${entry.id}&export=download&confirm=t`);
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.startsWith('image/')) throw new Error(`${entry.name}: HTTP ${response.status} (${type})`);
  const partial = `${target}.part`;
  fs.writeFileSync(partial, Buffer.from(await response.arrayBuffer()));
  fs.renameSync(partial, target);
  return 'downloaded';
}

async function main() {
  const entries = (await listFolder(folderId)).filter((entry) => /\.png$/i.test(entry.name));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LIST_FILE, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`Found ${entries.length} region images.`);

  const queue = [...entries];
  const failures = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const entry = queue.shift();
      try {
        console.log(`${await download(entry)}: ${entry.name}`);
      } catch (error) {
        failures.push(error.message);
      }
    }
  }));
  if (failures.length) {
    console.error(`Failed:\n${failures.join('\n')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
