import type { Preset } from "../api/dollyt";
import { ExportProgress } from "./ExportProgress";
import { PrimaryButton } from "./PrimaryButton";
import { Panel, SettingRow } from "./ui/Panel";
import { CustomSelect } from "./ui/CustomSelect";
import { Toggle } from "./Toggle";
import { presetDisplayName } from "../lib/presetsUi";
import { t } from "../i18n";

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
          <SettingRow label={t("presetLabel")}>
            <CustomSelect
              value={selectedPresetId}
              onChange={onPresetChange}
              className="mono"
              options={presets.map((p) => ({
                value: p.id,
                label: presetDisplayName(p),
                iconId: p.id,
              }))}
              ariaLabel={t("exportPresetAria")}
            />
          </SettingRow>
          <Toggle
            checked={exportFullVideo}
            onChange={onExportFullVideoChange}
            label={t("fullVideo")}
            description={
              exportFullVideo ? t("fullVideoDesc") : t("clipDesc")
            }
          />
          <div className="set-row flex flex-col gap-2">
            <PrimaryButton
              variant="primary"
              className="btn-sm btn-block"
              onClick={onExport}
            >
              {exportFullVideo ? t("exportAll") : t("exportClip")}
            </PrimaryButton>
            <PrimaryButton
              variant="ghost"
              className="btn-sm btn-block"
              onClick={onCancel}
            >
              {t("cancel")}
            </PrimaryButton>
            <ExportProgress percent={jobPercent} label={status} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
