import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveLocalBin, resolveLocalBinScript } from "./run-local-command.mjs";

test("resolves the Windows executable for a local package binary", () => {
  const bin = resolveLocalBin("tauri", "win32");
  assert.match(bin, /node_modules[\\/]\.bin[\\/]tauri\.cmd$/);
});

test("resolves JavaScript entry points so local commands work from paths with spaces", () => {
  assert.equal(
    path.relative(path.resolve("node_modules"), resolveLocalBinScript("vite")),
    path.join("vite", "bin", "vite.js"),
  );
  assert.equal(
    path.relative(path.resolve("node_modules"), resolveLocalBinScript("tauri")),
    path.join("@tauri-apps", "cli", "tauri.js"),
  );
});
