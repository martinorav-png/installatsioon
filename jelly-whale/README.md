# Blue Whale Jelly · Material Studies No. 058

A single plump jelly whale and its eyes on a pure white studio background. The whale has no internal layers, bubbles, baleen, krill, mouth markings, or visible controls.

## Run locally

```sh
cd jelly-whale
npm ci
npm run dev
```

## Build

```sh
npm run build
```

Serve `dist/` with a static web server. To host under a directory, build with `npm run build -- --base=./`.

## Interactions

Drag the whale to stretch it. Scroll while holding, or use a second finger, to twist. Drag empty space to orbit; scroll or pinch to zoom. Double-click to restore the studio view.

Keyboard: `G` swell, `R` reset, `L` lights out, `Space` pause, `S` quarter speed, `M` mesh, `1` / `2` / `3` colour palettes. Up/down adjusts firmness; brackets adjust damping. Reduced-motion preferences start the simulation paused.

## Rendering and physics

Three.js r170 loads through a jsDelivr import map and renders through WebGL2. Separate passes provide refraction, back-face thickness, tinted shadows and contact shading. A still whale appears if WebGL2 or the CDN is unavailable.

The CPU soft body uses a snapped 0.12 lattice, five tetrahedra per cell, ten substeps at 60 Hz and barycentric surface/eye attachment. Positive-volume protection and bounded grab-induced velocity prevent cells from folding after release.

## Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

The numerical suite checks inflation, lattice connectivity and production-resolution grab/release recovery. Browser checks cover desktop/phone rendering, drag release, keyboard controls, production imports and the CDN fallback.

The existing gallery at the repository root is independent of this study.
