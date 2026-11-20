## Dollyt 1.2.6

### Fixed

- Treats a growing partial MKV on disk as active download progress so section exports on long YouTube videos are not killed during silent FFmpeg mux phases.
- Scales the section stall watchdog with clip length (about 4× the section span, between 5 and 15 minutes).

### Improved

- Uses one yt-dlp fragment thread for section downloads to reduce hung parallel DASH merges on Windows.
- Raises fragment retries for section downloads.
- Reuses cached metadata when the video was loaded moments ago instead of forcing a second full `-J` before every export.

Windows x64 installer. Runtime tool licenses and sources are documented in [THIRD_PARTY.md](THIRD_PARTY.md).

## Dollyt 1.2.5

### Fixed

- Disables `--load-info-json` when using `--download-sections` so DASH clip exports no longer stall with expired fragment URLs (regression in 1.2.4).
- Extends the yt-dlp stall watchdog to 300 seconds for section downloads instead of cutting at 120 seconds during long silent mux phases.
- Maps queue job failures to `annulé` when the user cancelled even if the child process slot was already empty.
- Clears the tracked export job when starting a new download so the previous job progress and file are not shown on the download screen.
- Ignores late `job-progress` events for jobs that already finished, cancelled, or errored.
- Resets stale `activeJobId` when returning home after a completed export.

### Improved

- Unit test ensures section downloads never combine `--load-info-json` with `--download-sections`.

Windows x64 installer. Runtime tool licenses and sources are documented in [THIRD_PARTY.md](THIRD_PARTY.md).

## Dollyt 1.2.4

### Fixed

- Writes application logs in local Windows time instead of UTC.
- Fetches fresh metadata once per export and passes it to yt-dlp with `--load-info-json` so the download step avoids a second full YouTube page extraction on the first attempt. HTTP 403 retries still use a full re-extraction.
- Shows the waiting stage only after the download phase has started and only after 45 seconds without output, instead of after 5 seconds during analysis.
- Parses FFmpeg section progress from partial carriage-return output so percentages can move during quiet mux phases.
- Returns the download screen to idle after a cancelled export instead of leaving a blocking error state.
- Clears the yt-dlp child process slot after each queue job finishes.
- Prefers exact audio format IDs `251` and `140` before variant IDs such as `251-18`.

### Improved

- Emits a diagnostic heartbeat every 30 seconds when yt-dlp is active but produces no new lines during a section download.
- Records the actual yt-dlp format selector in export start logs.

Windows x64 installer. Runtime tool licenses and sources are documented in [THIRD_PARTY.md](THIRD_PARTY.md).

## Dollyt 1.2.3

### Fixed

- Installs yt-dlp, FFmpeg, ffprobe and Deno during Windows setup so a new installation does not download the video tools on its first app launch.
- Selects an available software H.264 encoder and applies valid OpenH264 bitrate units while respecting preset bitrate limits.
- Reuses recent video metadata instead of requesting it twice for one export.
- Keeps queue progress associated with the active export and closes a cancellation race between queue handoff and process start.
- Downloads only the requested time range when a clip covers less than most of the source video, avoiding full-length downloads for short excerpts.
- Reports download progress from FFmpeg time estimates when yt-dlp uses section mode, so clip exports show a real percentage instead of staying indeterminate.
- Parses FFmpeg time estimates from stderr lines where the time field appears in the middle of the line, not just at the start.
- Filters progress events by job ID in the editor view and resets the progress display when a different job becomes active, preventing another export's percentage from being shown.
- Logs yt-dlp extraction messages that were previously discarded, so format analysis and download preparation are visible in the diagnostics.
- Stops a download after two minutes without any data from yt-dlp instead of waiting indefinitely, and reports a recoverable connection error.
- Aligns odd source dimensions before local quality exports so libx264 no longer fails on width or height that is not divisible by two.
- Ignores negative FFmpeg time stamps so export progress does not jump backward during section downloads.
- Points yt-dlp section downloads at the bundled FFmpeg instead of whatever happens to be on the system PATH.
- Removes partial output files when FFmpeg fails and skips audio encoding when the source has no audio track.
- Rejects audio-only exports when the video has no audio, with a translated message instead of a raw FFmpeg error.
- Keeps queue and download progress from decreasing when stages change or multiple jobs are listed.
- Shows when YouTube stops sending data and when an HTTP 403 triggers a single retry.
- Redacts cookie file paths in diagnostic logs and serializes log file writes to avoid interleaved lines.

### Improved

