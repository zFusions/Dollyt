# Scénario de validation export (Dollyt 1.2.4)

Ce protocole valide les correctifs que tu as vécus : fausse panne « YouTube n’envoie rien », double extraction lente, heure des logs décalée, file bloquée après annulation.

## Avant de commencer

1. Installe **`Dollyt_1.2.6_x64-setup.exe`** depuis le brouillon GitHub (minimum **1.2.5** ; évite la 1.2.4).
2. Ouvre Dollyt une fois. Laisse finir « Préparation des outils vidéo » si l’écran le demande.
3. Va dans **Paramètres** : choisis un **dossier de sortie** (obligatoire pour exporter).
4. Sur l’écran d’accueil ou depuis **Paramètres**, ouvre **Afficher les logs** (console de diagnostic). Garde-la visible pendant les tests.

Tu feras les scénarios **dans l’ordre** : **B** (le plus important), puis **C**, puis **A** si tu veux, **D** en option.

---

## Scénario B : l’extrait d’environ 2 minutes (celui qui plantait)

### Ce que ce test vérifie

L’app ne doit plus te dire trop tôt que YouTube n’envoie rien alors que le téléchargement tourne encore. Dans les logs, tu dois voir une seule grosse extraction au début (pas deux fois Deno d’affilée). À la fin, un fichier doit apparaître dans ton dossier de sortie.

### Préparation

- Vidéo YouTube **longue** (au moins 8 minutes), en **1080p** si possible. Tu peux reprendre la même vidéo qu’au moment du bug.
- Dans Dollyt : colle l’URL, clique pour **charger** la vidéo. Attends que le titre et la durée s’affichent.

### Réglages de l’extrait

1. Choisis un **preset** : **QUALITY MAX** ou **Source brute**.
2. Mode **extrait** (pas « vidéo entière »).
3. Règle le début et la fin pour environ **2 minutes** de segment (ex. de 2:00 à 3:05, ou 5:00 à 7:00). L’important : ~120 secondes, pas 5 secondes.

### Lancer l’export

1. Clique **Exporter** (ou équivalent qui envoie vers l’écran de téléchargement).
2. Note l’**heure Windows** au moment où tu cliques.
3. **Ne touche pas à Annuler** pendant **3 minutes** (même si le pourcentage bouge peu).

### Ce que tu dois voir à l’écran (dans l’ordre)

| Phase | Texte possible | Normal ? |
|-------|----------------|----------|
| Début | Préparation / analyse des formats | Oui |
| Milieu | Téléchargement vidéo | Oui |
| Parfois | « Téléchargement en cours, peu de retour d’étape » | Oui, mais **surtout pas** dans les 30 premières secondes après le début du téléchargement |
| Fin | Création du clip, puis terminé | Oui |

Pendant que le **%** ne bouge pas, ce n’est pas forcément une panne sur un extrait 1080p : le mux peut être silencieux une minute ou deux.

### Ce que tu dois voir dans les logs

Cherche ces indices (ordre approximatif) :

1. `job … démarré` avec `qualité=…` (souvent `299+251`, pas obligatoirement `251-18`).
2. Sur un **extrait**, tu peux voir `[youtube] Extracting URL` au téléchargement : **normal** en 1.2.5 (on n’utilise plus `load-info-json` avec les sections).
3. Tu ne dois **pas** voir `URLs are ignored due to --load-info-json` suivi d’un silence jusqu’à « aucune donnée depuis 120 s ».
4. Si le mux est muet : heartbeats `yt-dlp actif sans ligne depuis N s` toutes les ~30 s, et le job peut durer jusqu’à **5 min** avant abandon automatique (pas 2 min).
5. Horodatages = heure Windows (scénario A).

### Résultat

- **Réussi** : après quelques minutes max (souvent 2 à 5 min selon la vidéo), export **terminé** et fichier dans le dossier de sortie. Ou échec **clair** (403, réseau) avec message explicite sans rester bloqué indéfiniment.
- **Échoué** : avant 3 minutes tu es obligé d’annuler, aucun heartbeat dans les logs, ou message « YouTube n’envoie rien » (ancien libellé) alors que la version est bien 1.2.4.

---

## Scénario C : annuler puis relancer (file qui « mourait »)

### Ce que ce test vérifie

Après **Annuler**, tu peux enchaîner un autre export sans redémarrer l’app ni rester sur un écran d’erreur bloquant.

### Étapes

1. Même vidéo chargée qu’au scénario B.
2. Extrait **court** : 5 à 10 secondes seulement.
3. Lance l’export.
4. Quand la barre commence à bouger (vers 5–15 %), clique **Annuler**.
5. Observe l’écran : tu dois pouvoir **repartir** (accueil ou nouvel export), pas rester coincé sur une erreur rouge sans issue.
6. Relance **tout de suite** un 2ᵉ export (court ou le même 2 min qu’en B).
7. Cette fois **ne annule pas** : laisse aller 2 minutes minimum ou jusqu’à la fin.

### Résultat

- **Réussi** : le 2ᵉ job démarre, la progression repart, l’app répond encore.
- **Échoué** : le 2ᵉ job reste figé à ~5 %, plus rien ne démarre, ou l’UI reste en erreur après l’annulation.

---

## Scénario A : heure des logs (rapide)

1. Au lancement, regarde la ligne `application démarrée` dans les logs.
2. Compare avec l’horloge Windows (barre des tâches).

**Réussi** : même heure à une ou deux minutes près (ex. log `23:05` et Windows `23:05` ou `23:06`).  
**Échoué** : décalage d’**environ une heure** (c’était le bug UTC de l’ancienne version).

---

## Scénario D : file d’attente (optionnel)

1. Lance un export **long** (même extrait 2 min qu’en B).
2. Ouvre la **file** si ton parcours le permet, et ajoute un **2ᵉ** job (extrait 5 s).
3. Annule le **1er** pendant que le 2ᵉ attend.
4. Vérifie que le 2ᵉ passe en cours et progresse.

---

## Si tu dois signaler un bug

Dans l’app : **Copier tous les logs**. Envoie avec :

- Version **1.2.4** (installateur utilisé).
- Scénario lettré (B, C, …).
- Preset et durée d’extrait en secondes.
- Heure locale au moment du test.

Pas besoin de coller l’URL de la vidéo dans un message public si tu préfères.

---

## Ce qui n’est pas un bug Dollyt

- `Sleeping 4.00 seconds` dans les logs : pause imposée par YouTube.
- Pourcentage qui ne bouge pas 30–90 s sur un gros extrait 1080p, **si** les heartbeats `yt-dlp actif sans ligne` apparaissent.
- HTTP 403 : refus côté serveur (réseau, cookies, yt-dlp à jour depuis Paramètres).