import { useEffect } from "react";
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
import { useLocale } from "./i18n";
import { DownloadView } from "./views/DownloadView";
import { useAppUpdater } from "./hooks/useAppUpdater";

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
              title: current.video?.title || "Vidéo sans titre",
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
        onNav={go}
        editorEnabled={!EDITOR_QUARANTINED && !!video}
      >
        {body}
      </AppShell>
      {updateDialog}
      {updateNotice}
    </>
  );
}

export default App;
