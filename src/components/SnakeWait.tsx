import { SnakeGame } from "./SnakeGame";
import { t } from "../i18n";

export function SnakeWait() {
  return (
    <div className="wait-snake-wrap">
      <SnakeGame
        width={520}
        height={168}
        cols={26}
        rows={11}
        className="wait-snake"
        ariaLabel={t("snakeAriaSteer")}
      />
    </div>
  );
}
