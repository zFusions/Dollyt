export function snapToFrame(secs: number, fps: number): number {
  const step = 1 / fps;
  return Math.round(secs / step) * step;
}

export function clampTime(secs: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, secs));
}

export function formatTimecode(secs: number, fps: number): string {
  const snapped = snapToFrame(secs, fps);
  const minutes = Math.floor(snapped / 60);
  const seconds = Math.floor(snapped % 60);
  const frames = Math.round((snapped - Math.floor(snapped)) * fps);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const ff = String(frames).padStart(2, "0");
  return `${mm}:${ss}.${ff}`;
}

/** Lecture transport type Medal (dixièmes). */
export function formatTimeTransport(secs: number): string {
  const t = Math.max(0, secs);
  const mm = String(Math.floor(t / 60)).padStart(2, "0");
  const ss = Math.floor(t % 60);
  const d = Math.min(9, Math.floor((t % 1) * 10));
  return `${mm}:${String(ss).padStart(2, "0")}.${d}`;
}

export function formatRulerLabel(secs: number): string {
  const t = Math.max(0, secs);
  if (t >= 3600) {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    return `${h}:${String(m).padStart(2, "0")}`;
  }
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Pas de graduation lisible pour une fenêtre timeline (secondes). */
export function rulerMinorStep(viewSpan: number): number {
  if (viewSpan <= 0) return 1;
  const rough = viewSpan / 36;
  const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900];
  for (const s of steps) {
    if (s >= rough) return s;
  }
  return 900;
}

export function rulerLabelStep(viewSpan: number): number {
  const rough = viewSpan / 7;
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800];
  for (const s of steps) {
    if (s >= rough) return s;
  }
  return 1800;
}
