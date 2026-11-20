# Scénario de validation export (1.2.4)

À exécuter sur **Windows x64** avec l’installateur du brouillon **Dollyt 1.2.4** (pas une ancienne 1.2.3).

## Prérequis

- Dossier de sortie défini dans **Paramètres**.
- Connexion stable. Si tu utilises des cookies, fichier ou Firefox déjà configuré.
- Console de diagnostic ouverte (**Afficher les logs**) pendant les tests.

---

## A. Heure des logs

1. Lance Dollyt.
2. Ouvre les logs.
3. Vérifie que la première ligne « application démarrée » a la **même heure** que l’horloge Windows (à la minute près).

**OK** : pas de décalage d’une heure.  
**KO** : note l’heure affichée vs l’heure système.

---

## B. Extrait ~2 min (cas qui bloquait)

**Objectif** : extrait court en qualité élevée, sans faux « YouTube n’envoie rien » trop tôt.

1. Colle l’URL d’une vidéo **≥ 8 minutes** en 1080p (ex. celle qui posait problème).
2. Charge la vidéo, attends la fin de l’analyse.
3. Définis un extrait **environ 120–185 s** (2 min).
4. Preset **QUALITY MAX** ou **Source brute**.
5. Lance l’export (un seul job).
6. Pendant l’export, observe l’UI et les logs pendant **au moins 3 minutes** avant toute annulation.

**Attendu dans les logs**

- Une ligne du type : `téléchargement yt-dlp avec métadonnées récentes (sans deuxième extraction)`.
- Pas de `[youtube] Extracting URL` **juste après** cette ligne au premier essai (le 403 peut forcer un 2ᵉ essai complet : normal).
- Horodatage local cohérent.
- Si mux muet : message périodique `yt-dlp actif sans ligne depuis N s` (toutes les ~30 s).
- Libellé d’attente tardif : « Téléchargement en cours, peu de retour d'étape » **pas avant ~45 s** après le début du téléchargement.

**OK** : fichier dans le dossier de sortie, ou erreur explicite (403, réseau) **avant** 3 min avec message clair.  
**KO** : annulation obligatoire avant 3 min sans progression ni heartbeat, ou heure log fausse.

---

## C. Annulation puis 2ᵉ export

1. Relance un export court (**5–10 s** d’extrait) sur la **même** vidéo.
2. Dès ~10 %, **Annuler**.
3. Vérifie : écran export **ne reste pas** bloqué en erreur rouge (retour utilisable).
4. Enchaîne un **2ᵉ** export (même extrait ou autre preset).
5. Laisse le 2ᵉ job aller au bout ou 2 min min.

**OK** : 2ᵉ job démarre, UI suivante, pas de « tout est mort ».  
**KO** : 2ᵉ job figé à ~5 %, file inactive, UI bloquée en erreur après annulation.

---

## D. File d’attente (optionnel)

1. Lance export job 1 (extrait long).
2. Sans attendre la fin, ajoute job 2 (extrait très court).
3. Annule job 1 quand job 2 est en file.
4. Vérifie que job 2 passe en actif et progresse.

---

## E. Ce qu’on envoie si ça casse

Copie **tous les logs** (bouton dans l’app). Indique :

- Version affichée (À propos / installateur 1.2.4).
- Scénario (B, C, …).
- Heure locale au moment du test.
- Preset et durée d’extrait (sans coller l’URL si tu préfères).

---

## Limites connues (pas un bug d’app)

- YouTube peut imposer une pause (`Sleeping X seconds`) ou refuser (HTTP 403).
- Un extrait 1080p60 peut rester **sans %** plusieurs dizaines de secondes pendant le mux : les heartbeats dans les logs confirment que le process vit.