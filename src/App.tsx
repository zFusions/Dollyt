import { AppShell } from "./components/AppShell";
import { useDollytStore } from "./store";
import { EditorView } from "./views/EditorView";
import { HomeView } from "./views/HomeView";

function App() {
  const screen = useDollytStore((s) => s.screen);
  return (
    <AppShell>
      <header className="mb-6 flex items-center justify-between border-b border-line pb-3">
        <span className="font-mono text-xs tracking-wide text-text-faint">Dollyt</span>
      </header>
      {screen === "home" ? <HomeView /> : <EditorView />}
    </AppShell>
  );
}

export default App;
