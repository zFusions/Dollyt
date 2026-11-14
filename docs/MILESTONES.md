# Jalons

Le socle documentaire est validé. Le plan M0 est dans [plans/M0.md](plans/M0.md) ; l'exécution commence après validation de ce plan.

À la fin de chaque jalon : lancer lint et tests, résumer ce qui marche, lister ce qui n'est pas vérifié, s'arrêter. Le jalon suivant attend une validation.

Les décisions de stack et de direction artistique sont dans [DESIGN.md](DESIGN.md). Un plan de jalon, le jour venu, s'écrit dans `docs/plans/Mx.md` et se valide avant l'exécution.

## M0 — Spike preview

Terminé (GO). Rapport : [plans/M0-report.md](plans/M0-report.md).

## M1 — Moteur

Infra clôturée (BYPASS). Plan : [plans/M1.md](plans/M1.md), rapport : [plans/M1-report.md](plans/M1-report.md), inventaire : [INFRA.md](INFRA.md). Shell UI minimal conservé ; polish DA reporté à M5.

## M2 — Éditeur et timeline

Code présent (storyboards, filmstrip, TimelineEditor, preview locale) mais **quarantiné** en 1.0.x : `EDITOR_QUARANTINED = true` dans `src/editorAvailability.ts`. Réouverture = décision produit explicite.

## M3 — Presets, export, paramètres

Terminé en 1.0.x : 8 presets JSON, export selon preset, écran Paramètres, historique.

## M4 — Distribution

Terminé en 1.0.x : releases GitHub automatiques (tag `vX.Y.Z` → NSIS + `latest.json` signé), updater in-app avec ignorer/installer, auto-update yt-dlp, CI `--locked`.

## M5 — Finition

En cours : i18n FR/EN complet,Snake, progression lissée, README public. Reste : screenshots README, `docs/PERF.md`, passe perf.
