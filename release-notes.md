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
