import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ExportProgress } from "../components/ExportProgress";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDollytStore } from "../store";

export function EditorView() {
  const video = useDollytStore((s) => s.video);
  const url = useDollytStore((s) => s.url);
  const startSecs = useDollytStore((s) => s.startSecs);
  const endSecs = useDollytStore((s) => s.endSecs);
  const status = useDollytStore((s) => s.status);
  const jobPercent = useDollytStore((s) => s.jobPercent);
  const setRange = useDollytStore((s) => s.setRange);
  const setStatus = useDollytStore((s) => s.setStatus);
  const setJobPercent = useDollytStore((s) => s.setJobPercent);
  const goHome = useDollytStore((s) => s.goHome);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    listen<{ percent: number; stage: string }>("job-progress", (event) => {
      setJobPercent(event.payload.percent);
      setStatus(`${event.payload.stage} — ${event.payload.percent} %`);
    }).then((u) => unsubs.push(u));
    listen<{ ok: boolean; message: string }>("job-finished", (event) => {
      setJobPercent(event.payload.ok ? 100 : 0);
      setStatus(event.payload.message);
    }).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, [setJobPercent, setStatus]);

  if (!video) return null;

  async function onExport() {
    if (!video) return;
    setJobPercent(0);
    setStatus("Préparation…");
    try {
      await invoke<number>("start_cut_job_command", {
        rawUrl: url,
        formatId: video.formatId,
        startSecs: Number(startSecs),
        endSecs: Number(endSecs),
      });
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function onCancel() {
    await invoke("cancel_job");
    setStatus("Annulation…");
    setJobPercent(0);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div className="space-y-4 border-t border-line pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-serif text-xl text-text">{video.title}</h1>
          <button
            type="button"
            onClick={goHome}
            className="font-mono text-xs text-text-dim underline-offset-2 hover:text-text hover:underline"
          >
            Nouveau lien
          </button>
        </div>
        <video
          src={video.previewUrl}
          controls
          playsInline
          className="aspect-video w-full bg-black"
        />
        <PreviewStripPlaceholder />
      </div>
      <aside className="space-y-4 border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <p className="font-mono text-xs text-text-dim">
          {video.formatId} — {video.durationSecs.toFixed(1)} s
        </p>
        <label className="block space-y-1">
          <span className="font-mono text-xs text-text-faint">Entrée</span>
          <input
            type="number"
            step="0.1"
            value={startSecs}
            onChange={(e) => setRange(e.target.value, endSecs)}
            className="w-full border border-line bg-raised px-2 py-2 font-mono text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-mono text-xs text-text-faint">Sortie</span>
          <input
            type="number"
            step="0.1"
            value={endSecs}
            onChange={(e) => setRange(startSecs, e.target.value)}
            className="w-full border border-line bg-raised px-2 py-2 font-mono text-sm"
          />
        </label>
        <div className="flex flex-col gap-2">
          <PrimaryButton onClick={onExport}>Exporter</PrimaryButton>
          <PrimaryButton variant="ghost" onClick={onCancel}>
            Annuler
          </PrimaryButton>
        </div>
        <ExportProgress percent={jobPercent} label={status} />
        {status && (
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-text-dim">
            {status}
          </pre>
        )}
      </aside>
    </section>
  );
}

function PreviewStripPlaceholder() {
  return (
    <div
      className="h-12 border border-line bg-surface"
      aria-hidden
      title="Timeline — jalon M2"
    >
      <p className="px-2 py-3 font-mono text-[10px] text-text-faint">
        Timeline et storyboards au jalon M2
      </p>
    </div>
  );
}
