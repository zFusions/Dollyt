export type StoryboardMeta = {
  templateUrl: string;
  intervalSecs?: number | null;
  columns?: number | null;
  rows?: number | null;
  tileWidth?: number | null;
  tileHeight?: number | null;
};

export type StoryboardFrame = {
  sheetUrl: string;
  col: number;
  row: number;
  cols: number;
  rows: number;
};

function sheetUrlFor(sb: StoryboardMeta, sheet: number): string {
  const level = "0";
  return sb.templateUrl.replace(/\$L/g, level).replace(/\$N/g, String(sheet));
}

/** Une vignette découpée dans la planche storyboard YouTube. */
export function storyboardAtTime(
  sb: StoryboardMeta,
  timeSecs: number,
): StoryboardFrame | null {
  if (!sb.templateUrl) return null;
  const interval = Math.max(0.5, sb.intervalSecs ?? 10);
  const cols = Math.max(1, sb.columns ?? 5);
  const rows = Math.max(1, sb.rows ?? 5);
  const perSheet = cols * rows;
  const idx = Math.max(0, Math.floor(timeSecs / interval));
  const sheet = Math.floor(idx / perSheet);
  const inSheet = idx % perSheet;
  const col = inSheet % cols;
  const row = Math.floor(inSheet / cols);
  return {
    sheetUrl: sheetUrlFor(sb, sheet),
    col,
    row,
    cols,
    rows,
  };
}

/** Taille d’une tuile à partir des pixels réels de la planche (fiable). */
export function tileSizeFromSheet(
  sheetW: number,
  sheetH: number,
  frame: StoryboardFrame,
): { tw: number; th: number } {
  const cols = Math.max(1, frame.cols);
  const rows = Math.max(1, frame.rows);
  return {
    tw: Math.max(1, Math.floor(sheetW / cols)),
    th: Math.max(1, Math.floor(sheetH / rows)),
  };
}

/** Taille d’une tuile (yt-dlp donne parfois la planche entière). */
export function storyboardTileSize(
  sb: StoryboardMeta,
  frame: StoryboardFrame,
): { tw: number; th: number } {
  const cols = Math.max(1, frame.cols);
  const rows = Math.max(1, frame.rows);
  let tw = sb.tileWidth ?? 160;
  let th = sb.tileHeight ?? 90;
  if (tw > 400) tw = Math.max(48, Math.floor(tw / cols));
  if (th > 400) th = Math.max(27, Math.floor(th / rows));
  return { tw, th };
}

export function storyboardFramesForWindow(
  sb: StoryboardMeta,
  viewStart: number,
  viewSpan: number,
  count: number,
): StoryboardFrame[] {
  const n = Math.max(2, Math.min(count, 24));
  const out: StoryboardFrame[] = [];
  for (let i = 0; i < n; i++) {
    const t = viewStart + (viewSpan * i) / Math.max(n - 1, 1);
    const frame = storyboardAtTime(sb, t);
    if (frame) out.push(frame);
  }
  return out;
}
