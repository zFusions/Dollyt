export type BufferedJobProgress = {
  stage: string;
  percent: number;
};

export type BufferedJobFinished = {
  ok: boolean;
  message: string;
  outputPath?: string;
  previewPath?: string;
};

export type BufferedJobEvents = {
  progress?: BufferedJobProgress;
  finished?: BufferedJobFinished;
};

export function bufferJobProgress(jobId: number, progress: BufferedJobProgress): void;
export function bufferJobFinished(jobId: number, finished: BufferedJobFinished): void;
export function takeBufferedJobEvents(jobId: number): BufferedJobEvents | undefined;
