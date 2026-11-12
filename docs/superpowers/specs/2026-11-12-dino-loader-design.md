# Dino loader intégré — design

## Intention

Remplacer le mini-runner actuel par une version plus proche du T-Rex Chromium montré
par l'utilisateur, tout en restant hors ligne, intégré au canvas React et cohérent
avec la DA Dollyt.

## Objectifs

- Démarrage uniquement avec Espace, Flèche haut ou clic.
- Boucle stable à 60 FPS avec delta time, saut, gravité, accélération et obstacles.
- Score, collision, game-over et recommencement fiables.
- Pause propre quand la fenêtre devient invisible.
- Respect de `prefers-reduced-motion`.
- Afficher le pourcentage sur la même ligne que le titre « Préparation de la vidéo »,
  avec la police Instrument Sans utilisée par le titre.

## Hors périmètre

- Iframe CodePen ou script externe.
- Audio, télémétrie ou dépendance supplémentaire.
- Modification de la logique de téléchargement.

## Approches

1. Porter le moteur dans le composant canvas existant et redessiner le T-Rex,
   les cactus, le sol et le score avec la palette Dollyt. Retenu : fiable, hors
   ligne, compatible avec Tauri et contrôlable par React.
2. Embarquer le CodePen dans une iframe. Rejeté : dépendance réseau, CSP et focus
   clavier moins fiables, personnalisation limitée.

## Conception retenue

`DinoLoader` conserve son API `active` et possède une boucle de jeu isolée avec
des références mutables. Les obstacles sont générés avec des espacements bornés,
le score augmente à chaque obstacle franchi et la vitesse progresse sans dépasser
un plafond. Le canvas est redimensionné visuellement par CSS mais conserve une
résolution interne stable pour éviter les accoups.

`DownloadView` regroupe le pourcentage et le titre dans un en-tête horizontal.
Le pourcentage conserve la tabularité des chiffres mais utilise `var(--font-ui)`,
comme le texte de la page.
