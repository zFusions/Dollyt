import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readDiagnosticLogs } from "../api/dollyt";
import { CopyButton } from "./CopyButton";
import { t } from "../i18n";

type Props = { initiallyOpen?: boolean };

export function DiagnosticLogsPanel({ initiallyOpen = false }: Props) {
  const [open, setOpen] = useState(initiallyOpen);
  const [logs, setLogs] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !isTauri()) return;
    let active = true;
    const liveLines: string[] = [];
    const unlisten = listen<{ line: string }>("diagnostic-log", (event) => {
      liveLines.push(event.payload.line);
      setLogs((current) => (current ? `${current}\n${event.payload.line}` : event.payload.line));
    });
    void unlisten
      .then(() => readDiagnosticLogs())
      .then((initial) => {
        if (!active) return;
        const missed = liveLines.filter((line) => !initial.includes(line));
        setLogs([initial.trimEnd(), ...missed].filter(Boolean).join("\n"));
        setError("");
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      });

    return () => {
      active = false;
      void unlisten.then((stop) => stop());
    };
  }, [open]);

  return (
    <div className="diagnostic-console-panel">
      <button
        type="button"
        className="btn btn-sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? t("hideLogs") : t("showLogs")}
      </button>
      {open ? (
        <>
          <div className="diagnostic-console-toolbar">
            <p className="meta">{error || t("diagnosticLogsHint")}</p>
            <CopyButton text={logs} label={t("copyAllLogs")} disabled={!logs} />
          </div>
          <pre className="diagnostic-console" role="log" aria-live="polite">
            {logs || t("noDiagnosticLogs")}
          </pre>
        </>
      ) : null}
    </div>
  );
}
