import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelJob,
  listPresets,
  startCutJob,
  getTimelineFilmstripMaster,
  cancelLocalPreview,
  resolvePreviewUrl,
  startLocalPreview,
  type Preset,
} from "../api/dollyt";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ExportPanel } from "../components/ExportPanel";
import { PreviewPlayer } from "../components/PreviewPlayer";
import { TimelineEditor } from "../components/TimelineEditor";
import { useEditorTransport } from "../hooks/useEditorTransport";
import { usePreviewAt } from "../hooks/usePreviewAt";
import {
  playheadInPreview,
  previewWindowStart,
  timelineToLocalTime,
} from "../lib/previewWindow";
import { masterFrameCount } from "../lib/filmstripMaster";
import { storyboardAtTime, type StoryboardMeta } from "../lib/storyboardStrip";
import { clampTime, snapToFrame } from "../lib/time";
import { seekToFrame } from "../lib/videoSeek";
import { useDollytStore } from "../store";

export function EditorView() {
  const video = useDollytStore((s) => s.video);
  const url = useDollytStore((s) => s.url);
  const startSecs = useDollytStore((s) => s.startSecs);
  const endSecs = useDollytStore((s) => s.endSecs);
  const playheadSecs = useDollytStore((s) => s.playheadSecs);
  const status = useDollytStore((s) => s.status);
  const jobPercent = useDollytStore((s) => s.jobPercent);
  const setRangeSecs = useDollytStore((s) => s.setRangeSecs);
  const setPlayhead = useDollytStore((s) => s.setPlayhead);
  const setStatus = useDollytStore((s) => s.setStatus);
  const setJobPercent = useDollytStore((s) => s.setJobPercent);
  const patchVideo = useDollytStore((s) => s.patchVideo);
  const storyboard = useDollytStore((s) => s.storyboard);
  const selectedPresetId = useDollytStore((s) => s.selectedPresetId);
  const setSelectedPresetId = useDollytStore((s) => s.setSelectedPresetId);
  const exportFullVideo = useDollytStore((s) => s.exportFullVideo);
  const setExportFullVideo = useDollytStore((s) => s.setExportFullVideo);
  const goHome = useDollytStore((s) => s.goHome);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadRef = useRef(0);
  playheadRef.current = playheadSecs;
  const [playing, setPlaying] = useState(false);
  const [streamDead, setStreamDead] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const previewReqRef = useRef(-1);
  const previewDebounceRef = useRef(0);
  const previewEpochRef = useRef(0);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const pendingPlayRef = useRef(false);
  const placedPlayback = useRef("");
  const [fetchingPreview, setFetchingPreview] = useState(false);

  const fps = video?.previewFps ?? 30;
  const duration = video?.durationSecs ?? 0;
  const previewStart = video?.previewStartSecs ?? 0;
  const previewFileDur = Math.max(
    0.5,
    video?.previewFileDurationSecs
      ?? (video?.previewLocalUrl ? duration : 60),
  );
  const localUrl = (video?.previewLocalUrl ?? "").trim();
  const streamCandidate =
    video?.previewUrl && /^https?:\/\//i.test(video.previewUrl)
      ? video.previewUrl
      : "";
  const useStream = Boolean(streamCandidate) && !streamDead;
  const useLocal = !useStream && Boolean(localUrl);
  const isStreamPreview = useStream;
  const playbackUrl = useStream
    ? streamCandidate
    : localUrl || (streamDead ? "" : streamCandidate);
  const awaitingLocal = useLocal && fetchingPreview;
  const showPlayer = Boolean(playbackUrl);
  const clipSelection = !exportFullVideo;
  const fullLocal =
    !useStream &&
    Boolean(video?.previewLocalUrl) &&
    previewStart < 1 &&
    previewFileDur >= Math.max(1, duration - 2);
  const [masterStrip, setMasterStrip] = useState<string[]>([]);

  const requestPreviewWindow = useCallback(
    (atSecs: number, urgent = false) => {
      if (fullLocal || useStream) return;
      if (!video || !url || !isTauri()) return;
      const wantStart = previewWindowStart(atSecs, duration);
      if (Math.abs(previewReqRef.current - wantStart) < 0.2) return;
      previewReqRef.current = wantStart;
      const run = () => {
        setFetchingPreview(true);
        void startLocalPreview(url, video.formatId, duration, atSecs, false)
          .catch(() => {
            previewReqRef.current = -1;
          })
      };
      window.clearTimeout(previewDebounceRef.current);
      if (urgent) run();
      else previewDebounceRef.current = window.setTimeout(run, 520);
    },
    [duration, fullLocal, url, useStream, video],
  );

  const previewCtx = useMemo(
    () =>
      useStream
        ? { previewStart: 0, previewFileDur: Math.max(duration, 0.5) }
        : { previewStart, previewFileDur },
    [duration, previewFileDur, previewStart, useStream],
  );
  const onNeedWindow = useCallback(
    (at: number) => {
      if (useStream || fullLocal) return;
      requestPreviewWindow(at);
    },
    [fullLocal, requestPreviewWindow, useStream],
  );
  const previewAt = usePreviewAt(
    videoRef,
    fps,
    duration,
    setPlayhead,
    previewCtx,
    onNeedWindow,
  );

  const beginScrub = useCallback(() => {
    const el = videoRef.current;
    if (el) {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    const snapped = snapToFrame(clampTime(playheadSecs, 0, duration), fps);
    setPlayhead(snapped);
    const localT = useStream
      ? snapped
      : timelineToLocalTime(snapped, previewStart);
    if (
      !fullLocal &&
      !useStream &&
      !playheadInPreview(snapped, previewStart, previewFileDur)
    ) {
      pendingPlayRef.current = true;
      requestPreviewWindow(snapped, true);
      return;
    }
    seekToFrame(el, localT, false);
    void el.play().catch(() => {
      setStreamDead(true);
      if (url && video) {
        pendingPlayRef.current = true;
        void startLocalPreview(url, video.formatId, duration, snapped, false);
      }
    });
  }, [
    duration,
    fps,
    playheadSecs,
    previewFileDur,
    previewStart,
    requestPreviewWindow,
    setPlayhead,
    fullLocal,
    useStream,
  ]);

  useEditorTransport({
    videoRef,
    fps,
    duration,
    start: startSecs,
    end: endSecs,
    playhead: playheadSecs,
    clipSelection,
    onRangeChange: setRangeSecs,
    onPreviewAt: (t) => {
      beginScrub();
      previewAt(t);
    },
    onTogglePlay: togglePlay,
  });

  useEffect(() => {
    listPresets().then(setPresets).catch(() => setPresets([]));
  }, []);

  useEffect(() => {
    setStatus("");
    setJobPercent(0);
  }, [setJobPercent, setStatus]);

  const streamBootRef = useRef("");
  useEffect(() => {
    if (!video || !url || !isTauri()) return;
    const key = `${url}|${video.formatId}`;
    if (streamBootRef.current === key) return;
    streamBootRef.current = key;
    setStatus("");
    let cancelled = false;
    void (async () => {
      if (video.previewLocalUrl && !streamDead) return;
      try {
        const fresh = await resolvePreviewUrl(url, video.formatId);
        if (cancelled) return;
        if (fresh) {
          patchVideo({ previewUrl: fresh });
          setStreamDead(false);
        }
      } catch {
        /* lecture : repli uniquement si le lecteur signale une erreur */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [duration, patchVideo, playheadSecs, streamDead, url, video]);

  useEffect(() => {
    if (
      !fullLocal ||
      !video?.previewLocalUrl ||
      !isTauri() ||
      fetchingPreview ||
      useStream
    ) {
      setMasterStrip([]);
      return;
    }
    const path = video.previewLocalUrl;
    let cancelled = false;
    void getTimelineFilmstripMaster(path, duration, masterFrameCount(duration)).then(
      (frames) => {
        if (!cancelled) setMasterStrip(frames);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [duration, fetchingPreview, fullLocal, useStream, video?.previewLocalUrl]);

  useEffect(() => {
    if (!isTauri()) return;
    const unsubs: Array<() => void> = [];
    listen<{ percent: number }>("preview-progress", (event) => {
      const n = event.payload.percent;
      if (n > 0 && n < 100) setFetchingPreview(true);
      if (n >= 100) setFetchingPreview(false);
    }).then((u) => unsubs.push(u));
    listen<{ percent: number; stage: string }>("job-progress", (event) => {
      setJobPercent(event.payload.percent);
      setStatus(`${event.payload.stage} — ${event.payload.percent} %`);
    }).then((u) => unsubs.push(u));
    listen<{ ok: boolean; message: string }>("job-finished", (event) => {
      setJobPercent(event.payload.ok ? 100 : 0);
      setStatus(event.payload.message);
    }).then((u) => unsubs.push(u));
    listen<{
      previewUrl: string;
      previewFileDurationSecs?: number | null;
      previewStartSecs?: number;
    }>("preview-local-ready", (event) => {
      previewReqRef.current = event.payload.previewStartSecs ?? 0;
      previewEpochRef.current += 1;
      setPreviewEpoch(previewEpochRef.current);
      setFetchingPreview(false);
      patchVideo({
        previewLocalUrl: event.payload.previewUrl,
        previewFileDurationSecs: event.payload.previewFileDurationSecs,
        previewStartSecs: event.payload.previewStartSecs ?? 0,
      });
    }).then((u) => unsubs.push(u));
    listen<{ message?: string }>("preview-local-failed", () => {
      previewReqRef.current = -1;
      setFetchingPreview(false);
    }).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, [patchVideo, setJobPercent, setStatus]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onMeta = () => {
      if (useStream) return;
      const d = el.duration;
      if (Number.isFinite(d) && d > 1) {
        patchVideo({ previewFileDurationSecs: d });
      }
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [patchVideo, playbackUrl, useStream]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !playbackUrl) return;
    const placeKey = `${playbackUrl}|${previewStart}|${previewEpoch}`;
    if (placedPlayback.current === placeKey) return;
    const place = () => {
      placedPlayback.current = placeKey;
      const p0 = useStream ? 0 : (video?.previewStartSecs ?? 0);
      const local = timelineToLocalTime(playheadSecs, p0);
      seekToFrame(el, local, false);
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        void el.play();
      }
    };
    if (el.readyState >= 2) place();
    else el.addEventListener("loadeddata", place, { once: true });
  }, [duration, fps, playheadSecs, playbackUrl, previewEpoch, previewStart, useStream, video?.previewStartSecs]);

  const storyboardMeta: StoryboardMeta | null = storyboard?.templateUrl
    ? {
        templateUrl: storyboard.templateUrl,
        intervalSecs: storyboard.intervalSecs,
        columns: storyboard.columns,
        rows: storyboard.rows,
        tileWidth: storyboard.width,
        tileHeight: storyboard.height,
      }
    : null;
  const previewPoster = useMemo(() => {
    if (!storyboardMeta || !awaitingLocal) return null;
    return storyboardAtTime(storyboardMeta, playheadSecs)?.sheetUrl ?? null;
  }, [awaitingLocal, playheadSecs, storyboardMeta]);

  if (!video) return null;

  function endScrub() {
    previewAt(playheadSecs, true);
  }

  const onPlayheadMove = useCallback(
    (t: number) => {
      const snapped = snapToFrame(clampTime(t, 0, duration), fps);
      setPlayhead(snapped);
      previewAt(snapped);
    },
    [duration, fps, previewAt, setPlayhead],
  );

  async function onExport() {
    if (!video) return;
    setJobPercent(0);
    setStatus("Préparation…");
    const start = exportFullVideo ? 0 : snapToFrame(startSecs, fps);
    const end = exportFullVideo
      ? snapToFrame(duration, fps)
      : snapToFrame(endSecs, fps);
    try {
      await startCutJob({
        rawUrl: url,
        formatId: video.exportFormatId,
        startSecs: start,
        endSecs: end,
        presetId: selectedPresetId,
      });
    } catch (err) {
      setStatus(String(err));
    }
  }

  async function onCancel() {
    await cancelJob();
    setStatus("Annulation…");
    setJobPercent(0);
  }

  const formatLabel = `${video.formatId} · ${fps} i/s · ${duration.toFixed(1)} s`;

  return (
    <section className="page editor-page">
      <header className="editor-topbar">
        <h1 className="page-title editor-title">{video.title}</h1>
        <button type="button" onClick={goHome} className="btn btn-ghost btn-sm shrink-0">
          Nouveau lien
        </button>
      </header>
      <div className="editor-body">
        <div className="editor-stack">
          <div className="editor-stage">
            {showPlayer ? (
              <PreviewPlayer
                videoRef={videoRef}
                previewUrl={playbackUrl || streamCandidate}
                streamFallback={isStreamPreview}
                awaitingLocal={awaitingLocal}
                fetchingHint={
                  fetchingPreview && useLocal ? "Chargement de la zone…" : ""
                }
                mediaEpoch={previewEpoch}
                posterUrl={previewPoster}
                onCanPlay={() => {
                  if (!useStream) return;
                  void cancelLocalPreview();
                  setFetchingPreview(false);
                }}
                onStreamError={() => {
                  setStreamDead(true);
                  if (!url || !video) return;
                  void cancelLocalPreview();
                  setFetchingPreview(true);
                  void resolvePreviewUrl(url, video.formatId)
                    .then((fresh) => {
                      if (fresh) {
                        patchVideo({ previewUrl: fresh });
                        setStreamDead(false);
                        setFetchingPreview(false);
                        return;
                      }
                      void startLocalPreview(
                        url,
                        video.formatId,
                        video.durationSecs,
                        playheadSecs,
                        false,
                      );
                    })
                    .catch(() => {
                      void startLocalPreview(
                        url,
                        video.formatId,
                        video.durationSecs,
                        playheadSecs,
                        false,
                      );
                    });
                }}
                onTimeUpdate={() => {
                  const el = videoRef.current;
                  if (!el || el.paused || el.seeking) return;
                  const t = el.currentTime;
                  const p0 = useStream ? 0 : previewStart;
                  setPlayhead(
                    snapToFrame(clampTime(p0 + t, 0, duration), fps),
                  );
                }}
              />
            ) : (
              <div className="preview-frame panel flex flex-1 items-center justify-center">
                <p className="meta">
                  {fetchingPreview
                    ? "Préparation du flux…"
                    : "Flux indisponible — retente dans un instant ou nouveau lien."}
                </p>
              </div>
            )}
          </div>
          <TimelineEditor
            duration={duration}
            fps={fps}
            start={startSecs}
            end={endSecs}
            playhead={playheadSecs}
            storyboard={storyboardMeta}
            thumbs={[]}
            localPreviewUrl={video.previewLocalUrl}
            previewFileOffset={previewStart}
            thumbsLoading={fetchingPreview}
            hdFilmstripPaused={useStream || (useLocal && fetchingPreview)}
            clipSelection={clipSelection}
            playing={playing}
            onTogglePlay={togglePlay}
            onRangeChange={setRangeSecs}
            masterFilmstrip={masterStrip}
            onPlayheadChange={onPlayheadMove}
            onScrubStart={beginScrub}
            onScrubEnd={endScrub}
          />
        </div>
        <aside className="editor-aside">
          <ExportPanel
            formatLabel={formatLabel}
            presets={presets}
            selectedPresetId={selectedPresetId}
            onPresetChange={setSelectedPresetId}
            exportFullVideo={exportFullVideo}
            onExportFullVideoChange={setExportFullVideo}
            onExport={onExport}
            onCancel={onCancel}
            jobPercent={jobPercent}
            status={status}
          />
        </aside>
      </div>
    </section>
  );
}
