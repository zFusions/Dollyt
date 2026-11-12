import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export function resolveLocalBin(name, platform = process.platform) {
  const suffix = platform === "win32" ? ".cmd" : "";
  return path.join(root, "node_modules", ".bin", `${name}${suffix}`);
}

function installDependencies() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["install", "--no-audit", "--no-fund"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error("Usage: node scripts/run-local-command.mjs <command> [...args]");
    process.exit(2);
  }

  let executable = resolveLocalBin(command);
  if (!existsSync(executable)) {
    console.log("Dépendances JavaScript absentes ou incomplètes ; installation en cours...");
    installDependencies();
    executable = resolveLocalBin(command);
  }

  if (!existsSync(executable)) {
    console.error(`Commande locale introuvable après installation : ${command}`);
    process.exit(1);
  }

  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}
