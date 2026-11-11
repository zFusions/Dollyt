import { invoke } from "@tauri-apps/api/core";
import { FormEvent, useRef, useState } from "react";
import "./App.css";

type VideoInfo = {
  title: string;
  durationSecs: number;
  previewUrl: string;
  formatId: string;
};

type RunCutResult = {
  download: { path: string; elapsedMs: number };
  cut: { path: string; outputDurationSecs: number; elapsedMs: number };
};

const DEFAULT_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [startSecs, setStartSecs] = useState("5");
  const [endSecs, setEndSecs] = useState("12");
  const [status, setStatus] = useState("");
  const [cutResult, setCutResult] = useState<RunCutResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function onLoad(e: FormEvent) {
    e.preventDefault();
    setStatus("Chargement…");
    setCutResult(null);
    try {
      const loaded = await invoke<VideoInfo>("load_video", { rawUrl: url });
      setInfo(loaded);
      setStatus(`OK — ${loaded.formatId} — ${loaded.durationSecs.toFixed(1)} s`);
    } catch (err) {
      setInfo(null);
      setStatus(String(err));
    }
  }

  async function onCut() {
    if (!info) return;
    setStatus("Téléchargement et découpe…");
    try {
      const result = await invoke<RunCutResult>("run_cut_pipeline", {
        rawUrl: url,
        formatId: info.formatId,
        startSecs: Number(startSecs),
        endSecs: Number(endSecs),
      });
      setCutResult(result);
      setStatus(
        `Découpe OK — MKV ${result.download.elapsedMs} ms, MP4 ${result.cut.elapsedMs} ms, durée ${result.cut.outputDurationSecs.toFixed(2)} s`,
      );
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <main className="m0">
      <h1>Dollyt — spike M0</h1>
      <form onSubmit={onLoad} className="row">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Lien YouTube"
        />
        <button type="submit">Charger</button>
      </form>
      {info && (
        <section>
          <p>
            <strong>{info.title}</strong>
          </p>
          <video
            ref={videoRef}
            src={info.previewUrl}
            controls
            playsInline
            className="preview"
          />
          <div className="row">
            <label>
              Début (s)
              <input
                type="number"
                step="0.1"
                value={startSecs}
                onChange={(e) => setStartSecs(e.target.value)}
              />
            </label>
            <label>
              Fin (s)
              <input
                type="number"
                step="0.1"
                value={endSecs}
                onChange={(e) => setEndSecs(e.target.value)}
              />
            </label>
            <button type="button" onClick={onCut}>
              Tester la découpe
            </button>
          </div>
        </section>
      )}
      <p className="status">{status}</p>
      {cutResult && (
        <pre className="paths">
          {cutResult.download.path}
          {"\n"}
          {cutResult.cut.path}
        </pre>
      )}
    </main>
  );
}

export default App;
