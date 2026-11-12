import { Panel } from "../components/ui/Panel";
import { ExportProgress } from "../components/ExportProgress";
import { useDollytStore } from "../store";

export function QueueView() {
  const jobPercent = useDollytStore((s) => s.jobPercent);
  const status = useDollytStore((s) => s.status);

  return (
    <div className="page set-page">
      <header className="set-head">
        <h1 className="page-title">File d'attente</h1>
        <p className="page-sub">Tu ne peux lancer qu&apos;un export à la fois.</p>
      </header>
      <section className="set-section">
        <h2 className="set-heading">En cours</h2>
        <Panel>
        <div className="panel-pad space-y-3">
          <ExportProgress percent={jobPercent} label={status || "Inactif"} />
          {!status ? (
            <p className="meta">Rien en cours. Pars de l&apos;accueil avec un lien YouTube.</p>
          ) : null}
        </div>
        </Panel>
      </section>
    </div>
  );
}
