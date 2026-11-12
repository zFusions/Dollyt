import { useEffect, useState } from "react";
import {
  getSettings,
  listPresets,
  saveSettings,
  type Preset,
} from "../api/dollyt";
import { PresetAppIcon } from "../components/presets/PresetAppIcon";
import { Panel } from "../components/ui/Panel";
import {
  presetBrief,
  presetRowExportSpec,
  SOCIAL_PRESET_IDS,
} from "../lib/presetsUi";
import { useDollytStore } from "../store";

function PresetPickList({
  items,
  selectedId,
  busy,
  onPick,
}: {
  items: Preset[];
  selectedId: string;
  busy: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="set-group">
      {items.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={busy}
          onClick={() => void onPick(p.id)}
          className={`pick-row pick-row--rich${p.id === "quality-max" ? " pick-row--max" : ""}`}
          data-on={p.id === selectedId ? true : undefined}
        >
          <PresetAppIcon presetId={p.id} className="pick-row-icon" />
          <span className="pick-row-main">
            <span className="set-label">
              {p.name}
              {p.id === "quality-max" ? (
                <span className="pick-row-badge">Qualité max</span>
              ) : null}
            </span>
          </span>
          <span className="pick-row-spec mono" title={presetRowExportSpec(p)}>
            {presetRowExportSpec(p)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PresetsView() {
  const selectedPresetId = useDollytStore((s) => s.selectedPresetId);
  const setSelectedPresetId = useDollytStore((s) => s.setSelectedPresetId);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listPresets()
      .then(setPresets)
      .catch((e) => setErr(String(e)));
    getSettings()
      .then((s) => {
        if (s?.defaultPresetId) setSelectedPresetId(s.defaultPresetId);
      })
      .catch(() => {});
  }, [setSelectedPresetId]);

  const active = presets.find((p) => p.id === selectedPresetId);
  const activeBrief = active ? presetBrief(active) : null;
  const social = presets.filter((p) => SOCIAL_PRESET_IDS.has(p.id));
  const other = presets.filter((p) => !SOCIAL_PRESET_IDS.has(p.id));

  async function pickPreset(id: string) {
    setSelectedPresetId(id);
    setBusy(true);
    setMsg("");
    try {
      const base = await getSettings();
      if (!base) {
        setErr("Réglages indisponibles hors application.");
        return;
      }
      await saveSettings({ ...base, defaultPresetId: id });
      setMsg("C’est enregistré. L’accueil utilisera ce preset.");
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page set-page">
      <header className="set-head">
        <h1 className="page-title">Presets</h1>
        <p className="page-sub">
          Choisis où tu envoies la vidéo. Le même réglage suit sur l&apos;accueil.
        </p>
        <div className="set-head-actions">
          {msg ? <p className="meta">{msg}</p> : null}
        </div>
      </header>

      {err ? <p className="meta text-warn">{err}</p> : null}

      <section className="set-section">
        <h2 className="set-heading">Réseaux</h2>
        <Panel>
          <PresetPickList
            items={social}
            selectedId={selectedPresetId}
            busy={busy}
            onPick={pickPreset}
          />
        </Panel>
      </section>

      {other.length > 0 ? (
        <section className="set-section">
          <h2 className="set-heading">Autres</h2>
          <Panel>
            <PresetPickList
              items={other}
              selectedId={selectedPresetId}
              busy={busy}
              onPick={pickPreset}
            />
          </Panel>
        </section>
      ) : null}

      {active && activeBrief ? (
        <section className="set-section preset-active">
          <h2 className="set-heading">En bref</h2>
          <Panel className="panel-pad">
            <p className="preset-active-name">{active.name}</p>
            <p className="preset-active-lead">{activeBrief.lead}</p>
            {activeBrief.points.length > 0 ? (
              <ul className="preset-active-list meta">
                {activeBrief.points.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            <p className="meta preset-active-spec mono">
              Fichier : {presetRowExportSpec(active)}
            </p>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
