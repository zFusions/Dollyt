# Rapport M0 — Spike preview

Statut : terminé, en attente de validation humaine avant M1.

## Environnement

| Élément | Valeur |
|---------|--------|
| OS | Windows 10.0.26300 |
| Node | v24.14.0 |
| yt-dlp | 2026.10.26 |
| FFmpeg / ffprobe | 9.0.2-full_build (gyan.dev) |
| Deno | 2.9.8 |
| Rust | 1.99.1 (installé via rustup pendant M0) |
| Tauri | 2.12.5 (crate app) |
| WebView2 | non mesuré automatiquement |

## Lecture preview (itag 18)

| Test | Résultat | Notes |
|------|----------|-------|
| Métadonnées `-J` | OK | test ignoré `live_me_at_the_zoo`, format `18` |
| URL signée format 18 | OK | extraite du JSON |
| Lecture `<video>` directe | non vérifié ici | lancer `npm run tauri dev` et confirmer seek + son |
| Proxy local | non utilisé | réservé si la CSP ou WebView2 bloque |
| Seek / son | non vérifié ici | validation manuelle requise |

CSP dans `tauri.conf.json` : `media-src` et `connect-src` incluent `https://*.googlevideo.com`. Pas de proxy.

## Téléchargement et découpe

Vidéo : [Me at the zoo](https://www.youtube.com/watch?v=jNQXAC9IVRw), plage 5–12 s, marge 3 s.

| Test | Résultat | Notes |
|------|----------|-------|
| `--download-sections` (copie) | OK | test ignoré réseau |
| Durée téléchargement | **5814 ms** | `download_ms` du test |
| `ffprobe` offset | utilisé | valeur lue avant coupe |
| Découpe FFmpeg | OK | **261 ms**, sortie **7,0 s** demandée |
| Écart vs plage | OK | 7 s attendus pour 12−5 |

## Commandes exécutées

```text
cargo test
cargo clippy -- -D warnings
cargo test live_me_at_the_zoo_pipeline -- --ignored --nocapture
npm run build
```

## Go / no-go

- **Décision proposée : GO conditionnel**
- **Raisons :** chaîne yt-dlp → section MKV → ffprobe → FFmpeg validée en test réel avec mesures. Le code Rust est en place pour la preview dans Tauri. Il reste à confirmer la lecture `<video>` dans WebView2 (`npm run tauri dev`) : seek, son, pas de blocage CSP.

## Non vérifié (hors M0)

Storyboards, pas à pas, mock `npm run dev`, binaires hashés, sélection DASH HQ, proxy HTTP, annulation d’arbre de processus, repli sans itag 18 en conditions réelles.
