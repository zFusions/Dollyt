# Mini-jeu de chargement Dollyt

## Intention

Remplacer le mini-jeu Dino actuel, peu lisible et instable, par un runner local fiable
pendant le traitement d'un extrait. Le jeu doit distraire sans détourner l'attention du
chargement et rester cohérent avec la DA noire, rouge safelight et typographique de Dollyt.

## Objectifs

- Démarrage explicite par Espace, Flèche haut ou clic.
- Saut, gravité, obstacles, collisions, score et recommencement fiables.
- Animation fluide avec `requestAnimationFrame`, pause quand la fenêtre est masquée et
  respect de `prefers-reduced-motion`.
- Rendu original Dollyt en canvas, sans ressource distante ni nouvelle dépendance.
- Conservation de la zone de déplacement de la fenêtre et des contrôles existants.

## Hors périmètre

- Aucun téléchargement de jeu ou d'asset depuis Internet pendant l'exécution.
- Aucun son, classement en ligne ou télémétrie.
- Aucun changement au flux de téléchargement.

## Approches considérées

1. Intégrer le clone Chrome `wayou/t-rex-runner` (BSD-3-Clause) : gameplay éprouvé,
   mais assets et style étrangers à Dollyt.
2. Ajouter une librairie de jeu : plus de fonctionnalités, mais dépendance et maintenance
   inutiles pour un jeu de chargement court.
3. Recréer un runner compact avec les mécaniques éprouvées du T-Rex Runner : surface
   d'attaque réduite, timing stable, rendu original et aucune dépendance.

L'approche 3 est retenue pour respecter la DA, réduire la surface de maintenance et garder
le jeu embarqué dans l'application.

## Conception

Le composant conserve son API `active` et son canvas existant. La boucle utilise le temps
réel plafonné entre les frames, une machine d'état `ready/running/game-over`, une liste
d'obstacles et des hitbox indépendantes du rendu. Le dessin utilise les couleurs et la
typographie déjà définies par Dollyt. Les entrées clavier sont limitées à la fenêtre du
jeu et sont nettoyées au démontage.
