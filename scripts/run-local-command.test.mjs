import test from "node:test";
import assert from "node:assert/strict";
import { resolveLocalBin } from "./run-local-command.mjs";

test("resolves the Windows executable for a local package binary", () => {
  const bin = resolveLocalBin("tauri", "win32");
  assert.match(bin, /node_modules[\\/]\.bin[\\/]tauri\.cmd$/);
});
