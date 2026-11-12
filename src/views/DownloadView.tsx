import { useMemo, useState, type ReactNode } from "react";
import { DinoLoader } from "../components/DinoLoader";
import { WindowControls } from "../components/WindowChrome";
import { revealFile } from "../api/dollyt";
import { previewSrc } from "../lib/previewSrc";
import { useDollytStore } from "../store";
import { t } from "../i18n";

type ActionIconName = "refresh" | "scissors" | "home" | "folder";

function ActionIcon({ name }: { name: ActionIconName }) {
  const paths: Record<ActionIconName, ReactNode> = {
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.7-4L3 9" />
        <path d="M3 4v5h5" />
        <path d="M4 13a8 8 0 0 0 14.7 4L21 15" />
        <path d="M21 20v-5h-5" />
      </>
    ),
    scissors: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="6" cy="18" r="2.5" />
        <path d="m8.2 7.3 10.3 10.3M8.2 16.7 18.5 6.4" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9M9 20v-6h6v6" />
      </>
    ),
    folder: (
      <>
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
        <path d="M3 10h18" />
      </>
    ),
  };
  return (
    <svg
      className="download-action-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

export function DownloadView() {
  const state = useDollytStore((s) => s.downloadState);
  const stage = useDollytStore((s) => s.downloadStage);
  const percent = useDollytStore((s) => s.jobPercent);
  const path = useDollytStore((s) => s.downloadPath);
  const outputPath = useDollytStore((s) => s.downloadOutputPath);
  const message = useDollytStore((s) => s.status);
  const setRange = useDollytStore((s) => s.setRangeSecs);
  const go = useDollytStore((s) => s.go);
  const goHome = useDollytStore((s) => s.goHome);
  const resetDownload = useDollytStore((s) => s.resetDownload);
  const [openError, setOpenError] = useState("");
  const stages: Record<string, string> = {
    validation: t("preparingVideo"),
    download: t("downloadingVideo"),
    encode: t("creatingClip"),
    done: t("done"),
  };

  const videoUrl = useMemo(() => (path ? previewSrc(path) : ""), [path]);

  function retry() {
    resetDownload();
    go("home");
  }

  function newClip() {
    setRange(0, 7);
    resetDownload();
    go("home");
  }

  async function openOutputFile() {
    if (!outputPath) return;
    setOpenError("");
    try {
      await revealFile(outputPath);
    } catch (error) {
      setOpenError(String(error));
    }
  }

  return (
    <div className="download-page">
      <header className="download-head">
        <div className="download-head-drag" data-tauri-drag-region>
          <div className="download-brand">
            <img src="/logo-red.png" alt="" aria-hidden />
            <span>Dollyt</span>
          </div>
        </div>
        <WindowControls />
      </header>
      <main className="download-main">
        {state === "loading" || state === "idle" ? (
          <section className="download-loading" aria-live="polite">
            <DinoLoader active />
            <div className="download-loading-title">
              <span className="download-percent">{percent}%</span>
              <h1>{stages[stage] ?? t("preparingClip")}</h1>
            </div>
            <div className="download-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${percent}%` }} />
            </div>
          </section>
        ) : state === "success" && videoUrl ? (
          <section className="download-result">
            <div className="download-result-copy">
              <h1>{t("clipReady")}</h1>
              <p className="download-result-sub">{t("clipReadySub")}</p>
              <div className="download-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={retry}>
                  <ActionIcon name="refresh" />
                  {t("restart")}
                </button>
                <button type="button" className="btn btn-sm" onClick={newClip}>
                  <ActionIcon name="scissors" />
                  {t("newClip")}
                </button>
                <button type="button" className="btn btn-sm" onClick={goHome}>
                  <ActionIcon name="home" />
                  {t("launch")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm download-open-file"
                  onClick={() => void openOutputFile()}
                  disabled={!outputPath}
                >
                  <ActionIcon name="folder" />
                  {t("openFile")}
                </button>
              </div>
              {openError ? <p className="download-open-error">{openError}</p> : null}
            </div>
            <div className="download-preview">
              <p className="download-preview-label">{t("preview")}</p>
              <video
                src={videoUrl}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                disableRemotePlayback
                playsInline
                preload="metadata"
              />
            </div>
          </section>
        ) : (
          <section className="download-error">
            <h1>{t("exportFailed")}</h1>
            <p className="download-sub">{message || t("retryHint")}</p>
            <div className="download-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={retry}>
                <ActionIcon name="refresh" />
                {t("retry")}
              </button>
              <button type="button" className="btn btn-sm" onClick={goHome}>
                <ActionIcon name="home" />
                {t("launch")}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
