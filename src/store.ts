import { create } from "zustand";
import { releasePreviewCache, type StoryboardInfo, type VideoInfo } from "./api/dollyt";
import { EDITOR_QUARANTINED } from "./editorAvailability";

export type { VideoInfo };

export type Screen = "home" | "download" | "editor" | "presets" | "settings" | "queue";
export type DownloadState = "idle" | "loading" | "success" | "error";
export type HistoryEntry = {
  id: string;
  title: string;
  url: string;
  outputPath: string;
  thumbnailUrl: string;
  kind: "clip" | "full";
  createdAt: number;
};

const HISTORY_KEY = "dollyt.history.v1";

function readHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is HistoryEntry => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Partial<HistoryEntry>;
      return (
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.url === "string" &&
        typeof item.outputPath === "string" &&
        typeof item.thumbnailUrl === "string" &&
        (item.kind === "clip" || item.kind === "full") &&
        typeof item.createdAt === "number"
      );
    });
  } catch (error) {
    console.warn("Impossible de lire l’historique local.", error);
    return [];
  }
}

function writeHistory(history: HistoryEntry[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn("Impossible d’enregistrer l’historique local.", error);
  }
}

type DollytState = {
  screen: Screen;
  url: string;
  video: VideoInfo | null;
  storyboard: StoryboardInfo | null;
  startSecs: number;
  endSecs: number;
  playheadSecs: number;
  status: string;
  jobPercent: number;
  downloadState: DownloadState;
  downloadStage: string;
  downloadPath: string;
  downloadOutputPath: string;
  history: HistoryEntry[];
  selectedPresetId: string;
  exportFullVideo: boolean;
  setUrl: (url: string) => void;
  setVideo: (video: VideoInfo | null) => void;
  setStoryboard: (sb: StoryboardInfo | null) => void;
  patchVideo: (partial: Partial<VideoInfo>) => void;
  setRangeSecs: (start: number, end: number) => void;
  setPlayhead: (t: number) => void;
  setStatus: (status: string) => void;
  setJobPercent: (n: number) => void;
  beginDownload: () => void;
  setDownloadProgress: (stage: string, percent: number) => void;
  finishDownload: (
    ok: boolean,
    message: string,
    previewPath?: string,
    outputPath?: string,
  ) => void;
  addHistory: (entry: HistoryEntry) => void;
  removeHistory: (id: string) => void;
  resetDownload: () => void;
  setSelectedPresetId: (id: string) => void;
  setExportFullVideo: (v: boolean) => void;
  go: (screen: Screen) => void;
  goHome: () => void;
  goEditor: () => void;
};

const PROGRESS_TICK_MS = 100;
const PROGRESS_STEP = 2;
let progressTarget = 0;
let progressTimer: ReturnType<typeof setInterval> | null = null;

function stopProgressPump() {
  if (progressTimer !== null) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

export const useDollytStore = create<DollytState>((set, get) => {
  const pumpProgress = () => {
    const current = get().jobPercent;
    const gap = progressTarget - current;
    if (gap <= 0.01) {
      if (current !== progressTarget) set({ jobPercent: progressTarget });
      stopProgressPump();
      return;
    }
    set({
      jobPercent: Math.min(progressTarget, current + Math.min(PROGRESS_STEP, gap)),
    });
  };
  const ensureProgressPump = () => {
    if (progressTimer === null) {
      progressTimer = setInterval(pumpProgress, PROGRESS_TICK_MS);
    }
  };
  const resetProgress = (value: number) => {
    progressTarget = value;
    stopProgressPump();
    set({ jobPercent: value });
  };

  return {
  screen: "home",
  url: "",
  video: null,
  storyboard: null,
  startSecs: 5,
  endSecs: 12,
  playheadSecs: 5,
  status: "",
  jobPercent: 0,
  downloadState: "idle",
  downloadStage: "",
  downloadPath: "",
  downloadOutputPath: "",
  history: readHistory(),
  selectedPresetId: "tiktok",
  exportFullVideo: false,
  setUrl: (url) => set({ url }),
  setVideo: (video) => {
    if (!video) {
      set({ video: null });
      return;
    }
    const duration = Math.max(0, Number(video.durationSecs) || 0);
    const span = duration > 180 ? 30 : duration > 60 ? 20 : 7;
    const start = 0;
    const end = Math.min(duration, Math.max(span, 1));
    set({
      video,
      startSecs: start,
      endSecs: end,
      playheadSecs: start,
    });
  },
  setStoryboard: (storyboard) => set({ storyboard }),
  patchVideo: (partial) =>
    set((s) => (s.video ? { video: { ...s.video, ...partial } } : s)),
  setRangeSecs: (startSecs, endSecs) => set({ startSecs, endSecs }),
  setPlayhead: (playheadSecs) => set({ playheadSecs }),
  setStatus: (status) => set({ status }),
  setJobPercent: (jobPercent) => {
    progressTarget = Math.min(100, Math.max(0, jobPercent));
    stopProgressPump();
    set({ jobPercent: progressTarget });
  },
  beginDownload: () => {
    resetProgress(0);
    set({
      downloadState: "loading",
      downloadStage: "Préparation",
      downloadPath: "",
      downloadOutputPath: "",
      status: "",
    });
  },
  setDownloadProgress: (downloadStage, jobPercent) => {
    progressTarget = Math.min(100, Math.max(progressTarget, jobPercent));
    ensureProgressPump();
    set({ downloadState: "loading", downloadStage });
  },
  finishDownload: (ok, status, downloadPath = "", downloadOutputPath = "") => {
    resetProgress(ok ? 100 : 0);
    set({
      downloadState: ok ? "success" : "error",
      status,
      downloadPath,
      downloadOutputPath,
    });
  },
  addHistory: (entry) =>
    set((state) => {
      const history = [
        entry,
        ...state.history.filter((item) => item.outputPath !== entry.outputPath),
      ].slice(0, 50);
      writeHistory(history);
      return { history };
    }),
  removeHistory: (id) =>
    set((state) => {
      const history = state.history.filter((entry) => entry.id !== id);
      writeHistory(history);
      return { history };
    }),
  resetDownload: () => {
    resetProgress(0);
    set({
      downloadState: "idle",
      downloadStage: "",
      downloadPath: "",
      downloadOutputPath: "",
      status: "",
    });
  },
  setSelectedPresetId: (selectedPresetId) => set({ selectedPresetId }),
  setExportFullVideo: (exportFullVideo) => set({ exportFullVideo }),
  go: (screen) => {
    if (EDITOR_QUARANTINED && screen === "editor") return;
    set({ screen });
  },
  goHome: () => {
    void releasePreviewCache().catch(() => {});
    resetProgress(0);
    set({
      screen: "home",
      url: "",
      video: null,
      storyboard: null,
      status: "",
      downloadState: "idle",
      downloadStage: "",
      downloadPath: "",
      downloadOutputPath: "",
    });
  },
  goEditor: () => {
    if (EDITOR_QUARANTINED) return;
    set({ screen: "editor" });
  },
  };
});
