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
    <div className="dialog-overlay">
      <div className="dialog-card">
        <h2 className="dialog-title">{t("updateAvailable")}</h2>
        <p className="dialog-sub">
          {t("updateAvailableSub")} {version}
        </p>
        {body && <p className="dialog-body">{body}</p>}
        <div className="dialog-actions">
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
