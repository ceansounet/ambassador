import jsQR from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

import { buildPosterReferralUrl } from "@/lib/posters/config";
import type { PosterRow } from "@/lib/posters/types";

const QR_ROTATIONS = [0, 90, 180, 270] as const;

async function decodeSingleQr(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
    {
      inversionAttempts: "attemptBoth",
    },
  );

  return code?.data ?? null;
}

export async function generateQrCodePng(content: string, size: number) {
  return QRCode.toBuffer(content, {
    type: "png",
    width: Math.max(256, Math.round(size * 3)),
    margin: 2,
    errorCorrectionLevel: "L",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

export async function readQrCodesFromImageBuffer(buffer: Buffer) {
  const matches = new Set<string>();

  for (const angle of QR_ROTATIONS) {
    const rotated = angle === 0 ? buffer : await sharp(buffer).rotate(angle).toBuffer();
    const result = await decodeSingleQr(rotated);

    if (result) {
      matches.add(result);
    }
  }

  return [...matches];
}

export function normalizeQrValue(value: string) {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

export function getPosterReferralUrl(poster: Pick<PosterRow, "referral_code">) {
  return buildPosterReferralUrl(poster.referral_code);
}

export function detectedQrMatchesPoster(detectedCodes: string[], poster: PosterRow) {
  const posterUrl = normalizeQrValue(getPosterReferralUrl(poster));
  const posterCode = poster.referral_code.toLowerCase();

  return detectedCodes.some((entry) => {
    const normalized = normalizeQrValue(entry);
    return normalized === posterUrl || normalized.includes(posterCode);
  });
}

export function findMatchingPoster(detectedCodes: string[], posters: PosterRow[]) {
  return posters.find((poster) => detectedQrMatchesPoster(detectedCodes, poster)) ?? null;
}
