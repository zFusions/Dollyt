import { PrimaryButton } from "./PrimaryButton";

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
        aria-label="Fermer"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="dev-gate-title"
        className="set-dev-gate-card"
      >
        <h2 id="dev-gate-title" className="set-dev-gate-title">
          Mode développeur
        </h2>
        <p className="meta set-dev-gate-lead">
          Tu pourras régler CRF, fps, Mbps et le preset x264 au-dessus des réglages
          TikTok, Reels, etc. Sans ces bases FFmpeg, tu peux rester sur les
          presets.
        </p>
        <ul className="meta set-dev-gate-list">
          <li>Un CRF trop bas ou trop de Mbps donne un gros fichier sans mieux sur le réseau.</li>
          <li>Un fps ou un plafond Mbps incohérent peut bloquer l&apos;upload.</li>
          <li>Ces valeurs comptent pour chaque export depuis l&apos;accueil.</li>
        </ul>
        <div className="set-dev-gate-actions">
          <PrimaryButton variant="default" className="btn-sm" onClick={onCancel}>
            Annuler
          </PrimaryButton>
          <PrimaryButton variant="primary" className="btn-sm" onClick={onConfirm}>
            Activer le mode développeur
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
