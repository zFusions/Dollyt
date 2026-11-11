import { create } from "zustand";

export type VideoInfo = {
  title: string;
  durationSecs: number;
  previewUrl: string;
  formatId: string;
};

type Screen = "home" | "editor";

type DollytState = {
  screen: Screen;
  url: string;
  video: VideoInfo | null;
  startSecs: string;
  endSecs: string;
  status: string;
  jobPercent: number;
  setUrl: (url: string) => void;
  setVideo: (video: VideoInfo | null) => void;
  setRange: (start: string, end: string) => void;
  setStatus: (status: string) => void;
  setJobPercent: (n: number) => void;
  goHome: () => void;
  goEditor: () => void;
};

export const useDollytStore = create<DollytState>((set) => ({
  screen: "home",
  url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  video: null,
  startSecs: "5",
  endSecs: "12",
  status: "",
  jobPercent: 0,
  setUrl: (url) => set({ url }),
  setVideo: (video) => set({ video }),
  setRange: (startSecs, endSecs) => set({ startSecs, endSecs }),
  setStatus: (status) => set({ status }),
  setJobPercent: (jobPercent) => set({ jobPercent }),
  goHome: () => set({ screen: "home", video: null, status: "", jobPercent: 0 }),
  goEditor: () => set({ screen: "editor" }),
}));
