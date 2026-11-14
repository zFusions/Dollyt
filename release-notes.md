## Dollyt 1.1.0

### New

- **Export queue**: a dedicated page shows running, queued, and finished exports with stage and percentage. One job at a time; others wait their turn.
- **Audio export**: two new presets, MP3 and FLAC (lossy / lossless), with a built-in audio player to preview the result.
- **Hardware encoding**: settings option to use the GPU (NVIDIA / AMD) instead of the CPU, with a **Quality** or **Speed** mode and a clear explanation of both.
- **Copy button on errors**: long yt-dlp error messages can now be copied directly.
- **Smoother progress**: the bar advances throughout the download instead of jumping from 5% to 70%.
- **YouTube thumbnails** in video export history.
- **Snake high score** now persists between sessions.

### Fixed

- **Wrong clip duration**: a calculation error could produce a clip much shorter than the selected range. Cuts now match the chosen range exactly.
- **Video exports failing** on some formats (VP9/1440p): downloads now prefer a reliable codec.
- **GPU encoding never used on AMD**: GPU detection fixed, exports are significantly faster.
- **Silent export failures**: errors now remain visible in the queue with full details.
- **Progress resetting to 0%** when leaving the screen mid-export.
- **Dropdown animation** on selectors is now more visible.

Windows x64 installer. See [README.md](https://github.com/zFusions/Dollyt/blob/master/README.md) for usage and privacy details.
