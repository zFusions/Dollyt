import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function PrimaryButton({
  variant = "primary",
  className = "",
  ...props
}: Props) {
  const base =
    "rounded-[2px] px-4 py-2 text-sm transition-[opacity,transform] duration-200 disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-safelight text-bg font-sans hover:opacity-90"
      : "border border-line bg-transparent text-text-dim hover:border-line-strong hover:text-text";
  return <button type="button" className={`${base} ${styles} ${className}`} {...props} />;
}
