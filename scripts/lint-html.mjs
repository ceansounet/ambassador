import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirs = new Set([".git", ".next", "build", "node_modules", "out", "ref"]);
const htmlExtensions = new Set([".htm", ".html"]);

async function collectHtmlFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") {
      continue;
    }

    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(entryPath)));
      continue;
    }

    if (htmlExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(path.relative(rootDir, entryPath));
    }
  }

  return files.sort();
}

function runHtmlValidate(files) {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  return new Promise((resolve, reject) => {
    const child = spawn(command, ["exec", "html-validate", ...files], {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`html-validate exited with code ${code ?? 1}`));
    });
  });
}

const htmlFiles = await collectHtmlFiles(rootDir);

if (htmlFiles.length === 0) {
  console.log("No HTML files found. Skipping HTML lint.");
  process.exit(0);
}

await runHtmlValidate(htmlFiles);