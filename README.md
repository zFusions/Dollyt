# Dollyt

> Desktop YouTube clip exporter for Windows.

Dollyt turns a YouTube URL into a local video clip or a full export. It provides
local preview, timeline selection, reusable export presets, FFmpeg encoding,
history and a French/English interface.

<!-- Future hero image: docs/assets/dollyt-hero.png -->

## Features

- YouTube metadata and local preview.
- Precise start/end selection.
- Presets for TikTok, Reels, Shorts, YouTube and X.
- FFmpeg export with optional hardware encoding.
- Persistent local settings and export history.
- Reveal an exported file in Windows Explorer.
- Offline Dino loading screen and reduced-motion support.
- No Dollyt telemetry or cloud upload.

## Screenshots

Screenshots are intentionally left as placeholders until the public UI capture
set is prepared.

- `docs/assets/dollyt-home.png`
- `docs/assets/dollyt-editor.png`
- `docs/assets/dollyt-settings.png`

## Technology

- Tauri 2
- Rust 2024
- React 19 and TypeScript
- Vite 8
- FFmpeg, ffprobe, Deno and yt-dlp

## Requirements

- Windows 10 version 1809 or later, or Windows 11 (x64).
- WebView2 Runtime.
- Rust stable and the Tauri prerequisites for source builds.
- Node.js and npm.
- FFmpeg, ffprobe and Deno available on `PATH` for the first setup.

yt-dlp is downloaded from an official pinned GitHub release and verified with
SHA-256 before use. FFmpeg, ffprobe and Deno are currently bootstrapped from
the system `PATH`; production packaging should provide verified, pinned copies.

## Installation

Download the Windows installer from the project's releases page when one is
published. The initial V1 installers are not code-signed yet; Windows
SmartScreen may display a warning until a signing certificate is configured.
User settings and history are stored outside the install
directory in `%LOCALAPPDATA%\Dollyt`.

## Build from source

```powershell
npm install
npm run typecheck
npm run build
npm run tauri dev
```

For a release build:

```powershell
npm run tauri build
```

The generated executable and installer are written below
`src-tauri\target\release\`.

## Usage

1. Paste a YouTube URL.
2. Choose a preset and select a range.
3. Export the clip.
4. Open the result from the completion screen or the History page.

Dollyt supports French and English. The first launch follows the system
language when it is supported; a manual choice is persisted locally.

## Architecture

The React frontend owns navigation, transient editor state and the local
history view. Tauri commands provide a narrow boundary to the Rust backend.
Rust validates YouTube URLs, invokes yt-dlp, performs FFmpeg processing and
emits progress events. Settings and presets live in
`%LOCALAPPDATA%\Dollyt`; temporary previews and filmstrips live in the user
temporary directory.

See [docs/INFRA.md](docs/INFRA.md) for the current data-flow map.

## Development

```powershell
npm run typecheck
npm run build
npm run test:e2e
cargo test --manifest-path src-tauri\Cargo.toml --locked
cargo clippy --manifest-path src-tauri\Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri\Cargo.toml -- --check
```

## Privacy and legal notice

Dollyt does not provide a Dollyt server, telemetry or account system. Network
traffic is made to YouTube/googlevideo for media work and GitHub for the
pinned yt-dlp release. Use the software only with content you are allowed to
download and process. Dollyt is not affiliated with YouTube and does not
bypass DRM.

## Contributing

Keep changes focused, add a regression test for behavior changes, and run the
validation commands above before opening a pull request. Do not commit
credentials, cookies, local paths or generated build artifacts.

## License

MIT. See [LICENSE](LICENSE).
