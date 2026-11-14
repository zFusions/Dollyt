import { useState } from "react";
import { PrimaryButton } from "./PrimaryButton";
import { t } from "../i18n";

type UpdateDialogProps = {
  version: string;
  body?: string | null;
  onInstall: () => void;
  onIgnore: () => void;
};

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string };

function inlineMd(text: string) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function parseBody(body: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: inlineMd(line.slice(3)) });
    } else if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: inlineMd(line.slice(4)) });
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      blocks.push({ kind: "li", text: inlineMd(line.slice(2)) });
    } else {
      blocks.push({ kind: "p", text: inlineMd(line) });
    }
  }
  return blocks;
}

export function UpdateDialog({
  version,
  body,
  onInstall,
  onIgnore,
}: UpdateDialogProps) {
  const [installing, setInstalling] = useState(false);
  const blocks = body ? parseBody(body) : [];

  async function handleInstall() {
    setInstalling(true);
    try {
      await onInstall();
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="set-dev-gate" role="presentation">
      <div className="set-dev-gate-card">
        <h2 className="set-dev-gate-title">
          {t("updateAvailable")} — v{version}
        </h2>
        <p className="meta set-dev-gate-lead">{t("updateAvailableSub")}</p>
        {blocks.length > 0 ? (
          <div className="update-notes">
            {blocks.map((block, i) => {
              if (block.kind === "h2") {
                return (
                  <h3 key={i} className="update-notes-h2">
                    {block.text}
                  </h3>
                );
              }
              if (block.kind === "h3") {
                return (
                  <h4 key={i} className="update-notes-h3">
                    {block.text}
                  </h4>
                );
              }
              if (block.kind === "li") {
                return (
                  <p key={i} className="update-notes-li">
                    <span aria-hidden>•</span> {block.text}
                  </p>
                );
              }
              return (
                <p key={i} className="update-notes-p">
                  {block.text}
                </p>
              );
            })}
          </div>
        ) : null}
        <div className="set-dev-gate-actions">
          <PrimaryButton
            variant="default"
            className="btn-sm"
            onClick={onIgnore}
            disabled={installing}
          >
            {t("ignoreUpdate")}
          </PrimaryButton>
          <PrimaryButton
            variant="primary"
            className="btn-sm"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? t("installingUpdate") : t("installUpdate")}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
