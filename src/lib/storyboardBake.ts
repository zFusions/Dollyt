import type { StoryboardFrame, StoryboardMeta } from "./storyboardStrip";
import { tileSizeFromSheet } from "./storyboardStrip";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("storyboard"));
    img.src = src;
  });
}

/** Une vignette JPEG par case — plus de sprites CSS qui se superposent. */
export async function bakeStoryboardCell(
  frame: StoryboardFrame,
  _sb: StoryboardMeta,
): Promise<string> {
  const img = await loadImage(frame.sheetUrl);
  const { tw, th } = tileSizeFromSheet(img.naturalWidth, img.naturalHeight, frame);
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, frame.col * tw, frame.row * th, tw, th, 0, 0, tw, th);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export async function bakeStoryboardStrip(
  frames: StoryboardFrame[],
  sb: StoryboardMeta,
): Promise<string[]> {
  const out: string[] = [];
  for (const f of frames) {
    try {
      const url = await bakeStoryboardCell(f, sb);
      if (url) out.push(url);
    } catch {
      // shortcut: CORS ou réseau, vignette ignorée
    }
  }
  return out;
}
