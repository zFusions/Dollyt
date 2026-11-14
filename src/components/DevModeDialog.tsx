import { PrimaryButton } from "./PrimaryButton";
import { t } from "../i18n";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DevModeDialog({ open, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div className="set-dev-gate" role="presentation">
      <button
        type="button"
        className="set-dev-gate-backdrop"
        aria-label={t("close")}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="dev-gate-title"
        className="set-dev-gate-card"
      >
        <h2 id="dev-gate-title" className="set-dev-gate-title">
          {t("devMode")}
        </h2>
        <p className="meta set-dev-gate-lead">
          {t("devGateLead")}
        </p>
        <ul className="meta set-dev-gate-list">
          <li>{t("devGateLi1")}</li>
          <li>{t("devGateLi2")}</li>
          <li>{t("devGateLi3")}</li>
        </ul>
        <div className="set-dev-gate-actions">
          <PrimaryButton variant="default" className="btn-sm" onClick={onCancel}>
            {t("cancel")}
          </PrimaryButton>
          <PrimaryButton variant="primary" className="btn-sm" onClick={onConfirm}>
            {t("devGateConfirm")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
