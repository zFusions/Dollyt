# Design

Ce fichier décrit l'architecture et la direction artistique de Dollyt. Il prime sur tout skill tiers de design. Les règles d'appel à yt-dlp et FFmpeg sont dans `.cursor/skills/dollyt-engine/SKILL.md`. En cas de contradiction sur l'interface, ce fichier gagne.

## Produit

Dollyt télécharge une vidéo YouTube, ou un extrait, pour un montage court. L'utilisateur colle un lien, prévisualise avec le son, règle deux curseurs d'entrée et de sortie, choisit un preset, exporte.

Hors v1 : autres plateformes, upscale, montage multipiste, macOS, Linux, comptes, télémétrie, cloud.

Cible : Windows 10 1809+ et Windows 11, x64, WebView2. Au repos, le CPU reste quasi nul : pas d'animation hors écran, pas de polling inutile.

## Architecture

```
src/                 interface TypeScript, Vite, React
src-tauri/           Tauri 2, Rust stable
docs/                ce fichier, les jalons, plus tard PERF.md
scripts/
installer/           Inno Setup, au jalon M4
.github/workflows/   ci.yml et release.yml, au jalon M4
```

`npm run dev` lancera l'interface dans le navigateur avec un faux backend. La même version figurera dans `tauri.conf.json`, `package.json` et `Cargo.toml`. La CI tournera en `--locked`. Aucun de ces fichiers n'existe encore.

Frontend : état léger (Zustand ou un équivalent du même rôle, choisi quand le code commencera). Animations en CSS ou Web Animations API. Polices embarquées en woff2, aucun CDN. Thème sombre seul en v1. Cadre natif Windows, barre de titre sombre, pas de barre de titre personnalisée.

Modules Rust prévus, séparés : `commands`, `ytdlp`, `ffmpeg`, `jobs`, `presets`, `settings`, `updater`, `error`.

Binaires yt-dlp, FFmpeg et Deno : absents du dépôt. Téléchargés au premier lancement dans `%LOCALAPPDATA%\Dollyt\bin`, SHA-256 vérifié, sources officielles seulement. Deno sert à yt-dlp pour les challenges JavaScript de YouTube.

Mise à jour de l'application : plugin officiel d'updater de Tauri 2. L'identifiant exact du plugin et les clés de signature se confirment dans la documentation Tauri 2 au jalon M4. Non vérifié à ce stade.

Presets : JSON versionnés, validés par serde. Presets intégrés en lecture seule. Presets utilisateur : créer, dupliquer, importer, exporter. Champs : nom, conteneur, codec vidéo, CRF ou débit, résolution et ratio, fps, recadrage (aucun, centré, décalage réglable), codec et débit audio, gabarit de nom de fichier.

Presets intégrés prévus : Source brute (MKV, copie de flux), Édition (MP4 H.264 haute qualité, qualité de la source), TikTok 9:16, Reels 9:16, Shorts 9:16, YouTube 16:9. Les résolutions et débits par défaut de chaque plateforme se vérifient dans la documentation actuelle de la plateforme avant d'être écrits. Ils ne sont pas fixés ici.

Dossier d'export dans les Paramètres. Gabarit de nom par défaut : `{titre}_{debut}-{fin}`.

Encodage par défaut prévu : `libx264`, CRF 12 à 16 selon le preset, `-preset slow`, `yuv420p`, AAC 320k. Encodage matériel (NVENC, AMF, QSV) en option, désactivé par défaut, détecté via `ffmpeg -encoders`.

## Preview

La preview est le risque principal. M0 est un spike jetable qui la valide avant le travail de design détaillé.

Lecture : flux progressif muxé (itag 18, 360p30 avec son) dans une balise `<video>`, via l'URL signée obtenue par yt-dlp. Seek, son, pas à pas à 1/fps. Si WebView2 ou la CSP bloque la lecture, un petit proxy HTTP local en Rust (`127.0.0.1`, port éphémère, jeton aléatoire, requêtes Range). Si l'itag 18 manque, documenter un repli vers un autre flux muxé. libmpv seulement en dernier recours. Les URL signées expirent : les re-résoudre à la demande.

Miniatures de timeline : storyboards YouTube (`sb0` à `sb3`), sans télécharger la vidéo.

Précision en deux temps : sélection grossière sur le 360p30, téléchargement de la plage avec marge en qualité maximale, affinage image par image sur le clip local.

