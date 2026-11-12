import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

/** Fichier local (Tauri) ou URL distante pour &lt;video&gt;. */
export function previewSrc(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return isTauri() ? convertFileSrc(pathOrUrl) : pathOrUrl;
}
