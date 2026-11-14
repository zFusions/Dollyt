import { useState } from "react";
import { t } from "../i18n";

type Props = { text: string; className?: string };

export function CopyButton({ text, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      className={`btn btn-sm ${className}`.trim()}
      onClick={() => void copy()}
    >
      {copied ? t("copiedFeedback") : t("copyAction")}
    </button>
  );
}
