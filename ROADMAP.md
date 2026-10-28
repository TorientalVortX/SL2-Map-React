# Roadmap

Rough sizes: S = under an hour, M = a session, L = a few sessions.

## Housekeeping

- [x] Commit pending work (marker dragging, world/local scale, smooth zoom, descriptions). Check the `map-source/tiles` changes first. (S)
- [x] README: dev marker dragging, the `scale` field, the right-click template, zoom thresholds. (S)
- [x] Validate `locations.json` in tests: unique ids, known types and scales, coordinates inside the map, no empty names. (S)
- [x] ESLint and a GitHub Action that runs tests and the build on PRs. (S–M)

## Content

- [ ] More marker types: landmark, dungeon, city/town, tavern, point of interest. Landmark and dungeon already have pin colours. (S)
- [ ] Local markers for each nation: cities, taverns, landmarks. (ongoing)
- [ ] Optional `link` field on locations, shown as "Read more" on the card (neus-projects or Miraheze). (S)
- [ ] Optional image per location on the card, lazy loaded and resized at build time. (M)
- [ ] Nation borders: outline territories, highlight on hover, tint when selected. Needs a dev tool to draw them. (L)
- [ ] Nation names as map labels at world zoom. (M)

## Dev tools

- [ ] Dev marker editor: right-click to create, edit name/type/scale/description in a form, delete. Saves to `locations.json`. (M)
- [ ] Custom marker icons: upload an image in the marker editor, saved to `map-source/markers/` and resized to a hashed webp at build. The icon replaces the pin shape entirely. Include icons in the offline download. (M, after the editor)
  - [ ] Per-type default icons (e.g. every tavern gets the same icon).
  - [ ] Optional per-marker `icon` field that overrides the type icon. Fallback order: marker icon, type icon, coloured pin.

## Sharing and embedding

- [ ] Link previews for Discord and socials: a Pages Function that sets the title, description and thumbnail for `loc=` links. (M)
- [ ] Embed mode: swap `X-Frame-Options: DENY` for a `frame-ancestors` list, add `?embed=1` to hide the panel and offline download. (S–M)

## Map usability

- [ ] Distance tool: click two points for distance. Travel time if the lore gives a scale. (M)
- [ ] Search: arrow-key navigation, typo tolerance, results grouped by world/local. (S)
- [ ] Mobile: location card as a swipe-up bottom sheet, plus a phone-sized smoke check. (M)
- [ ] Marker clustering, once local markers are in the hundreds. (M)

## Technical

- [ ] `npm run smoke`: headless browser check that loads the map, zooms, searches and opens a card. (S)
- [ ] Faster Cloudflare builds: commit or cache the generated tiles instead of rebuilding them on every deploy. (S)

## Suggested order

1. Housekeeping
2. Dev marker editor
3. Marker types, lore links, link previews
