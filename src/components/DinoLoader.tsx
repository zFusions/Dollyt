import { useEffect, useRef } from "react";

type Props = { active: boolean };

export function DinoLoader({ active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const ground = h - 14;
    let frame = 0;
    let dinoY = 0;
    let vy = 0;
    let jumping = false;
    const obstacles: { x: number; w: number }[] = [{ x: w + 40, w: 10 }];
    let speed = 3.2;
    let leg = 0;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const jump = () => {
      if (!jumping && dinoY <= 0) {
        vy = reduced ? 0 : -7.2;
        jumping = true;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    const onTap = () => jump();
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onTap);

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgb(18 14 12 / 0.92)";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgb(154 143 131 / 0.35)";
      ctx.beginPath();
      ctx.moveTo(0, ground + 0.5);
      ctx.lineTo(w, ground + 0.5);
      ctx.stroke();

      vy += 0.42;
      dinoY += vy;
      if (dinoY > 0) {
        dinoY = 0;
        vy = 0;
        jumping = false;
      }

      const dx = 28;
      const dy = ground - 22 + dinoY;
      ctx.fillStyle = "#e9e1d3";
      ctx.fillRect(dx, dy, 20, 22);
      leg = frame % 12 < 6 ? 0 : 3;
      ctx.fillRect(dx + 2, dy + 22, 6, 4 + leg);
      ctx.fillRect(dx + 12, dy + 22, 6, 4 + (leg ? 0 : 3));

      for (const ob of obstacles) {
        ob.x -= speed;
        ctx.fillStyle = "#9a8f83";
        ctx.fillRect(ob.x, ground - 16, ob.w, 16);
      }
      if (obstacles[0].x < -20) {
        obstacles[0].x = w + 30 + Math.random() * 80;
      }

      speed = Math.min(5.5, 3.2 + frame / 2800);

      rafRef.current = requestAnimationFrame(tick);
    };

    if (reduced) {
      ctx.fillStyle = "rgb(18 14 12 / 0.92)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#9a8f83";
      ctx.font = "12px sans-serif";
      ctx.fillText("Export en cours…", 16, h / 2);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onTap);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="home-dino" role="status" aria-live="polite">
      <p className="meta home-dino-hint">Espace ou clic pour sauter</p>
      <canvas
        ref={canvasRef}
        className="home-dino-canvas"
        width={360}
        height={96}
        aria-hidden
      />
    </div>
  );
}
