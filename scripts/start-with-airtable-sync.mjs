import { spawn } from "node:child_process";

function isEnabled(value, fallback) {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;

  return fallback;
}

const port = process.env.PORT?.trim() || "7171";
const shouldStartSyncLoop = isEnabled(process.env.AIRTABLE_SYNC_AUTOSTART, true);
const children = new Set();
let shuttingDown = false;
let exitTimer = null;
let shutdownExitCode = 0;

function spawnChild(command, args, name) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown && children.size === 0) {
      if (exitTimer) clearTimeout(exitTimer);
      process.exit(shutdownExitCode);
    }

    if (shuttingDown) return;

    const suffix = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.error(`[startup] ${name} exited with ${suffix}`);
    shutdown(signal ?? "SIGTERM", code ?? 1);
  });

  child.on("error", (error) => {
    if (shuttingDown) return;

    console.error(`[startup] failed to start ${name}: ${error.message}`);
    shutdown("SIGTERM", 1);
  });

  return child;
}

function shutdown(signal, exitCode = 0) {
  if (!shuttingDown) {
    shuttingDown = true;
  }

  shutdownExitCode = exitCode;

  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }

  if (children.size === 0) {
    process.exit(exitCode);
  }

  if (!exitTimer) {
    exitTimer = setTimeout(() => {
      process.exit(exitCode);
    }, 5_000);
  }
}

process.on("SIGINT", () => shutdown("SIGINT", 0));
process.on("SIGTERM", () => shutdown("SIGTERM", 0));

spawnChild("pnpm", ["start:server", "-p", port], "app");

if (shouldStartSyncLoop) {
  spawnChild("node", ["scripts/airtable-sync-loop.mjs"], "airtable-sync");
} else {
  console.log("[startup] airtable sync autostart disabled");
}
