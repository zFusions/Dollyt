import { FormEvent, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { listPresets, loadVideo, startCutJob, type Preset } from "../api/dollyt";
import { DinoLoader } from "../components/DinoLoader";
import { Switch } from "../components/Toggle";
import { WindowControls } from "../components/WindowChrome";
import { clampTime, snapToFrame } from "../lib/time";
import { presetShortLabel } from "../lib/presetsUi";
import { CustomSelect } from "../components/ui/CustomSelect";
import { validateYoutubeUrl } from "../lib/validateUrl";
import { useDollytStore } from "../store";

export function HomeView() {
  const url = useDollytStore((s) => s.url);
  const setUrl = useDollytStore((s) => s.setUrl);
  const setVideo = useDollytStore((s) => s.setVideo);
  const setStoryboard = useDollytStore((s) => s.setStoryboard);
  const setStatus = useDollytStore((s) => s.setStatus);
  const status = useDollytStore((s) => s.status);
  const go = useDollytStore((s) => s.go);
  const startSecs = useDollytStore((s) => s.startSecs);
  const endSecs = useDollytStore((s) => s.endSecs);
  const setRangeSecs = useDollytStore((s) => s.setRangeSecs);
  const selectedPresetId = useDollytStore((s) => s.selectedPresetId);
  const setSelectedPresetId = useDollytStore((s) => s.setSelectedPresetId);
  const exportFullVideo = useDollytStore((s) => s.exportFullVideo);
  const setExportFullVideo = useDollytStore((s) => s.setExportFullVideo);
  const setJobPercent = useDollytStore((s) => s.setJobPercent);
  const jobPercent = useDollytStore((s) => s.jobPercent);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    listPresets()
      .then(setPresets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const unsubs: Array<() => void> = [];
    listen<{ percent: number; stage: string }>("job-progress", (event) => {
      setJobPercent(event.payload.percent);
      setStatus(`${event.payload.stage}, ${event.payload.percent} %`);
    }).then((u) => unsubs.push(u));
    listen<{ ok: boolean; message: string }>("job-finished", (event) => {
      setJobPercent(event.payload.ok ? 100 : 0);
      setStatus(event.payload.message);
      setBusy(false);
    }).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, [setJobPercent, setStatus]);

  async function onDownload(e: FormEvent) {
    e.preventDefault();
    const invalid = validateYoutubeUrl(url);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!exportFullVideo && endSecs <= startSecs) {
      setError("La fin doit être après le début.");
      return;
    }
    setError("");
    setBusy(true);
    setJobPercent(0);
    setStatus("On lit la vidéo sur YouTube…");
    setVideo(null);
    setStoryboard(null);
    try {
      const { video: loaded } = await loadVideo(url);
      const fps = loaded.previewFps ?? 30;
      const dur = loaded.durationSecs || 0;
      const start = exportFullVideo
        ? 0
        : snapToFrame(clampTime(startSecs, 0, dur), fps);
      const end = exportFullVideo
        ? snapToFrame(dur, fps)
        : snapToFrame(clampTime(endSecs, start + 1 / fps, dur), fps);
      if (!exportFullVideo) setRangeSecs(start, end);
      await startCutJob({
        rawUrl: url,
        formatId: loaded.exportFormatId,
        startSecs: start,
        endSecs: end,
        presetId: selectedPresetId,
      });
    } catch (err) {
      const msg = String(err);
      setError(msg);
      setStatus(msg);
      setBusy(false);
    }
  }

  function focusUrl() {
    setUrl("");
    setError("");
    formRef.current?.querySelector<HTMLInputElement>("#url-field")?.focus();
  }

  function submitDownload() {
    formRef.current?.requestSubmit();
  }

  return (
    <div className="home-hero">
      <header
        className={`home-nav${isTauri() ? " home-nav--frameless" : ""}`}
      >
        <div className="home-nav-inner">
          <span
            className="home-brand"
            {...(isTauri() ? { "data-tauri-drag-region": true } : {})}
          >
            Dollyt
          </span>
          {isTauri() ? (
            <span className="home-nav-drag" data-tauri-drag-region aria-hidden />
          ) : null}
          <div className="home-nav-end">
            <button type="button" className="home-ghost" onClick={focusUrl}>
              Nouveau lien
            </button>
            <button
              type="button"
              className="home-pill"
              disabled={busy}
              onClick={submitDownload}
            >
              Lancer
            </button>
          </div>
        </div>
        <nav className="home-nav-mid" aria-label="Navigation">
          <button type="button" onClick={() => go("presets")}>
            Presets
          </button>
          <button type="button" onClick={() => go("settings")}>
            Paramètres
          </button>
          <button type="button" onClick={() => go("queue")}>
            File
          </button>
        </nav>
        {isTauri() ? (
          <WindowControls className="win-chrome-controls--in-nav" />
        ) : null}
      </header>

      <main className="home-main">
        <section className="home-intro" aria-labelledby="home-title">
          <h1 id="home-title" className="home-title home-title-lit">
            De l&apos;URL YouTube à l&apos;extrait, sans friction
          </h1>
          <p className="home-lead">
            Colle un lien, choisis un preset, règle l&apos;extrait si tu veux, et
            enregistre le fichier chez toi.
          </p>

          <form
            ref={formRef}
            className="home-composer-stack"
            onSubmit={onDownload}
            noValidate
            autoComplete="off"
          >
            <div className="home-composer">
              <div className="home-composer-slab home-composer-slab--unified">
                <div className="home-url-row">
                  <div className="home-composer-field">
                    <span className="home-field-mirror" aria-hidden>
                      {url || "Colle ton lien YouTube"}
                    </span>
                    <input
                      id="url-field"
                      type="text"
                      inputMode="url"
                      name="dollyt-youtube-url"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (error) setError("");
                      }}
                      className="field home-field"
                      placeholder="Colle ton lien YouTube"
                      autoComplete="off"
                      autoFocus
                      disabled={busy}
                      aria-label="Lien YouTube"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? "url-field-err" : undefined}
                      data-1p-ignore
                      data-lpignore="true"
                    />
                  </div>
                  <button type="submit" className="home-submit" disabled={busy}>
                    <img
                      className="home-submit-icon"
                      src="/icons/envoyer.png"
                      alt=""
                      width={17}
                      height={17}
                      decoding="async"
                    />
                    <span className="home-submit-label">
                      {busy ? "Export…" : "Télécharger"}
                    </span>
                  </button>
                </div>
                <div className="home-composer-split" aria-hidden />
                <div className="home-export-row">
                  <label className="home-preset-field">
                    <span>Qualité</span>
                    <CustomSelect
                      triggerClassName="home-preset-select mono"
                      value={selectedPresetId}
                      disabled={busy || presets.length === 0}
                      onChange={setSelectedPresetId}
                      ariaLabel="Preset d'export"
                      options={presets.map((p) => ({
                        value: p.id,
                        label: presetShortLabel(p),
                        iconId: p.id,
                      }))}
                    />
                  </label>
                  <div className="home-mode-field">
                    <span>Portée</span>
                    <div className="home-mode-control">
                      <span className="home-mode-label">
                        {exportFullVideo ? "Vidéo entière" : "Extrait"}
                      </span>
                      <Switch
                        checked={exportFullVideo}
                        onChange={setExportFullVideo}
                        label="Basculer entre extrait et vidéo entière"
                      />
                    </div>
                  </div>
                </div>
                <div
                  className="home-clip-block"
                  data-full={exportFullVideo ? true : undefined}
                  aria-hidden={exportFullVideo ? true : undefined}
                >
                  <div className="home-clip-row">
                    <label className="home-clip-field">
                      <span>Début (s)</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className="field home-clip-input mono"
                        value={startSecs}
                        disabled={busy || exportFullVideo}
                        tabIndex={exportFullVideo ? -1 : undefined}
                        onChange={(e) =>
                          setRangeSecs(Number(e.target.value) || 0, endSecs)
                        }
                      />
                    </label>
                    <label className="home-clip-field">
                      <span>Fin (s)</span>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className="field home-clip-input mono"
                        value={endSecs}
                        disabled={busy || exportFullVideo}
                        tabIndex={exportFullVideo ? -1 : undefined}
                        onChange={(e) =>
                          setRangeSecs(startSecs, Number(e.target.value) || 0)
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
            {busy ? <DinoLoader active /> : null}
            {busy && jobPercent > 0 ? (
              <div
                className="home-progress"
                role="progressbar"
                aria-valuenow={jobPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="home-progress-fill"
                  style={{ width: `${jobPercent}%` }}
                />
              </div>
            ) : null}
          </form>

          <p className="home-hint">
            <span className="home-local">
              Tout reste sur ton PC, sans envoi vers un serveur Dollyt.
            </span>
          </p>

          {error || status ? (
            <p
              id="url-field-err"
              className="home-status"
              data-tone={error ? "err" : undefined}
              role={error ? "alert" : "status"}
            >
              {error || status}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
