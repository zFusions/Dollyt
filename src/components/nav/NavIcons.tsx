/** Icônes rail — assets fournis (masque + currentColor). */
import type { Screen } from "../../store";

const RAIL_ICON: Partial<Record<Screen, string>> = {
  home: "/icons/nav/accueil.png",
  presets: "/icons/nav/presets.png",
  settings: "/icons/nav/parametres.png",
  queue: "/icons/nav/file.png",
};

function RailAssetIcon({ id }: { id: Screen }) {
  const src = RAIL_ICON[id];
  if (!src) return null;
  return (
    <span
      className="rail-icon-asset"
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
      }}
      aria-hidden
    />
  );
}

/** Éditeur (quarantaine) — pas d’asset fourni. */
function NavEditorIcon() {
  return (
    <svg
      className="rail-icon-svg"
      xmlns="http://www.w3.org/2000/svg"
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function NavIcon({ id }: { id: Screen }) {
  if (id === "editor") return <NavEditorIcon />;
  return <RailAssetIcon id={id} />;
}
