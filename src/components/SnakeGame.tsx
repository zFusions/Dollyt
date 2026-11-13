import { useEffect, useRef } from "react";

type Props = {
  width: number;
  height: number;
  cols?: number;
  rows?: number;
  className?: string;
  ariaLabel?: string;
};

type Cell = { x: number; y: number };

const BG = "#110e0c";
const SNAKE = "#e9e1d3";
const HEAD = "#f4ede1";
const FOOD = "#e03a1e";
const DIM = "#62594f";
const TEXT = "#9a8f83";
const TICK_START = 150;
const TICK_MIN = 70;

/** Mini-jeu Snake — palette Chambre noire, flèches ou glisser pour diriger. */
export function SnakeGame({
  width,
  height,
  cols = 28,
  rows = 10,
  className,
  ariaLabel = "Mini-jeu Snake",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const ctx: CanvasRenderingContext2D = context;

    const cw = width / cols;
    const ch = height / rows;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cy = Math.floor(rows / 2);
    const cx = Math.floor(cols / 2);
    let snake: Cell[] = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    let dir: Cell = { x: 1, y: 0 };
    let queue: Cell[] = [];
    let food: Cell = { x: cols - 2, y: 1 };
    let score = 0;
    let started = false;
    let dead = false;
    let timer = 0;
    let swipe: { x: number; y: number } | null = null;
    let occupied = new Set<string>();
    for (const s of snake) occupied.add(`${s.x},${s.y}`);
    occupied.add(`${food.x},${food.y}`);

    function freeCell(): Cell {
      for (let tries = 0; tries < 800; tries += 1) {
        const cell = {
          x: Math.floor(Math.random() * cols),
          y: Math.floor(Math.random() * rows),
        };
        if (!occupied.has(`${cell.x},${cell.y}`)) return cell;
      }
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (!occupied.has(`${x},${y}`)) return { x, y };
        }
      }
      return { x: 0, y: 0 };
    }

    function reset() {
      snake = [
        { x: cx, y: cy },
        { x: cx - 1, y: cy },
        { x: cx - 2, y: cy },
      ];
      dir = { x: 1, y: 0 };
      queue = [];
      occupied.clear();
      for (const s of snake) occupied.add(`${s.x},${s.y}`);
      food = freeCell();
      occupied.add(`${food.x},${food.y}`);
      score = 0;
      started = true;
      dead = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, TICK_START);
    }

    function pushDir(next: Cell) {
      const last = queue.length ? queue[queue.length - 1] : dir;
      if (next.x === -last.x && next.y === -last.y) return;
      if (next.x === last.x && next.y === last.y) return;
      if (queue.length < 3) queue.push(next);
    }

    function tick() {
      const interval = Math.max(TICK_MIN, TICK_START - score * 3);
      if (queue.length) dir = queue.shift() as Cell;
      // Wrap-around : les bords sont traversables, seule la queue tue.
      const head = {
        x: (snake[0].x + dir.x + cols) % cols,
        y: (snake[0].y + dir.y + rows) % rows,
      };
      const hitSelf = snake.some(
        (s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y,
      );
      if (hitSelf) {
        dead = true;
        started = false;
        draw();
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 1;
        occupied.add(`${head.x},${head.y}`);
        food = freeCell();
        occupied.add(`${food.x},${food.y}`);
      } else {
        const tail = snake.pop();
        if (tail) occupied.delete(`${tail.x},${tail.y}`);
      }
      draw();
      timer = window.setTimeout(tick, interval);
    }

    function cellRect(c: Cell, pad: number) {
      return {
        x: c.x * cw + pad,
        y: c.y * ch + pad,
        w: cw - pad * 2,
        h: ch - pad * 2,
      };
    }

    function draw() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, width, height);

      // La pomme est toujours visible : jamais sous une case du serpent.
      if (occupied.has(`${food.x},${food.y}`)) {
        occupied.delete(`${food.x},${food.y}`);
        food = freeCell();
        occupied.add(`${food.x},${food.y}`);
      }
      const f = cellRect(food, Math.min(cw, ch) * 0.22);
      ctx.fillStyle = FOOD;
      ctx.fillRect(f.x, f.y, f.w, f.h);

      snake.forEach((c, i) => {
        const pad = i === 0 ? Math.min(cw, ch) * 0.12 : Math.min(cw, ch) * 0.2;
        const r = cellRect(c, pad);
        ctx.fillStyle = i === 0 ? HEAD : SNAKE;
        ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i / (snake.length + 8));
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      if (snake.length) {
        const h = snake[0];
        const hx = h.x * cw + cw / 2 + dir.x * cw * 0.14;
        const hy = h.y * ch + ch / 2 + dir.y * ch * 0.14;
        const px = -dir.y;
        const py = dir.x;
        ctx.fillStyle = BG;
        ctx.beginPath();
        ctx.arc(hx + px * 2.2, hy + py * 2.2, 1.5, 0, Math.PI * 2);
        ctx.arc(hx - px * 2.2, hy - py * 2.2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = "12px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = DIM;
      ctx.fillText(`SCORE ${String(score).padStart(3, "0")}`, 12, 18);

      ctx.textAlign = "center";
      if (dead) {
        ctx.fillStyle = FOOD;
        ctx.fillText("ESPACE POUR REJOUER", width / 2, height - 12);
      } else if (!started) {
        ctx.fillStyle = TEXT;
        ctx.fillText("FLÈCHES POUR COMMENCER", width / 2, height - 12);
      }
      ctx.textAlign = "left";
    }

    function onKey(event: KeyboardEvent) {
      const dirs: Record<string, Cell> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        KeyW: { x: 0, y: -1 },
        KeyS: { x: 0, y: 1 },
        KeyA: { x: -1, y: 0 },
        KeyD: { x: 1, y: 0 },
      };
      const next = dirs[event.code];
      if (event.code === "Space" || event.code === "Enter" || next) {
        event.preventDefault();
      }
      if (!started || dead) {
        if (event.code === "Space" || event.code === "Enter" || next) {
          reset();
          if (next) pushDir(next);
        }
        return;
      }
      if (next) pushDir(next);
    }

    function onPointerDown(event: PointerEvent) {
      if (!started || dead) {
        reset();
        return;
      }
      swipe = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(event: PointerEvent) {
      if (!swipe || !started || dead) {
        swipe = null;
        return;
      }
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      pushDir(
        Math.abs(dx) > Math.abs(dy)
          ? { x: Math.sign(dx), y: 0 }
          : { x: 0, y: Math.sign(dy) },
      );
    }

    function onVisibility() {
      window.clearTimeout(timer);
      if (document.hidden) return;
      if (started && !dead) timer = window.setTimeout(tick, 60);
    }

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    document.addEventListener("visibilitychange", onVisibility);
    draw();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [width, height, cols, rows]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height }}
      role="img"
      aria-label={ariaLabel}
    />
  );
}