Raccourcis : Espace lecture/pause, J/K/L, flèches gauche/droite image par image, Shift+flèches 1 s, `I` et `O` pour l'entrée et la sortie, Entrée pour exporter. Champs timecode éditables `HH:MM:SS.mmm`. Zoom de la timeline.

## Direction artistique : Chambre noire

Une chambre noire de laboratoire photo. On développe un plan. Lumière inactinique rouge, grain argentique, noir chaud, papier.

Ça ne ressemble pas à une interface de jeu : pas de néon, pas d'angles découpés, pas de glow RGB, pas de HUD.

### Tokens

Déclarés en variables CSS. La palette Tailwind par défaut n'est pas utilisée.

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

### Règles

Le rouge est rare. Il marque le playhead, le bouton principal, le focus, la progression, la sélection. Jamais en grande surface, jamais en texte courant. Les contrastes se vérifient en WCAG AA. Le rouge sur fond sombre est réservé aux grands textes et aux composants d'interface. Les rapports de contraste ne sont pas mesurés dans ce document.

Lumière : un seul halo très diffus (`radial-gradient`, 6 à 10 % d'opacité) en haut à gauche, fixe, sans animation, plus une vignette discrète. Pas d'ombre colorée, pas de glow sur les boutons.

Grain : une tuile PNG de bruit pré-générée (environ 256 px, 4 à 6 % d'opacité) sur un pseudo-élément fixe, `pointer-events: none`, statique. Un seul calque. Pas de `feTurbulence` plein écran, pas de grain animé.

Typographie : titres en Instrument Serif, interface en Instrument Sans, timecodes et valeurs en IBM Plex Mono, ou des équivalents libres du même caractère. Interdits : Inter, Roboto, Space Grotesk, Poppins, une police système seule. Les fichiers woff2 et leurs licences ne sont pas encore choisis. Non vérifié.

Formes : rayon 2 px, 3 px au maximum, sur les contrôles. 0 sur la timeline. Traits de 1 px. Séparation par traits fins et par l'espace, pas par des cartes arrondies à ombre. Grille de 4 px.

Motifs : graduations de timecode, perforations de pellicule très discrètes sur le bord de la timeline, grille de miniatures façon planche-contact, numéros d'images en mono.

Icônes : un seul set, trait fin. Pas d'emoji.

Mouvement : `transform` et `opacity` uniquement. Durées 120, 200 et 360 ms. Courbe `cubic-bezier(.2, .7, .2, 1)`.

- Miniature « développement » : du noir à l'image (opacity, scale 1.02 vers 1), en cascade de 25 à 40 ms.
- Progression d'export : un trait rouge fin qui s'étend (`scaleX`).
- Playhead : trait rouge de 1 px, petite poignée.
- `prefers-reduced-motion` est respecté. Rien ne tourne en continu quand l'application est au repos.

Textes en français, sobres, sans point d'exclamation, sans emoji, sans jargon de jeu. Exemple : « Colle un lien YouTube ».

### Checklist anti-slop

À relire avant chaque livraison d'écran.

- Pas de dégradé violet ou bleu, pas de texte en dégradé.
- Pas de glassmorphism ni de `backdrop-filter`.
- Pas de grille de cartes identiques arrondies avec ombre.
- Pas de héros centré générique, pas de fausses statistiques, pas de lorem ipsum.
- Pas d'emoji en guise d'icônes.
- Pas de police par défaut des générateurs d'interface.
- Si un élément pourrait venir de n'importe quel template, le refaire.

## Écrans

1. Accueil. Écran presque vide. Un grand champ en serif : « Colle un lien YouTube ». Détection du presse-papiers en option. Historique récent en grille façon planche-contact.
2. Éditeur. Preview en haut, au ratio réel de la vidéo. Timeline en bas : bande de miniatures issues des storyboards, deux poignées entrée et sortie, durée sélectionnée en mono, zoom. Panneau droit étroit : preset, taille et qualité estimées, destination, bouton Exporter.
3. File d'attente. Lignes sobres, trait de progression, annulation, ouverture du dossier.
4. Paramètres. Dossier de sortie, gabarit de nom, encodage matériel, mise à jour de yt-dlp, dossier des binaires.
5. Presets. Liste, éditeur, import et export.

## Accessibilité

Navigation clavier complète. Focus visible par un trait rouge. Contrastes à vérifier au moment des écrans, pas estimés ici.
