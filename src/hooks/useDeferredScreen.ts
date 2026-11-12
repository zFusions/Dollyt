import { useEffect, useRef, useState } from "react";
import type { Screen } from "../store";

const LEAVE_MS = 170;

export type ViewPhase = "idle" | "leave" | "enter";

export function useDeferredScreen(screen: Screen): {
  shownScreen: Screen;
  viewPhase: ViewPhase;
} {
  const [shown, setShown] = useState(screen);
  const [phase, setPhase] = useState<ViewPhase>("idle");
  const screenRef = useRef(screen);

  useEffect(() => {
    screenRef.current = screen;
    if (screen === shown) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(screen);
      setPhase("idle");
      return;
    }

    setPhase("leave");
    const leaveTimer = window.setTimeout(() => {
      setShown(screenRef.current);
      setPhase("enter");
    }, LEAVE_MS);

    return () => window.clearTimeout(leaveTimer);
  }, [screen, shown]);

  useEffect(() => {
    if (phase !== "enter") return;
    const frame = window.requestAnimationFrame(() => setPhase("idle"));
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  return { shownScreen: shown, viewPhase: phase };
}
