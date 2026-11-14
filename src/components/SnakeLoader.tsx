import { SnakeGame } from "./SnakeGame";
import { t } from "../i18n";

type Props = { active: boolean };

export function SnakeLoader({ active }: Props) {
  if (!active) return null;

  return (
    <div className="home-snake" role="status" aria-live="polite">
      <p className="meta home-snake-hint">{t("snakeHint")}</p>
      <SnakeGame
        width={600}
        height={150}
        cols={30}
        rows={10}
        className="home-snake-canvas"
        ariaLabel={t("snakeAria")}
      />
    </div>
  );
}
