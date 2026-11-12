import { useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
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

const DEFAULTS: Settings = {
  exportDir: "",
  nameTemplate: "{titre}_depuis-{debut}s_jusqu-a-{fin}s",
  hardwareEncode: false,
  ytdlpCookiesBrowser: "",
  ytdlpCookiesFile: "",
  youtubeOnboardingDone: true,
  defaultPresetId: "tiktok",
  developerMode: false,
  devCrf: null,
  devVideoMaxBitrateKbps: null,
  devFps: null,
  devAudioBitrateKbps: null,
  devX264Preset: "",
};

export function SettingsView() {
  const setSelectedPresetId = useDollytStore((s) => s.setSelectedPresetId);
  const [draft, setDraft] = useState<Settings>(DEFAULTS);
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
        setDraft({
          ...DEFAULTS,
          ...s,
          defaultPresetId: presetId,
          ytdlpCookiesBrowser: s.ytdlpCookiesBrowser ?? "",
          ytdlpCookiesFile: s.ytdlpCookiesFile ?? "",
          youtubeOnboardingDone: s.youtubeOnboardingDone ?? false,
          developerMode: s.developerMode ?? false,
          devCrf: s.devCrf ?? null,
          devVideoMaxBitrateKbps: s.devVideoMaxBitrateKbps ?? null,
          devFps: s.devFps ?? null,
          devAudioBitrateKbps: s.devAudioBitrateKbps ?? null,
          devX264Preset: s.devX264Preset ?? "",
        });
        setSelectedPresetId(presetId);
      })
      .catch((e) => setMsg(String(e)));
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
      setSelectedPresetId(draft.defaultPresetId);
      setMsg("Enregistré");
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
          message: "Tu as déjà la dernière version yt-dlp listée sur GitHub.",
        });
      } else {
        setNotice({
          title: "yt-dlp",
          message: "yt-dlp est à jour sur ton disque.",
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
        <h1 className="page-title">Paramètres</h1>
        <p className="page-sub">
          Dossier de sortie, yt-dlp et options avancées. Le preset pour TikTok ou
          YouTube se choisit dans Presets.
        </p>
        <div className="set-head-actions">
          {msg ? <p className="meta">{msg}</p> : null}
          <PrimaryButton
            variant="primary"
            className="btn-sm"
            onClick={onSave}
            disabled={busy}
          >
            Enregistrer
          </PrimaryButton>
        </div>
      </header>

      <section className="set-section">
        <h2 className="set-heading">Export</h2>
        <Panel>
          <div className="set-group">
            <SettingRow
              label="Dossier de sortie"
              hint="Chemin complet ou dossier vide pour la valeur par défaut"
            >
              <input
                value={draft.exportDir}
                onChange={(e) =>
                  setDraft({ ...draft, exportDir: e.target.value })
                }
                className="field mono"
                spellCheck={false}
              />
            </SettingRow>
            <SettingRow
              label="Nom des fichiers exportés"
              hint="{titre}, {debut} et {fin} sont remplacés au moment de l'export"
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
            <SettingRow label="Encodage matériel" hint="Passe par la carte NVIDIA si elle est là">
              <Switch
                checked={draft.hardwareEncode}
                onChange={(v) => setDraft({ ...draft, hardwareEncode: v })}
                label="Encodage matériel"
              />
            </SettingRow>
          </div>
        </Panel>
      </section>

      <section className="set-section">
        <h2 className="set-heading">Moteur</h2>
        <Panel>
          <div className="set-group">
            <SettingRow
              label="yt-dlp"
              hint="Remplace le binaire yt-dlp fourni avec l'app"
            >
              <PrimaryButton
                variant="default"
                className="btn-sm"
                onClick={onUpdateYtdlp}
                disabled={busy}
              >
                Mettre à jour
              </PrimaryButton>
            </SettingRow>
          </div>
        </Panel>
      </section>

      <section className="set-section">
        <h2 className="set-heading">Développeur</h2>
        <p className="meta mb-2 px-0.5">
          Réserve ça si tu touches à FFmpeg toi-même. Laisse vide pour garder le
          preset choisi dans Presets.
        </p>
        <Panel>
          <div className="set-group">
            <SettingRow
              label="Mode développeur"
              hint="CRF, Mbps, fps et preset x264 personnalisés"
            >
              <Switch
                checked={draft.developerMode}
                onChange={onDeveloperMode}
                label="Mode développeur"
              />
            </SettingRow>
            {draft.developerMode ? (
              <>
                <p className="meta px-3 pb-1 text-warn" role="note">
                  Chaque export depuis l&apos;accueil utilisera ces valeurs. Mauvais CRF
                  ou fps peut gonfler le fichier ou faire échouer l&apos;upload.
                </p>
                <SettingRow
                  label="CRF"
                  hint="18 est souvent propre. 0 fait des fichiers énormes. Vide = preset."
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
                  label="Plafond vidéo (Mbps)"
                  hint="Plafond réseau du preset si tu laisses vide"
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
                <SettingRow label="Images par seconde" hint="Vide = preset.">
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
                  label="Audio (kbps)"
                  hint="Reels : souvent 128 kbps max. Vide = preset."
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
                  label="Preset x264"
                  hint="slow demande plus de temps, souvent un peu plus net"
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
                      { value: "", label: "fast (défaut)" },
                      { value: "medium", label: "medium" },
                      { value: "slow", label: "slow" },
                      { value: "veryslow", label: "veryslow" },
                    ]}
                    ariaLabel="Preset x264"
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
