import type { ExportJob } from "../store";
import type { BufferedJobEvents } from "./jobEventBuffer.mjs";

export function shouldTrackNewJobAsActive(
  activeJobId: number | null,
  jobs: ExportJob[],
  bufferedEvents?: BufferedJobEvents,
  candidateJobId?: number | null,
): boolean;
