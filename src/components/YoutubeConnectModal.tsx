import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "@tauri-apps/api/core";
import {
  closeYoutubeLogin,
  getSettings,
  openYoutubeLogin,
  pickCookiesFile,
  probeYoutubeSession,
  saveSettings,
  type Settings,
} from "../api/dollyt";
import { PrimaryButton } from "./PrimaryButton";

type Props = {
  onDone: () => void;
};

type Method = "firefox" | "dollyt" | "cookies";

export function YoutubeConnectModal({ onDone }: Props) {
  const [method, setMethod] = useState<Method>("firefox");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [cookiesPath, setCookiesPath] = useState("");

  async function persist(patch: Partial<Settings>, done = true) {
    const base = (await getSettings()) ?? {
      exportDir: "",
      nameTemplate: "{titre}_{debut}-{fin}",
      hardwareEncode: false,
      autoUpdateYtdlp: false,
      ytdlpCookiesBrowser: "",
      ytdlpCookiesFile: "",
      youtubeOnboardingDone: false,
      defaultPresetId: "tiktok",
      developerMode: false,
      devCrf: null,
      devVideoMaxBitrateKbps: null,
      devFps: null,
      devAudioBitrateKbps: null,
      devX264Preset: "",
    };
    await saveSettings({
      ...base,
      ...patch,
      youtubeOnboardingDone: done ? true : base.youtubeOnboardingDone,
    });
  }

  async function testSession() {
    setBusy(true);
    setMsg("Test en cours…");
    try {
      await probeYoutubeSession();
      setMsg("La session YouTube répond. Tu peux coller un lien.");
      await persist({}, true);
      onDone();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyFirefox() {
    setBusy(true);
    setMsg("");
    try {
      await persist({ ytdlpCookiesBrowser: "firefox", ytdlpCookiesFile: "" }, false);
      if (isTauri()) {
        await openUrl("https://www.youtube.com");
      }
      setMsg(
        "Ouvre Firefox, connecte-toi à YouTube, ferme le navigateur, puis clique Tester.",
      );
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyDollytWindow() {
    setBusy(true);
    setMsg("");
    try {
      await openYoutubeLogin();
      setMsg(
        "Connecte-toi dans la fenêtre Dollyt. Sur Windows, Chrome et Edge demandent souvent un fichier cookies.txt. Firefox reste le plus simple.",
      );
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importCookies() {
    setBusy(true);
    setMsg("");
    try {
      const path = await pickCookiesFile();
      if (!path) {
        setMsg("Aucun fichier choisi.");
        return;
      }
      setCookiesPath(path);
      await persist({
        ytdlpCookiesFile: path,
        ytdlpCookiesBrowser: "",
      }, false);
      setMsg("Fichier enregistré. Clique « Tester ».");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finishDollyt() {
    await closeYoutubeLogin();
    await testSession();
  }

  async function skip() {
    await persist({ youtubeOnboardingDone: true }, true);
    onDone();
  }

  return (
    <div
      className="yt-connect-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yt-connect-title"
    >
      <div className="yt-connect-panel panel">
        <h2 id="yt-connect-title" className="set-heading">
          Accès YouTube
        </h2>
        <p className="meta">
          yt-dlp a besoin d&apos;une session YouTube valide. Sans ça, beaucoup de
          vidéos refusent la lecture. Choisis une méthode ci-dessous.
        </p>

        <div className="yt-connect-options">
          <label className={`yt-connect-opt${method === "firefox" ? " is-on" : ""}`}>
            <input
              type="radio"
              name="yt-method"
              checked={method === "firefox"}
              onChange={() => setMethod("firefox")}
            />
            <span className="yt-connect-opt-title">Firefox (recommandé)</span>
            <span className="meta">
              Dollyt lit les cookies Firefox déjà sur ton PC (Windows).
            </span>
          </label>
          <label className={`yt-connect-opt${method === "dollyt" ? " is-on" : ""}`}>
            <input
              type="radio"
              name="yt-method"
              checked={method === "dollyt"}
              onChange={() => setMethod("dollyt")}
            />
            <span className="yt-connect-opt-title">Fenêtre Dollyt</span>
            <span className="meta">
              Tu te connectes dans une petite fenêtre Dollyt, puis tu testes.
            </span>
          </label>
          <label className={`yt-connect-opt${method === "cookies" ? " is-on" : ""}`}>
            <input
              type="radio"
              name="yt-method"
              checked={method === "cookies"}
              onChange={() => setMethod("cookies")}
            />
            <span className="yt-connect-opt-title">Fichier cookies.txt</span>
            <span className="meta">
              Export depuis Chrome (extension « Get cookies.txt LOCALLY »).
            </span>
          </label>
        </div>

        <div className="yt-connect-actions">
          {method === "firefox" ? (
            <PrimaryButton variant="primary" onClick={() => void applyFirefox()} disabled={busy}>
              Ouvrir Firefox et configurer
            </PrimaryButton>
          ) : method === "dollyt" ? (
            <>
              <PrimaryButton variant="primary" onClick={() => void applyDollytWindow()} disabled={busy}>
                Ouvrir la fenêtre YouTube
              </PrimaryButton>
              <PrimaryButton variant="default" onClick={() => void finishDollyt()} disabled={busy}>
                J&apos;ai fini, tester
              </PrimaryButton>
            </>
          ) : (
            <PrimaryButton variant="primary" onClick={() => void importCookies()} disabled={busy}>
              Choisir cookies.txt
            </PrimaryButton>
          )}
          <PrimaryButton variant="default" onClick={() => void testSession()} disabled={busy}>
            Tester la connexion
          </PrimaryButton>
        </div>

        {cookiesPath ? (
          <p className="meta mono yt-connect-path">{cookiesPath}</p>
        ) : null}
        {msg ? <p className="meta yt-connect-msg">{msg}</p> : null}

        <button type="button" className="btn btn-ghost btn-sm yt-connect-skip" onClick={() => void skip()}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
