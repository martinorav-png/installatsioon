# Whale display mode implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement the checked tasks below.

**Goal:** Smooth the jelly sculpture and add one large switch: off plays a hopping, jiggling exhibit with slow camera rotation; on enables direct interaction.

**Architecture:** Keep the Three.js scene alive when the React switch changes. The scene owns mode state and a fixed-step physics driven display sequence. Round the implicit appendages and smooth shared surface normals without increasing simulation resolution.

**Tech stack:** Existing React, TypeScript, Three.js r170, Vitest and Playwright.

**Spec:** User requests in this chat: retain the release settling fix and jelly eyes, smooth the tail and whole sculpture, add a large interactive on/off switch.

## Constraints and review focus

- The toggle starts off in "floppy mode on", with physical hops and slow rotation. On shows "jiggly mode on", stops scheduled forces and rotation, and enables interaction.
- Switching modes cancels active grabs, pointer capture and pending touch state.
- Keyboard activation of the switch must not trigger the scene's Space shortcut.
- Reduced motion starts still; choosing display mode is an explicit opt-in to motion.
- Keep the white gallery, one sculpture, existing keyboard shortcuts and mobile layout. Show no development controls.
- Preserve volume, floor contact, release settling and the current performance improvements.

## Tasks

- [x] Add a failing browser test for an accessible switch, autonomous hop/orbit, disabled grabs in display mode and restored interaction when enabled.
- [x] Add `setInteractive(boolean)` and diagnostics to `src/whale/scene.ts`; schedule bounded impulses and camera orbit only in display mode. Add a localized impulse option in `physics.ts` for gentle jiggle.
- [x] Add the large switch to `JellyInstallation.tsx` and its CSS. Keep initialization and disposal independent from mode changes.
- [x] Round appendage SDF intersections in `shape.ts`; add a shared-vertex normal smoother with a numerical regression in `surface.test.ts`.
- [x] Update existing browser expectations for the one deliberate UI control. Run unit tests, build and browser suite; inspect desktop/mobile captures and live switch behavior.
- [x] Review changes and document the new modes in README.

Ruling: Round only the visible shell, retaining the verified internal lattice. Rounding the fine simulation lattice changed thin boundary cells and regressed recovery; the existing separate render mesh provides visual rounding without that physics change.

Verification: 50 unit tests passed; 18 desktop/mobile browser checks passed; production build and whitespace checks passed. Desktop/mobile display captures and live off/on behavior inspected. Final review found no actionable issues.

Follow-up: The user's later request supersedes the original interactive-on default. Mode lettering now uses a locally bundled Rubik Bubbles font above the standalone switch; reduced-motion preferences still pause the initial display sequence.
