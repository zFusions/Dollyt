import { useSyncExternalStore } from "react";

export type Locale = "fr" | "en";
const LOCALE_KEY = "dollyt.locale.v1";
const listeners = new Set<() => void>();
const detectedLocale: Locale =
  typeof navigator !== "undefined" &&
  (navigator.language.toLowerCase().startsWith("fr") ||
    navigator.languages?.some((value) => value.toLowerCase().startsWith("fr")))
    ? "fr"
    : "en";
let locale: Locale =
  typeof localStorage !== "undefined" &&
  (localStorage.getItem(LOCALE_KEY) === "fr" || localStorage.getItem(LOCALE_KEY) === "en")
    ? (localStorage.getItem(LOCALE_KEY) as Locale)
    : detectedLocale;

const messages = {
  fr: {
    homeTitle: "De l’URL YouTube à l’extrait, sans friction",
    homeLead: "Colle un lien, choisis un preset, règle l’extrait si tu veux, puis enregistre le fichier chez toi.",
    newLink: "Nouveau lien",
    launch: "Lancer",
    presets: "Presets",
    settings: "Paramètres",
    queue: "Historique",
    historyTitle: "Historique",
    historySub: "Retrouve tes exports et leur vidéo d’origine.",
    emptyHistory: "Aucun export pour le moment",
    emptyHistorySub: "Ton prochain extrait apparaîtra ici automatiquement.",
    openFolder: "Ouvrir le dossier",
    fullVideoHistory: "Vidéo entière",
    clipHistory: "Extrait",
    pasteUrl: "Colle ton lien YouTube",
    download: "Télécharger",
    exporting: "Export…",
    quality: "Qualité",
    range: "Portée",
    fullVideo: "Vidéo entière",
    clip: "Extrait",
    start: "Début (s)",
    end: "Fin (s)",
    chooseOutput: "Choisis d’abord un dossier de sortie dans Paramètres.",
    outputFolder: "Dossier de sortie",
    browse: "Parcourir…",
    noFolder: "Aucun dossier choisi",
    outputHint: "Choisis le dossier où Dollyt enregistrera tes extraits",
    save: "Enregistrer",
    export: "Export",
    savedLocally: "Tout reste sur ton PC, sans envoi vers un serveur Dollyt.",
    deleteHistory: "Supprimer cette entrée",
    confirmDeleteHistory: "Supprimer cette vidéo de l’historique ?",
    cancel: "Annuler",
    delete: "Supprimer",
    recentExports: "Exports récents",
    language: "Langue",
    french: "Français",
    english: "Anglais",
    preparingVideo: "Préparation de la vidéo",
    downloadingVideo: "Téléchargement de la vidéo",
    creatingClip: "Création de ton extrait",
    done: "Terminé",
    preparingClip: "Préparation de ton extrait",
    clipReady: "Ton extrait est prêt",
    clipReadySub: "Tu peux le regarder ou en créer un autre.",
    restart: "Recommencer",
    newClip: "Nouvel extrait",
    openFile: "Ouvrir le fichier",
    exportFailed: "On n’a pas pu créer ton extrait.",
    retry: "Réessayer",
    retryHint: "Réessaie avec le même lien.",
    preview: "Aperçu",
    updateAvailable: "Mise à jour disponible",
    updateAvailableSub: "Une nouvelle version de Dollyt est disponible.",
    installUpdate: "Installer",
    ignoreUpdate: "Ignorer",
    autoUpdate: "Mise à jour automatique",
    autoUpdateHint: "Vérifie les mises à jour au démarrage.",
    checkUpdate: "Vérifier maintenant",
    noUpdate: "Dollyt est à jour",
    noUpdateSub: "Tu as déjà la dernière version.",
    updateError: "Erreur lors de la vérification",
    installingUpdate: "Installation de la mise à jour…",
  },
  en: {
    homeTitle: "From YouTube URL to clip, without the hassle",
    homeLead: "Paste a link, choose a preset, adjust the clip if you want, then save the file on your computer.",
    newLink: "New link",
    launch: "Start",
    presets: "Presets",
    settings: "Settings",
    queue: "History",
    historyTitle: "History",
    historySub: "Find your exports and their source video.",
    emptyHistory: "No exports yet",
    emptyHistorySub: "Your next clip will appear here automatically.",
    openFolder: "Open folder",
    fullVideoHistory: "Full video",
    clipHistory: "Clip",
    pasteUrl: "Paste your YouTube link",
    download: "Download",
    exporting: "Exporting…",
    quality: "Quality",
    range: "Range",
    fullVideo: "Full video",
    clip: "Clip",
    start: "Start (s)",
    end: "End (s)",
    chooseOutput: "Choose an output folder in Settings first.",
    outputFolder: "Output folder",
    browse: "Browse…",
    noFolder: "No folder selected",
    outputHint: "Choose where Dollyt should save your clips",
    save: "Save",
    export: "Export",
    savedLocally: "Everything stays on your computer. Nothing is sent to a Dollyt server.",
    deleteHistory: "Delete this entry",
    confirmDeleteHistory: "Remove this video from history?",
    cancel: "Cancel",
    delete: "Delete",
    recentExports: "Recent exports",
    language: "Language",
    french: "French",
    english: "English",
    preparingVideo: "Preparing video",
    downloadingVideo: "Downloading video",
    creatingClip: "Creating your clip",
    done: "Done",
    preparingClip: "Preparing your clip",
    clipReady: "Your clip is ready",
    clipReadySub: "Watch it or create another one.",
    restart: "Start over",
    newClip: "New clip",
    openFile: "Open file",
    exportFailed: "We couldn’t create your clip.",
    retry: "Retry",
    retryHint: "Try again with the same link.",
    preview: "Preview",
    updateAvailable: "Update available",
    updateAvailableSub: "A new version of Dollyt is available.",
    installUpdate: "Install",
    ignoreUpdate: "Ignore",
    autoUpdate: "Automatic updates",
    autoUpdateHint: "Check for updates on startup.",
    checkUpdate: "Check now",
    noUpdate: "Dollyt is up to date",
    noUpdateSub: "You already have the latest version.",
    updateError: "Error checking for updates",
    installingUpdate: "Installing update…",
  },
} as const;

export type MessageKey = keyof typeof messages.fr;

export function t(key: MessageKey): string {
  return messages[locale][key];
}

export function currentLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  locale = next;
  if (typeof localStorage !== "undefined") localStorage.setItem(LOCALE_KEY, next);
  listeners.forEach((listener) => listener());
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => locale,
    () => locale,
  );
}
