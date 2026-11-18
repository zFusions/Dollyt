# Third-party runtime tools

Dollyt's Windows setup bundles these tools from pinned official releases. The
build verifies each downloaded archive against its SHA-256 digest before the
executables are included. `src-tauri/src/bins.rs` contains the runtime recovery
pins.

- [FFmpeg 8.1.3](https://ffmpeg.org/) — static GPL build from
  [FFmpeg-Builds release `autobuild-2026-11-12-15-40`](https://github.com/FFmpeg-Builds/FFmpeg-Builds/releases/tag/autobuild-2026-11-12-15-40).
  The GPL variant includes `libx264` and `libopenh264`; software encoding can
  fall back to either encoder when one is unavailable.
  The FFmpeg source is available from the
  [FFmpeg 8.1.3 source release](https://github.com/FFmpeg/FFmpeg/tree/n8.1.3)
  and the [FFmpeg-Builds build scripts](https://github.com/FFmpeg-Builds/FFmpeg-Builds/tree/c9fe511).
  FFmpeg-Builds documents the GPL and LGPL variant contents in its
  [package list](https://github.com/FFmpeg-Builds/FFmpeg-Builds#package-list).
  [GNU GPL v3 license text](https://www.gnu.org/licenses/gpl-3.0.html).
- [Deno](https://deno.com/) — MIT licensed, downloaded from the
  [official Deno release](https://github.com/denoland/deno/releases).
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — downloaded from its official
  GitHub release and verified before use.

FFmpeg, Deno and yt-dlp remain separate executables. Their licenses do not
change the MIT license of Dollyt's source code. FFmpeg's GPL terms apply to the
FFmpeg executable and its redistribution; consult the linked FFmpeg and build
sources for the applicable notices and license text.
