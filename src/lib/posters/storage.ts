import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = /* turbopackIgnore: true */ process.cwd();
const proofRoot = path.join(projectRoot, ".data", "posters", "proofs");

function sanitizeExtension(input: string | undefined) {
  const ext = path.extname(input ?? "").toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(ext)) {
    return ext;
  }

  return ".bin";
}

async function ensureProofDirectory() {
  await fs.mkdir(proofRoot, { recursive: true });
}

export async function savePosterProofFile(posterId: string, file: File) {
  await ensureProofDirectory();

  const extension = sanitizeExtension(file.name);
  const filename = `${posterId}-${Date.now()}${extension}`;
  const absolutePath = path.join(proofRoot, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  await fs.writeFile(absolutePath, buffer);

  return {
    absolutePath,
    relativePath: path.relative(projectRoot, absolutePath),
    size: buffer.byteLength,
  };
}

export async function deletePosterProofFile(relativePath: string | null | undefined) {
  if (!relativePath) return;

  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(projectRoot, relativePath);

  await fs.rm(absolutePath, { force: true });
}
