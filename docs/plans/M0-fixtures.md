# M0 — URL et fixtures de test

Vidéos publiques YouTube, vérifiées localement avec `yt-dlp --ignore-config` le 2026-03-26.

## URL principale (courte, itag 18)

| Rôle | URL | itag 18 | Durée approx. |
|------|-----|---------|----------------|
| Spike par défaut | https://www.youtube.com/watch?v=jNQXAC9IVRw | oui | ~19 s |

« Me at the zoo » — idéal pour boucles rapides preview et téléchargement.

## URL secondaires

| Rôle | URL | itag 18 | Note |
|------|-----|---------|------|
| 360p30 | https://www.youtube.com/watch?v=aqz-KE-bpKQ | oui | Big Buck Bunny (court) |
| Plus longue | https://youtu.be/9bZkp7q19f0 | oui | Gangnam Style, test plage |

## Repli sans itag 18

Aucune URL live fiable sans format muxé n’a été retenue. Le repli muxé est couvert par :

- un test unitaire Rust sur un extrait JSON dans `src-tauri/fixtures/` ;
- le code qui choisit le premier format `vcodec!=none&acodec!=none` si le format `18` est absent.

## Plage de test suggérée (Me at the zoo)

- Entrée : `5` s
- Sortie : `12` s
- Marge téléchargement : `3` s → section yt-dlp `3-15`
