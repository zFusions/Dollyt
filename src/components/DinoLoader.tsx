import { SnakeGame } from "./SnakeGame";

type Props = { active: boolean };

export function DinoLoader({ active }: Props) {
  if (!active) return null;

  return (
    <div className="home-dino" role="status" aria-live="polite">
      <p className="meta home-dino-hint">Flèches, glisser ou clic pour jouer</p>
      <SnakeGame
        width={600}
        height={150}
        cols={30}
        rows={10}
        className="home-dino-canvas"
        ariaLabel="Mini-jeu Snake"
      />
    </div>
  );
}
