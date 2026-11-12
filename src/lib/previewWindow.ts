/** Fenêtre preview locale [start, start + span] sur la timeline. */
export function previewWindowStart(
  playhead: number,
  duration: number,
  windowSecs = 60,
): number {
  const win = Math.max(10, windowSecs);
  if (duration <= win) return 0;
  const lead = 3;
  let start = Math.max(0, playhead - lead);
  start = Math.min(start, Math.max(0, duration - win));
  return start;
}

export function playheadInPreview(
  playhead: number,
  previewStart: number,
  fileDur: number,
): boolean {
  const span = Math.max(0.5, fileDur);
  return playhead >= previewStart - 0.05 && playhead <= previewStart + span + 0.05;
}

export function timelineToLocalTime(playhead: number, previewStart: number): number {
  return Math.max(0, playhead - previewStart);
}
