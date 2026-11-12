import { useEffect, useRef } from "react";

type Props = { active: boolean };

type Obstacle = {
  x: number;
  width: number;
  height: number;
  kind: "small" | "large";
  scored: boolean;
};

type Cloud = {
  x: number;
  y: number;
  width: number;
};

const WIDTH = 600;
const HEIGHT = 150;
const GROUND_Y = 122;
const DINO_X = 42;
const DINO_WIDTH = 44;
const DINO_HEIGHT = 42;

export function DinoLoader({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gravity = reduced ? 0.62 : 0.72;
    const jumpVelocity = reduced ? 12.5 : 14.5;
    let dinoY = 0;
    let velocityY = 0;
    let started = false;
    let gameOver = false;
    let score = 0;
    let speed = reduced ? 4.8 : 5.8;
    let frame = 0;
    let lastTime = 0;
    let obstacle: Obstacle = {
      x: WIDTH + 130,
      width: 18,
      height: 28,
      kind: "small",
      scored: false,
    };
    const clouds: Cloud[] = [
      { x: 118, y: 30, width: 34 },
      { x: 420, y: 50, width: 48 },
    ];

    const drawCloud = (cloud: Cloud) => {
      ctx.fillStyle = "rgb(154 143 131 / 0.16)";
      ctx.fillRect(cloud.x, cloud.y + 6, cloud.width, 2);
      ctx.fillRect(cloud.x + 8, cloud.y + 3, cloud.width - 18, 2);
      ctx.fillRect(cloud.x + 15, cloud.y, cloud.width - 28, 2);
    };

    const drawDino = () => {
      const top = GROUND_Y - DINO_HEIGHT - dinoY;
      const legOffset = started && !gameOver && frame % 12 < 6 ? 3 : 0;
      ctx.fillStyle = "#e9e1d3";
      ctx.fillRect(DINO_X + 9, top + 8, 27, 24);
      ctx.fillRect(DINO_X + 25, top, 17, 18);
      ctx.fillRect(DINO_X + 38, top + 5, 10, 9);
      ctx.fillRect(DINO_X + 2, top + 17, 12, 4);
      ctx.fillRect(DINO_X + 13, top + 30, 8, 12 + legOffset);
      ctx.fillRect(DINO_X + 29, top + 30, 8, 12 + (legOffset ? 0 : 3));
      ctx.fillStyle = "#110e0c";
      ctx.fillRect(DINO_X + 36, top + 5, 3, 3);
    };

    const drawObstacle = () => {
      const top = GROUND_Y - obstacle.height;
      ctx.fillStyle = "#9a8f83";
      ctx.fillRect(obstacle.x + 5, top, obstacle.width - 10, obstacle.height);
      ctx.fillRect(obstacle.x, top + 12, obstacle.width, 7);
      if (obstacle.kind === "large") {
        ctx.fillRect(obstacle.x + obstacle.width - 4, top + 7, 7, 8);
        ctx.fillRect(obstacle.x + 7, top + 4, 6, 8);
      }
    };

    const drawScene = (message?: string) => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#120e0c";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      clouds.forEach(drawCloud);
      ctx.fillStyle = "rgb(233 225 211 / 0.24)";
      ctx.fillRect(0, GROUND_Y, WIDTH, 1);
      ctx.fillStyle = "rgb(154 143 131 / 0.28)";
      for (let x = -((frame * speed) % 34); x < WIDTH; x += 34) {
        ctx.fillRect(x, GROUND_Y + 7, 14, 1);
      }
      drawDino();
      drawObstacle();
      ctx.fillStyle = "#9a8f83";
      ctx.font = "12px 'IBM Plex Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`SCORE ${String(score).padStart(3, "0")}`, WIDTH - 18, 20);
      if (message) {
        ctx.fillStyle = "#e9e1d3";
        ctx.font = "600 14px 'Instrument Sans', sans-serif";
        ctx.fillText(message, WIDTH - 18, 42);
      }
      ctx.textAlign = "left";
    };

    const reset = () => {
      dinoY = 0;
      velocityY = 0;
      score = 0;
      speed = reduced ? 4.8 : 5.8;
      frame = 0;
      obstacle = {
        x: WIDTH + 130,
        width: 18,
        height: 28,
        kind: "small",
        scored: false,
      };
      gameOver = false;
    };

    const jump = () => {
      if (!started || gameOver) {
        reset();
        started = true;
        lastTime = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (dinoY === 0 && velocityY === 0) velocityY = jumpVelocity;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "ArrowUp") return;
      event.preventDefault();
      jump();
    };

    const onTap = () => jump();

    const tick = (now: number) => {
      const delta = Math.min(34, now - lastTime || 16.67) / 16.67;
      lastTime = now;
      frame += 1;
      velocityY -= gravity * delta;
      dinoY += velocityY * delta;
      if (dinoY <= 0) {
        dinoY = 0;
        velocityY = 0;
      }

      obstacle.x -= speed * delta;
      if (!obstacle.scored && obstacle.x + obstacle.width < DINO_X) {
        obstacle.scored = true;
        score += 1;
        speed = Math.min(reduced ? 7.2 : 10.5, speed + 0.16);
      }
      if (obstacle.x + obstacle.width < -20) {
        const large = Math.random() > 0.62;
        obstacle = {
          x: WIDTH + 80 + Math.random() * 130,
          width: large ? 28 : 18,
          height: large ? 36 : 28,
          kind: large ? "large" : "small",
          scored: false,
        };
      }

      const dinoTop = GROUND_Y - DINO_HEIGHT - dinoY;
      const dinoRight = DINO_X + DINO_WIDTH - 5;
      const hit =
        obstacle.x < dinoRight &&
        obstacle.x + obstacle.width > DINO_X + 8 &&
        dinoTop + DINO_HEIGHT - 3 > GROUND_Y - obstacle.height;
      if (hit) {
        gameOver = true;
        started = false;
        drawScene("ESPACE POUR REJOUER");
        return;
      }

      drawScene();
      rafRef.current = requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        return;
      }
      if (started && !gameOver) {
        lastTime = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onTap);
    document.addEventListener("visibilitychange", onVisibilityChange);
    drawScene("ESPACE POUR COMMENCER");

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onTap);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="home-dino" role="status" aria-live="polite">
      <p className="meta home-dino-hint">Espace ou clic pour jouer</p>
      <canvas
        ref={canvasRef}
        className="home-dino-canvas"
        width={WIDTH}
        height={HEIGHT}
        aria-hidden
      />
    </div>
  );
}
