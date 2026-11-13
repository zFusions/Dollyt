import { SnakeGame } from "./SnakeGame";

/** Mini snake pendant le téléchargement — palette Chambre noire. */
export function SnakeWait() {
  return (
    <div className="wait-snake-wrap">
      <SnakeGame
        width={520}
        height={168}
        cols={26}
        rows={11}
        className="wait-snake"
        ariaLabel="Mini-jeu Snake : flèches ou glisser pour diriger"
      />
    </div>
  );
}
