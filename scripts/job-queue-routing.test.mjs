import test from "node:test";
import assert from "node:assert/strict";
import { shouldTrackNewJobAsActive } from "../src/lib/jobQueueRouting.mjs";

test("a new job stays queued while another job is running", () => {
  assert.equal(
    shouldTrackNewJobAsActive(1, [{ id: 1, state: "running" }]),
    false,
  );
});

test("the first job is tracked as active when the queue is idle", () => {
  assert.equal(shouldTrackNewJobAsActive(null, []), true);
});

test("buffered progress adopts a job that started before the UI registered it", () => {
  assert.equal(
    shouldTrackNewJobAsActive(1, [{ id: 1, state: "running" }], {
      progress: { stage: "download", percent: 20 },
    }, 2),
    true,
  );
});

test("buffered completion adopts a job that finished before the UI registered it", () => {
  assert.equal(
    shouldTrackNewJobAsActive(1, [{ id: 1, state: "running" }], {
      finished: { ok: false, message: "error" },
    }, 2),
    true,
  );
});

test("an event handler can register the candidate job before the caller resumes", () => {
  assert.equal(
    shouldTrackNewJobAsActive(2, [{ id: 1, state: "running" }], undefined, 2),
    true,
  );
});
