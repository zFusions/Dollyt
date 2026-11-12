import { invoke, isTauri } from "@tauri-apps/api/core";

export type VideoInfo = {
  title: string;
  durationSecs: number;
  previewUrl: string;
  /** Fichier local (prioritaire pour la lecture). */
  previewLocalUrl?: string | null;
  formatId: string;
  exportFormatId: string;
  previewFps: number;
  previewFileDurationSecs?: number | null;
  /** Début de la fenêtre preview locale sur la timeline YouTube. */
  previewStartSecs?: number | null;
};

export type StoryboardInfo = {
  templateUrl?: string | null;
  intervalSecs?: number | null;
  columns?: number | null;
  rows?: number | null;
  width?: number | null;
  height?: number | null;
};

export type LoadVideoResponse = {
  video: VideoInfo;
  storyboard: StoryboardInfo;
};

export type Settings = {
  exportDir: string;
  nameTemplate: string;
  hardwareEncode: boolean;
  /** firefox | "" */
  ytdlpCookiesBrowser: string;
  ytdlpCookiesFile: string;
  youtubeOnboardingDone: boolean;
  defaultPresetId: string;
  developerMode: boolean;
  devCrf: number | null;
  devVideoMaxBitrateKbps: number | null;
  devFps: number | null;
  devAudioBitrateKbps: number | null;
  devX264Preset: string;
};

export type Preset = {
  id: string;
  name: string;
  container: string;
  videoCodec: string;
  audioCodec: string;
  crf: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  crop: string;
  audioBitrateKbps: number | null;
  nameTemplate: string;
  description: string;
  videoMaxBitrateKbps: number | null;
};

const MOCK: VideoInfo = {
  title: "Me at the zoo (mock)",
  durationSecs: 19,
  previewUrl: "",
  formatId: "18",
  exportFormatId: "308+251",
  previewFps: 30,
};

export async function loadVideo(rawUrl: string): Promise<LoadVideoResponse> {
  if (isTauri()) {
    return invoke<LoadVideoResponse>("load_video", { rawUrl });
  }
  await new Promise((r) => setTimeout(r, 400));
  return {
    video: { ...MOCK, title: `Mock — ${rawUrl.slice(0, 48)}` },
    storyboard: {},
  };
}

export async function cancelLocalPreview(): Promise<void> {
  if (!isTauri()) return;
  await invoke("cancel_local_preview");
}

export async function startLocalPreview(
  rawUrl: string,
  formatId: string,
  durationSecs: number,
  startSecs?: number,
  full = false,
): Promise<void> {
  if (!isTauri()) return;
  await invoke("start_local_preview", {
    rawUrl,
    formatId,
    durationSecs,
    startSecs: startSecs ?? null,
    full,
  });
}

export async function getStoryboard(rawUrl: string): Promise<StoryboardInfo> {
  if (!isTauri()) return {};
  return invoke<StoryboardInfo>("get_storyboard", { rawUrl });
}

export type TimelineFilmstrip = { frames: string[] };

export async function resolvePreviewUrl(
  rawUrl: string,
  formatId: string,
): Promise<string> {
  if (!isTauri()) return "";
  return invoke<string>("resolve_preview_url", { rawUrl, formatId });
}

export async function releasePreviewCache(): Promise<void> {
  if (!isTauri()) return;
  await invoke("release_preview_cache");
}

export async function getTimelineFilmstripMaster(
  videoPath: string,
  durationSecs: number,
  frameCount: number,
): Promise<string[]> {
  if (!isTauri()) return [];
  const raw = await invoke<TimelineFilmstrip>("get_timeline_filmstrip_master", {
    videoPath,
    durationSecs,
    frameCount,
  });
  return raw.frames ?? [];
}

export async function getTimelineFilmstrip(args: {
  videoPath: string;
  viewStart: number;
  viewSpan: number;
  previewStart: number;
  frameCount: number;
}): Promise<string[]> {
  if (!isTauri()) return [];
  const raw = await invoke<TimelineFilmstrip>("get_timeline_filmstrip", {
    videoPath: args.videoPath,
    viewStart: args.viewStart,
    viewSpan: args.viewSpan,
    previewStart: args.previewStart,
    frameCount: args.frameCount,
  });
  return raw.frames ?? [];
}

export async function startCutJob(args: {
  rawUrl: string;
  formatId: string;
  startSecs: number;
  endSecs: number;
  presetId: string;
}): Promise<number> {
  if (isTauri()) {
    return invoke<number>("start_cut_job_command", args);
  }
  throw new Error("Export disponible seulement dans l’app Tauri (npm run tauri dev).");
}

export async function cancelJob(): Promise<void> {
  if (isTauri()) {
    await invoke("cancel_job");
  }
}

export async function listPresets(): Promise<Preset[]> {
  if (!isTauri()) return [];
  return invoke<Preset[]>("list_presets");
}

export async function getSettings(): Promise<Settings | null> {
  if (!isTauri()) return null;
  return invoke<Settings>("get_settings");
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!isTauri()) return;
  await invoke("save_settings_cmd", { settings });
}

export type YtdlpUpdateResult = { alreadyLatest: boolean };

export async function updateYtdlp(): Promise<YtdlpUpdateResult | null> {
  if (!isTauri()) return { alreadyLatest: true };
  return invoke<YtdlpUpdateResult>("update_ytdlp");
}

export async function openYoutubeLogin(): Promise<void> {
  if (!isTauri()) return;
  await invoke("open_youtube_login");
}

export async function closeYoutubeLogin(): Promise<void> {
  if (!isTauri()) return;
  await invoke("close_youtube_login");
}

export async function probeYoutubeSession(): Promise<void> {
  if (!isTauri()) return;
  await invoke("probe_youtube_session");
}

export async function pickCookiesFile(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("pick_cookies_file");
}

export async function pickExportDirectory(): Promise<string | null> {
  if (!isTauri()) return null;
  return invoke<string | null>("pick_export_directory");
}
