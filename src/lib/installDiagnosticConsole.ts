import { isTauri } from "@tauri-apps/api/core";
import { appendDiagnosticLog } from "../api/dollyt";

function describe(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`;
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function installDiagnosticConsole(): () => void {
  if (!isTauri()) return () => {};
  const originalError = console.error;
  const originalWarn = console.warn;

  const relay = (level: string, values: unknown[]) => {
    const message = values.map(describe).join(" ").slice(0, 4_000);
    if (message) void appendDiagnosticLog(`${level}: ${message}`).catch(() => {});
  };
  console.error = (...values) => {
    originalError(...values);
    relay("console.error", values);
  };
  console.warn = (...values) => {
    originalWarn(...values);
    relay("console.warn", values);
  };

  const onError = (event: ErrorEvent) => relay("window.error", [event.message, event.error]);
  const onRejection = (event: PromiseRejectionEvent) =>
    relay("unhandledrejection", [event.reason]);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    console.error = originalError;
    console.warn = originalWarn;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
