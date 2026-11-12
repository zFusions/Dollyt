/** Safelight + grain — partagés sur toute l'app. */
export function AmbientBackdrop() {
  return (
    <>
      <div className="atmo-backdrop" aria-hidden>
        <span className="atmo-lit-fill" />
        <span className="atmo-lit-source" />
        <span className="atmo-lit-source-br" />
        <span className="atmo-lit-source-bl" />
        <span className="atmo-lit-beam-soft" />
        <span className="atmo-lit-pool" />
      </div>
      <div className="atmo-grain" aria-hidden />
    </>
  );
}
