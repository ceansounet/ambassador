import fs from "node:fs/promises";
import path from "node:path";

import { optionalEnv } from "@/lib/env";

type StorageDriver = "local" | "r2";

export type StoredProof = {
  key: string;
  size: number;
  driver: StorageDriver;
};

const projectRoot = /* turbopackIgnore: true */ process.cwd();

function getStorageDriver(): StorageDriver {
  const configured = optionalEnv("STORAGE_DRIVER");
  if (configured === "local" || configured === "r2") return configured;
  return optionalEnv("R2_ACCESS") !== null &&
    optionalEnv("R2_SECRET") !== null &&
    optionalEnv("R2_LINK") !== null
    ? "r2"
    : "local";
}

function getLfsRoot() {
  const configured = optionalEnv("LFS_ROOT");
  if (configured !== null && configured !== "") {
    return path.isAbsolute(configured) ? configured : path.join(projectRoot, configured);
  }

  return path.join(projectRoot, "lfs");
}

function getProofRoot() {
  return path.join(getLfsRoot(), "poster-proofs");
}

function sanitizeExtension(input: string | undefined) {
  const ext = path.extname(input ?? "").toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(ext)) {
    return ext;
  }

  return ".bin";
}

function buildKey(posterId: string, file: File) {
  const extension = sanitizeExtension(file.name);
  return `${posterId}-${Date.now()}${extension}`;
}

async function saveLocal(key: string, buffer: Buffer) {
  const absolutePath = path.join(getProofRoot(), key);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
}

async function readLocal(key: string) {
  const absolutePath = path.join(getProofRoot(), key);
  return fs.readFile(absolutePath);
}

async function deleteLocal(key: string) {
  const absolutePath = path.join(getProofRoot(), key);
  await fs.rm(absolutePath, { force: true });
}

type S3Env = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
};

function parseR2Link(value: string | null) {
  if (value === null) return null;
  try {
    return new URL(value);
  } catch {
    throw new Error("R2_LINK must be a valid URL.");
  }
}

function requireS3Env(): S3Env {
  const accessKeyId = optionalEnv("R2_ACCESS") ?? optionalEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = optionalEnv("R2_SECRET") ?? optionalEnv("R2_SECRET_ACCESS_KEY");
  const r2Link = optionalEnv("R2_LINK");
  const accountId = optionalEnv("R2_ACCOUNT_ID");
  const parsedLink = parseR2Link(r2Link);
  const linkBucket = parsedLink?.pathname.split("/").filter(Boolean).at(0) ?? null;
  const bucket = optionalEnv("R2_BUCKET") ?? linkBucket;
  const endpoint =
    parsedLink !== null
      ? parsedLink.origin
      : accountId !== null
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : null;

  if (
    endpoint === null ||
    endpoint === "" ||
    accessKeyId === null ||
    accessKeyId === "" ||
    secretAccessKey === null ||
    secretAccessKey === "" ||
    bucket === null ||
    bucket === ""
  ) {
    throw new Error(
      "R2 storage driver requires R2_ACCESS, R2_SECRET, R2_LINK, and R2_BUCKET unless R2_LINK contains the bucket path.",
    );
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket, forcePathStyle: parsedLink !== null };
}

async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const env = requireS3Env();
  return {
    env,
    client: new S3Client({
      region: "auto",
      endpoint: env.endpoint,
      forcePathStyle: env.forcePathStyle,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    }),
  };
}

const PROOF_PREFIX = "poster-proofs/";

async function saveRemote(key: string, buffer: Buffer, contentType: string | null) {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, env } = await getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: `${PROOF_PREFIX}${key}`,
      Body: buffer,
      ContentType: contentType ?? "application/octet-stream",
    }),
  );
}

async function deleteRemote(key: string) {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, env } = await getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.bucket,
      Key: `${PROOF_PREFIX}${key}`,
    }),
  );
}

export async function savePosterProofFile(posterId: string, file: File): Promise<StoredProof> {
  const key = buildKey(posterId, file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const driver = getStorageDriver();

  if (driver === "r2") {
    await saveRemote(key, buffer, file.type || null);
  } else {
    await saveLocal(key, buffer);
  }

  return {
    key,
    size: buffer.byteLength,
    driver,
  };
}

/**
 * Resolve a directly-loadable URL for a stored proof.
 *
 * For R2 we hand back a short-lived presigned URL so the image is served from
 * the bucket's own origin rather than being proxied through the app. That keeps
 * any user-supplied markup (e.g. a malicious SVG) off our origin, where it could
 * otherwise reach authenticated `/api/admin` routes. Local development has no
 * public origin, so we inline the bytes as a data URL instead.
 */
export async function getPosterProofUrl(
  key: string | null | undefined,
  contentType?: string | null,
): Promise<string | null> {
  if (key === null || key === undefined || key === "") return null;

  const driver = getStorageDriver();
  if (driver === "r2") {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { client, env } = await getS3Client();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: env.bucket, Key: `${PROOF_PREFIX}${key}` }),
      { expiresIn: 60 * 60 },
    );
  }

  const buffer = await readLocal(key);
  const type =
    contentType !== null && contentType !== undefined && contentType.startsWith("image/")
      ? contentType
      : "application/octet-stream";
  return `data:${type};base64,${buffer.toString("base64")}`;
}

export async function deletePosterProofFile(key: string | null | undefined) {
  if (key === null || key === undefined || key === "") return;

  const driver = getStorageDriver();
  try {
    if (driver === "r2") {
      await deleteRemote(key);
    } else {
      await deleteLocal(key);
    }
  } catch (error) {
    console.error("Failed to delete poster proof", { key, error });
  }
}
