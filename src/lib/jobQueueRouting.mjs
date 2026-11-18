export function shouldTrackNewJobAsActive(
  activeJobId,
  jobs,
  bufferedEvents,
  candidateJobId = null,
) {
  if (candidateJobId !== null && activeJobId === candidateJobId) return true;
  const backendStartedJob = Boolean(bufferedEvents?.progress || bufferedEvents?.finished);
  const noTrackedRunningJob =
    activeJobId === null && !jobs.some((job) => job.state === "running");

  return noTrackedRunningJob || backendStartedJob;
}
