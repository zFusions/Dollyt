import type { Preset } from "../api/dollyt";
import { ExportProgress } from "./ExportProgress";
import { PrimaryButton } from "./PrimaryButton";
import { Panel, SettingRow } from "./ui/Panel";
import { CustomSelect } from "./ui/CustomSelect";
import { Toggle } from "./Toggle";

type Props = {
  formatLabel: string;
  presets: Preset[];
  selectedPresetId: string;
  onPresetChange: (id: string) => void;
  exportFullVideo: boolean;
  onExportFullVideoChange: (v: boolean) => void;
  onExport: () => void;
  onCancel: () => void;
  jobPercent: number;
  status: string;
};

export function ExportPanel({
  formatLabel,
  presets,
  selectedPresetId,
  onPresetChange,
  exportFullVideo,
  onExportFullVideoChange,
  onExport,
  onCancel,
  jobPercent,
  status,
}: Props) {
  return (
    <div className="editor-aside-stack">
      <h2 className="set-heading">Export</h2>
      <p className="editor-format-meta meta mono">{formatLabel}</p>
      <Panel>
        <div className="set-group">
          <SettingRow label="Preset">
            <CustomSelect
              value={selectedPresetId}
              onChange={onPresetChange}
              className="mono"
              options={presets.map((p) => ({
                value: p.id,
                label: p.name,
                iconId: p.id,
              }))}
              ariaLabel="Preset d'export"
            />
          </SettingRow>
          <Toggle
            checked={exportFullVideo}
            onChange={onExportFullVideoChange}
            label="Vidéo entière"
            description={
              exportFullVideo ? "Toute la durée" : "Seulement la zone marquée"
            }
          />
          <div className="set-row flex flex-col gap-2">
            <PrimaryButton
              variant="primary"
              className="btn-sm btn-block"
              onClick={onExport}
            >
              {exportFullVideo ? "Exporter tout" : "Exporter le clip"}
            </PrimaryButton>
            <PrimaryButton
              variant="ghost"
              className="btn-sm btn-block"
              onClick={onCancel}
            >
              Annuler
            </PrimaryButton>
            <ExportProgress percent={jobPercent} label={status} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
