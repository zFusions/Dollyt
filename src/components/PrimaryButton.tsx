import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "default";
  block?: boolean;
  play?: boolean;
};

export function PrimaryButton({
  variant = "primary",
  block = false,
  play = false,
  className = "",
  type = "button",
  ...props
}: Props) {
  const parts = ["btn"];
  if (variant === "primary") parts.push("btn-primary");
  else if (variant === "ghost") parts.push("btn-ghost");
  if (block) parts.push("btn-block");
  if (play) parts.push("btn-play");
  return (
    <button
      type={type}
      className={`${parts.join(" ")} ${className}`.trim()}
      {...props}
    />
  );
}
