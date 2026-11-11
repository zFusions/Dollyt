# Dollyt

Dollyt est une application Windows open source. Elle télécharge une vidéo YouTube, ou un extrait, en haute qualité, pour un montage TikTok, Reels ou Shorts.

Flux prévu : coller un lien, prévisualiser avec le son et image par image, régler l'entrée et la sortie, choisir un preset, exporter.

## Non-objectifs v1

Autres plateformes que YouTube, upscale, éditeur de montage complet, macOS, Linux, comptes utilisateur, télémétrie, cloud.

## État

Ce dépôt contient le socle documentaire. Le code de l'application n'est pas écrit. Le jalon M0, le spike de preview, n'a pas commencé. La suite est dans [docs/MILESTONES.md](docs/MILESTONES.md).

## Stack prévue

Tauri 2, Rust stable, TypeScript, Vite, React, Tailwind CSS 4 avec des tokens propres au projet. Windows 10 version 1809 ou plus récente, et Windows 11, en x64, avec WebView2.

yt-dlp, FFmpeg et Deno ne sont pas versionnés. Au premier lancement, l'application les téléchargera dans `%LOCALAPPDATA%\Dollyt\bin`, vérifiera leur SHA-256, et ne les prendra que depuis les sources officielles.

## Privacy

Dollyt n'a pas de télémétrie.

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
