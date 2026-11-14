import type { Preset } from "../api/dollyt";
import { t } from "../i18n";

export const SOCIAL_PRESET_IDS = new Set([
  "tiktok",
  "reels",
  "shorts",
  "x",
  "youtube",
]);

const PRESET_NAMES: Record<string, () => string> = {
  edition: () => t("presetNameEdition"),
  source: () => t("presetNameSource"),
  "quality-max": () => t("presetNameQualityMax"),
  audio: () => t("presetNameAudio"),
  "audio-lossless": () => t("presetNameAudioLossless"),
};

export function presetDisplayName(p: Preset): string {
  return PRESET_NAMES[p.id]?.() ?? p.name;
}

export function presetShortLabel(p: Preset): string {
  return presetDisplayName(p);
}

export type PresetGroup = "social" | "other" | "audio";

export function presetGroupKey(p: Preset): PresetGroup {
  if (p.videoCodec === "none") return "audio";
  return SOCIAL_PRESET_IDS.has(p.id) ? "social" : "other";
}

export function presetGroupLabel(key: PresetGroup): string {
  if (key === "social") return t("networks");
  if (key === "audio") return t("sound");
  return t("others");
}

const GROUP_ORDER: Record<PresetGroup, number> = {
  social: 0,
  other: 1,
  audio: 2,
};

export function presetSelectOptions(presets: Preset[]) {
  return [...presets]
    .sort(
      (a, b) =>
        GROUP_ORDER[presetGroupKey(a)] - GROUP_ORDER[presetGroupKey(b)],
    )
    .map((p) => ({
      value: p.id,
      label: presetShortLabel(p),
      iconId: p.id,
      group: presetGroupLabel(presetGroupKey(p)),
    }));
}

export type PresetBrief = { lead: string; points: string[] };

function presetBriefs(): Record<string, PresetBrief> {
  return {
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
    audio: {
      lead: t("audioBrief"),
      points: [],
    },
    "audio-lossless": {
      lead: t("audioLosslessBrief"),
      points: [],
    },
  };
}

export function presetBrief(p: Preset): PresetBrief {
  return (
    presetBriefs()[p.id] ?? {
      lead: p.description || p.name,
      points: [],
    }
  );
}

/** Sous-titre de ligne dans la liste. */
export function presetRowSub(p: Preset): string {
  const key = PRESET_SUB_KEYS[p.id];
  return key ? t(key) : presetBrief(p).lead;
}

const PRESET_SUB_KEYS: Record<string, Parameters<typeof t>[0]> = {
  tiktok: "tiktokSub",
  reels: "reelsSub",
  shorts: "shortsSub",
  youtube: "youtubeSub",
  x: "xSub",
  edition: "editionSub",
  source: "sourceSub",
  "quality-max": "qualityMaxSub",
  audio: "audioSub",
  "audio-lossless": "audioLosslessSub",
};

function videoCodecLabel(codec: string): string {
  if (codec === "libx264") return t("h264");
  if (codec === "copy") return t("copy");
  return codec;
}

/** Badge format court : MP4 · H.264, MKV · COPIE, MP3 · 320k, FLAC. */
export function presetRowFormat(p: Preset): string {
  const container = p.container.toUpperCase();
  if (p.videoCodec === "none") {
    if (p.audioCodec === "flac") return t("lossless");
    return p.audioBitrateKbps != null ? `${p.audioBitrateKbps}k` : container;
  }
  if (p.videoCodec === "copy") {
    return `${container} · ${t("copy").toUpperCase()}`;
  }
  return `${container} · ${videoCodecLabel(p.videoCodec).toUpperCase()}`;
}

/** Colonne droite : ce que le fichier exporté contient. */
export function presetRowExportSpec(p: Preset): string {
  if (p.videoCodec === "none") {
    const codec =
      p.audioCodec === "libmp3lame"
        ? "MP3"
        : p.audioCodec === "flac"
          ? "FLAC"
          : p.audioCodec;
    const parts = [`.${p.container}`, codec];
    if (p.audioBitrateKbps != null) parts.push(`${p.audioBitrateKbps} kbps`);
    return parts.join(" · ");
  }
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
