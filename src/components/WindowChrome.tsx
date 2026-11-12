import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Props = {
  showTitle?: boolean;
};

export function WindowControls({ className = "" }: { className?: string }) {
  if (!isTauri()) return null;
  const appWindow = getCurrentWindow();
  return (
    <div className={`win-chrome-controls ${className}`.trim()}>
      <button
        type="button"
        className="win-chrome-btn"
        aria-label="Réduire"
        onClick={() => void appWindow.minimize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <button
        type="button"
        className="win-chrome-btn"
        aria-label="Agrandir ou restaurer"
        onClick={() => void appWindow.toggleMaximize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <rect
            x="1.2"
            y="1.2"
            width="7.6"
            height="7.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
      <button
        type="button"
        className="win-chrome-btn win-chrome-btn-close"
        aria-label="Fermer"
        onClick={() => void appWindow.close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path
            d="M1.5 1.5l7 7M8.5 1.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
      </button>
    </div>
  );
}

export function WindowChrome({ showTitle = true }: Props) {
  if (!isTauri()) return null;
  return (
    <header className="win-chrome win-chrome--frameless">
      <div className="win-chrome-drag" data-tauri-drag-region>
        {showTitle ? <span className="win-chrome-title">Dollyt</span> : null}
      </div>
      <WindowControls />
    </header>
  );
}
