import { seekToFrame } from "./videoSeek";

/** Vignettes sur un élément vidéo dédié pour ne pas décaler la preview. */
import { previewSrc } from "./previewSrc";

function stripSampleTime(i: number, n: number, duration: number): number {
  if (n <= 1) return 0;
  if (i === 0) return Math.min(duration, Math.max(0.08, duration * 0.02));
  return (duration * i) / Math.max(n - 1, 1);
}

async function captureStrip(
  video: HTMLVideoElement,
  duration: number,
  count: number,
): Promise<string[]> {
  const n = Math.max(2, Math.min(count, Math.ceil(duration)));
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const wasPaused = video.paused;
  const t0 = video.currentTime;
  video.pause();
  const out: string[] = [];
  const fileDur =
    video.duration > 0 && Number.isFinite(video.duration)
      ? video.duration
      : duration;
  const span = Math.min(duration, fileDur);
  for (let i = 0; i < n; i++) {
    const t = Math.min(span, stripSampleTime(i, n, span));
    await seeked(video, t);
    if (i === 0) await paintReady(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    out.push(canvas.toDataURL("image/jpeg", 0.9));
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  await seeked(video, t0);
  if (!wasPaused) void video.play();
  return out;
}

/** Vignettes HD pour la fenêtre visible (fichier local déjà chargé). */
export async function buildFilmstripWindow(
  previewUrl: string,
  viewStart: number,
  viewSpan: number,
  count: number,
): Promise<string[]> {
  const video = document.createElement("video");
  video.src = previewSrc(previewUrl);
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  await waitMetadata(video);
  const span = Math.max(0.001, viewSpan);
  const n = Math.max(2, Math.min(count, 16));
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  const wasPaused = video.paused;
  const t0 = video.currentTime;
  video.pause();
  const out: string[] = [];
  const fileDur =
    video.duration > 0 && Number.isFinite(video.duration)
      ? video.duration
      : viewStart + span;
  for (let i = 0; i < n; i++) {
    const t = Math.min(
      fileDur,
      viewStart + (span * i) / Math.max(n - 1, 1),
    );
    await seeked(video, t);
    if (i === 0) await paintReady(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    out.push(canvas.toDataURL("image/jpeg", 0.9));
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  await seeked(video, t0);
  if (!wasPaused) void video.play();
  video.removeAttribute("src");
  video.load();
  return out;
}

export async function buildFilmstrip(
  previewUrl: string,
  duration: number,
  count: number,
): Promise<string[]> {
  const video = document.createElement("video");
  video.src = previewSrc(previewUrl);
  video.muted = true;
  video.preload = "auto";
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  await waitMetadata(video);
  const out = await captureStrip(video, duration, count);
  video.removeAttribute("src");
  video.load();
  return out;
}

/** Repli : même lecteur que la preview (WebView / fichier local). */
export async function buildFilmstripFromVideo(
  video: HTMLVideoElement,
  duration: number,
  count: number,
): Promise<string[]> {
  if (video.readyState < 1) await waitMetadata(video);
  const span = video.duration > 0 ? video.duration : duration;
  return captureStrip(video, Math.min(duration, span), count);
}

function waitMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onErr = () => reject(new Error("preview indisponible"));
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", onErr, { once: true });
  });
}

function paintReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    if (typeof video.requestVideoFrameCallback === "function") {
      video.requestVideoFrameCallback(() => done());
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(done));
  });
}

function seeked(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.02) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    seekToFrame(video, time, true);
  });
}
