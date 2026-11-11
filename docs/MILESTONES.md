# Jalons

Le socle documentaire est validé. Le plan M0 est dans [plans/M0.md](plans/M0.md) ; l'exécution commence après validation de ce plan.

À la fin de chaque jalon : lancer lint et tests, résumer ce qui marche, lister ce qui n'est pas vérifié, s'arrêter. Le jalon suivant attend une validation.

Les décisions de stack et de direction artistique sont dans [DESIGN.md](DESIGN.md). Un plan de jalon, le jour venu, s'écrit dans `docs/plans/Mx.md` et se valide avant l'exécution.

## M0 — Spike preview

Terminé (GO). Rapport : [plans/M0-report.md](plans/M0-report.md).

## M1 — Moteur

En cours. Plan : [plans/M1.md](plans/M1.md). Binaires, hashs, sélection de format, jobs, progression, annulation, erreurs. Revue sécurité en fin de jalon.

## M2 — Éditeur et timeline

Storyboards, poignées, raccourcis, affinage sur le clip local.

## M3 — Presets, export, paramètres

Presets intégrés et utilisateur. Export selon le preset. Écran Paramètres.

## M4 — Distribution

Mises à jour de l'application, installeur Inno Setup, CI et release, `SHA256SUMS.txt` joint aux releases. Passe de revue sécurité à la fin.

## M5 — Finition

Direction artistique, animations, passe de performance consignée dans `docs/PERF.md`. Aucun chiffre de performance n'est promis à l'avance. Une mesure, le jour où elle existe, est écrite avec les conditions du test.
