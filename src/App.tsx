import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FormEvent, useEffect, useRef, useState } from "react";
import "./App.css";

type VideoInfo = {
  title: string;
  durationSecs: number;
  previewUrl: string;
  formatId: string;
};

const DEFAULT_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [startSecs, setStartSecs] = useState("5");
  const [endSecs, setEndSecs] = useState("12");
  const [status, setStatus] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    listen<{ percent: number; stage: string }>("job-progress", (event) => {
      setStatus(`${event.payload.stage} — ${event.payload.percent} %`);
    }).then((u) => unsubs.push(u));
    listen<{ ok: boolean; message: string }>("job-finished", (event) => {
      setStatus(event.payload.ok ? event.payload.message : event.payload.message);
    }).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, []);

  async function onLoad(e: FormEvent) {
    e.preventDefault();
    setStatus("Chargement…");
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
      await invoke<number>("start_cut_job_command", {
        rawUrl: url,
        formatId: info.formatId,
        startSecs: Number(startSecs),
        endSecs: Number(endSecs),
      });
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function onCancel() {
    try {
      await invoke("cancel_job");
      setStatus("Annulation demandée…");
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
            <button type="button" onClick={onCancel}>
              Annuler
            </button>
          </div>
        </section>
      )}
      <p className="status">{status}</p>
    </main>
  );
}

export default App;
