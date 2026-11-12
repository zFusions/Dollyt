import { EDITOR_QUARANTINED } from "../editorAvailability";
import type { Screen } from "../store";
import { NavIcon } from "./nav/NavIcons";

const ITEMS: { id: Screen; label: string; short: string }[] = [
  { id: "home", label: "Accueil", short: "Accueil" },
  { id: "editor", label: "Éditeur", short: "Montage" },
  { id: "presets", label: "Presets", short: "Presets" },
  { id: "settings", label: "Paramètres", short: "Réglages" },
  { id: "queue", label: "File", short: "File" },
];

type Props = {
  screen: Screen;
  onNav: (s: Screen) => void;
  editorEnabled: boolean;
  compact?: boolean;
};

export function NavRail({ screen, onNav, editorEnabled, compact }: Props) {
  return (
    <nav
      className={`rail${compact ? " rail--compact" : ""}`}
      aria-label="Navigation"
    >
      <div className="rail-brand">
        <strong>{compact ? "D" : "Dollyt"}</strong>
        {!compact ? <span className="meta">Clips YouTube</span> : null}
      </div>
      <div className="rail-nav">
        {(EDITOR_QUARANTINED
          ? ITEMS.filter((item) => item.id !== "editor")
          : ITEMS
        ).map((item) => {
          const disabled = item.id === "editor" && !editorEnabled;
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onNav(item.id)}
              className="rail-item"
              aria-current={active ? "page" : undefined}
              title={item.label}
            >
              <span className="rail-icon">
                <NavIcon id={item.id} />
              </span>
              <span className="rail-label">
                {compact ? item.short : item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
