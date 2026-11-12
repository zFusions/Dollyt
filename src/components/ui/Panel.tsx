import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function PanelHead({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="panel-head panel-pad !pb-0">
      <h2 className="section-title">{title}</h2>
      {hint ? <p className="meta">{hint}</p> : null}
    </div>
  );
}

export function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="set-row">
      <div className="set-line">
        <div className="set-text">
          <p className="set-label">{label}</p>
          {hint ? <p className="set-hint">{hint}</p> : null}
        </div>
        <div className="set-control">{children}</div>
      </div>
    </div>
  );
}
