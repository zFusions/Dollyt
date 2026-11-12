# Dollyt Runner Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable loading Dino with a polished, local Dollyt runner that has dependable input, collision, scoring, pause, and restart behavior.

**Architecture:** Keep `DinoLoader` as the public React component and replace its canvas loop with a small explicit state machine and time-based simulation. Keep rendering local and original to Dollyt; do not copy remote assets or add a runtime dependency.

**Tech Stack:** React 19, TypeScript, Canvas 2D, CSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-dollyt-runner-design.md`

## Global Constraints

- No new package or remote asset.
- Keep the existing `DinoLoader({ active: boolean })` interface.
- Keep the game local, silent, and free of telemetry.
- Respect `prefers-reduced-motion`.
- Preserve the download screen's draggable header and existing loading flow.

## Review Focus

- Repeated Space/click input must not create duplicate animation loops; verify one active loop after restart.
- A hidden and then visible window must resume without a giant physics jump; verify the first resumed frame is bounded.
- Reduced motion must still allow input and collision while disabling decorative animation.
- Fast obstacles must collide using hitboxes, not only painted pixels.
- Unmounting the loading view must remove listeners and cancel the frame; verify navigation does not leave a running loop.

---

### Task 1: Replace the runner simulation and renderer

**Files:**
- Modify: `src/components/DinoLoader.tsx`
- Modify: `src/styles/home.css` only if the new canvas layout needs visual adjustments

**Interfaces:**
- Consumes: existing `active` prop and Dollyt CSS variables.
- Produces: the same `DinoLoader({ active: boolean })` component, with `ready`, `running`, and `game-over` states.

- [ ] **Step 1: Add a deterministic game model inside the component**

Use explicit state for `status`, `dinoY`, `velocityY`, `score`, `speed`, and an obstacle list. Keep world coordinates independent from CSS size and cap frame delta at 32ms.

- [ ] **Step 2: Implement input and lifecycle guards**

Make Space, ArrowUp, and canvas pointer input call one guarded action: start from `ready`, jump only while grounded, and reset from `game-over`. Store the active RAF id and ensure start cannot schedule a second loop.

- [ ] **Step 3: Implement collision, scoring, restart, and visibility handling**

Use inset rectangle hitboxes, score an obstacle only once, recycle obstacles with a bounded random gap, pause on `document.hidden`, and reset `lastTime` before resuming.

- [ ] **Step 4: Draw an original Dollyt scene**

Render a clean safelight runner with a dino silhouette, ground marks, two obstacle variants, score, and concise state prompts. Use existing font families and colors; avoid copied Chrome sprites or external files.

- [ ] **Step 5: Run the focused checks**

Run `npm run typecheck` and `npm run build`.
Expected: both commands exit 0.

### Task 2: Verify interaction and cleanup

**Files:**
- Test: `e2e/dino-loader.spec.ts`
- Modify: `e2e/nav-transition.spec.ts` only if shared setup is required

**Interfaces:**
- Consumes: the rendered loading screen and existing navigation controls.
- Produces: browser coverage for start, restart, and cleanup behavior.

- [ ] **Step 1: Add a browser test for the ready state**

Navigate to the download/loading view and assert the game prompt is visible before any key input.

- [ ] **Step 2: Add input and restart coverage**

Press Space, wait briefly, assert the canvas remains visible, then exercise a restart input after the game-over prompt without creating a second canvas or error.

- [ ] **Step 3: Add reduced-motion coverage**

Emulate `prefers-reduced-motion: reduce`, start the game, and assert the loading screen remains usable.

- [ ] **Step 4: Run the focused and full checks**

Run `npx playwright test e2e/dino-loader.spec.ts` and then `npm run test:e2e`.
Expected: all tests pass with no console errors.

### Task 3: Final validation

**Files:**
- None

- [ ] **Step 1: Review the diff**

Run `git diff --check` and inspect that no remote asset, package, telemetry, or unrelated UI change was introduced.

- [ ] **Step 2: Run the production checks**

Run `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
Expected: all commands exit 0.
