import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getSettings, saveSettings } from "../api/dollyt";
import { UpdateDialog } from "../components/UpdateDialog";
import { NoticeDialog } from "../components/NoticeDialog";
import { t } from "../i18n";

type UpdateInfo = {
  version: string;
  body?: string | null;
};

export function useAppUpdater() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(
    null,
  );
  async function checkForUpdates(manual = false) {
    if (!isTauri()) return;

    try {
      const update = await check();
      if (!update) {
        if (manual) {
          setNotice({
            title: t("noUpdate"),
            message: t("noUpdateSub"),
          });
        }
        return;
      }

      const settings = await getSettings();
      if (!settings) {
        await update.close();
        return;
      }

      if (settings.ignoredUpdateVersion === update.version && !manual) {
        await update.close();
        return;
      }

      setAvailableUpdate(update);
      setUpdateInfo({
        version: update.version,
        body: update.body,
      });
    } catch (error) {
      if (manual) {
        setNotice({
          title: t("updateError"),
          message: String(error),
        });
      }
    }
  }

  async function handleInstall() {
    if (!updateInfo || !availableUpdate) return;

    try {
      setDownloadPercent(0);
      let downloaded = 0;
      let contentLength: number | undefined;
      await availableUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setDownloadPercent(
            contentLength && contentLength > 0
              ? Math.min(99, Math.floor((downloaded / contentLength) * 100))
              : null,
          );
        } else if (event.event === "Finished") {
          setDownloadPercent(100);
        }
      });
      await relaunch();
    } catch (error) {
      await availableUpdate.close().catch(() => undefined);
      setAvailableUpdate(null);
      setUpdateInfo(null);
      setNotice({
        title: t("updateError"),
        message: String(error),
      });
    }
  }

  async function handleIgnore() {
    if (!updateInfo) return;

    const settings = await getSettings();
    if (!settings) return;

    await saveSettings({
      ...settings,
      ignoredUpdateVersion: updateInfo.version,
    });

    await availableUpdate?.close();
    setAvailableUpdate(null);
    setUpdateInfo(null);
  }

  useEffect(() => {
    const listener = () => {
      void checkForUpdates(true);
    };

    window.addEventListener("dollyt:check-update", listener);
    return () => window.removeEventListener("dollyt:check-update", listener);
  }, []);

  useEffect(() => {
    async function startupCheck() {
      const settings = await getSettings();
      if (!settings) return;

      if (settings.autoUpdateApp) {
        await checkForUpdates(false);
      }
    }

    void startupCheck();
  }, []);

  return {
    dialog: updateInfo ? (
      <UpdateDialog
        version={updateInfo.version}
        body={updateInfo.body}
        downloadPercent={downloadPercent}
        onInstall={handleInstall}
        onIgnore={handleIgnore}
      />
    ) : null,
    notice: notice ? (
      <NoticeDialog
        open={true}
        title={notice.title}
        message={notice.message}
        onClose={() => setNotice(null)}
      />
    ) : null,
  };
}
