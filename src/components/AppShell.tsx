import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-bg text-text">
      <Vignette />
      <div className="room-halo" aria-hidden />
      <div className="room-grain" aria-hidden />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}

function Vignette() {
  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{
        background:
          "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)",
      }}
      aria-hidden
    />
  );
}
