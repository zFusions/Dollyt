import { FormEvent, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import {
  getSettings,
  listPresets,
  loadVideo,
  startCutJob,
  type Preset,
} from "../api/dollyt";
import { DinoLoader } from "../components/DinoLoader";
import { Switch } from "../components/Toggle";
import { WindowControls } from "../components/WindowChrome";
import { clampTime, snapToFrame } from "../lib/time";
import { presetShortLabel } from "../lib/presetsUi";
import { CustomSelect } from "../components/ui/CustomSelect";
import { normalizeYoutubeUrl, validateYoutubeUrl } from "../lib/validateUrl";
import { useDollytStore } from "../store";
import { t } from "../i18n";

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
  const beginDownload = useDollytStore((s) => s.beginDownload);
  const resetDownload = useDollytStore((s) => s.resetDownload);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    listPresets()
      .then(setPresets)
      .catch(() => {});
  }, []);

  async function onDownload(e: FormEvent) {
    e.preventDefault();
    const invalid = validateYoutubeUrl(url);
    if (invalid) {
      setError(invalid);
      return;
    }
    const target = normalizeYoutubeUrl(url);
    if (!target) {
      setError("Ce lien n’est pas valide.");
      return;
    }
    if (!exportFullVideo && endSecs <= startSecs) {
      setError("La fin doit être après le début.");
      return;
    }
    setError("");
    setBusy(true);
    beginDownload();
    go("download");
    setVideo(null);
    setStoryboard(null);
    try {
      const settings = await getSettings();
      if (!settings?.exportDir.trim()) {
        setError(t("chooseOutput"));
        go("settings");
        setBusy(false);
        resetDownload();
        return;
      }
      const { video: loaded, storyboard } = await loadVideo(target);
      setVideo(loaded);
      setStoryboard(storyboard);
      const fps = loaded.previewFps ?? 30;
      const dur = loaded.durationSecs || 0;
      if (dur <= 0) {
        setError("Durée de la vidéo inconnue (direct ou indisponible).");
        setBusy(false);
        useDollytStore.getState().finishDownload(false, "Durée inconnue.");
        return;
      }
      const start = exportFullVideo
        ? 0
        : snapToFrame(clampTime(startSecs, 0, dur), fps);
      const end = exportFullVideo
        ? snapToFrame(dur, fps)
        : snapToFrame(clampTime(endSecs, start + 1 / fps, dur), fps);
      if (!exportFullVideo) setRangeSecs(start, end);
      await startCutJob({
        rawUrl: target,
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
      useDollytStore.getState().finishDownload(false, msg);
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
            <img className="brand-mark" src="/logo-red.png" alt="" aria-hidden />
            Dollyt
          </span>
          {isTauri() ? (
            <span className="home-nav-drag" data-tauri-drag-region aria-hidden />
          ) : null}
          <div className="home-nav-end">
            <button type="button" className="home-ghost" onClick={focusUrl}>
              {t("newLink")}
            </button>
            <button
              type="button"
              className="home-pill"
              disabled={busy}
              onClick={submitDownload}
            >
              {t("launch")}
            </button>
          </div>
        </div>
        <nav className="home-nav-mid" aria-label="Navigation">
          <button type="button" onClick={() => go("presets")}>
            {t("presets")}
          </button>
          <button type="button" onClick={() => go("settings")}>
            {t("settings")}
          </button>
          <button type="button" onClick={() => go("queue")}>
            {t("queue")}
          </button>
        </nav>
        {isTauri() ? (
          <WindowControls className="win-chrome-controls--in-nav" />
        ) : null}
      </header>

      <main className="home-main">
        <section className="home-intro" aria-labelledby="home-title">
          <h1 id="home-title" className="home-title home-title-lit">
            {t("homeTitle")}
          </h1>
          <p className="home-lead">
            {t("homeLead")}
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
                      {url || t("pasteUrl")}
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
                      placeholder={t("pasteUrl")}
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
                      {busy ? t("exporting") : t("download")}
                    </span>
                  </button>
                </div>
                <div className="home-composer-split" aria-hidden />
                <div className="home-export-row">
                  <label className="home-preset-field">
                    <span>{t("quality")}</span>
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
                    <span>{t("range")}</span>
                    <div className="home-mode-control">
                      <span className="home-mode-label">
                        {exportFullVideo ? t("fullVideo") : t("clip")}
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
                      <span>{t("start")}</span>
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
                      <span>{t("end")}</span>
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
          </form>

          <p className="home-hint">
            <span className="home-local">
              {t("savedLocally")}
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
