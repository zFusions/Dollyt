import { useEffect, useRef, useState } from "react";
import {
  getSettings,
  saveSettings,
  pickExportDirectory,
  updateYtdlp,
  type Settings,
} from "../api/dollyt";
import { DevModeDialog } from "../components/DevModeDialog";
import { NoticeDialog } from "../components/NoticeDialog";
import { CustomSelect } from "../components/ui/CustomSelect";
import { Panel, SettingRow } from "../components/ui/Panel";
import { Switch } from "../components/Toggle";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDollytStore } from "../store";
import { setLocale, t, useLocale } from "../i18n";
import { setLeaveGuard } from "../lib/leaveGuard";

const DEFAULTS: Settings = {
  exportDir: "",
  nameTemplate: "{titre}_depuis-{debut}s_jusqu-a-{fin}s",
  hardwareEncode: false,
  autoUpdateYtdlp: false,
  ytdlpCookiesBrowser: "",
  ytdlpCookiesFile: "",
  defaultPresetId: "tiktok",
  developerMode: false,
  devCrf: null,
  devVideoMaxBitrateKbps: null,
  devFps: null,
  devAudioBitrateKbps: null,
  devX264Preset: "",
  autoUpdateApp: false,
  ignoredUpdateVersion: null,
};

export function SettingsView() {
  const locale = useLocale();
  const setSelectedPresetId = useDollytStore((s) => s.setSelectedPresetId);
  const [draft, setDraft] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState<Settings>(DEFAULTS);
  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  draftRef.current = draft;
  savedRef.current = saved;
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [devGateOpen, setDevGateOpen] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(
    null,
  );

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (!s) return;
        const presetId = s.defaultPresetId || "tiktok";
        const loaded: Settings = {
          ...DEFAULTS,
          ...s,
          autoUpdateYtdlp: s.autoUpdateYtdlp ?? false,
          defaultPresetId: presetId,
          ytdlpCookiesBrowser: s.ytdlpCookiesBrowser ?? "",
          ytdlpCookiesFile: s.ytdlpCookiesFile ?? "",
          developerMode: s.developerMode ?? false,
          devCrf: s.devCrf ?? null,
          devVideoMaxBitrateKbps: s.devVideoMaxBitrateKbps ?? null,
          devFps: s.devFps ?? null,
          devAudioBitrateKbps: s.devAudioBitrateKbps ?? null,
          devX264Preset: s.devX264Preset ?? "",
          autoUpdateApp: s.autoUpdateApp ?? false,
          ignoredUpdateVersion: s.ignoredUpdateVersion ?? null,
        };
        setDraft(loaded);
        setSaved(loaded);
        setSelectedPresetId(presetId);
      })
      .catch((e) => setMsg(String(e)));
  }, [setSelectedPresetId]);

  useEffect(() => {
    setLeaveGuard({
      isDirty: () =>
        JSON.stringify(draftRef.current) !== JSON.stringify(savedRef.current),
      save: async () => {
        const d = draftRef.current;
        await saveSettings(d);
        setSaved({ ...d });
        setSelectedPresetId(d.defaultPresetId);
      },
      discard: () => setDraft({ ...savedRef.current }),
    });
    return () => setLeaveGuard(null);
  }, [setSelectedPresetId]);

  function onDeveloperMode(next: boolean) {
    if (next && !draft.developerMode) {
      setDevGateOpen(true);
      return;
    }
    setDraft({ ...draft, developerMode: next });
  }

  function confirmDeveloperMode() {
    setDraft({ ...draft, developerMode: true });
    setDevGateOpen(false);
  }

  async function onSave() {
    setBusy(true);
    setMsg("");
    try {
      await saveSettings(draft);
      setSaved({ ...draft });
      setSelectedPresetId(draft.defaultPresetId);
      setMsg(t("savedMsg"));
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateYtdlp() {
    setBusy(true);
    setMsg("");
    try {
      const result = await updateYtdlp();
      if (result?.alreadyLatest) {
        setNotice({
          title: "yt-dlp",
          message: t("ytdlpLatest"),
        });
      } else {
        setNotice({
          title: "yt-dlp",
          message: t("ytdlpRechecked"),
        });
      }
    } catch (e) {
      setNotice({
        title: "yt-dlp",
        message: String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page set-page">
      <DevModeDialog
        open={devGateOpen}
        onCancel={() => setDevGateOpen(false)}
        onConfirm={confirmDeveloperMode}
      />
      <NoticeDialog
        open={notice !== null}
        title={notice?.title ?? ""}
        message={notice?.message ?? ""}
        onClose={() => setNotice(null)}
      />
      <header className="set-head">
        <h1 className="page-title">{t("settingsTitle")}</h1>
        <p className="page-sub">
          {t("settingsSub")} YouTube se choisit dans Presets.
        </p>
        <div className="set-head-actions">
          {msg ? <p className="meta">{msg}</p> : null}
          <PrimaryButton
            variant="primary"
            className="btn-sm"
            onClick={onSave}
            disabled={busy}
          >
            {t("save")}
          </PrimaryButton>
        </div>
      </header>

      <section className="set-section">
        <h2 className="set-heading">{t("language")}</h2>
        <Panel>
          <div className="set-group">
            <SettingRow label={t("language")} hint={t("savedLocally")}>
              <select
                className="field"
                value={locale}
                onChange={(event) => setLocale(event.target.value as "fr" | "en")}
              >
                <option value="fr">{t("french")}</option>
                <option value="en">{t("english")}</option>
              </select>
            </SettingRow>
          </div>
        </Panel>
      </section>

      <section className="set-section">
        <h2 className="set-heading">{t("export")}</h2>
        <Panel>
          <div className="set-group">
            <SettingRow
              label={t("outputFolder")}
              hint={t("outputHint")}
            >
              <div className="set-path-control">
                <input
                  value={draft.exportDir}
                  onChange={(e) =>
                    setDraft({ ...draft, exportDir: e.target.value })
                  }
                  className="field mono"
                  spellCheck={false}
                  placeholder={t("noFolder")}
                />
                <PrimaryButton
                  variant="default"
                  className="btn-sm"
                  onClick={() => {
                    void pickExportDirectory()
                      .then((path) => {
                        if (path) {
                          setDraft((current) => ({ ...current, exportDir: path }));
                        }
                      })
                      .catch((error) => setMsg(String(error)));
                  }}
                >
                  {t("browse")}
                </PrimaryButton>
              </div>
            </SettingRow>
            <SettingRow
              label={t("exportFilename")}
              hint={t("exportFilenameHint")}
            >
              <input
                value={draft.nameTemplate}
                onChange={(e) =>
                  setDraft({ ...draft, nameTemplate: e.target.value })
                }
                className="field mono"
                spellCheck={false}
              />
            </SettingRow>
            <SettingRow label={t("hwEncode")} hint={t("hwEncodeHint")}>
              <Switch
                checked={draft.hardwareEncode}
                onChange={(v) => setDraft({ ...draft, hardwareEncode: v })}
                label={t("hwEncode")}
              />
            </SettingRow>
          </div>
        </Panel>
      </section>

      <section className="set-section">
        <h2 className="set-heading">{t("engine")}</h2>
        <Panel>
          <div className="set-group">
            <SettingRow
              label="yt-dlp"
              hint={t("ytdlpSecureHint")}
            >
              <span className="meta">{t("secured")}</span>
            </SettingRow>
          </div>
        </Panel>
      </section>

      <section className="set-section">
        <h2 className="set-heading">{t("updateAvailable")}</h2>
        <Panel>
          <div className="set-group">
            <SettingRow
              label={t("autoUpdateApp")}
              hint={t("autoUpdateHint")}
            >
              <Switch
                checked={draft.autoUpdateApp}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, autoUpdateApp: value }))
                }
                label={t("autoUpdate")}
              />
            </SettingRow>
            <SettingRow
              label={t("checkUpdate")}
              hint={t("checkUpdateManualHint")}
            >
              <PrimaryButton
                variant="default"
                className="btn-sm"
                onClick={() => {
                  setBusy(true);
                  setMsg("");
                  window.dispatchEvent(new CustomEvent("dollyt:check-update"));
                }}
                disabled={busy}
              >
                {t("checkUpdate")}
              </PrimaryButton>
            </SettingRow>
            <SettingRow
              label={t("autoUpdateYtdlp")}
              hint={t("autoUpdateYtdlpHint")}
            >
              <Switch
                checked={draft.autoUpdateYtdlp}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, autoUpdateYtdlp: value }))
                }
                label={t("autoUpdateYtdlp")}
              />
            </SettingRow>
            <SettingRow
              label={t("ytdlpVersion")}
              hint={t("ytdlpSourceHint")}
            >
              <PrimaryButton
                variant="default"
                className="btn-sm"
                onClick={onUpdateYtdlp}
                disabled={busy}
              >
                {t("recheckYtdlp")}
              </PrimaryButton>
            </SettingRow>
          </div>
        </Panel>
      </section>

      <section className="set-section">
        <h2 className="set-heading">{t("developer")}</h2>
        <p className="meta mb-2 px-0.5">
          {t("devIntro")}
        </p>
        <Panel>
          <div className="set-group">
            <SettingRow
              label={t("devMode")}
              hint={t("devModeHint")}
            >
              <Switch
                checked={draft.developerMode}
                onChange={onDeveloperMode}
                label={t("devMode")}
              />
            </SettingRow>
            {draft.developerMode ? (
              <>
                <p className="meta px-3 pb-1 text-warn" role="note">
                  {t("devValuesWarning")}
                </p>
                <SettingRow
                  label="CRF"
                  hint={t("devValuesHint")}
                >
                  <input
                    type="number"
                    min={0}
                    max={51}
                    className="field mono"
                    value={draft.devCrf ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        devCrf:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                    placeholder="18"
                  />
                </SettingRow>
                <SettingRow
                  label={t("videoCap")}
                  hint={t("networkCapHint")}
                >
                  <input
                    type="number"
                    min={1}
                    max={80}
                    step={0.5}
                    className="field mono"
                    value={
                      draft.devVideoMaxBitrateKbps != null
                        ? draft.devVideoMaxBitrateKbps / 1000
                        : ""
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        devVideoMaxBitrateKbps:
                          e.target.value === ""
                            ? null
                            : Math.round(Number(e.target.value) * 1000),
                      })
                    }
                    placeholder="10"
                  />
                </SettingRow>
                <SettingRow label={t("fpsLabel")} hint={t("fpsHint")}>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    className="field mono"
                    value={draft.devFps ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        devFps:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                    placeholder="30"
                  />
                </SettingRow>
                <SettingRow
                  label={t("audioKbps")}
                  hint={t("audioHint")}
                >
                  <input
                    type="number"
                    min={64}
                    max={512}
                    className="field mono"
                    value={draft.devAudioBitrateKbps ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        devAudioBitrateKbps:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value),
                      })
                    }
                    placeholder="128"
                  />
                </SettingRow>
                <SettingRow
                  label={t("x264Preset")}
                  hint={t("x264Hint")}
                >
                  <CustomSelect
                    value={draft.devX264Preset || ""}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        devX264Preset: v,
                      })
                    }
                    options={[
                      { value: "", label: t("x264Default") },
                      { value: "medium", label: "medium" },
                      { value: "slow", label: "slow" },
                      { value: "veryslow", label: "veryslow" },
                    ]}
                    ariaLabel={t("x264Preset")}
                  />
                </SettingRow>
              </>
            ) : null}
          </div>
        </Panel>
      </section>
    </div>
  );
}
