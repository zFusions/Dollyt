import { EDITOR_QUARANTINED } from "../editorAvailability";
import type { Screen } from "../store";
import { NavIcon } from "./nav/NavIcons";
import { t, type MessageKey } from "../i18n";

type NavItem = { id: Screen; labelKey: MessageKey; shortKey: MessageKey };

const ITEMS: NavItem[] = [
  { id: "home", labelKey: "home", shortKey: "home" },
  { id: "editor", labelKey: "editor", shortKey: "editorShort" },
  { id: "presets", labelKey: "presets", shortKey: "presets" },
  { id: "settings", labelKey: "settings", shortKey: "settingsShort" },
  { id: "queue", labelKey: "history", shortKey: "history" },
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
      aria-label={t("navigation")}
    >
      <div className="rail-brand">
        <strong>
          <img className="brand-mark" src="/logo-red.png" alt="" aria-hidden />
          {!compact ? "Dollyt" : null}
        </strong>
        {!compact ? <span className="meta">{t("youtubeClips")}</span> : null}
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
              title={t(item.labelKey)}
            >
              <span className="rail-icon">
                <NavIcon id={item.id} />
              </span>
              <span className="rail-label">
                {compact ? t(item.shortKey) : t(item.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
