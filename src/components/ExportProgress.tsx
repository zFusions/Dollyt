type Props = {
  percent: number;
  label: string;
};

export function ExportProgress({ percent, label }: Props) {
  if (percent <= 0 && !label) return null;
  const p = Math.min(100, Math.max(0, percent)) / 100;
  return (
    <div className="space-y-2">
      {label ? <p className="meta">{label}</p> : null}
      <div className="meter" aria-hidden>
        <span style={{ transform: `scaleX(${p})`, width: "100%" }} />
      </div>
    </div>
  );
}
