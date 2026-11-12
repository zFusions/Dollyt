import { useEffect, useRef } from "react";

/** Mini saut pendant le téléchargement — palette Chambre noire. */
export function WaitDino() {
  const ref = useRef<HTMLCanvasElement>(null);
  const jumpRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.focus();
    const w = canvas.width;
    const h = canvas.height;
    const ground = h - 22;
    const dinoX = 36;
    const dinoW = 26;
    const dinoH = 30;
    let y = ground - dinoH;
    let vy = 0;
    let frame = 0;
    let xObs = w + 420;
    let speed = 3.1;
    let score = 0;
    let alive = true;
    let grace = 150;
    let raf = 0;
    let cloudX = w * 0.6;

    const reset = () => {
      alive = true;
      y = ground - dinoH;
      vy = 0;
      xObs = w + 320;
      speed = 3.1;
      grace = 100;
      frame = 0;
    };

    const grounded = () =>
      alive && y >= ground - dinoH - 1 && Math.abs(vy) < 0.6;

    const jump = () => {
      if (!alive) {
        reset();
        return;
      }
      if (grounded()) vy = -10.2;
    };
    jumpRef.current = jump;

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.code !== "ArrowUp") return;
      e.preventDefault();
      e.stopPropagation();
      jump();
    };
    window.addEventListener("keydown", onKey, true);
    const focusSoon = window.setTimeout(() => canvas.focus(), 0);
    const refocus = window.setInterval(() => canvas.focus(), 800);
    const stopRefocus = window.setTimeout(() => window.clearInterval(refocus), 8000);

    const drawCactus = (x: number) => {
      const gh = 26;
      ctx.fillStyle = "#9A8F83";
      ctx.fillRect(x, ground - gh, 10, gh);
      ctx.fillRect(x - 6, ground - gh + 10, 8, 5);
      ctx.fillRect(x + 8, ground - gh + 14, 8, 5);
    };

    const drawDinoAlive = () => {
      const leg = grounded() && frame % 20 < 10 ? 2 : 0;
      ctx.fillStyle = "#E9E1D3";
      roundRect(ctx, dinoX, y, dinoW, dinoH, 4);
      ctx.fill();
      ctx.fillStyle = "#110E0C";
      ctx.fillRect(dinoX + 16, y + 8, 3, 3);
      if (grounded()) {
        ctx.fillRect(dinoX + 4, y + dinoH - 4, 8, 4 + leg);
        ctx.fillRect(dinoX + 14, y + dinoH - 4, 8, 4 - leg);
      }
      ctx.fillStyle = "#E03A1E";
      ctx.fillRect(dinoX + 20, y + 12, 6, 3);
    };

    const drawDinoDead = () => {
      ctx.save();
      ctx.translate(dinoX + 8, ground - 6);
      ctx.rotate(-Math.PI / 2.2);
      ctx.fillStyle = "#9A8F83";
      roundRect(ctx, 0, -dinoH, dinoW, dinoH, 4);
      ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      frame += 1;
      if (grace > 0) grace -= 1;
      if (alive) {
        vy += 0.48;
        y += vy;
        if (y > ground - dinoH) {
          y = ground - dinoH;
          vy = 0;
        }
        xObs -= speed;
        cloudX -= 0.15;
        if (cloudX < -80) cloudX = w + 40;
        if (xObs < -24) {
          xObs = w + 120 + Math.random() * 240;
          speed = Math.min(8.5, speed + 0.05);
          score += 1;
        }
        if (grace <= 0) {
          const hit =
            xObs < dinoX + dinoW - 10 &&
            xObs + 10 > dinoX + 10 &&
            y + dinoH > ground - 24;
          if (hit) alive = false;
        }
      }

      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#181411");
      g.addColorStop(0.45, "#110E0C");
      g.addColorStop(1, "#0A0807");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = "rgb(255 255 255 / 0.04)";
      ctx.fillRect(cloudX, 24, 44, 10);
      ctx.fillRect(cloudX + 28, 20, 36, 10);

      ctx.fillStyle = "rgb(255 255 255 / 0.06)";
      ctx.fillRect(0, ground, w, 1);
      ctx.fillStyle = "#191919";
      ctx.fillRect(0, ground + 1, w, h - ground);

      if (alive) drawCactus(xObs);
      if (alive) drawDinoAlive();
      else drawDinoDead();

      ctx.font = "12px IBM Plex Mono, ui-monospace, monospace";
      ctx.fillStyle = alive ? "#62594F" : "#E03A1E";
      ctx.fillText(
        alive ? String(score) : "Clic ou Espace pour rejouer",
        14,
        20,
      );
      ctx.fillStyle = "rgb(224 58 30 / 0.35)";
      ctx.fillRect(0, 0, w, 2);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(focusSoon);
      window.clearTimeout(stopRefocus);
      window.clearInterval(refocus);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  return (
    <div
      className="wait-dino-wrap"
      onPointerDown={(e) => {
        e.preventDefault();
        ref.current?.focus();
        jumpRef.current();
      }}
    >
      <canvas
        ref={ref}
        width={520}
        height={168}
        tabIndex={0}
        className="wait-dino"
        aria-label="Mini-jeu : espace ou clic pour sauter"
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
