const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

/** URL normalisée (https:// ajouté si absent) ou null si hôte non YouTube/invalide. */
export function normalizeYoutubeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let href = t;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(t)) href = `https://${t}`;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (!HOSTS.has(u.hostname.toLowerCase())) return null;
  return href;
}

export function validateYoutubeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Colle un lien YouTube pour continuer.";
  if (normalizeYoutubeUrl(t) === null) {
    return "Ce lien n’est pas valide ou ne vient pas de YouTube.";
  }
  return null;
}
