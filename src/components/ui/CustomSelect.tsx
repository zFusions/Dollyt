import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PresetAppIcon } from "../presets/PresetAppIcon";

export type SelectOption = {
  value: string;
  label: string;
  iconId?: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  ariaLabel?: string;
  placement?: "down" | "up";
};

export function CustomSelect({
  value,
  options,
  onChange,
  disabled,
  className = "",
  triggerClassName = "",
  ariaLabel,
  placement = "down",
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const placeMenu = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxDown = window.innerHeight - rect.bottom - gap - 12;
    const maxUp = rect.top - gap - 12;
    const preferUp = placement === "up" || (maxDown < 160 && maxUp > maxDown);
    const maxHeight = Math.min(280, Math.max(120, preferUp ? maxUp : maxDown));
    const top = preferUp ? rect.top - gap - maxHeight : rect.bottom + gap;
    setMenuRect({
      top: Math.max(8, top),
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    placeMenu();
    const onResize = () => placeMenu();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const menuEl = document.getElementById(listId);
      if (menuEl?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, listId]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const menu =
    open && menuRect
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            className="custom-select-menu"
            style={{
              top: menuRect.top,
              left: menuRect.left,
              width: menuRect.width,
              maxHeight: menuRect.maxHeight,
            }}
          >
            {options.map((opt) => (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className="custom-select-option"
                  data-selected={opt.value === value ? true : undefined}
                  onClick={() => pick(opt.value)}
                >
                  <span className="custom-select-option-inner">
                    {opt.iconId ? (
                      <PresetAppIcon presetId={opt.iconId} />
                    ) : null}
                    <span>{opt.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className={`custom-select ${className}`.trim()}
        ref={rootRef}
        data-open={open || undefined}
      >
        <button
          ref={triggerRef}
          type="button"
          className={`custom-select-trigger ${triggerClassName}`.trim()}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={ariaLabel ?? selected?.label}
          onClick={() => !disabled && setOpen((v) => !v)}
        >
          <span className="custom-select-option-inner custom-select-trigger-inner">
            {selected?.iconId ? (
              <PresetAppIcon presetId={selected.iconId} />
            ) : null}
            <span className="custom-select-value">
              {selected?.label ?? "Choisir…"}
            </span>
          </span>
          <span className="custom-select-chevron" aria-hidden />
        </button>
      </div>
      {menu}
    </>
  );
}