- Bounds yt-dlp network socket waits and retry counts so stalled requests can fail with a recoverable error.
- Shows a clear connection and format-analysis stage when YouTube has not provided a measurable download percentage yet.
- Adds faststart to re-encoded MP4 exports for quicker in-app preview.
- Scales vertical network presets to their configured resolution instead of a fixed 1080x1920 filter chain.
- Updates QUALITY MAX and FLAC preset copy so it matches actual stream selection and YouTube audio limits.
- Runs the full Node, npm, Rust, E2E and runtime-tool verification set before a tagged release build.

Windows x64 installer. Runtime tool licenses and sources are documented in [THIRD_PARTY.md](THIRD_PARTY.md).

## Dollyt 1.2.2

### Fixed

- Restores H.264 MP4 exports by installing an FFmpeg build that includes `libx264`. Existing installations are checked once and only incompatible FFmpeg binaries are replaced. Migrating an incompatible install downloads a 185 MiB FFmpeg archive once.
- Clip downloads use yt-dlp's native progress reporting before the requested section is cut locally. This reports a real percentage but can download more of the source video, especially for long videos.
- Installing an app update reuses the update already found, avoiding a second network check. The dialog reports update download progress when the server provides a content length.

### Improved

- Hardware encoders remain opt-in and are probed before use. Software encoding remains available on supported Windows x64 PCs without an NVIDIA or AMD dedicated graphics card.
- Documents the separately licensed FFmpeg GPL runtime and its source build references.

Windows x64 installer. See [README.md](https://github.com/zFusions/Dollyt/blob/master/README.md) for usage and privacy details.

## Dollyt 1.2.1

### Improved

- Download progress no longer displays estimated percentages when yt-dlp cannot report real progress.
- A Google Video HTTP 403 during a clip download triggers one fresh metadata extraction and retry. Persistent failures show a clearer message and keep signed media URLs out of diagnostics.
- An in-app diagnostic console provides live application logs and a control to copy them for support.
- Local tool setup records its stages and failures in the diagnostic log.

### Fixed

- Prevents yt-dlp download processes from blocking on unread standard output.
- Collects yt-dlp and FFmpeg diagnostics before resolving export errors.
- Updates the Rust `zip` dependency to resolve reported vulnerabilities.

Windows x64 installer. See [README.md](https://github.com/zFusions/Dollyt/blob/master/README.md) for usage and privacy details.

## Dollyt 1.2.0

### Added

- Tool setup runs outside the synchronous Tauri startup path. The app can open while local tools are prepared and enables export when setup completes.
- Local install markers let later launches reuse verified tools without repeating archive hashes or yt-dlp version probes.
- yt-dlp can be updated from the latest official GitHub release. The downloaded executable is checked against its reported release version before it replaces the installed binary.

### Improved

- Export progress events that arrive before the interface registers a job are buffered and replayed.
- Full video downloads report yt-dlp progress. Progress remains associated with its own export.
- Hardware encoding checks the available encoder and falls back to software encoding when it cannot be used.
- The content security policy restricts scripts to the application source and limits local asset access to the temporary cache.

### Fixed

- The export worker recovers from internal errors so the queue can continue processing jobs.
- Cancelling an export updates its state immediately and marks the job as cancelled.
- Temporary download files are cleaned up after failure or cancellation.
- User presets receive stricter encoding validation and resolve correctly for export jobs.
- Export filenames avoid reserved Windows names and stay inside the selected output folder.

Windows x64 installer. See [README.md](https://github.com/zFusions/Dollyt/blob/master/README.md) for usage and privacy details.

## Dollyt 1.1.1

### Fixed

- **Export queue could freeze permanently**: a rare internal error could stop the processing worker and leave exports stuck with cancel unresponsive. The queue now recovers automatically.
- **Cancel appeared to do nothing**: cancelling the active export now updates the interface immediately, and aborted jobs are correctly marked as cancelled instead of failed.
- **Progress bar stalled during full video downloads**: full video exports now report real download progress instead of a synthetic estimate that stopped near two thirds.
- **Download screen reused another export's percent**: launching a new export while one was running no longer displays the previous job's progress.
- **Clip time fields kept old values**: the new link actions now reset the time range and the full video option.
- **Temporary files cleanup**: downloaded sections are removed after each export, including on failure and cancellation.
- **Preset validation**: user presets with unsupported codec or container values are rejected before reaching the encoder.

### Improved

- **Hardware detection**: NVIDIA encoding capability is now verified with a real encoding test and falls back to CPU when the driver fails.
- **History detail**: export history shows the selected time range for each clip.
- **Default clip length** is now 5 seconds.

Windows x64 installer. See [README.md](https://github.com/zFusions/Dollyt/blob/master/README.md) for usage and privacy details.
