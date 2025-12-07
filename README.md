# SL2 Map (React)

A React + Vite remake of the SL2 interactive world map.

## Deploy to Cloudflare Pages (GitHub)

This repository is set up so only the proper production build (`dist/`) is deployed via GitHub Actions, while large generated assets and dev outputs remain out of Git history.

### What’s included
- `.gitignore` excludes `node_modules/`, `dist/`, `public/tiles/`, and `public/cache-manifest.json`.
- GitHub Actions workflow at `.github/workflows/deploy-cloudflare-pages.yml` builds the site and deploys `dist/` to Cloudflare Pages.

### Setup Steps
1. Create a Cloudflare Pages project named `sl2-map-react` (or change `projectName` in the workflow).
2. In your GitHub repository, add secrets:
	- `CLOUDFLARE_API_TOKEN`: Token with Pages write permissions.
	- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID.
3. Push to `main` to trigger deployment, or run the workflow manually.

### Local Development
```powershell
npm run dev
```

### Build Locally
```powershell
npm run build
```

The production output is in `dist/` and is what gets deployed.

## Scripts

- `npm run dev`: Start the dev server at `http://localhost:5173/`
- `npm run build`: Build for production
- `npm run preview`: Preview the production build

## Project Structure

- `public/tiles/`: Static map tiles served at `/tiles/...`
- `src/lib/GameMap.js`: Ported GameMap class, instantiated by `App` on mount
- `src/App.jsx`: React component rendering the map UI with matching element IDs
- `src/styles.css`: Original styling moved into the React app

## Notes

- World map images (`World_Map_Optimized_*.jpg`) are optional. Place them in `public/` if available, or the app will use tiles-only.
- If you change asset paths, update `tilePath` and world map paths in `src/lib/GameMap.js`.

## Quick Start

```powershell
Push-Location "c:\Users\chris\Desktop\Code Projects\SL2-Map\react-map"; npm install; npm run dev
```

## One-time Tile Slicing

Use the provided script to slice a large `mapfile.png` into optimized 800×800 tiles organized into 6×6 subfolders (`subfolder_R_C/tile_r_c.jpg`) matching `src/lib/GameMap.js`.

- Install dependency:

```powershell
npm install sharp --save-dev
```

- Run the slicer (replace the input path):

```powershell
$env:MAP_INPUT = "c:\\Users\\chris\\Desktop\\Code Projects\\SL2-Map-React\\public\\mapfile.png"; npm run slice-map
```

Alternatively, call directly:

```powershell
node scripts/slice-map.js --input "c:\\Users\\chris\\Desktop\\Code Projects\\SL2-Map-React\\public\\mapfile.png" --outDir "public/tiles" --tileSize 800 --subfolderSize 6 --quality 75
```

Notes:
- The script auto-derives grid size from the image and pads edges when needed.
- Output format defaults to JPEG with `mozjpeg`, progressive, and quality 75 for fast interactive loads.
- Ensure the resulting folders appear under `public/tiles/` as `subfolder_{R}_{C}/tile_{r}_{c}.jpg`.

## Stitch World Maps from Tiles

Generate multi-resolution world map images directly from the tiles:

```powershell
npm run stitch-worldmaps
```

This produces:
- `public/World_Map_Optimized_tiny.jpg` (896×1024)
- `public/World_Map_Optimized_small.jpg` (1792×2048)
- `public/World_Map_Optimized_medium.jpg` (3584×4096)
- `public/World_Map_Optimized_large.jpg` (6720×7680)

Config matches `src/lib/GameMap.js`. Override defaults if needed:

```powershell
node scripts/stitch-worldmaps.js --tilesDir "public/tiles" --tileSize 800 --gridWidth 42 --gridHeight 48 --subfolderSize 6 --format jpg --outDir "public"
```
