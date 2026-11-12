import { RefObject, useEffect } from "react";
import { clampTime, snapToFrame } from "../lib/time";

type Args = {
  videoRef: RefObject<HTMLVideoElement | null>;
  fps: number;
  duration: number;
  start: number;
  end: number;
  playhead: number;
  clipSelection: boolean;
  onRangeChange: (start: number, end: number) => void;
  onPreviewAt: (t: number) => void;
  onTogglePlay: () => void;
};

export function useEditorTransport({
  videoRef,
  fps,
  duration,
  start,
  end,
  playhead,
  clipSelection,
  onRangeChange,
  onPreviewAt,
  onTogglePlay,
}: Args) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const frame = 1 / fps;
      const lo = clipSelection ? start : 0;
      const hi = clipSelection ? end : duration;
      if (clipSelection && e.code === "KeyI") {
        const t = snapToFrame(playhead, fps);
        onRangeChange(t, end);
        onPreviewAt(t);
        e.preventDefault();
      } else if (clipSelection && e.code === "KeyO") {
        const t = snapToFrame(playhead, fps);
        onRangeChange(start, t);
        onPreviewAt(t);
        e.preventDefault();
      } else if (e.code === "ArrowLeft") {
        const t = snapToFrame(playhead - frame, fps);
        onPreviewAt(clampTime(t, lo, hi));
        e.preventDefault();
      } else if (e.code === "ArrowRight") {
        const t = snapToFrame(playhead + frame, fps);
        onPreviewAt(clampTime(t, lo, hi));
        e.preventDefault();
      } else if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    clipSelection,
    duration,
    end,
    fps,
    onPreviewAt,
    onRangeChange,
    onTogglePlay,
    playhead,
    start,
    videoRef,
  ]);
}
