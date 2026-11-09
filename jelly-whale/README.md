# Blue Whale Jelly · Material Studies No. 058

A single plump jelly whale and its eyes on a pure white studio background, with one large mode switch. The whale has no internal layers, bubbles, baleen, krill or mouth markings.

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

The toggle starts off in **floppy mode on**: the whale jumps, flops and jiggles while the camera slowly orbits. Turn it on for **jiggly mode on** to grab and stretch the whale with manual camera controls. Switching modes releases any active grab. Large Rubik Bubbles lettering above the standalone toggle shows the current mode. The control retains the accessible name **Interactive mode**; keyboard users can focus it and press Space or Enter.

Drag the whale to stretch it. Scroll while holding, or use a second finger, to twist. Drag empty space to orbit; scroll or pinch to zoom. Double-click to restore the studio view.

Keyboard: `G` swell, `R` reset, `L` lights out, `Space` pause, `S` quarter speed, `M` mesh, `1` / `2` / `3` colour palettes. Up/down adjusts firmness; brackets adjust damping. Reduced-motion preferences start the simulation paused.

## Rendering and physics

Three.js r170 loads through a jsDelivr import map and renders through WebGL2. Separate passes provide refraction, back-face thickness, tinted shadows and contact shading. A still whale appears if WebGL2 or the CDN is unavailable.

The CPU soft body uses a snapped 0.18 lattice (1,744 nodes and 5,810 tetrahedra), five tetrahedra per cell, ten substeps at 60 Hz and barycentric surface/eye attachment. The independent visual mesh uses rounded fin, tail and nose intersections plus smoothed shared-vertex normals. Skinning and normals update only after a physics step; pixel density is capped at 1.5 and shadow/contact maps use smaller offscreen targets. Positive-volume protection and bounded grab-induced velocity prevent cells from folding after release.

Reduced motion starts the simulation paused, but grabbing the whale explicitly resumes it. Pointer movement is bounded relative to the original contact point, so the body follows a pull and rebounds on release.

With reduced-motion preferences, the default off mode starts paused. Explicitly switching back to display mode opts into movement. Its bounded hops run through the same physics solver every 2.8 simulation seconds. Returning to interactive mode stops scheduled impulses and camera rotation; reduced motion returns to its paused default until a grab.

The Rubik Bubbles font is bundled locally as a Latin WOFF subset. Its source is the Google Fonts `ofl/rubikbubbles` directory; the original Open Font License is included in `public/fonts/RubikBubbles-OFL.txt`.

Display jumps use stronger upward launches and alternating, opposing head/tail kicks. The display velocity allowance is higher for these jumps; switching back restores the direct-interaction limit.

Inversion protection repairs individual tetrahedra and, when necessary, rolls back only their vertices to the previous substep. It does not restore the entire whale to rest during a grab. Shape recovery uses the integrated spring and damping, without an additional positional tether that would suppress the release wobble.

Only part of each positional correction transfers back into momentum, so cell stabilization cannot sustain rapid shaking. Viscous damping lets the broad release wobble decay. The eyes share the exact body material instance, including its jelly shader, colour, absorption, reflections and lighting. Their surface meshes remain bound vertex by vertex to the cheek volume.

## Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

The numerical suite checks inflation, lattice connectivity, release settling, repeated hops, floor contact, eye deformation and normal smoothing. Browser checks cover desktop/phone rendering, mode switching, autonomous motion and orbit, mouse/touch dragging, keyboard controls, production imports and the CDN fallback.

The existing gallery at the repository root is independent of this study.
