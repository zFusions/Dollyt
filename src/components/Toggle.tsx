type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
};

export function Switch({
  checked,
  onChange,
  label,
}: Pick<Props, "checked" | "onChange" | "label">) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    />
  );
}

export function Toggle({ checked, onChange, label, description }: Props) {
  if (!label) {
    return <Switch checked={checked} onChange={onChange} label={label} />;
  }
  return (
    <div className="set-row">
      <div className="set-line">
        <div className="set-text">
          <p className="set-label">{label}</p>
          {description ? <p className="set-hint">{description}</p> : null}
        </div>
        <Switch checked={checked} onChange={onChange} label={label} />
      </div>
    </div>
  );
}
