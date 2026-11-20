# Synthèse audit multi-agent (2026-11-21)

Quatre passes parallèles : moteur export (Rust), UI/file (React), outils embarqués (aperçu), commandes/cache.

## Cause du dernier échec utilisateur (logs 1.2.4)

Le patch `--load-info-json` **avec** `--download-sections` a figé yt-dlp : aucune ligne après `Destination`, puis watchdog **120 s** → message « expire ». Ce n’était pas l’extrait « 120 secondes » ni YouTube qui expirait en premier, c’était **notre** coupure.

## Correctifs livrés en 1.2.5

| Priorité | Domaine | Correctif |
|----------|---------|-----------|
| P0 | `ytdlp.rs` / `jobs.rs` | Pas de `load-info-json` en mode section |
| P0 | `ytdlp.rs` | Stall 300 s sur sections (au lieu de 120 s) |
| P0 | `HomeView` / `store` / `App.tsx` | Nouvel export sans traîner l’ancien job ; ignorer progress tardifs |
| P1 | `jobs.rs` | Annulation → `annulé` même si slot processus vide |

## Hors code (limites)

- HTTP 403 YouTube : cookies, yt-dlp à jour, réseau.
- Double extraction yt-dlp sur extraits (lenteur acceptable vs hang).
- Éditeur timeline toujours quarantiné.

## Vérification

`docs/TEST-SCENARIO-export.md` sur installateur **1.2.5** uniquement.