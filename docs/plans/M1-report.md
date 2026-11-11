# Rapport M1 — Moteur (partiel)

Statut : en cours. UI Chambre noire amorcée en parallèle.

## Fait

- Binaires : yt-dlp téléchargé avec SHA-256 ; FFmpeg/ffprobe/deno copiés depuis le PATH vers `%LOCALAPPDATA%\Dollyt\bin`.
- `process`, `format` (preview + HQ en tests), `jobs` (un job, annulation, events).
- Logs : `%LOCALAPPDATA%\Dollyt\logs\dollyt.log`, URLs redacted.
- Progression yt-dlp via `--progress-template` (~10 Hz vers le front).

## Non vérifié / reste

- Téléchargement FFmpeg/Deno depuis sources officielles (hors copie PATH).
- Export HQ branché sur `pick_download_formats`.
- Progression FFmpeg en temps réel.
- Mise à jour yt-dlp automatique.
- Revue sécurité fin M1.
