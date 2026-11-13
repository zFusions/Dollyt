import type { ReactNode } from "react";
import { t } from "../i18n";

type Props = {
  busy: boolean;
  error: string;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function UnsavedGuardDialog({
  busy,
  error,
  onStay,
  onDiscard,
  onSaveAndLeave,
}: Props) {
  return (
    <div
      className="set-dev-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-guard-title"
    >
      <div className="set-dev-gate-card unsaved-guard-card">
        <span className="unsaved-guard-icon" aria-hidden>
          <Icon>
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </Icon>
        </span>
        <h2 id="unsaved-guard-title" className="set-dev-gate-title">
          {t("unsavedTitle")}
        </h2>
        <p className="meta set-dev-gate-lead">{t("unsavedMessage")}</p>
        {error ? <p className="unsaved-guard-error meta">{error}</p> : null}
        <div className="unsaved-guard-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onStay}
            disabled={busy}
          >
            <Icon>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </Icon>
            {t("unsavedStay")}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onDiscard}
            disabled={busy}
          >
            <Icon>
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </Icon>
            {t("unsavedDiscard")}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSaveAndLeave}
            disabled={busy}
          >
            <Icon>
              <path d="M20 6 9 17l-5-5" />
            </Icon>
            {t("unsavedSaveLeave")}
          </button>
        </div>
      </div>
    </div>
  );
}
