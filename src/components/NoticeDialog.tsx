import { PrimaryButton } from "./PrimaryButton";

type Props = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export function NoticeDialog({ open, title, message, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="set-dev-gate" role="presentation">
      <button
        type="button"
        className="set-dev-gate-backdrop"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="notice-dialog-title"
        className="set-dev-gate-card"
      >
        <h2 id="notice-dialog-title" className="set-dev-gate-title">
          {title}
        </h2>
        <p className="meta set-dev-gate-lead">{message}</p>
        <div className="set-dev-gate-actions">
          <PrimaryButton variant="primary" className="btn-sm" onClick={onClose}>
            OK
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
