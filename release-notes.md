## Dollyt 1.1.0

Merci pour vos tests ! Cette version corrige les bugs remontés et ajoute la file d'exports, l'audio et l'encodage matériel.

### Nouveautés

- **File d'exports** : une page dédiée montre les exports en cours, en attente et terminés, avec l'étape et le pourcentage de chacun. Un seul traitement à la fois, les autres attendent leur tour.
- **Export audio** : deux nouveaux presets — MP3 et FLAC (perte / sans perte) — avec un lecteur audio intégré pour pré-écouter le résultat.
- **Encodage matériel** : option dans les paramètres pour utiliser le GPU (NVIDIA / AMD) au lieu du CPU, avec un choix **Qualité** ou **Vitesse** et une explication claire des deux modes.
- **Bouton Copier sur les erreurs** : plus besoin de retaper les messages yt-dlp à la main.
- **Meilleure progression** : la jauge avance pendant tout le téléchargement au lieu de sauter de 5 % à 70 %.
- **Miniatures YouTube** dans l'historique des exports vidéo.
- **Score Snake sauvegardé** entre les sessions.

### Bugs corrigés

- **Durée de clip incorrecte** : un extrait demandé de 1:05 à 2:12 pouvait sortir en ~11 s. Le découpage respecte maintenant exactement la plage choisie.
- **Exports vidéo qui échouaient** sur certains formats (VP9/1440p) : le téléchargement privilégie désormais un format fiable.
- **Encodage GPU jamais utilisé sur AMD** : la détection du GPU a été corrigée — les exports sont nettement plus rapides.
- **Export qui disparaissait sans message** en cas d'échec : l'erreur reste visible dans la file avec son détail complet.
- **Progression qui repartait à 0 %** en quittant l'écran pendant un export.
- **Menu déroulant** des sélecteurs : animation plus visible à l'ouverture.

### Under the hood

- Préférences d'encodage NVENC/AMF corrigées et vérifiées sur matériel réel.
- Audit sécurité et propreté du code : aucune régression connue.

---

## Dollyt 1.1.0 (English)

Thank you for testing! This release fixes reported bugs and adds the export queue, audio exports, and hardware encoding.

### New

- **Export queue**: a dedicated page shows running, queued, and finished exports with stage and percentage. One job at a time, others wait their turn.
- **Audio export**: two new presets — MP3 and FLAC (lossy / lossless) — with a built-in audio player to preview the result.
- **Hardware encoding**: settings option to use your GPU (NVIDIA / AMD) instead of the CPU, with a **Quality** or **Speed** mode and a clear explanation of both.
- **Copy button on errors**: no more retyping long yt-dlp messages.
- **Smoother progress**: the bar now moves during the whole download instead of jumping from 5% to 70%.
- **YouTube thumbnails** in video export history.
- **Snake high score** now persists between sessions.

### Fixed

- **Wrong clip duration**: a 1:05–2:12 selection could export as ~11 s. Cuts now match the chosen range exactly.
- **Video exports failing** on some formats (VP9/1440p): downloads now prefer a reliable codec.
- **GPU encoding never used on AMD**: GPU detection fixed — exports are significantly faster.
- **Silent export failures**: errors now stay visible in the queue with full details.
- **Progress resetting to 0%** when leaving the screen mid-export.
- **Dropdown animation** on selectors is now more visible.

Windows x64 installer. See [README.md](https://github.com/zFusions/Dollyt/blob/master/README.md) for usage and privacy details.
