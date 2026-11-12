import type { ReactNode } from "react";
import { AmbientBackdrop } from "./AmbientBackdrop";
import { NavRail } from "./NavRail";
import { WindowChrome } from "./WindowChrome";
import type { ViewPhase } from "../hooks/useDeferredScreen";
import type { Screen } from "../store";

type Props = {
  children: ReactNode;
  screen: Screen;
  shownScreen: Screen;
  viewPhase: ViewPhase;
  onNav: (s: Screen) => void;
  editorEnabled: boolean;
};

export function AppShell({
  children,
  screen,
  shownScreen,
  viewPhase,
  onNav,
  editorEnabled,
}: Props) {
  const landing = shownScreen === "home" || shownScreen === "download";
  const studio = shownScreen === "editor";
  const shellClass = landing
    ? "shell shell--home"
    : studio
      ? "shell shell--studio"
      : "shell";
  return (
    <div className="app">
      {!landing ? <WindowChrome showTitle /> : null}
      <AmbientBackdrop />
      <div className={shellClass}>
        {!landing ? (
          <NavRail
            screen={screen}
            onNav={onNav}
            editorEnabled={editorEnabled}
            compact={studio}
          />
        ) : null}
        <div className="stage">
          <div className="scroll">
            <div
              className={`view-stage view-stage--${viewPhase}`}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
