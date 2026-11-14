import { useState } from "react";
import { revealFile } from "../api/dollyt";
import { backendText, t } from "../i18n";
import { useDollytStore, type HistoryEntry } from "../store";

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const removeHistory = useDollytStore((s) => s.removeHistory);

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
          {entry.kind === "full" ? t("fullVideoHistory") : t("clipHistory")} ·{" "}
          {new Date(entry.createdAt).toLocaleDateString()}
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
