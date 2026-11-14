# Infra Dollyt (hors interface)

État au 2026-11-14 : release publique v1.1.1; le flux actif va d'un lien YouTube à un export, avec preview du fichier terminé et historique local. L'éditeur timeline existe mais est **quarantiné** (`src/editorAvailability.ts` → `EDITOR_QUARANTINED = true`).

## Rust (`src-tauri/src/`)

| Module | Rôle |
|--------|------|
| `bins` | `%LOCALAPPDATA%\Dollyt\bin` — téléchargements initiaux épinglés et vérifiés par SHA-256; les manifestes locaux servent de marqueurs d’installation et évitent de recalculer les hashes aux lancements suivants; yt-dlp garde un marqueur de version validée; self-update via GitHub avec contrôle `--version` au moment de la mise à jour |
| `commands` | Surface Tauri : `initialize_tools`, `load_video`, `resolve_preview_url`, `start/cancel_local_preview`, `get_timeline_filmstrip(_master)`, `release_preview_cache`, settings, presets, `update_ytdlp`, `pick_export_directory`, `start_cut_job_command`, `reveal_file` |
| `format` | Choix des formats yt-dlp : preview muxée (itag 18) + formats HQ pour export |
| `ffmpeg` | Coupe exacte de plage, export selon preset (x264 CRF / copie de flux, audio AAC) |
| `jobs` | Un job à la fois : load → download section → probe → encode → `job-progress` / `job-finished` events; les presets intégrés et utilisateur sont résolus côté worker |
| `presets` | 10 JSON embarqués (`src-tauri/presets/`) + presets JSON utilisateur `%LOCALAPPDATA%\Dollyt\presets`; les IDs intégrés ont priorité sur les collisions |
| `settings` | `settings.json` : dossier export, gabarit global (le gabarit par défaut du preset reste actif), matériel NVENC/AMF, dev CRF/fps/audio/x264, langue, auto-update app/yt-dlp, version ignorée |
| `storyboard` | Extraction sb0–sb3 depuis les métadonnées yt-dlp (timeline, quarantain) |
| `ytdlp` | Wrapper yt-dlp via Deno : `-J` metadata, section download, détection cookies Firefox/fichier, mapping erreurs, ticker de progression nettoyé à chaque sortie |
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
