import fs from "node:fs";
import path from "node:path";

import { optionalEnv } from "@/lib/env";
import type {
  PosterStyle,
  PosterTemplateCoordinates,
  PosterTemplateTextCoordinates,
} from "@/lib/posters/types";

const DEFAULT_CURRENT_DOMAIN = "http://localhost:7171";
const projectRoot = /* turbopackIgnore: true */ process.cwd();

export const DEFAULT_POSTER_CAMPAIGN = optionalEnv("POSTER_DEFAULT_CAMPAIGN") ?? "default";

type PosterCampaignConfigFile = {
  redirectBaseUrl?: string;
  templates?: Partial<Record<PosterStyle, string>>;
  qrCoordinates?: Partial<Record<PosterStyle, Partial<PosterTemplateCoordinates>>>;
  referralTextCoordinates?: Partial<Record<PosterStyle, Partial<PosterTemplateTextCoordinates>>>;
};

const defaultTemplateFilenames: Record<PosterStyle, string> = {
  color: "poster-color.pdf",
  bw: "poster-bw.pdf",
  printer_efficient: "poster-printer_efficient.pdf",
};

function posterTemplateRoots() {
  return [
    optionalEnv("POSTER_TEMPLATE_ROOT"),
    path.join(projectRoot, "public", "posters"),
  ].filter((value): value is string => Boolean(value));
}

export function normalizeCampaignSlug(campaignSlug?: string | null) {
  const normalized = campaignSlug
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || DEFAULT_POSTER_CAMPAIGN;
}

function resolveCampaignConfigPath(campaignSlug: string) {
  for (const root of posterTemplateRoots()) {
    const configPath = path.join(root, campaignSlug, "config.json");
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

export function readPosterCampaignConfig(campaignSlug: string): PosterCampaignConfigFile {
  const configPath = resolveCampaignConfigPath(normalizeCampaignSlug(campaignSlug));
  if (!configPath) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as PosterCampaignConfigFile;
  } catch {
    return {};
  }
}

function defaultRenderCoordinates(pageWidth: number, pageHeight: number) {
  const margin = 36;
  const size = Math.round(Math.min(pageWidth, pageHeight) * 0.22);

  return {
    qr: {
      x: Math.max(margin, pageWidth - size - margin),
      y: margin,
      size,
    },
    text: {
      x: Math.max(margin, pageWidth - size / 2 - margin),
      y: Math.max(18, margin - 6),
      size: 16,
      color: "000000",
    },
  };
}

export function resolvePosterTemplatePath(campaignSlug: string, style: PosterStyle) {
  const slug = normalizeCampaignSlug(campaignSlug);
  const config = readPosterCampaignConfig(slug);
  const filename = config.templates?.[style] ?? defaultTemplateFilenames[style];

  for (const root of posterTemplateRoots()) {
    const campaignTemplate = path.join(root, slug, filename);
    if (fs.existsSync(campaignTemplate)) {
      return campaignTemplate;
    }

    const defaultTemplate = path.join(root, DEFAULT_POSTER_CAMPAIGN, defaultTemplateFilenames[style]);
    if (fs.existsSync(defaultTemplate)) {
      return defaultTemplate;
    }
  }

  return null;
}

export function getPosterRenderConfig(
  campaignSlug: string,
  style: PosterStyle,
  pageWidth: number,
  pageHeight: number,
) {
  const defaults = defaultRenderCoordinates(pageWidth, pageHeight);
  const config = readPosterCampaignConfig(normalizeCampaignSlug(campaignSlug));
  const qrOverrides = config.qrCoordinates?.[style] ?? {};
  const textOverrides = config.referralTextCoordinates?.[style] ?? {};

  return {
    qr: {
      x: qrOverrides.x ?? defaults.qr.x,
      y: qrOverrides.y ?? defaults.qr.y,
      size: qrOverrides.size ?? defaults.qr.size,
    },
    text: {
      x: textOverrides.x ?? defaults.text.x,
      y: textOverrides.y ?? defaults.text.y,
      size: textOverrides.size ?? defaults.text.size,
      color: textOverrides.color ?? defaults.text.color,
    },
  };
}

export function getPosterPublicBaseUrl() {
  return optionalEnv("CURRENT_DOMAIN") ?? DEFAULT_CURRENT_DOMAIN;
}

export function buildPosterReferralUrl(referralCode: string) {
  return `${getPosterPublicBaseUrl()}/p/${encodeURIComponent(referralCode)}`;
}

export function buildPosterRedirectUrl(referralCode: string, campaignSlug: string) {
  const config = readPosterCampaignConfig(normalizeCampaignSlug(campaignSlug));
  const target = new URL(
    config.redirectBaseUrl ??
      optionalEnv("POSTER_REDIRECT_BASE_URL") ??
      getPosterPublicBaseUrl(),
  );
  target.searchParams.set("ref", referralCode);
  return target.toString();
}
