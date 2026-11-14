import { useRef, useState } from "react";
import { previewSrc } from "../lib/previewSrc";
import { formatTimeTransport } from "../lib/time";
import { t } from "../i18n";

export function AudioPreviewPlayer({ path }: { path: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const src = previewSrc(path);
  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }

  function seekAt(clientX: number) {
    const el = audioRef.current;
    const track = trackRef.current;
    if (!el || !track || !Number.isFinite(el.duration)) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setTime(el.currentTime);
  }

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <button
        type="button"
        className="audio-play"
        onClick={toggle}
        aria-label={playing ? t("pause") : t("play")}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10-6.5a1 1 0 0 0 0-1.72l-10-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
      </button>
      <div className="audio-eq" data-on={playing || undefined} aria-hidden>
        <span /><span /><span /><span /><span />
      </div>
      <div
        ref={trackRef}
        className="audio-track"
        role="slider"
        aria-label={t("preview")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekAt(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) seekAt(e.clientX);
        }}
        onKeyDown={(e) => {
          const el = audioRef.current;
          if (!el) return;
          if (e.key === "ArrowRight") el.currentTime = Math.min(el.duration, el.currentTime + 5);
          else if (e.key === "ArrowLeft") el.currentTime = Math.max(0, el.currentTime - 5);
          else return;
          e.preventDefault();
        }}
      >
        <div className="audio-fill" style={{ width: `${pct}%` }} />
        <div className="audio-thumb" style={{ left: `${pct}%` }} />
      </div>
      <span className="audio-time">
        {formatTimeTransport(time)} / {formatTimeTransport(duration)}
      </span>
    </div>
  );
}
