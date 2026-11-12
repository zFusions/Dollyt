# Rapport M1 — moteur (infra)

**Statut :** infra moteur consolidée (validation BYPASS utilisateur). Interface / DA : hors périmètre de cette passe.

## Fait

- Modules `commands`, `settings`, `presets`, `storyboard`, `updater` (stub).
- 6 presets JSON embarqués ; export jobs HQ → dossier `settings.exportDir` avec template de nom.
- `VideoInfo.exportFormatId`, merge yt-dlp pour formats `vidéo+audio`.
- Commandes settings / presets / bins / update_ytdlp / storyboard / metadata.
- Logs rotation 2 Mo ; mock front `src/api/dollyt.ts` pour `npm run dev`.
- CI Windows : build, tests, clippy.

## Commandes

```text
npm run typecheck
npm run test:rust
npm run lint:rust
npm run tauri dev
```

## Non vérifié ici

- Export HQ réel sur une longue vidéo 4K (réseau).
- `h264_nvenc` sans GPU NVIDIA.
- CI GitHub Actions (workflow ajouté, pas exécuté sur Actions dans cette session).

## Suite (hors infra)

- M2 timeline + storyboards UI.
- M5 Chambre noire / animations.
