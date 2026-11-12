# Dino Loader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the fragile DinoLoader with a polished offline T-Rex runner and align the download percentage beside the preparation title.

**Architecture:** Keep the existing `DinoLoader({ active })` canvas boundary, but replace its one-obstacle loop with a delta-time runner using mutable refs, bounded obstacle spawning, collision state, score, restart and visibility pause. Keep all visual rendering local to the canvas and preserve the existing download state flow.

**Tech Stack:** React 19, TypeScript, Canvas 2D, CSS tokens, Vite.

**Spec:** `docs/superpowers/specs/2026-11-12-dino-loader-design.md`

## Global Constraints

- No iframe, remote script, package, audio or telemetry.
- Preserve `DinoLoader` public prop `active: boolean`.
- Start only after Space, ArrowUp or click.
- Respect `prefers-reduced-motion`.
- Keep the Dollyt palette and Instrument Sans/IBM Plex Mono typography.

## Review Focus

- Rapid repeated input must not create duplicate animation frames.
- Visibility changes must pause and resume without a time jump.
- Collision must stop the loop and expose a restart state.
- Canvas CSS resizing must not distort collision coordinates.
- Reduced motion must still leave the game playable without pulsing animation.

---

### Task 1: Replace the Dino game loop

**Files:**
- Modify: `src/components/DinoLoader.tsx`
- Test: existing TypeScript/build validation

**Interfaces:**
- Consumes: `active: boolean`
- Produces: the same rendered loader surface and keyboard/click controls.

- [ ] **Step 1: Replace the single obstacle state with typed runner state**

Use typed dino, obstacle and game state values. Keep all mutable frame state inside
the effect so unmount cleanup remains deterministic.

- [ ] **Step 2: Implement the 60 FPS delta-time loop**

Use `requestAnimationFrame`, clamp elapsed time, apply gravity and jump velocity,
move obstacles, progressively increase speed to a bounded maximum, and schedule
exactly one next frame while running.

- [ ] **Step 3: Implement reliable input and restart behavior**

Space, ArrowUp and pointer input start the game when idle, jump only when grounded,
and restart after game-over. Prevent default browser scrolling only for handled
game keys.

- [ ] **Step 4: Implement obstacle generation, collision and score**

Generate small/large cactus-like silhouettes with a bounded gap, detect overlap
against the dino hitbox, increment score only once per obstacle, and render
`SCORE 000` plus `ESPACE POUR REJOUER` after a crash.

- [ ] **Step 5: Render a Dollyt T-Rex scene**

Draw a readable blocky T-Rex with alternating feet, cactus obstacles, horizon line,
subtle background details and score using the existing palette. Keep the game
recognizable without copying external image assets.

- [ ] **Step 6: Preserve pause and reduced-motion behavior**

Cancel the active frame when the document is hidden, resume with a fresh timestamp,
and reduce speed/animation intensity when `prefers-reduced-motion` is enabled.

- [ ] **Step 7: Validate the component**

Run `npm run typecheck` and `npm run build`.
Expected: both pass with no TypeScript errors.

### Task 2: Align download progress typography and layout

**Files:**
- Modify: `src/views/DownloadView.tsx`
- Modify: `src/styles/home.css`

**Interfaces:**
- Consumes: existing `percent`, `stage` and progress bar state.
- Produces: a title row where percentage and preparation text share one visual line.

- [ ] **Step 1: Put percentage and title in one semantic heading row**

Render the percent and current stage inside one `.download-loading-title` wrapper,
with the percentage using the same UI font family and weight as the title.

- [ ] **Step 2: Tune responsive layout**

Use flex alignment with the percent beside the title on desktop and allow wrapping
on narrow windows. Remove the old separate heading wrapper styling.

- [ ] **Step 3: Validate layout build**

Run `npm run typecheck`, `npm run build` and `git diff --check`.
Expected: all pass.

### Task 3: Final regression checks

**Files:**
- No new files.

- [ ] **Step 1: Run the relevant frontend tests**

Run `npm run test:e2e` if the Tauri test harness is available.
Expected: navigation/download tests pass; otherwise record an environment-only
failure without changing unrelated code.

- [ ] **Step 2: Review the final diff**

Confirm only DinoLoader, DownloadView, home styles and the requested design/plan
documents changed for this feature.
