import type { Preset } from "../api/dollyt";

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
    lead: "MP4 vertical 1080×1920, pensé pour poster sur TikTok.",
    points: [
      "Vidéo H.264, 30 fps, recadrage centré en 9:16.",
      "TikTok ne publie pas de plafond Mbps pour l’upload : Dollyt n’en impose pas non plus.",
      "Les « 100 Mbps » dans leur doc, c’est la bande passante de leur serveur, pas la taille de ton export.",
    ],
  },
  reels: {
    lead: "MP4 vertical pour Reels, calé sur les limites Meta.",
    points: [
      "Jusqu’à 1080×1920, H.264, 30 fps.",
      "Plafond vidéo 25 Mbps, audio AAC 128 kbps.",
    ],
  },
  shorts: {
    lead: "MP4 vertical pour YouTube Shorts.",
    points: [
      "1080×1920, H.264, 30 fps.",
      "Débit cible 8 Mbps (recommandation YouTube SDR, pas un maximum API).",
    ],
  },
  youtube: {
    lead: "MP4 paysage pour une vidéo YouTube classique.",
    points: [
      "1920×1080, H.264, 30 fps.",
      "Débit cible 8 Mbps (recommandation d’upload Google).",
    ],
  },
  x: {
    lead: "MP4 vertical pour X (Twitter).",
    points: [
      "1080×1920, H.264, 30 fps.",
      "Plafond 25 Mbps côté aide X.",
    ],
  },
  edition: {
    lead: "MP4 haute qualité pour garder une copie chez toi.",
    points: [
      "H.264 avec CRF 14, sans recadrage imposé.",
      "Utile avant de repasser par un preset réseau.",
    ],
  },
  source: {
    lead: "On copie le flux tel quel, sans ré-encodage.",
    points: [
      "Fichier MKV, export rapide.",
      "Plus lourd qu’un MP4 réencodé.",
    ],
  },
  "quality-max": {
    lead: "On prend le meilleur flux que YouTube propose, puis on le garde en copie.",
    points: [
      "MKV, vidéo et son en copie (pas de plafond Mbps ni de fps forcé par Dollyt).",
      "Prévois du temps, de la place disque et une bonne connexion.",
    ],
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
    tiktok: "Vertical TikTok",
    reels: "Limite Meta",
    shorts: "Shorts vertical",
    youtube: "Vidéo paysage",
    x: "Post vertical X",
    edition: "Archive locale",
    source: "Sans ré-encodage",
    "quality-max": "Flux YouTube au max",
  };
  return byId[p.id] ?? presetBrief(p).lead;
}

function videoCodecLabel(codec: string): string {
  if (codec === "libx264") return "H.264";
  if (codec === "copy") return "copie";
  return codec;
}

/** Colonne droite : ce que le fichier exporté contient. */
export function presetRowExportSpec(p: Preset): string {
  if (p.videoCodec === "copy") {
    return p.id === "quality-max"
      ? `.${p.container} · flux HQ · copie`
      : `.${p.container} · copie`;
  }
  const parts: string[] = [
    `.${p.container}`,
    videoCodecLabel(p.videoCodec),
  ];
  if (p.width && p.height) parts.push(`${p.width}×${p.height}`);
  if (p.fps) parts.push(`${p.fps} fps`);
  if (p.crf != null) parts.push(`CRF ${p.crf}`);
  if (p.videoMaxBitrateKbps != null) {
    const mbps = p.videoMaxBitrateKbps / 1000;
    const n = Number.isInteger(mbps) ? String(mbps) : mbps.toFixed(1);
    parts.push(`≤ ${n} Mbps`);
  }
  return parts.join(" · ");
}

/** Pastille courte (accueil, résumés). */
export function presetRowChip(p: Preset): string {
  if (p.width && p.height) {
    return p.height > p.width ? "1080×1920" : "1920×1080";
  }
  if (p.videoCodec === "copy") return "Copie";
  return `.${p.container}`;
}

/** Résumé technique court pour l’accueil / exports. */
export function presetSummaryLine(p: Preset): string {
  const chip = presetRowChip(p);
  if (p.videoMaxBitrateKbps != null) {
    const mbps = p.videoMaxBitrateKbps / 1000;
    const n = Number.isInteger(mbps) ? String(mbps) : mbps.toFixed(1);
    return `${chip} · ${n} Mbps`;
  }
  if (p.id === "tiktok") return `${chip} · pas de plafond publié`;
  return chip;
}
