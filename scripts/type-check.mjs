import { rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function run(command, args) {
  const resolvedCommand = process.platform === "win32" ? `${command}.cmd` : command;

  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

await Promise.all([
  rm(path.join(rootDir, ".next", "types"), { force: true, recursive: true }),
  rm(path.join(rootDir, ".next", "dev", "types"), { force: true, recursive: true }),
]);

await run("pnpm", ["exec", "next", "typegen"]);
await run("pnpm", ["exec", "tsc", "--noEmit"]);