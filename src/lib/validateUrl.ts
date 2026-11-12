const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

export function validateYoutubeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Colle un lien YouTube pour continuer.";
  let href = t;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(t)) href = `https://${t}`;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return "Ce lien n’est pas valide.";
  }
  if (!HOSTS.has(u.hostname.toLowerCase())) {
    return "Seuls les liens YouTube (watch, youtu.be, /shorts) sont acceptés.";
  }
  return null;
}
