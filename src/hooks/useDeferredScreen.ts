import { useEffect, useRef, useState } from "react";
import type { Screen } from "../store";

const LEAVE_MS = 170;
const ENTER_MS = 240;

export type ViewPhase = "idle" | "leave" | "enter";

export function useDeferredScreen(screen: Screen): {
  shownScreen: Screen;
  viewPhase: ViewPhase;
} {
  const [shown, setShown] = useState(screen);
  const [phase, setPhase] = useState<ViewPhase>("idle");
  const shownRef = useRef(screen);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (screen === shownRef.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = screen;
      setShown(screen);
      setPhase("idle");
      return;
    }

    setPhase("leave");
    timerRef.current = window.setTimeout(() => {
      shownRef.current = screen;
      setShown(screen);
      setPhase("enter");
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setPhase("idle");
      }, ENTER_MS);
    }, LEAVE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [screen]);

  return { shownScreen: shown, viewPhase: phase };
}
