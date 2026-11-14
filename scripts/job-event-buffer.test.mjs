import test from "node:test";
import assert from "node:assert/strict";
import {
  bufferJobFinished,
  bufferJobProgress,
  takeBufferedJobEvents,
} from "../src/lib/jobEventBuffer.mjs";

test("replays progress and completion received before a job is registered", () => {
  bufferJobProgress(42, { stage: "encode", percent: 91 });
  bufferJobFinished(42, {
    ok: true,
    message: "Extrait exporté.",
    outputPath: "C:/Videos/clip.mp4",
    previewPath: "C:/Temp/clip.mp4",
  });

  assert.deepEqual(takeBufferedJobEvents(42), {
    progress: { stage: "encode", percent: 91 },
    finished: {
      ok: true,
      message: "Extrait exporté.",
      outputPath: "C:/Videos/clip.mp4",
      previewPath: "C:/Temp/clip.mp4",
    },
  });
  assert.equal(takeBufferedJobEvents(42), undefined);
});

test("keeps only the latest progress for a not-yet-registered job", () => {
  bufferJobProgress(43, { stage: "download", percent: 12 });
  bufferJobProgress(43, { stage: "encode", percent: 70 });

  assert.deepEqual(takeBufferedJobEvents(43), {
    progress: { stage: "encode", percent: 70 },
  });
});
