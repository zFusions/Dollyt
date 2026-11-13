import { SnakeGame } from "./SnakeGame";

/** Mini snake pendant le téléchargement — palette Chambre noire. */
export function WaitDino() {
  return (
    <div className="wait-dino-wrap">
      <SnakeGame
        width={520}
        height={168}
        cols={26}
        rows={11}
        className="wait-dino"
        ariaLabel="Mini-jeu Snake : flèches ou glisser pour diriger"
      />
    </div>
  );
}
