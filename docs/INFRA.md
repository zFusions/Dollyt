# Infra Dollyt (hors interface)

État après la 1.0.x publique : moteur YouTube → clip, preview locale, presets, export FFmpeg, mises à jour auto. L'éditeur timeline existe mais est **quarantiné** (`src/editorAvailability.ts` → `EDITOR_QUARANTINED = true`).

## Rust (`src-tauri/src/`)

| Module | Rôle |
|--------|------|
| `bins` | `%LOCALAPPDATA%\Dollyt\bin` — yt-dlp (release GitHub épinglée + SHA-256), FFmpeg/ffprobe/Deno (ZIP officiels vérifiés), détection auto-update yt-dlp |
| `commands` | Surface Tauri : `load_video`, `resolve_preview_url`, `start/cancel_local_preview`, `get_timeline_filmstrip(_master)`, `release_preview_cache`, settings, presets, `update_ytdlp`, `pick_export_directory`, `start_cut_job_command`, `reveal_file` |
| `format` | Choix des formats yt-dlp : preview muxée (itag 18) + formats HQ pour export |
| `ffmpeg` | Coupe exacte de plage, export selon preset (x264 CRF / copie de flux, audio AAC) |
| `jobs` | Un job à la fois : load → download section → probe → encode → `job-progress` / `job-finished` events |
| `presets` | 8 JSON embarqués (`src-tauri/presets/`) + presets utilisateur `%LOCALAPPDATA%\Dollyt\presets` |
| `settings` | `settings.json` : dossier export, gabarit `{titre}_{debut}-{fin}`, matériel NVENC, dev CRF/fps/audio/x264, langue, auto-update app/yt-dlp, version ignorée |
| `storyboard` | Extraction sb0–sb3 depuis les métadonnées yt-dlp (timeline, quarantain) |
| `ytdlp` | Wrapper yt-dlp via Deno : `-J` metadata, section download, détection cookies Firefox/fichier, mapping erreurs |
| `error` | Messages d'erreur normalisés (`yt-dlp a échoué`, `ffmpeg a échoué`, …) — traduits côté front via `backendText()` |
| `log` | Rotation ~2 Mo → `.1.log`, URLs masquées |

## Commandes Tauri (surface IPC réelle)

`load_video`, `resolve_preview_url`, `start_local_preview`, `cancel_local_preview`, `get_timeline_filmstrip`, `get_timeline_filmstrip_master`, `release_preview_cache`, `get_settings`, `save_settings_cmd`, `list_presets`, `update_ytdlp`, `pick_export_directory`, `start_cut_job_command`, `cancel_job`, `reveal_file`.

## Événements

`job-progress` `{job_id, stage, percent}` — stages : `validation`, `download`, `encode`, `done`. `job-finished` `{job_id, ok, message, outputPath?, previewPath?}`.

## Front (`src/`)

- `api/dollyt.ts` : `invoke` Tauri + mock `npm run dev`.
- `i18n.ts` : FR/EN, `t()` partout, `backendText()` traduit les messages d'erreur Rust à l'affichage.
- `lib/presetsUi.ts` : noms/briefs/specs localisés, évalués au rendu (le changement de langue est immédiat).
- Vues : `HomeView` (URL + preset + clip/full), `DownloadView` (Snake loader + progression lissée ~2 %/tick), `PresetsView`, `SettingsView`, `QueueView` (historique), `EditorView`/`EditorOpeningView` (quarantinés).
- `SnakeGame` : mini-jeu canvas dans les loaders (pommes, wrap-around, clavier non intrusif).
- `useAppUpdater` + `UpdateDialog` : check GitHub releases, `latest.json` signé minisign, ignorer/version, notes de release formatées.

## Distribution

- CI `ci.yml` : build front + `cargo test --locked` + clippy.
- Release `release.yml` : tag `vX.Y.Z` → build Windows x64 NSIS + `latest.json` (signature updater Tauri, clé dans `tauri.conf.json`).
- Auto-update : `@tauri-apps/plugin-updater` + `plugin-process` (relaunch). Settings : auto-update app, auto-update yt-dlp, « Vérifier maintenant », version ignorée.

## Volontairement reporté / hors scope

- Éditeur timeline complet (storyboards, filmstrip, TimelineEditor) : code présent, inaccessible.
- Presets utilisateur CRUD (lecture seule pour l'instant).
- macOS/Linux, cloud, comptes, télémétrie.
