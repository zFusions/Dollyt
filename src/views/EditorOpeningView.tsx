import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SnakeWait } from "../components/SnakeWait";
import { startLocalPreview } from "../api/dollyt";
import { useDollytStore } from "../store";
import { t } from "../i18n";

export function EditorOpeningView() {
  const url = useDollytStore((s) => s.url);
  const video = useDollytStore((s) => s.video);
  const status = useDollytStore((s) => s.status);
  const goHome = useDollytStore((s) => s.goHome);
  const setStatus = useDollytStore((s) => s.setStatus);
  const patchVideo = useDollytStore((s) => s.patchVideo);
  const setJobPercent = useDollytStore((s) => s.setJobPercent);
  const [pct, setPct] = useState(2);
  const [shown, setShown] = useState(2);
  const [fail, setFail] = useState("");
  const target = useRef(2);
  target.current = pct;

  const bootRef = useRef("");
  useEffect(() => {
    if (!isTauri() || !video || !url) return;
    const hasRemote =
      video.previewUrl && /^https?:\/\//i.test(video.previewUrl);
    if (hasRemote || video.previewLocalUrl) return;
    const key = `${url}|${video.formatId}`;
    if (bootRef.current === key) return;
    bootRef.current = key;
    void startLocalPreview(url, video.formatId, video.durationSecs, 0, false);
  }, [url, video]);

  useEffect(() => {
    if (!isTauri()) return;
    const unsubs: Array<() => void> = [];
    listen<{ percent: number }>("preview-progress", (event) => {
      const n = Math.max(0, Math.min(100, event.payload.percent));
      setPct(n);
    }).then((u) => unsubs.push(u));
    listen<{
      previewUrl: string;
      previewFileDurationSecs?: number | null;
      previewStartSecs?: number;
    }>("preview-local-ready", (event) => {
      patchVideo({
        previewLocalUrl: event.payload.previewUrl,
        previewFileDurationSecs: event.payload.previewFileDurationSecs,
        previewStartSecs: event.payload.previewStartSecs ?? 0,
      });
      setPct(100);
      setStatus("");
      setJobPercent(0);
    }).then((u) => unsubs.push(u));
    listen<{ message?: string }>("preview-local-failed", (event) => {
      const msg = event.payload.message || t("downloadFailed");
      setFail(msg);
      setStatus(msg);
    }).then((u) => unsubs.push(u));
    return () => {
      unsubs.forEach((u) => u());
      setStatus("");
    };
  }, [patchVideo, setJobPercent, setStatus]);

  useEffect(() => {
    let id = 0;
    const step = () => {
      setShown((s) => {
        const goal = target.current;
        if (goal >= 100) return 100;
        const next = s + (goal - s) * 0.12;
        return Math.abs(goal - next) < 0.4 ? goal : next;
      });
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section className="page editor-page editor-opening">
      <p className="editor-opening-title">{t("preparingVideoTitle")}</p>
      <p className="meta">{fail || status || t("ytInfoLoading")}</p>
      <div
        className="load-track"
        role="progressbar"
        aria-valuenow={Math.round(shown)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="load-fill" style={{ transform: `scaleX(${shown / 100})` }} />
      </div>
      <p className="mono load-pct">{Math.round(shown)} %</p>
      <SnakeWait />
      <p className="meta">{t("snakeHintLong")}</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={goHome} tabIndex={-1}>
        {t("cancel")}
      </button>
    </section>
  );
}
