import { useState } from "react";
import { PrimaryButton } from "./PrimaryButton";
import { t } from "../i18n";

type UpdateDialogProps = {
  version: string;
  body?: string | null;
  onInstall: () => void;
  onIgnore: () => void;
};

export function UpdateDialog({
  version,
  body,
  onInstall,
  onIgnore,
}: UpdateDialogProps) {
  const [installing, setInstalling] = useState(false);

  async function handleInstall() {
    setInstalling(true);
    try {
      await onInstall();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="set-dev-gate" role="presentation">
      <div className="set-dev-gate-card">
        <h2 className="set-dev-gate-title">{t("updateAvailable")}</h2>
        <p className="meta set-dev-gate-lead">
          {t("updateAvailableSub")} {version}
        </p>
        {body ? <p className="meta set-dev-gate-lead">{body}</p> : null}
        <div className="set-dev-gate-actions">
          <PrimaryButton
            variant="default"
            className="btn-sm"
            onClick={onIgnore}
            disabled={installing}
          >
            {t("ignoreUpdate")}
          </PrimaryButton>
          <PrimaryButton
            variant="primary"
            className="btn-sm"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? t("installingUpdate") : t("installUpdate")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
