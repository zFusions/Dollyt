import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppShell } from "./components/AppShell";
import { useDeferredScreen } from "./hooks/useDeferredScreen";
import { EditorErrorBoundary } from "./components/EditorErrorBoundary";
import { getSettings } from "./api/dollyt";
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
  const { shownScreen, viewPhase } = useDeferredScreen(screen);
  const { dialog: updateDialog, notice: updateNotice } = useAppUpdater();
  const [pendingNav, setPendingNav] = useState<Screen | null>(null);
  const [guardBusy, setGuardBusy] = useState(false);
  const [guardError, setGuardError] = useState("");

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
    listen<{ percent: number; stage: string }>("job-progress", (event) => {
      if (active) setDownloadProgress(event.payload.stage, event.payload.percent);
    }).then((unsubscribe) => unsubs.push(unsubscribe));
    listen<{
      ok: boolean;
      message: string;
      outputPath?: string;
      previewPath?: string;
    }>(
      "job-finished",
      (event) => {
        if (active) {
          const current = useDollytStore.getState();
          if (event.payload.ok && event.payload.outputPath) {
            addHistory({
              id: `${Date.now()}-${event.payload.outputPath}`,
              title: current.video?.title || t("untitledVideo"),
              url: current.url,
              outputPath: event.payload.outputPath,
              thumbnailUrl: current.video?.thumbnailUrl || "",
              kind: current.exportFullVideo ? "full" : "clip",
              createdAt: Date.now(),
            });
          }
          finishDownload(
            event.payload.ok,
            event.payload.message,
            event.payload.previewPath ?? "",
            event.payload.outputPath ?? "",
          );
        }
      },
    ).then((unsubscribe) => unsubs.push(unsubscribe));
    return () => {
      active = false;
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [addHistory, finishDownload, setDownloadProgress]);

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

  let body = <HomeView />;
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
