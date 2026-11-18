# Infra Dollyt (hors interface)

État au 2026-11-18 : release publique v1.2.2; FFmpeg inclut `libx264`, les téléchargements d'extraits utilisent la progression yt-dlp et l'updater réutilise la version déjà vérifiée. L'éditeur timeline existe mais est **quarantiné** (`src/editorAvailability.ts` → `EDITOR_QUARANTINED = true`).

## Rust (`src-tauri/src/`)

| Module | Rôle |
|--------|------|
| `bins` | `%LOCALAPPDATA%\Dollyt\bin` — téléchargements initiaux épinglés et vérifiés par SHA-256; un marqueur de build FFmpeg déclenche une migration unique vers un binaire avec `libx264` si l'existant en est dépourvu; yt-dlp garde un marqueur de version validée |
| `commands` | Surface Tauri : `initialize_tools`, `load_video`, `resolve_preview_url`, `start/cancel_local_preview`, `get_timeline_filmstrip(_master)`, `release_preview_cache`, settings, presets, `update_ytdlp`, `pick_export_directory`, `start_cut_job_command`, `reveal_file` |
| `format` | Choix des formats yt-dlp : preview muxée (itag 18) + formats HQ pour export |
| `ffmpeg` | Coupe exacte de plage, export selon preset (x264 CRF / copie de flux, audio AAC) |
| `jobs` | Un job à la fois : load → téléchargement yt-dlp avec progression réelle → découpe/encode local → `job-progress` / `job-finished` events; les presets intégrés et utilisateur sont résolus côté worker |
| `presets` | 10 JSON embarqués (`src-tauri/presets/`) + presets JSON utilisateur `%LOCALAPPDATA%\Dollyt\presets`; les IDs intégrés ont priorité sur les collisions |
| `settings` | `settings.json` : dossier export, gabarit global (le gabarit par défaut du preset reste actif), matériel NVENC/AMF, dev CRF/fps/audio/x264, langue, auto-update app/yt-dlp, version ignorée |
| `storyboard` | Extraction sb0–sb3 depuis les métadonnées yt-dlp (timeline, quarantain) |
| `ytdlp` | Wrapper yt-dlp via Deno : `-J` metadata, téléchargement natif pour publier une progression réelle, détection cookies Firefox/fichier et mapping erreurs |
| `error` | Messages d'erreur normalisés (`yt-dlp a échoué`, `ffmpeg a échoué`, …) — traduits côté front via `backendText()` |
| `log` | Rotation ~2 Mo → `.1.log`, URLs masquées |

## Commandes Tauri (surface IPC réelle)

`initialize_tools`, `load_video`, `resolve_preview_url`, `start_local_preview`, `cancel_local_preview`, `get_timeline_filmstrip`, `get_timeline_filmstrip_master`, `release_preview_cache`, `get_settings`, `save_settings_cmd`, `list_presets`, `update_ytdlp`, `pick_export_directory`, `start_cut_job_command`, `cancel_job`, `reveal_file`.

## Événements

`job-progress` `{job_id, stage, percent}` — stages : `validation`, `download`, `encode`, `done`. `job-finished` `{job_id, ok, message, outputPath?, previewPath?}`.

## Front (`src/`)

- `api/dollyt.ts` : `invoke` Tauri + mock `npm run dev`.
- `i18n.ts` : FR/EN, `t()` partout, `backendText()` traduit les messages d'erreur Rust à l'affichage.
- `lib/presetsUi.ts` : noms/briefs/specs localisés, évalués au rendu (le changement de langue est immédiat).
- Vues : `HomeView` (URL + preset + clip/full), `DownloadView` (Snake loader + progression lissée ~2 %/tick + preview du résultat), `PresetsView`, `SettingsView`, `QueueView` (file et historique), `EditorView`/`EditorOpeningView` (quarantinés).
- L'interface s'ouvre immédiatement pendant l'initialisation des outils; l'export reste désactivé jusqu'à leur disponibilité. Une page de retry apparaît seulement si la préparation échoue. Les téléchargements initiaux vérifient les hashes; les marqueurs évitent les checks coûteux aux lancements suivants. L'auto-update yt-dlp tourne en arrière-plan si l'option est activée.
- `SnakeGame` : mini-jeu canvas dans les loaders (pommes, wrap-around, clavier non intrusif).
- `useAppUpdater` + `UpdateDialog` : check GitHub releases, `latest.json` signé minisign, ignorer/version, notes de release formatées.

## Distribution

- CI `ci.yml` : npm audit, build front, `cargo test --locked`, clippy, fmt, E2E Playwright mock, RustSec audit.
- Release `release.yml` : tag `vX.Y.Z` → build Windows x64 NSIS + `latest.json` (signature updater Tauri, clé dans `tauri.conf.json`).
- Auto-update : `@tauri-apps/plugin-updater` + `plugin-process` (relaunch). Settings : auto-update app, auto-update yt-dlp, « Vérifier maintenant », version ignorée.

## Volontairement reporté / hors scope

- Éditeur timeline complet (storyboards, filmstrip, TimelineEditor) : code présent, inaccessible.
- Presets utilisateur CRUD (lecture seule pour l'instant).
- macOS/Linux, cloud, comptes, télémétrie.
