import { create } from "zustand";
import { releasePreviewCache, type StoryboardInfo, type VideoInfo } from "./api/dollyt";
import { EDITOR_QUARANTINED } from "./editorAvailability";

export type { VideoInfo };

export type Screen = "home" | "editor" | "presets" | "settings" | "queue";

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
  setSelectedPresetId: (id: string) => void;
  setExportFullVideo: (v: boolean) => void;
  go: (screen: Screen) => void;
  goHome: () => void;
  goEditor: () => void;
};

export const useDollytStore = create<DollytState>((set) => ({
  screen: "home",
  url: "",
  video: null,
  storyboard: null,
  startSecs: 5,
  endSecs: 12,
  playheadSecs: 5,
  status: "",
  jobPercent: 0,
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
  setJobPercent: (jobPercent) => set({ jobPercent }),
  setSelectedPresetId: (selectedPresetId) => set({ selectedPresetId }),
  setExportFullVideo: (exportFullVideo) => set({ exportFullVideo }),
  go: (screen) => {
    if (EDITOR_QUARANTINED && screen === "editor") return;
    set({ screen });
  },
  goHome: () => {
    void releasePreviewCache().catch(() => {});
    set({ screen: "home", video: null, storyboard: null, status: "", jobPercent: 0 });
  },
  goEditor: () => {
    if (EDITOR_QUARANTINED) return;
    set({ screen: "editor" });
  },
}));
