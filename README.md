# Dollyt

Dollyt est une application Windows open source fonctionnelle. Elle télécharge une vidéo YouTube, ou un extrait, en haute qualité, pour un montage TikTok, Reels ou Shorts.

Flux prévu : coller un lien, prévisualiser avec le son et image par image, régler l'entrée et la sortie, choisir un preset, exporter.

## Non-objectifs v1

Autres plateformes que YouTube, upscale, éditeur de montage complet, macOS, Linux, comptes utilisateur, télémétrie, cloud.

## État

La version actuelle fournit l'accueil, la récupération YouTube, la preview locale, les presets, les réglages, la file et l'export FFmpeg. L'éditeur complet reste volontairement désactivé et isolé dans `src/quarantine`.

## Stack prévue

Tauri 2, Rust stable, TypeScript, Vite, React, Tailwind CSS 4 avec des tokens propres au projet. Windows 10 version 1809 ou plus récente, et Windows 11, en x64, avec WebView2.

yt-dlp, FFmpeg et Deno ne sont pas versionnés. Au premier lancement, l'application utilise les outils disponibles dans le PATH ou télécharge yt-dlp depuis une release épinglée, puis vérifie son SHA-256 avant exécution. FFmpeg et Deno doivent être installés séparément pour le moment.

## Privacy

Dollyt n'a pas de télémétrie et n'envoie pas les vidéos vers un serveur Dollyt.

Le réseau se limite à :

- YouTube et googlevideo, pour les métadonnées, la preview et le téléchargement ;
- les releases GitHub, pour les mises à jour de l'application et de yt-dlp ;
- les sources officielles des binaires yt-dlp, FFmpeg et Deno.

Les journaux restent sur la machine, dans `%LOCALAPPDATA%\Dollyt\logs`. Une URL signée, un cookie ou un secret n'y est pas écrit.

## Disclaimer

Dollyt sert à travailler un contenu dont vous avez les droits. Le projet est indépendant et n'est pas affilié à YouTube. Il ne contourne ni DRM ni protection anti-bot.

Les demandes de retrait sont dans [DMCA.md](DMCA.md).

## Licence

MIT. Voir [LICENSE](LICENSE).

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md)
- [docs/MILESTONES.md](docs/MILESTONES.md)
