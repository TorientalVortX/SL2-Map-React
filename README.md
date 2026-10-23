# SL2 Map (React)

An interactive SL2 world map built with React, Vite and Leaflet.

## How the map is served

- Source tiles live in `map-source/tiles/subfolder_{R}_{C}/tile_{r}_{c}.{png,webp,jpg}` (800×800, 6×6 tiles per subfolder).
- `npm run tiles` (`scripts/build-tiles.js`) turns them into a zoom pyramid at `public/tiles/{version}/{z}/{x}/{y}.webp`.
  Each level halves the one above it, built depth-first from the source tiles so memory stays small; no full-size stitch is ever made.
- Fully black tiles are skipped. Their positions are stored as bitsets in `src/generated/tile-index.json`, and the client draws them without a request.
- The tile path includes a content hash, so `/tiles/*` can be cached as immutable and a rebuild never serves stale tiles.
- The same script writes `public/cache-manifest.json` / `cache-version.json` for the opt-in offline download.

All of `public/tiles/`, `src/generated/` and the cache manifests are generated and gitignored. `npm run dev` and `npm run build` run `npm run tiles` first; it skips the work when the source tiles have not changed.

Options: `node scripts/build-tiles.js --force --quality 75 --overview-quality 65` (`--quality` is the full-resolution level, `--overview-quality` the zoomed-out levels).

## Updating the map from region images

The current region art (4800×4800 PNGs, one 6×6 tile block each, plus a few odd-sized pieces) lives in the shared Google Drive folder. Those originals stay out of git.

1. `npm run regions:fetch`: download the PNGs into `map-source/regions/` (gitignored) and record their Drive ids and dates in `map-source/regions.json`.
2. `npm run regions:place`: guess each region's position by matching it against `map-source/reference.webp` (the previous world map at 1/16 scale) and write `map-source/layout.json`.
   Well-matched blocks snap to the detected block grid. Weak guesses are flagged `review`. Older overlapping versions of the same BTT number are disabled. Pass `--all` to re-guess everything.
3. `npm run dev`, open `http://localhost:5173/?arrange` (or "Arrange regions" in the panel), and fix the layout: drag regions, toggle versions on or off, and use **Top** to change which overlapping region is drawn above.
   Snap to the block grid, 48px cells, 800px tiles or 1px. Arrow keys nudge the selected region.
4. **Save & rebuild map** writes the layout, runs `npm run regions:compose` (regions → `map-source/tiles`) and rebuilds the pyramid. Check the result at `/`.

`map-source/layout.json` and the composed `map-source/tiles` are what get committed. `compose-regions.js --out <dir>` writes somewhere else to preview without replacing the current tiles.

## Locations

Pins come from `src/data/locations.json`:

```json
{ "id": 1756967094317, "name": "Telegrad", "x": 33048, "y": 19279, "type": "nation", "description": "..." }
```

`x`/`y` are pixels on the full-resolution map. `type` sets the pin colour (`nation`, `town`, `landmark`, `dungeon`) and appears as a filter in the panel once there is more than one type.
In `npm run dev`, right-click (or long-press) the map to get a ready-made entry for that spot.

## Sharing

The URL hash tracks the view, e.g. `#x=33048&y=19279&z=5.50&loc=1756967094317`. Opening such a link restores the view and the selected location.
Right-click / long-press any spot, or use **Copy link** on a location card.

## Scripts

- `npm run dev`: dev server at `http://localhost:5173/`
- `npm run build`: production build into `dist/`
- `npm run preview`: serve the production build
- `npm test`: unit tests (`node --test`)
- `npm run tiles`: build the tile pyramid
- `npm run slice-map`: slice a single large image into `map-source/tiles` (set `MAP_INPUT` to the image path)

```powershell
$env:MAP_INPUT = "C:\path\to\mapfile.png"; npm run slice-map
```

## Deploy to Cloudflare Pages

Build command `npm run build`, output directory `dist`. The build generates the tiles (about 30 s), so dev dependencies (`sharp`) must be installed during the build.
`public/_headers` sets long-lived caching for `/tiles/*` and `/assets/*`.
