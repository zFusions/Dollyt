/** Seek sans couper la lecture sauf si pause: true (filmstrip dédié). */
export function seekToFrame(
  video: HTMLVideoElement,
  secs: number,
  pause = false,
) {
  const max = Number.isFinite(video.duration) ? video.duration : secs;
  const t = Math.max(0, Math.min(secs, max));
  if (Math.abs(video.currentTime - t) < 0.0005) return;
  if (pause) video.pause();
  try {
    video.currentTime = t;
  } catch {
  }
}
