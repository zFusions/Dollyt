type Props = {
  percent: number;
  label: string;
};

export function ExportProgress({ percent, label }: Props) {
  if (percent <= 0 && !label) return null;
  return (
    <div className="mt-3 space-y-1">
      <p className="font-mono text-xs text-text-dim">{label}</p>
      <div className="h-px w-full overflow-hidden bg-line">
        <div
          className="h-px origin-left bg-safelight transition-transform duration-200"
          style={{
            transform: `scaleX(${Math.min(100, Math.max(0, percent)) / 100})`,
            width: "100%",
          }}
        />
      </div>
    </div>
  );
}
