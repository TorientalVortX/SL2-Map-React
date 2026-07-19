#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = process.cwd();
const publicDir = path.join(root, 'public');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function toUrl(file) {
  const rel = path.relative(publicDir, file).split(path.sep).join('/');
  return '/' + rel;
}

function sha1(str) {
  return crypto.createHash('sha1').update(str).digest('hex');
}

function main() {
  if (!fs.existsSync(publicDir)) {
    console.error('Public directory not found:', publicDir);
    process.exit(1);
  }

  const allFiles = walk(publicDir);
  const imageFiles = allFiles.filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));

  const entries = imageFiles.map(f => {
    const stat = fs.statSync(f);
    return { url: toUrl(f), bytes: stat.size };
  });

  const tiles = entries.filter(e => e.url.startsWith('/tiles/'));
  const worldMaps = entries.filter(e => /World_Map_Optimized/i.test(e.url));
  const others = entries.filter(e => !tiles.includes(e) && !worldMaps.includes(e));

  const totalBytes = entries.reduce((a, b) => a + b.bytes, 0);
  const sortedSignature = entries
    .slice()
    .sort((a, b) => (a.url < b.url ? -1 : 1))
    .map(e => `${e.url}:${e.bytes}`)
    .join('|');
  const version = sha1(sortedSignature);

  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    totalFiles: entries.length,
    totalBytes,
    tiles,
    worldMaps,
    others,
  };

  const outFile = path.join(publicDir, 'cache-manifest.json');
  const versionFile = path.join(publicDir, 'cache-version.json');
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(versionFile, JSON.stringify({ version, generatedAt: manifest.generatedAt }, null, 2));
  console.log(`Wrote ${outFile}`);
  console.log(`Wrote ${versionFile}`);
  console.log(`Total files: ${entries.length}`);
  console.log(`Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
}

main();
