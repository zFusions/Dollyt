import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getTimelineFilmstrip } from "../api/dollyt";
import { masterThumbsForView } from "../lib/filmstripMaster";
import { previewSrc } from "../lib/previewSrc";
import {
  storyboardFramesForWindow,
  type StoryboardFrame,
  type StoryboardMeta,
} from "../lib/storyboardStrip";
import {
  clampTime,
  formatRulerLabel,
  formatTimeTransport,
  rulerLabelStep,
  rulerMinorStep,
  snapToFrame,
} from "../lib/time";

type DragKind = "in" | "out" | "playhead" | "pan" | null;

function defaultViewSpan(duration: number): number {
  if (duration <= 0) return 30;
  if (duration > 3600) return 120;
  if (duration > 600) return 90;
  if (duration > 120) return 60;
  return Math.max(12, Math.min(duration, 30));
}

type Props = {
  duration: number;
  fps: number;
  start: number;
  end: number;
  playhead: number;
  storyboard?: StoryboardMeta | null;
  thumbs: string[];
  /** Durée couverte par le jeu de vignettes haute résolution (fichier local). */
  thumbSpan?: number;
  /** Chemin fichier local pour FFmpeg (pas l’URL asset). */
  localPreviewUrl?: string | null;
  /** Début du fichier local sur la timeline YouTube (s). */
  previewFileOffset?: number;
  /** Vignettes pleine durée (générées une fois). */
  masterFilmstrip?: string[];
  thumbsLoading?: boolean;
  /** Pas de FFmpeg HD tant que le flux ou un téléchargement preview est actif. */
  hdFilmstripPaused?: boolean;
  clipSelection: boolean;
  playing: boolean;
  onTogglePlay: () => void;
  onRangeChange: (start: number, end: number) => void;
  onPlayheadChange: (t: number) => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
};

