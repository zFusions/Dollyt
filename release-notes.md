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

### Improved

- Bounds yt-dlp network socket waits and retry counts so stalled requests can fail with a recoverable error.
- Shows a clear connection and format-analysis stage when YouTube has not provided a measurable download percentage yet.
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
