const MAX_PENDING_JOBS = 64;
const pending = new Map();

function update(jobId, patch) {
  if (!Number.isSafeInteger(jobId) || jobId < 0) return;

  const current = pending.get(jobId) ?? {};
  pending.set(jobId, { ...current, ...patch });

  while (pending.size > MAX_PENDING_JOBS) {
    pending.delete(pending.keys().next().value);
  }
}

export function bufferJobProgress(jobId, progress) {
  update(jobId, { progress });
}

export function bufferJobFinished(jobId, finished) {
  update(jobId, { finished });
}

export function takeBufferedJobEvents(jobId) {
  const events = pending.get(jobId);
  pending.delete(jobId);
  return events;
}
