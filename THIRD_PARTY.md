# Third-party runtime tools

Dollyt downloads these Windows tools on first launch. Each archive URL and
SHA-256 digest is pinned in `src-tauri/src/bins.rs`.

- [FFmpeg](https://ffmpeg.org/) — LGPL build from
  [FFmpeg-Builds](https://github.com/FFmpeg-Builds/FFmpeg-Builds), licensed
  under the GNU LGPL. The upstream source and license are available from the
  linked projects.
- [Deno](https://deno.com/) — MIT licensed, downloaded from the
  [official Deno release](https://github.com/denoland/deno/releases).
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — downloaded from its official
  GitHub release and verified before use.

These components remain separate executables and are not part of the Dollyt
source-code license.
