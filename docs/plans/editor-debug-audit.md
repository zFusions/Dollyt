# Audit debug — éditeur (timeline + preview)

**Date :** 2025-03-12  
**Méthode :** systematic-debugging (Phase 1 → 4), lecture code + chaîne Rust/UI.  
**Non vérifié :** comportement runtime sur la machine utilisateur après ce rapport.

## Cartographie

```text
load_video (Rust) → VideoInfo.duration + storyboard (yt-dlp)
start_local_preview → download_section(0…min(60,dur)) → preview-local-ready
                              ↓
EditorView: playheadSecs (store, 0…duration)  ≠  <video> (0…cap ~60s)
                              ↓
TimelineEditor: vignettes HD (0…cap) | storyboard YouTube (0…duration)
```

| Couche | Source de vérité temps | Limite connue |
|--------|-------------------------|---------------|
| Règle / timecode UI | `playheadSecs` | `duration` (métadonnées) |
| `<video>` lecture | `currentTime` | `cap` = `previewFileDurationSecs` ou 60 s |
| Vignettes HD | `buildFilmstrip` sur fichier local | même `cap` |
| Vignettes lointaines | storyboard `$L/$N` | toute la durée, basse définition |

**Décision produit implicite aujourd’hui :** timeline pleine durée, fichier local = **début de la vidéo seulement** (`commands.rs` `download_section(0.0, end, …)`).

---

## Symptômes → causes racines

### A. Espace / lecture depuis curseur loin → playhead saute vers 0 ou début du clip

**Reproduction (code) :** `playhead` ≈ 300 s, `cap` ≈ 60 s, mode clip actif (`exportFullVideo` = false).

1. `togglePlay` : `seekToFrame(el, min(playhead, cap))` — la lecture repart vers **la fin du fichier local**, pas vers le curseur.
2. Si le flux audio reste à `currentTime` ≈ 0 (seek raté, fin de fichier, ou relance), `onTimeUpdate` exécutait :
   `setPlayhead(clampTime(t, lo, hi))` → **force le timecode UI vers la zone clip (ex. 0–30 s)** alors que l’utilisateur visait 5:26.

**Cause racine :** une seule horloge (`playheadSecs`) synchronisée aveuglément sur `<video>` alors que la vidéo ne modélise **pas** l’instant timeline quand `playhead > cap`.

**Correctif retenu :** ne plus synchroniser `playhead` depuis `currentTime` si `head > cap + ε` (voir `EditorView`).

**Symptômes restants (architecture, pas bug CSS) :**

- Pas d’audio/image à 5:26 tant qu’aucun `download_section` n’est lancé autour de `playhead`.
- Comportement « Medal » attendu = fenêtre de preview **déplacée** ou stream seekable — **hors scope des patchs UI**.

### B. Quadrillage / plusieurs images par case timeline

**Cause racine (historique) :** vignettes storyboard en sprite CSS / métadonnées `width×height` incohérentes avec la planche réelle → chaque cellule montrait plusieurs tuiles.

**État code :** découpe par `naturalWidth/cols` (`StoryboardCell`, `tileSizeFromSheet` dans bake).

**Risque résiduel :** `frame.cols/rows` issus du format sb choisi par Rust ≠ grille réelle de l’image si mauvais format storyboard ; à confirmer sur un JSON yt-dlp réel.

### C. Bandes noires entre vignettes

**Causes probables (multi-facteurs) :**

1. URL storyboard `$N` absente ou 404 pour certains index (trous entre feuilles).
2. `onError` sur l’image → cellule vide (fond sombre).
3. Pas de repli « dernière vignette valide » (comportement manquant).

### D. Preview noire / « Préparation… »

**Chaîne :** flux HTTP YouTube dans WebView2 souvent inutilisable → attente `preview-local-ready`.  
**Échec silencieux :** `start_local_preview` spawn_blocking sans event d’erreur côté UI si `download_section` ou remux échoue.

### E. Réinitialisation playhead à l’ouverture

**`placedPlayback` effect :** au changement de `playbackUrl`, `setPlayhead(startSecs)` (souvent 0). **Attendu** une fois par fichier ; pas à chaque Espace.

**`setVideo` :** `playheadSecs: start` (0 sur longues vidéos). **Attendu** au chargement.

---

## Fichiers critiques

| Fichier | Rôle |
|---------|------|
| `src-tauri/src/commands.rs` | Preview 0…60 s uniquement |
| `src/views/EditorView.tsx` | Transport, cap, `onTimeUpdate`, filmstrip HD |
| `src/hooks/usePreviewAt.ts` | Seek vidéo seulement si `t ≤ cap` |
| `src/components/TimelineEditor.tsx` | Vue zoom, HD vs storyboard, bake |
| `src/lib/storyboardStrip.ts` | Index feuille / tuile |
| `src/components/PreviewPlayer.tsx` | `key={src}` → remount vidéo |

---

## Hypothèses testées

| Hypothèse | Verdict |
|-----------|---------|
| Boucle clip `onTimeUpdate` ramène à `lo` | Partiellement vrai ; garde `head ≤ loopEnd` ajoutée, insuffisante seule |
| Sync `currentTime` → playhead quand `head > cap` | **Confirmé** — cause principale saut vers 0 |
| Preview fichier non aligné sur curseur | **Confirmé** — architecture `download_section(0,…)` |
| Trop de vignettes en grille CSS | **Confirmé** (corrigé par découpe tuile) ; vérifier en prod |

---

## Pistes correctives (ordre recommandé)

1. **Garde sync playhead** (`head > cap`) — fait dans cette passe.
2. **Moteur :** `start_local_preview` avec `start_secs` (debounce au scrub) ou commande existante `download_section` déjà exposée.
3. **UI :** indicateur « Lecture locale 0:00–1:00 » vs curseur hors fenêtre ; désactiver play ou lancer fetch.
4. **Storyboard :** fixture log d’une charge `sb3` (cols/rows vs image) ; repli vignette précédente si 404.
5. **Erreurs Rust :** event `preview-local-failed` pour ne pas rester sur écran noir.

---

## Definition of done debug

- [x] Curseur hors fenêtre : pas de reset playhead depuis `currentTime` (garde UI).
- [x] `start_local_preview` avec `start_secs` + `previewStartSecs` sur l’event (fenêtre ~60 s mobile).
- [ ] Timeline 5–7 min → **6 colonnes**, une image pleine hauteur par colonne (storyboard).
- [ ] Scrub 5:26 → attente « Préparation… » puis lecture alignée (réseau + redémarrage Tauri requis).
