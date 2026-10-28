import fs from 'fs';
import path from 'path';

export const LOCATIONS_FILE = path.join('src', 'data', 'locations.json');

export function formatLocations(locations) {
  return `[\n${locations.map((location) => `  ${JSON.stringify(location)}`).join(',\n')}\n]\n`;
}

export function moveLocation(locations, id, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('x and y must be numbers');
  const index = locations.findIndex((location) => String(location.id) === String(id));
  if (index === -1) throw new Error(`Unknown location ${id}`);
  const next = [...locations];
  next[index] = { ...locations[index], x: Math.round(x), y: Math.round(y) };
  return next;
}

export function saveLocationPosition(id, x, y) {
  const locations = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
  fs.writeFileSync(LOCATIONS_FILE, formatLocations(moveLocation(locations, id, x, y)));
}
