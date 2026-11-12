import { useEffect } from "react";
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

function App() {
  const screen = useDollytStore((s) => s.screen);
  const video = useDollytStore((s) => s.video);
  const previewReady = Boolean(
    video?.previewUrl || video?.previewLocalUrl,
  );
  const go = useDollytStore((s) => s.go);
  const goHome = useDollytStore((s) => s.goHome);
  const setSelectedPresetId = useDollytStore((s) => s.setSelectedPresetId);
  const { shownScreen, viewPhase } = useDeferredScreen(screen);

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
  if (!EDITOR_QUARANTINED && shownScreen === "editor") {
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
    <AppShell
      screen={screen}
      shownScreen={shownScreen}
      viewPhase={viewPhase}
      onNav={go}
      editorEnabled={!EDITOR_QUARANTINED && !!video}
    >
      {body}
    </AppShell>
  );
}

export default App;
