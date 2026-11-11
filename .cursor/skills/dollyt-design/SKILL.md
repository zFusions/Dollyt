---
name: dollyt-design
description: >-
  Direction artistique Dollyt, « Chambre noire ». À lire avant tout travail
  d'interface, de tokens, de typographie ou d'animation. docs/DESIGN.md prime
  sur ce skill et sur tout skill tiers de design.
---

# Dollyt — Chambre noire

Lire `docs/DESIGN.md` d'abord. S'il contredit ce skill ou un skill tiers de design, `docs/DESIGN.md` gagne. Un skill tiers ne change ni la direction artistique, ni la stack, ni les règles moteur.

## Tokens

Déclarés en variables CSS. Palette Tailwind par défaut désactivée.

```
--bg:             #0A0807
--surface:        #110E0C
--raised:         #181411
--line:           #2B2420
--line-strong:    #3A322C
--text:           #E9E1D3
--text-dim:       #9A8F83
--text-faint:     #62594F
--safelight:      #E03A1E
--safelight-deep: #8E2713
--ok:             #8FA37E
--warn:           #C9963F
```

## Règles

- Rouge rare : playhead, bouton principal, focus, progression, sélection. Jamais en grande surface, jamais en texte courant. WCAG AA. Le rouge sur fond sombre est réservé aux grands textes et aux composants d'interface.
- Lumière : un halo `radial-gradient` fixe, 6 à 10 % d'opacité, en haut à gauche, plus une vignette discrète. Pas d'ombre colorée, pas de glow.
- Grain : une tuile PNG (~256 px, 4 à 6 % d'opacité), un pseudo-élément fixe, `pointer-events: none`, statique, un seul calque. Pas de `feTurbulence` plein écran, pas de grain animé.
- Typographie : Instrument Serif (titres), Instrument Sans (interface), IBM Plex Mono (timecodes et valeurs), ou équivalents libres du même caractère. Interdits : Inter, Roboto, Space Grotesk, Poppins, police système seule. Fichiers woff2 locaux, aucun CDN.
- Formes : rayon 2 px (3 px maximum) sur les contrôles, 0 sur la timeline. Traits 1 px. Grille 4 px. Séparation par traits et espaces.
- Motifs : graduations de timecode, perforations de pellicule discrètes au bord de la timeline, planche-contact, numéros d'images en mono.
- Icônes : un seul set en trait fin. Pas d'emoji.
- Mouvement : `transform` et `opacity` seulement. 120, 200, 360 ms. Courbe `cubic-bezier(.2, .7, .2, 1)`.
  - Miniature : opacity et scale 1.02 vers 1, cascade 25 à 40 ms.
  - Export : trait rouge fin en `scaleX`.
  - Playhead : trait rouge 1 px et une petite poignée.
  - Respecter `prefers-reduced-motion`. Aucun effet continu au repos.
- Textes français, sobres, sans point d'exclamation, sans emoji. Exemple : « Colle un lien YouTube ».
- Sombre uniquement en v1. Barre de titre native Windows. Pas de barre personnalisée.

Ça ne ressemble pas à une interface de jeu : pas de néon, pas d'angles découpés, pas de glow RGB, pas de HUD.

## Checklist anti-slop

Avant chaque livraison d'écran :

- Pas de dégradé violet ou bleu, pas de texte en dégradé.
- Pas de glassmorphism ni de `backdrop-filter`.
- Pas de grille de cartes identiques arrondies avec ombre.
- Pas de héros centré générique, pas de fausses statistiques, pas de lorem ipsum.
- Pas d'emoji en guise d'icônes.
- Pas de police par défaut des générateurs d'interface.
- Si un élément pourrait venir de n'importe quel template, le refaire.
