import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "./components/AppShell";
import { useDeferredScreen } from "./hooks/useDeferredScreen";
import { EditorErrorBoundary } from "./components/EditorErrorBoundary";
import { getSettings, initializeTools } from "./api/dollyt";
import { EDITOR_QUARANTINED } from "./editorAvailability";
import { useDollytStore } from "./store";
import { EditorOpeningView } from "./views/EditorOpeningView";
import { EditorView } from "./views/EditorView";
import { HomeView } from "./views/HomeView";
import { PresetsView } from "./views/PresetsView";
import { QueueView } from "./views/QueueView";
import { SettingsView } from "./views/SettingsView";
import { t, useLocale } from "./i18n";
import { DownloadView } from "./views/DownloadView";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { getLeaveGuard } from "./lib/leaveGuard";
import { bufferJobFinished, bufferJobProgress } from "./lib/jobEventBuffer.mjs";
import { UnsavedGuardDialog } from "./components/UnsavedGuardDialog";
import type { Screen } from "./store";

function App() {
  const locale = useLocale();
  const screen = useDollytStore((s) => s.screen);
  const video = useDollytStore((s) => s.video);
  const previewReady = Boolean(
    video?.previewUrl || video?.previewLocalUrl,
  );
  const go = useDollytStore((s) => s.go);
  const goHome = useDollytStore((s) => s.goHome);
  const setSelectedPresetId = useDollytStore((s) => s.setSelectedPresetId);
  const setDownloadProgress = useDollytStore((s) => s.setDownloadProgress);
  const finishDownload = useDollytStore((s) => s.finishDownload);
  const addHistory = useDollytStore((s) => s.addHistory);
  const updateJob = useDollytStore((s) => s.updateJob);
  const finishJob = useDollytStore((s) => s.finishJob);
  const setActiveJob = useDollytStore((s) => s.setActiveJob);
  const { shownScreen, viewPhase } = useDeferredScreen(screen);
  const { dialog: updateDialog, notice: updateNotice } = useAppUpdater();
  const [pendingNav, setPendingNav] = useState<Screen | null>(null);
  const [guardBusy, setGuardBusy] = useState(false);
  const [guardError, setGuardError] = useState("");
  const [toolsState, setToolsState] = useState<"loading" | "ready" | "error">(
    isTauri() ? "loading" : "ready",
  );
  const [toolsError, setToolsError] = useState("");
  const [toolsAttempt, setToolsAttempt] = useState(0);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    setToolsState("loading");
    setToolsError("");
    initializeTools()
      .then(() => {
        if (active) setToolsState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setToolsError(String(error));
        setToolsState("error");
      });
    return () => {
      active = false;
    };
  }, [toolsAttempt]);

  useEffect(() => {
    document.body.classList.toggle("unsaved-guard", pendingNav !== null);
    return () => document.body.classList.remove("unsaved-guard");
  }, [pendingNav]);

  function handleNav(target: Screen) {
    if (target === screen) return;
    const guard = getLeaveGuard();
    if (guard?.isDirty()) {
      setGuardError("");
      setPendingNav(target);
      return;
    }
    go(target);
  }

  function closeGuard() {
    if (guardBusy) return;
    setPendingNav(null);
    setGuardError("");
  }

  async function guardSaveAndLeave() {
    const guard = getLeaveGuard();
    const target = pendingNav;
    if (!guard || !target) return;
    setGuardBusy(true);
    setGuardError("");
    try {
      await guard.save();
      setPendingNav(null);
      go(target);
    } catch (error) {
      setGuardError(String(error));
    } finally {
      setGuardBusy(false);
    }
  }

  function guardDiscardAndLeave() {
    const guard = getLeaveGuard();
    const target = pendingNav;
    if (!guard || !target) return;
    guard.discard();
    setPendingNav(null);
    setGuardError("");
    go(target);
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const preventBrowserContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };
    document.addEventListener("contextmenu", preventBrowserContextMenu);
    return () =>
      document.removeEventListener("contextmenu", preventBrowserContextMenu);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    const unsubs: Array<() => void> = [];
    listen<{ jobId: number; stage: string; percent: number }>(
      "job-progress",
      (event) => {
        if (!active) return;
        const { jobId, stage, percent } = event.payload;
        const state = useDollytStore.getState();
        const known = state.jobs.some((job) => job.id === jobId);
        if (known) {
          const wasQueued = state.jobs.find((job) => job.id === jobId)?.state === "queued";
          updateJob(jobId, { stage, percent, state: "running" });
          const isScreenJob = state.activeJobId === jobId;
          const adoptOrphan = wasQueued && state.activeJobId === null;
          if (isScreenJob || adoptOrphan) {
            if (state.activeJobId !== jobId) setActiveJob(jobId);
            setDownloadProgress(stage, percent);
          }
        } else {
          bufferJobProgress(jobId, { stage, percent });
        }
      },
    ).then((unsubscribe) => unsubs.push(unsubscribe));
    listen<{
      jobId: number;
      ok: boolean;
      message: string;
      outputPath?: string;
      previewPath?: string;
    }>(
      "job-finished",
      (event) => {
        if (!active) return;
        const { jobId, ok, message, outputPath, previewPath } = event.payload;
        const state = useDollytStore.getState();
        const job = state.jobs.find((item) => item.id === jobId);
        if (!job) {
          bufferJobFinished(jobId, {
            ok,
            message,
            outputPath,
            previewPath,
          });
          return;
        }
        const wasActive = state.activeJobId === jobId;
        finishJob(jobId, ok, message, previewPath ?? "", outputPath ?? "");
        if (ok && outputPath) {
          addHistory({
            id: `${Date.now()}-${outputPath}`,
            title: job.title || t("untitledVideo"),
            url: job.url,
            outputPath,
            thumbnailUrl: job.thumbnailUrl || "",
            kind: job.kind,
            startSecs: job.startSecs,
            endSecs: job.endSecs,
            createdAt: Date.now(),
          });
        }
        if (wasActive) {
          finishDownload(
            ok,
            message,
            previewPath ?? "",
            outputPath ?? "",
          );
        }
      },
    ).then((unsubscribe) => unsubs.push(unsubscribe));
    return () => {
      active = false;
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [addHistory, finishDownload, finishJob, setActiveJob, setDownloadProgress, updateJob]);

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s?.defaultPresetId) setSelectedPresetId(s.defaultPresetId);
      })
      .catch(() => {});
  }, [setSelectedPresetId]);

  useEffect(() => {
    if (EDITOR_QUARANTINED && screen === "editor") go("home");
  }, [screen, go]);

  let body = <HomeView toolsReady={toolsState === "ready"} />;
  if (shownScreen === "download") {
    body = <DownloadView />;
  } else if (!EDITOR_QUARANTINED && shownScreen === "editor") {
    body = video && previewReady ? (
      <EditorErrorBoundary onReset={goHome}>
        <EditorView />
      </EditorErrorBoundary>
    ) : (
      <EditorOpeningView />
    );
  } else if (shownScreen === "presets") {
    body = <PresetsView />;
  } else if (shownScreen === "settings") {
    body = <SettingsView />;
  } else if (shownScreen === "queue") {
    body = <QueueView />;
  }

  if (toolsState === "error") {
    return (
      <main className="tools-init-screen">
        <section className="tools-init-card" aria-live="polite">
          <h1>{t("toolsSetupFailed")}</h1>
          <p>{toolsError}</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setToolsAttempt((attempt) => attempt + 1)}
          >
            {t("retryTools")}
          </button>
        </section>
      </main>
    );
  }

  return (
    <>
      <AppShell
        screen={screen}
        shownScreen={shownScreen}
        viewPhase={viewPhase}
        onNav={handleNav}
        editorEnabled={!EDITOR_QUARANTINED && !!video}
      >
        {body}
      </AppShell>
      {updateDialog}
      {updateNotice}
      {pendingNav ? (
        <UnsavedGuardDialog
          busy={guardBusy}
          error={guardError}
          onStay={closeGuard}
          onDiscard={guardDiscardAndLeave}
          onSaveAndLeave={guardSaveAndLeave}
        />
      ) : null}
    </>
  );
}

export default App;
