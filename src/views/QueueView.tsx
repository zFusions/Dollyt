import { useState } from "react";
import { cancelJob, revealFile } from "../api/dollyt";
import { CopyButton } from "../components/CopyButton";
import { formatTimeInput } from "../lib/time";
import { backendText, t } from "../i18n";
import { useDollytStore, type ExportJob, type HistoryEntry } from "../store";

const STAGE_KEYS: Record<string, Parameters<typeof t>[0]> = {
  validation: "preparingVideo",
  download: "downloadingVideo",
  encode: "creatingClip",
  done: "done",
};

function QueueJobRow({ job }: { job: ExportJob }) {
  const running = job.state === "running";
  return (
    <li className="queue-job">
      <div className="queue-job-main">
        <span className="queue-job-title" title={job.title || job.url}>
          {job.title || job.url}
        </span>
        <span className="queue-job-meta">
          {running ? t(STAGE_KEYS[job.stage] ?? "preparingClip") : t("queueWaiting")}
          {running ? ` · ${job.percent}%` : ""}
        </span>
        {running ? (
          <span className="queue-job-bar" role="progressbar" aria-valuenow={job.percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${job.percent}%` }} />
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => void cancelJob(job.id)}
      >
        {t("cancel")}
      </button>
    </li>
  );
}

function FinishedJobRow({ job }: { job: ExportJob }) {
  const removeJob = useDollytStore((s) => s.removeJob);
  const failed = job.state === "error";
  return (
    <li className="queue-job">
      <div className="queue-job-main">
        <span className="queue-job-title" title={job.title || job.url}>
          {job.title || job.url}
        </span>
        <span className="queue-job-meta">
          {failed ? t("exportFailed") : t("cancelled")}
          {job.message ? ` — ${backendText(job.message)}` : ""}
        </span>
      </div>
      <div className="queue-job-actions">
        {job.message ? <CopyButton text={job.message} /> : null}
        <button
          type="button"
          className="btn btn-sm"
          aria-label={t("close")}
          onClick={() => removeJob(job.id)}
        >
          ×
        </button>
      </div>
    </li>
  );
}

function ExportQueuePanel() {
  const jobs = useDollytStore((s) => s.jobs);
  const pending = jobs.filter(
    (job) => job.state === "queued" || job.state === "running",
  );
  const finished = jobs
    .filter((job) => job.state === "error" || job.state === "cancelled")
    .slice(-5);
  const running = pending.filter((job) => job.state === "running").length;
  const waiting = pending.length - running;

  return (
    <section className="export-queue" aria-label={t("exportQueue")}>
      <header className="export-queue-head">
        <h2 className="set-heading">{t("exportQueue")}</h2>
        <p className="export-queue-count">
          {pending.length === 0
            ? t("queueEmpty")
            : `${running} ${t("queueRunning").toLowerCase()} · ${waiting} ${t("queueWaiting").toLowerCase()}`}
        </p>
      </header>
      {pending.length > 0 ? (
        <ul className="export-queue-list">
          {pending.map((job) => (
            <QueueJobRow key={job.id} job={job} />
          ))}
        </ul>
      ) : null}
      {finished.length > 0 ? (
        <>
          <h3 className="export-queue-subhead">{t("queueFinished")}</h3>
          <ul className="export-queue-list">
            {finished.map((job) => (
              <FinishedJobRow key={job.id} job={job} />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

const AUDIO_EXT = /\.(mp3|flac|m4a|ogg|opus|wav|aac)$/i;

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const removeHistory = useDollytStore((s) => s.removeHistory);
  const audioExt = AUDIO_EXT.exec(entry.outputPath)?.[1]?.toUpperCase() ?? "";
  const clipLabel =
    entry.kind === "clip" && entry.startSecs != null && entry.endSecs != null
      ? `${t("clipHistory")} ${formatTimeInput(entry.startSecs)} - ${formatTimeInput(entry.endSecs)}`
      : entry.kind === "full"
        ? t("fullVideoHistory")
        : t("clipHistory");

  async function openLocation() {
    setError("");
    try {
      await revealFile(entry.outputPath);
    } catch (reason) {
      setError(String(reason));
    }
  }

  return (
    <article className="history-card">
      <button
        type="button"
        className="history-delete"
        aria-label={t("deleteHistory")}
        onClick={() => setConfirming(true)}
      >
        ×
      </button>
      {confirming ? (
        <div className="history-confirm" role="dialog" aria-label={t("confirmDeleteHistory")}>
          <strong>{t("confirmDeleteHistory")}</strong>
          <div className="history-confirm-actions">
            <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => removeHistory(entry.id)}
            >
              {t("delete")}
            </button>
          </div>
        </div>
      ) : null}
      <div className="history-thumb">
        {entry.thumbnailUrl ? (
          <img src={entry.thumbnailUrl} alt="" loading="lazy" />
        ) : audioExt ? (
          <span className="history-thumb-audio" title={audioExt} aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
            </svg>
          </span>
        ) : (
          <span aria-hidden>▶</span>
        )}
      </div>
      <div className="history-main">
        <h2>{entry.title}</h2>
        <a
          className="history-url"
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          title={entry.url}
        >
          {entry.url}
        </a>
        <p className="history-meta">
          {audioExt ? `${t("audioFile")} ${audioExt}` : clipLabel}{" "}
          · {new Date(entry.createdAt).toLocaleDateString()}
        </p>
        {error ? <p className="history-error">{backendText(error)}</p> : null}
      </div>
      <button type="button" className="btn btn-sm" onClick={openLocation}>
        {t("openFolder")}
      </button>
    </article>
  );
}

export function QueueView() {
  const history = useDollytStore((s) => s.history);

  return (
    <div className="page set-page history-page">
      <header className="set-head">
        <h1 className="page-title">{t("historyTitle")}</h1>
        <p className="page-sub">{t("historySub")}</p>
      </header>
      <ExportQueuePanel />
      {history.length === 0 ? (
        <section className="history-empty" aria-live="polite">
          <strong>{t("emptyHistory")}</strong>
          <p>{t("emptyHistorySub")}</p>
        </section>
      ) : (
        <section className="history-list" aria-label={t("recentExports")}>
          {history.map((entry) => (
            <HistoryCard key={entry.id} entry={entry} />
          ))}
        </section>
      )}
    </div>
  );
}
