import { create } from "zustand";
import { releasePreviewCache, type StoryboardInfo, type VideoInfo } from "./api/dollyt";
import { EDITOR_QUARANTINED } from "./editorAvailability";

export type { VideoInfo };

export type Screen = "home" | "download" | "editor" | "presets" | "settings" | "queue";
export type DownloadState = "idle" | "loading" | "success" | "error";
export type ExportJobState = "queued" | "running" | "success" | "error" | "cancelled";
export type ExportJob = {
  id: number;
  url: string;
  title: string;
  thumbnailUrl: string;
  kind: "clip" | "full";
  startSecs?: number;
  endSecs?: number;
  stage: string;
  percent: number | null;
  state: ExportJobState;
  message: string;
  outputPath: string;
  previewPath: string;
};
export type HistoryEntry = {
  id: string;
  title: string;
  url: string;
  outputPath: string;
  thumbnailUrl: string;
  kind: "clip" | "full";
  startSecs?: number;
  endSecs?: number;
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
  jobPercent: number | null;
  downloadState: DownloadState;
  downloadStage: string;
  downloadPath: string;
  downloadOutputPath: string;
  history: HistoryEntry[];
  jobs: ExportJob[];
  activeJobId: number | null;
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
  setDownloadProgress: (stage: string, percent: number | null) => void;
  finishDownload: (
    ok: boolean,
    message: string,
    previewPath?: string,
    outputPath?: string,
  ) => void;
  addHistory: (entry: HistoryEntry) => void;
  addJob: (job: ExportJob) => void;
  updateJob: (id: number, patch: Partial<ExportJob>) => void;
  finishJob: (
    id: number,
    ok: boolean,
    message: string,
    previewPath?: string,
    outputPath?: string,
  ) => void;
  removeJob: (id: number) => void;
  setActiveJob: (id: number | null) => void;
  removeHistory: (id: string) => void;
  resetDownload: () => void;
  setSelectedPresetId: (id: string) => void;
  setExportFullVideo: (v: boolean) => void;
  resetClipFields: () => void;
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
    const current = get().jobPercent ?? 0;
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
  startSecs: 0,
  endSecs: 5,
  playheadSecs: 0,
  status: "",
  jobPercent: 0,
  downloadState: "idle",
  downloadStage: "",
  downloadPath: "",
  downloadOutputPath: "",
  history: readHistory(),
  jobs: [],
  activeJobId: null,
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
      downloadStage: "",
      downloadPath: "",
      downloadOutputPath: "",
      status: "",
    });
  },
  setDownloadProgress: (downloadStage, jobPercent) => {
    if (jobPercent === null) {
      set({ downloadState: "loading", downloadStage });
      return;
    }
    const floor = get().jobPercent ?? 0;
    progressTarget = Math.min(100, Math.max(progressTarget, floor, jobPercent));
    ensureProgressPump();
    set({ downloadState: "loading", downloadStage });
  },
  finishDownload: (ok, status, downloadPath = "", downloadOutputPath = "") => {
    resetProgress(ok ? 100 : 0);
    set({
      downloadState: ok ? "success" : "error",
      status: ok ? "" : status,
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
  addJob: (job) =>
    set((state) => ({ jobs: [...state.jobs, job] })),
  updateJob: (id, patch) =>
    set((state) => ({
      jobs: state.jobs.map((job) => {
        if (job.id !== id) return job;
        let percent = job.percent;
        if (patch.percent !== undefined && patch.percent !== null) {
          percent =
            job.percent == null
              ? patch.percent
              : Math.max(job.percent, patch.percent);
        }
        return { ...job, ...patch, percent };
      }),
    })),
  finishJob: (id, ok, message, previewPath = "", outputPath = "") =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === id
          ? {
              ...job,
              state:
                ok
                  ? "success"
                  : message === "annulé" || message === "opération annulée"
                    ? "cancelled"
                    : "error",
              message,
              previewPath,
              outputPath,
              percent: ok ? 100 : job.percent,
            }
          : job,
      ),
      activeJobId: state.activeJobId === id ? null : state.activeJobId,
    })),
  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== id),
      activeJobId: state.activeJobId === id ? null : state.activeJobId,
    })),
  setActiveJob: (id) => set({ activeJobId: id }),
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
  resetClipFields: () =>
    set({ startSecs: 0, endSecs: 5, playheadSecs: 0, exportFullVideo: false }),
  go: (screen) => {
    if (EDITOR_QUARANTINED && screen === "editor") return;
    set(screen === "home" ? { screen, status: "" } : { screen });
  },
  goHome: () => {
    void releasePreviewCache().catch(() => {});
    const hasActiveJob = get().jobs.some(
      (job) => job.state === "running" || job.state === "queued",
    );
    if (!hasActiveJob) resetProgress(0);
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