export function TimelineEditor({
  duration,
  fps,
  start,
  end,
  playhead,
  storyboard,
  thumbs = [],
  localPreviewUrl,
  previewFileOffset = 0,
  masterFilmstrip = [],
  thumbsLoading = false,
  hdFilmstripPaused = false,
  clipSelection,
  playing,
  onTogglePlay,
  onRangeChange,
  onPlayheadChange,
  onScrubStart,
  onScrubEnd,
}: Props) {
  const safeDuration =
    Number.isFinite(duration) && duration > 0 ? duration : 1;
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragKind>(null);
  const [stripCount, setStripCount] = useState(12);
  const frame = 1 / Math.max(1, fps);
  const [viewSpan, setViewSpan] = useState(() => defaultViewSpan(safeDuration));
  const [viewStart, setViewStart] = useState(0);

  useEffect(() => {
    const span = defaultViewSpan(safeDuration);
    setViewSpan(span);
    if (safeDuration > 120 && clipSelection) {
      const pad = Math.max(4, (end - start) * 0.35);
      setViewStart(clampTime(start - pad, 0, Math.max(0, safeDuration - span)));
    } else {
      setViewStart(0);
    }
  }, [safeDuration]);

  const viewEnd = viewStart + viewSpan;

  const clampViewStart = useCallback(
    (nextStart: number, span = viewSpan) =>
      clampTime(nextStart, 0, Math.max(0, safeDuration - span)),
    [safeDuration, viewSpan],
  );

  useEffect(() => {
    if (playhead > viewEnd - 0.5) {
      setViewStart(clampViewStart(playhead - viewSpan * 0.15));
    } else if (playhead < viewStart + 0.05) {
      setViewStart(clampViewStart(playhead - viewSpan * 0.1));
    }
  }, [clampViewStart, playhead, viewEnd, viewSpan, viewStart]);

  const zoomAround = useCallback(
    (factor: number, anchor: number) => {
      const nextSpan = clampTime(
        factor < 1 ? viewSpan / 1.45 : viewSpan * 1.45,
        5,
        Math.max(5, safeDuration),
      );
      const ratio = viewSpan > 0 ? (anchor - viewStart) / viewSpan : 0.5;
      const nextStart = clampViewStart(anchor - ratio * nextSpan, nextSpan);
      setViewSpan(nextSpan);
      setViewStart(nextStart);
    },
    [clampViewStart, viewSpan, viewStart],
  );

  const xToTime = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || viewSpan <= 0) return viewStart;
      const rect = el.getBoundingClientRect();
      const ratio = clampTime((clientX - rect.left) / rect.width, 0, 1);
      return snapToFrame(viewStart + ratio * viewSpan, fps);
    },
    [fps, viewSpan, viewStart],
  );

  const pct = useCallback(
    (t: number) => (viewSpan > 0 ? ((t - viewStart) / viewSpan) * 100 : 0),
    [viewSpan, viewStart],
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const fit = () => {
      const n = Math.floor(el.clientWidth / 108);
      setStripCount(Math.min(16, Math.max(8, n || 8)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sbFrames =
    storyboard?.templateUrl
      ? storyboardFramesForWindow(storyboard, viewStart, viewSpan, stripCount)
      : [];
  const [hdThumbs, setHdThumbs] = useState<string[]>([]);
  const [hdBusy, setHdBusy] = useState(false);

  const masterHd = useMemo(() => {
    if (masterFilmstrip.length < 2) return [];
    return masterThumbsForView(
      masterFilmstrip,
      safeDuration,
      viewStart,
      viewSpan,
      stripCount,
    ).map((p) => previewSrc(p));
  }, [masterFilmstrip, safeDuration, stripCount, viewSpan, viewStart]);

  useEffect(() => {
    const path = localPreviewUrl?.trim();
    if (masterFilmstrip.length >= 2) return;
    if (hdFilmstripPaused || thumbsLoading) {
      return;
    }
    if (!path || /^https?:\/\//i.test(path)) {
      setHdThumbs([]);
      setHdBusy(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setHdBusy(true);
      const prevHd = hdThumbs;
      void getTimelineFilmstrip({
        videoPath: path,
        viewStart,
        viewSpan,
        previewStart: previewFileOffset,
        frameCount: stripCount,
      })
        .then((paths) => {
          if (cancelled) return;
          const urls = paths
            .filter((p) => p.length > 0)
            .map((p) => previewSrc(p));
          setHdThumbs(urls.length >= 2 ? urls : []);
        })
        .catch(() => {
          if (!cancelled && prevHd.length < 2) setHdThumbs([]);
        })
        .finally(() => {
          if (!cancelled) setHdBusy(false);
        });
    }, 480);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    hdFilmstripPaused,
    localPreviewUrl,
    masterFilmstrip.length,
    previewFileOffset,
    stripCount,
    thumbsLoading,
    viewSpan,
    viewStart,
  ]);

  const stripHd =
    masterHd.length >= 2
      ? masterHd
      : hdThumbs.length >= 2
        ? hdThumbs
        : thumbs.length >= 2
          ? thumbs
          : [];

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const t = xToTime(e.clientX);
      if (!clipSelection) {
        onPlayheadChange(snapToFrame(clampTime(t, 0, duration), fps));
        return;
      }
      if (drag === "in") {
        const next = Math.min(t, end - frame * 2);
        const snapped = clampTime(next, 0, duration);
        onRangeChange(snapped, end);
        onPlayheadChange(snapToFrame(snapped, fps));
      } else if (drag === "out") {
        const next = Math.max(t, start + frame * 2);
        const snapped = clampTime(next, 0, duration);
        onRangeChange(start, snapped);
        onPlayheadChange(snapToFrame(snapped, fps));
      } else if (drag === "playhead" || drag === "pan") {
        onPlayheadChange(snapToFrame(clampTime(t, 0, duration), fps));
      }
    };
    const onUp = () => {
      setDrag(null);
      onScrubEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    clipSelection,
    drag,
    duration,
    end,
    frame,
    fps,
    onPlayheadChange,
    onRangeChange,
    onScrubEnd,
    start,
    xToTime,
  ]);

  const scrubToClientX = (clientX: number, kind: DragKind) => {
    const t = snapToFrame(xToTime(clientX), fps);
    if (!clipSelection) {
      onPlayheadChange(clampTime(t, 0, duration));
      setDrag(kind ?? "playhead");
      return;
    }
    onPlayheadChange(snapToFrame(clampTime(t, 0, duration), fps));
    setDrag(
      kind === "playhead" || (t >= start && t <= end) ? "playhead" : "pan",
    );
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-handle]")) return;
    if ((e.target as HTMLElement).closest("[data-playhead]")) return;
  if ((e.target as HTMLElement).closest("[data-zoom]")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onScrubStart();
    scrubToClientX(e.clientX, "playhead");
  };

  const onPlayheadCapDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onScrubStart();
    scrubToClientX(e.clientX, "playhead");
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const anchor = xToTime(e.clientX);
      zoomAround(e.deltaY < 0 ? 0.7 : 1.4, anchor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [xToTime, zoomAround]);

  const playheadVisible =
    playhead >= viewStart - 0.05 && playhead <= viewEnd + 0.05;

  return (
    <section className="timeline-deck" aria-label="Montage">
      <TimelineTransport
        playing={playing}
        onTogglePlay={onTogglePlay}
        playhead={playhead}
        duration={safeDuration}
      />
      <div className="timeline-scrubber">
        <div
          ref={trackRef}
          className="timeline-track-wrap"
          role="slider"
          aria-valuemin={viewStart}
          aria-valuemax={viewEnd}
          aria-valuenow={playhead}
          aria-label={clipSelection ? "Timeline du clip" : "Timeline"}
          onPointerDown={onTrackPointerDown}
        >
          <Ruler viewStart={viewStart} viewSpan={viewSpan} />
          <div
            className={`timeline-lane${clipSelection ? " timeline-lane--crop" : ""}`}
          >
            <Filmstrip
              hd={stripHd}
              frames={sbFrames}
              tileCount={stripCount}
              loading={
                (thumbsLoading || hdBusy) &&
                stripHd.length < 2 &&
                sbFrames.length < 2
              }
            />
            {clipSelection ? (
              <ClipTrimmer
                pct={pct}
                clipStart={start}
                clipEnd={end}
                drag={drag}
                onInDrag={() => {
                  onScrubStart();
                  setDrag("in");
                }}
                onOutDrag={() => {
                  onScrubStart();
                  setDrag("out");
                }}
              />
            ) : (
              <div aria-hidden className="timeline-lane-active" />
            )}
          </div>
          {playheadVisible ? (
            <div className="timeline-playhead" style={{ left: `${pct(playhead)}%` }}>
              <div
                className="timeline-playhead-cap"
                data-playhead="1"
                role="button"
                tabIndex={0}
                aria-label="Tête de lecture"
                onPointerDown={onPlayheadCapDown}
              />
              <div className="timeline-playhead-line" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StoryboardCell({ frame }: { frame: StoryboardFrame }) {
  return (
    <div className="timeline-thumb timeline-thumb-sb-clip">
      <img
        src={frame.sheetUrl}
        alt=""
        draggable={false}
        className="timeline-thumb-sb-sheet"
        style={{
          width: `${frame.cols * 100}%`,
          height: `${frame.rows * 100}%`,
          left: `${-frame.col * 100}%`,
          top: `${-frame.row * 100}%`,
        }}
      />
    </div>
  );
}

function Filmstrip({
  hd = [],
  frames,
  loading = false,
  tileCount,
}: {
  hd?: string[];
  frames: StoryboardFrame[];
  loading?: boolean;
  tileCount: number;
}) {
  const n = Math.max(tileCount, hd.length, frames.length, 1);
  const hasCells = hd.length > 0 || frames.length > 0;
  return (
    <div
      className={`timeline-strip timeline-strip-master ${loading && !hasCells ? "timeline-strip--loading" : ""}`}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {hd.length > 0 ? (
        hd.slice(0, n).map((src, i) => (
          <img key={i} src={src} alt="" draggable={false} className="timeline-thumb" />
        ))
      ) : frames.length > 0 ? (
        frames.slice(0, n).map((f, i) => (
          <StoryboardCell key={`${f.sheetUrl}-${f.col}-${f.row}-${i}`} frame={f} />
        ))
      ) : (
        <div className="timeline-film-empty" aria-hidden />
      )}
    </div>
  );
}

function ClipTrimmer({
  clipStart,
  clipEnd,
  pct,
  drag,
  onInDrag,
  onOutDrag,
}: {
  clipStart: number;
  clipEnd: number;
  pct: (t: number) => number;
  drag: DragKind;
  onInDrag: () => void;
  onOutDrag: () => void;
}) {
  const left = pct(clipStart);
  const width = Math.max(0.35, pct(clipEnd) - pct(clipStart));
  return (
    <>
      <div className="timeline-lane-dim" style={{ width: `${Math.max(0, left)}%` }} />
      <div
        className="timeline-lane-dim"
        style={{ left: `${Math.min(100, left + width)}%`, right: 0 }}
      />
      <div
        className="timeline-clip"
        style={{ left: `${left}%`, width: `${width}%` }}
        role="group"
        aria-label="Sélection du clip"
      >
        <section className="timeline-clip-window" aria-hidden />
        <button
          type="button"
          data-handle="in"
          className={`timeline-clip-handle timeline-clip-handle--in${drag === "in" ? " timeline-clip-handle--active" : ""}`}
          aria-label="Entrée du clip"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onInDrag();
          }}
        />
        <button
          type="button"
          data-handle="out"
          className={`timeline-clip-handle timeline-clip-handle--out${drag === "out" ? " timeline-clip-handle--active" : ""}`}
          aria-label="Sortie du clip"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onOutDrag();
          }}
        />
      </div>
    </>
  );
}

function TimelineTransport({
  playing,
  onTogglePlay,
  playhead,
  duration,
}: {
  playing: boolean;
  onTogglePlay: () => void;
  playhead: number;
  duration: number;
}) {
  return (
    <h3 className="timeline-toolbar">
      <button
        type="button"
        className="timeline-transport"
        onClick={onTogglePlay}
        aria-label={playing ? "Pause" : "Lecture"}
      >
        {playing ? (
          <span className="timeline-icon-pause" />
        ) : (
          <span className="timeline-icon-play" />
        )}
      </button>
      <span className="timeline-clock mono">
        <span className="timeline-clock-now">{formatTimeTransport(playhead)}</span>
        <span className="timeline-clock-sep">/</span>
        <span className="timeline-clock-total">{formatTimeTransport(duration)}</span>
      </span>
    </h3>
  );
}

type RulerTick = { t: number; kind: "label" | "sec" | "minor" };

function rulerTicks(viewStart: number, viewSpan: number): RulerTick[] {
  if (viewSpan <= 0) return [];
  const minor = rulerMinorStep(viewSpan);
  let labelEvery = rulerLabelStep(viewSpan);
  if (labelEvery % minor > 0.01) {
    labelEvery = Math.ceil(labelEvery / minor) * minor;
  }
  const end = viewStart + viewSpan;
  const t0 = Math.floor(viewStart / minor) * minor;
  const ticks: RulerTick[] = [];
  for (let t = t0; t <= end + minor * 0.01; t += minor) {
    if (t < viewStart - 0.001) continue;
    const atEnd = t > end - 0.001;
    const tt = atEnd ? end : t;
    const mod = ((tt % labelEvery) + labelEvery) % labelEvery;
    const nearLabel =
      mod < 0.05 || labelEvery - mod < 0.05;
    let kind: RulerTick["kind"] = "minor";
    if (nearLabel || tt < 0.001) kind = "label";
    else if (minor >= 1 && Math.abs(tt % 1) < 0.05) kind = "sec";
    else if (minor < 1 && Math.abs(tt % 1) < minor * 0.5) kind = "sec";
    ticks.push({ t: tt, kind });
    if (atEnd) break;
  }
  return ticks;
}

function Ruler({
  viewStart,
  viewSpan,
}: {
  viewStart: number;
  viewSpan: number;
}) {
  const ticks = useMemo(
    () => rulerTicks(viewStart, viewSpan),
    [viewSpan, viewStart],
  );
  const pct = (t: number) => (viewSpan > 0 ? ((t - viewStart) / viewSpan) * 100 : 0);

  return (
    <div className="timeline-ruler" aria-hidden>
      <div className="timeline-ruler-baseline" />
      {ticks.map(({ t, kind }, i) => (
        <span
          key={`${kind}-${i}-${t.toFixed(2)}`}
          className={`timeline-ruler-mark timeline-ruler-mark--${kind}`}
          style={{ left: `${pct(t)}%` }}
        >
          <i className="timeline-ruler-tick" />
          {kind === "label" ? (
            <span className="timeline-ruler-label mono">{formatRulerLabel(t)}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
