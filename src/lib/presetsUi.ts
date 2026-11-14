import type { Preset } from "../api/dollyt";
import { t } from "../i18n";

export const SOCIAL_PRESET_IDS = new Set([
  "tiktok",
  "reels",
  "shorts",
  "x",
  "youtube",
]);

export function presetShortLabel(p: Preset): string {
  return p.name;
}

export type PresetBrief = { lead: string; points: string[] };

const PRESET_BRIEF: Record<string, PresetBrief> = {
  tiktok: {
    lead: t("tiktokBrief"),
    points: [t("tiktokPoint1"), t("tiktokPoint2"), t("tiktokPoint3")],
  },
  reels: {
    lead: t("reelsBrief"),
    points: [t("reelsPoint1"), t("reelsPoint2")],
  },
  shorts: {
    lead: t("shortsBrief"),
    points: [t("shortsPoint1"), t("shortsPoint2")],
  },
  youtube: {
    lead: t("youtubeBrief"),
    points: [t("youtubePoint1"), t("youtubePoint2")],
  },
  x: {
    lead: t("xBrief"),
    points: [t("xPoint1"), t("xPoint2")],
  },
  edition: {
    lead: t("editionBrief"),
    points: [t("editionPoint1"), t("editionPoint2")],
  },
  source: {
    lead: t("sourceBrief"),
    points: [t("sourcePoint1"), t("sourcePoint2")],
  },
  "quality-max": {
    lead: t("qualityMaxBrief"),
    points: [t("qualityMaxPoint1"), t("qualityMaxPoint2")],
  },
};

export function presetBrief(p: Preset): PresetBrief {
  return (
    PRESET_BRIEF[p.id] ?? {
      lead: p.description || p.name,
      points: [],
    }
  );
}

/** Sous-titre de ligne dans la liste. */
export function presetRowSub(p: Preset): string {
  const byId: Record<string, string> = {
    tiktok: t("tiktokSub"),
    reels: t("reelsSub"),
    shorts: t("shortsSub"),
    youtube: t("youtubeSub"),
    x: t("xSub"),
    edition: t("editionSub"),
    source: t("sourceSub"),
    "quality-max": t("qualityMaxSub"),
  };
  return byId[p.id] ?? presetBrief(p).lead;
}

function videoCodecLabel(codec: string): string {
  if (codec === "libx264") return t("h264");
  if (codec === "copy") return t("copy");
  return codec;
}

/** Colonne droite : ce que le fichier exporté contient. */
export function presetRowExportSpec(p: Preset): string {
  if (p.videoCodec === "copy") {
    return p.id === "quality-max"
      ? `.${p.container} · ${t("copyHq")}`
      : `.${p.container} · ${t("copyNoMax")}`;
  }
  const parts: string[] = [
    `.${p.container}`,
    videoCodecLabel(p.videoCodec),
  ];
  if (p.width && p.height) parts.push(`${p.width}×${p.height}`);
  if (p.fps) parts.push(`${p.fps} ${t("fps")}`);
  if (p.crf != null) parts.push(`${t("crf")} ${p.crf}`);
  if (p.videoMaxBitrateKbps != null) {
    const mbps = p.videoMaxBitrateKbps / 1000;
    const n = Number.isInteger(mbps) ? String(mbps) : mbps.toFixed(1);
    parts.push(`${t("maxBitrate")} ${n} ${t("mbps")}`);
  }
  return parts.join(" · ");
}

/** Pastille courte (accueil, résumés). */
export function presetRowChip(p: Preset): string {
  if (p.width && p.height) {
    return p.height > p.width ? t("vertical") : t("landscape");
  }
  if (p.videoCodec === "copy") return t("copy");
  return `.${p.container}`;
}

/** Résumé technique court pour l’accueil / exports. */
export function presetSummaryLine(p: Preset): string {
  const chip = presetRowChip(p);
  if (p.videoMaxBitrateKbps != null) {
    const mbps = p.videoMaxBitrateKbps / 1000;
    const n = Number.isInteger(mbps) ? String(mbps) : mbps.toFixed(1);
    return `${chip} · ${n} ${t("mbps")}`;
  }
  if (p.id === "tiktok") return `${chip} · ${t("noCap")}`;
  return chip;
}
