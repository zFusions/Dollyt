import { RefObject, useState } from "react";
import { previewSrc } from "../lib/previewSrc";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  previewUrl: string;
  streamFallback?: boolean;
  /** Premier fichier local pas encore prêt. */
  awaitingLocal?: boolean;
  /** Fenêtre locale en cours de téléchargement (curseur ailleurs). */
  fetchingHint?: string;
  posterUrl?: string | null;
  /** Force le rechargement quand le même fichier est réécrit sur disque. */
  mediaEpoch?: number;
  onStreamError?: () => void;
  onCanPlay?: () => void;
  onTimeUpdate: () => void;
};

export function PreviewPlayer({
  videoRef,
  previewUrl,
  streamFallback = false,
  awaitingLocal = false,
  fetchingHint = "",
  posterUrl,
  mediaEpoch = 0,
  onStreamError,
  onCanPlay,
  onTimeUpdate,
}: Props) {
  const [err, setErr] = useState("");
  const src = previewSrc(previewUrl);
  const showErr = err && !awaitingLocal;
  return (
    <div className="preview-frame panel overflow-hidden !p-0">
      {posterUrl && awaitingLocal ? (
        <img src={posterUrl} alt="" className="preview-poster" draggable={false} />
      ) : null}
      {awaitingLocal ? (
        <p className="preview-wait meta" aria-live="polite">
          Chargement de la zone…
        </p>
      ) : null}
      {fetchingHint ? (
        <p className="preview-wait preview-wait--subtle meta" aria-live="polite">
          {fetchingHint}
        </p>
      ) : null}
      {showErr ? <p className="preview-error meta">{err}</p> : null}
      <video
        key={`${src}#${mediaEpoch}`}
        ref={videoRef}
        src={src}
        playsInline
        muted={streamFallback}
        preload="auto"
        crossOrigin={streamFallback ? "anonymous" : undefined}
        className="preview-video w-full bg-black"
        onTimeUpdate={onTimeUpdate}
        onError={() => {
          if (awaitingLocal) return;
          onStreamError?.();
          setErr("Lecture impossible.");
        }}
        onLoadedData={() => setErr("")}
        onCanPlay={() => onCanPlay?.()}
      />
    </div>
  );
}
