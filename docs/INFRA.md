# Infra Dollyt (hors interface)

État après consolidation moteur / distribution, **avant** polish DA (M5) et timeline (M2).

## Rust (`src-tauri/src/`)

| Module | Rôle |
|--------|------|
| `bins` | `%LOCALAPPDATA%\Dollyt\bin`, yt-dlp GitHub + SHA-256, FFmpeg/ffprobe/deno copie PATH |
| `commands` | Surface Tauri (métadonnées, settings, presets, jobs, binaires) |
| `format` | Preview muxé (18), HQ HTTPS `pick_download_formats` |
| `jobs` | Un job, HQ + preset → dossier d’export settings |
| `presets` | 6 JSON embarqués + presets utilisateur `%LOCALAPPDATA%\Dollyt\presets` |
| `settings` | `settings.json` (export, template, encodage matériel) |
| `storyboard` | Extraction sb0–sb3 depuis `-J` |
| `updater` | Stub M4 (app), `update_ytdlp` en commande |
| `log` | Rotation ~2 Mo → `.1.log`, redaction URLs |

## Commandes Tauri

`load_video`, `fetch_metadata`, `get_storyboard`, `get_settings`, `save_settings_cmd`, `list_presets`, `get_preset`, `bins_status`, `update_ytdlp`, `download_section`, `run_cut_pipeline`, `start_cut_job_command`, `cancel_job`.

## Front minimal

- `src/api/dollyt.ts` : `invoke` sous Tauri, mock sous `npm run dev` (sans export).
- UI existante inchangée côté DA ; branchement API uniquement.

## CI

`.github/workflows/ci.yml` : `npm run build`, `cargo test --locked`, `clippy -D warnings` (Windows).

## Volontairement reporté

- Téléchargement officiel FFmpeg/Deno (toujours copie PATH).
- yt-dlp est téléchargé uniquement à l'initialisation si absent, ou via l'action manuelle de mise à jour.
- La version et le SHA-256 de yt-dlp sont épinglés dans le code afin d'éviter de faire confiance à une release "latest" non signée.
- Plugin updater Tauri, installeur NSIS.
- Timeline, grain, écrans Paramètres/Presets riches (interface).
