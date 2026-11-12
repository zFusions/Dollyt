/** Découpe un jeu de vignettes pleine durée pour la fenêtre visible. */
export function masterThumbsForView(
  paths: string[],
  videoDuration: number,
  viewStart: number,
  viewSpan: number,
  count: number,
): string[] {
  if (paths.length < 2 || videoDuration <= 0 || count < 2) return [];
  const span = Math.max(0.001, viewSpan);
  const n = Math.max(2, count);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = viewStart + (span * i) / Math.max(n - 1, 1);
    const idx = Math.round((t / videoDuration) * (paths.length - 1));
    const clamped = Math.min(paths.length - 1, Math.max(0, idx));
    out.push(paths[clamped]!);
  }
  return out;
}

export function masterFrameCount(durationSecs: number): number {
  if (durationSecs <= 120) return 24;
  if (durationSecs <= 600) return 40;
  if (durationSecs <= 3600) return 56;
  return 72;
}
