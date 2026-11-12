export type Locale = "fr" | "en";

const locale: Locale =
  typeof navigator !== "undefined" &&
  (navigator.language.toLowerCase().startsWith("fr") ||
    navigator.languages?.some((value) => value.toLowerCase().startsWith("fr")))
    ? "fr"
    : "en";

const messages = {
  fr: {
    homeTitle: "De l’URL YouTube à l’extrait, sans friction",
    homeLead: "Colle un lien, choisis un preset, règle l’extrait si tu veux, puis enregistre le fichier chez toi.",
    newLink: "Nouveau lien",
    launch: "Lancer",
    presets: "Presets",
    settings: "Paramètres",
    queue: "File",
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
  },
  en: {
    homeTitle: "From YouTube URL to clip, without the hassle",
    homeLead: "Paste a link, choose a preset, adjust the clip if you want, then save the file on your computer.",
    newLink: "New link",
    launch: "Start",
    presets: "Presets",
    settings: "Settings",
    queue: "Queue",
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
  },
} as const;

export type MessageKey = keyof typeof messages.fr;

export function t(key: MessageKey): string {
  return messages[locale][key];
}

export function currentLocale(): Locale {
  return locale;
}
