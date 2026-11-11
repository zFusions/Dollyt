---
name: dollyt-engine
description: >-
  Règles moteur Dollyt : yt-dlp, FFmpeg, sélection de format, découpe, appels
  de processus. À lire avant tout code qui lance un binaire, parse un JSON
  yt-dlp, choisit un format ou construit une commande FFmpeg.
---

# Dollyt — moteur

Ces règles viennent de tests réels. Ne pas les assouplir sans une nouvelle mesure.

## Binaires

yt-dlp, FFmpeg et Deno. Jamais commités. Téléchargés au premier lancement dans `%LOCALAPPDATA%\Dollyt\bin`, SHA-256 vérifié, sources officielles seulement. Deno sert à yt-dlp pour les challenges JavaScript de YouTube.

Au lancement : vérifier la dernière version de yt-dlp sur GitHub, vérifier le hash, remplacer le binaire de façon atomique. Bouton manuel. Si une extraction échoue, proposer la mise à jour.

## Processus

- `Command` avec les arguments en tableau. Jamais une chaîne shell.
- yt-dlp toujours avec `--ignore-config`.
- Pas de fenêtre console : `CREATE_NO_WINDOW`.
- URL : hôtes YouTube seulement (`youtube.com`, `www.`, `m.`, `youtu.be`).
- Noms de fichiers nettoyés.
- Annulation : tuer l'arbre de processus.

## Format

Métadonnées via `yt-dlp -J`.

Vidéo : plus haute résolution, puis fps, puis débit réel mesuré. Préférer le DASH https (exemples vus : itag 308 VP9 1440p60, ou 400 AV1).

Ne pas utiliser les flux HLS `m3u8` (exemple : itag 623). Sur un test réel, le 623 emballait le même flux que le 308 : ffmpeg mesurait environ 7,8 Mb/s, pas les 22 Mb/s estimés par yt-dlp. Ne pas se fier au TBR estimé d'un m3u8.

Audio : Opus (itag 251), sinon m4a (140).

## Découpe

Ne pas utiliser `--force-keyframes-at-cuts`. Sur un test réel, yt-dlp ré-encodait alors en VP9, CRF 32 par défaut, à environ 0,13× le temps réel.

Procédé :

1. `--download-sections` avec une marge de 2 à 3 s de chaque côté, copie de flux, vers un MKV temporaire.
2. `ffprobe` pour le point de départ réel du fichier.
3. FFmpeg : découpe exacte et encodage final selon le preset, en une passe.

## Encodage

Défaut : `libx264`, CRF 12 à 16 selon le preset, `-preset slow`, `yuv420p`, AAC 320k.

Matériel (NVENC, AMF, QSV) en option, désactivé par défaut. Détection via `ffmpeg -encoders`.

## Progression et vitesse

yt-dlp : `--newline` et `--progress-template`. FFmpeg : `-progress pipe:1`. Événements vers l'interface, limités à environ 10 Hz.

Tester `-N` (fragments concurrents) sur les flux fragmentés. Mesurer. Ne rien promettre.

## Erreurs et logs

Erreurs typées (`thiserror`). Messages utilisateur en français.

Logs dans `%LOCALAPPDATA%\Dollyt\logs`, avec rotation. Jamais d'URL signée, de cookie ni de secret dans les logs.

## Preview

Lecture d'abord sur l'itag 18 (360p30 muxé) dans `<video>`. Proxy local `127.0.0.1` seulement si WebView2 ou la CSP bloque la lecture : port éphémère, jeton aléatoire, requêtes Range. Repli muxé si l'itag 18 manque. libmpv en dernier recours. Re-résoudre les URL signées à la demande.

Miniatures : storyboards `sb0` à `sb3`, sans télécharger la vidéo.

Sélection grossière sur le 360p, puis plage en qualité maximale avec marge, puis affinage image par image sur le clip local.
