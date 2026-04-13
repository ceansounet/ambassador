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
  return (optionalEnv("STORAGE_DRIVER") as StorageDriver | null) ?? "local";
}

function getLfsRoot() {
  const configured = optionalEnv("LFS_ROOT");
  if (configured) {
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
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function requireS3Env(): S3Env {
  const accountId = optionalEnv("R2_ACCOUNT_ID");
  const accessKeyId = optionalEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = optionalEnv("R2_SECRET_ACCESS_KEY");
  const bucket = optionalEnv("R2_BUCKET");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 storage driver requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const env = requireS3Env();
  return {
    env,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
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

async function readRemote(key: string): Promise<Buffer> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, env } = await getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.bucket,
      Key: `${PROOF_PREFIX}${key}`,
    }),
  );

  const body = response.Body;
  if (!body) {
    throw new Error(`No body returned for proof ${key}`);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
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

export async function readPosterProofFile(key: string): Promise<Buffer> {
  const driver = getStorageDriver();
  if (driver === "r2") {
    return readRemote(key);
  }
  return readLocal(key);
}

export async function deletePosterProofFile(key: string | null | undefined) {
  if (!key) return;

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
