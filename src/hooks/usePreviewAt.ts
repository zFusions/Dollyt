import { RefObject, useCallback, useRef } from "react";
import { clampTime, snapToFrame } from "../lib/time";
import {
  playheadInPreview,
  timelineToLocalTime,
} from "../lib/previewWindow";
import { seekToFrame } from "../lib/videoSeek";

type PreviewCtx = {
  previewStart: number;
  previewFileDur: number;
};

export function usePreviewAt(
  videoRef: RefObject<HTMLVideoElement | null>,
  fps: number,
  duration: number,
  setPlayhead: (t: number) => void,
  preview: PreviewCtx,
  onNeedPreview: (timelineSecs: number) => void,
) {
  const lastSeek = useRef(0);
  return useCallback(
    (secs: number, immediate = false) => {
      const snapped = snapToFrame(clampTime(secs, 0, duration), fps);
      setPlayhead(snapped);
      const now = performance.now();
      if (!immediate && now - lastSeek.current < 80) return;
      lastSeek.current = now;
      const { previewStart, previewFileDur } = preview;
      if (!playheadInPreview(snapped, previewStart, previewFileDur)) {
        onNeedPreview(snapped);
        return;
      }
      const el = videoRef.current;
      if (el) seekToFrame(el, timelineToLocalTime(snapped, previewStart));
    },
    [duration, fps, onNeedPreview, preview, setPlayhead, videoRef],
  );
}
