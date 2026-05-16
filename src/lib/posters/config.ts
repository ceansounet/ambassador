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
const publicPosterRoot = path.join(projectRoot, "public", "posters");

export const DEFAULT_POSTER_CAMPAIGN = optionalEnv("POSTER_DEFAULT_CAMPAIGN") ?? "default";

type PosterCampaignConfigFile = {
  displayName?: string;
  redirectBaseUrl?: string;
  templates?: Partial<Record<PosterStyle, string>>;
  qrCoordinates?: Partial<Record<PosterStyle, Partial<PosterTemplateCoordinates>>>;
  referralTextCoordinates?: Partial<Record<PosterStyle, Partial<PosterTemplateTextCoordinates>>>;
};

const defaultTemplateFilenames: Record<PosterStyle, string> = {
  color: "stardance.pdf",
  bw: "stardance-bw.pdf",
  printer_efficient: "stardance-bw.pdf",
  a4: "stardance-a4.pdf",
  a4_bw: "stardance-a4-bw.pdf",
};

function posterTemplateRoots() {
  return [
    optionalEnv("POSTER_TEMPLATE_ROOT"),
    publicPosterRoot,
  ].filter((value): value is string => Boolean(value));
}

export function normalizeCampaignSlug(campaignSlug?: string | null) {
  const normalized =
    campaignSlug
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-") ?? "";

  let start = 0;
  let end = normalized.length;

  while (normalized.charAt(start) === "-") {
    start += 1;
  }

  while (end > start && normalized.charAt(end - 1) === "-") {
    end -= 1;
  }

  return normalized.slice(start, end) || DEFAULT_POSTER_CAMPAIGN;
}

export function readPosterCampaignConfig(campaignSlug: string): PosterCampaignConfigFile {
  const normalizedCampaignSlug = normalizeCampaignSlug(campaignSlug);
  let configPath: string | null = null;

  for (const root of posterTemplateRoots()) {
    const candidate = path.join(root, normalizedCampaignSlug, "config.json");

    if (fs.existsSync(candidate)) {
      configPath = candidate;
      break;
    }
  }

  if (configPath === null) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
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

export function normalizePosterReferralCode(referralCode: string) {
  const trimmed = referralCode.trim();
  const prefixedCode = /^a[!-]?([a-z0-9]{5})$/i.exec(trimmed);
  if (prefixedCode?.[1] !== undefined) {
    return prefixedCode[1].toLowerCase();
  }

  return /^[a-z0-9]{5}$/i.test(trimmed) ? trimmed.toLowerCase() : trimmed;
}

export function formatPosterReferralCode(referralCode: string) {
  const code = normalizePosterReferralCode(referralCode);
  return /^[a-z0-9]{5}$/.test(code) ? `a-${code}` : code;
}

export function buildPosterReferralUrl(referralCode: string) {
  return `${optionalEnv("CURRENT_DOMAIN") ?? DEFAULT_CURRENT_DOMAIN}/p/${encodeURIComponent(formatPosterReferralCode(referralCode))}`;
}

export function buildPosterScanUrl(qrCodeToken: string) {
  return `${optionalEnv("CURRENT_DOMAIN") ?? DEFAULT_CURRENT_DOMAIN}/p/${encodeURIComponent(qrCodeToken)}`;
}

export type PosterCampaignSummary = {
  slug: string;
  displayName: string;
  styles: PosterStyle[];
  previewUrls: Partial<Record<PosterStyle, string>>;
};

const AVAILABLE_STYLES: PosterStyle[] = ["color", "bw", "a4", "a4_bw"];

export function listPosterCampaigns(): PosterCampaignSummary[] {
  const seen = new Map<string, PosterCampaignSummary>();

  for (const root of posterTemplateRoots()) {
    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }

    for (const slug of entries) {
      if (seen.has(slug)) continue;
      const campaignDir = path.join(root, slug);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(campaignDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const config = readPosterCampaignConfig(slug);
      const styles = AVAILABLE_STYLES.filter((style) => {
        const filename = config.templates?.[style] ?? defaultTemplateFilenames[style];
        return fs.existsSync(path.join(campaignDir, filename));
      });

      if (styles.length === 0) continue;

      const displayName =
        typeof config.displayName === "string"
          ? config.displayName
          : slug.charAt(0).toUpperCase() + slug.slice(1);

      const previewUrls = Object.fromEntries(
        styles.flatMap((style) => {
          const filename = config.templates?.[style] ?? defaultTemplateFilenames[style];
          const previewFilename = filename.replace(/\.pdf$/i, ".webp");
          const publicPreview = path.join(publicPosterRoot, slug, previewFilename);
          if (!fs.existsSync(publicPreview)) return [];
          return [[style, `/posters/${encodeURIComponent(slug)}/${encodeURIComponent(previewFilename)}`]];
        }),
      ) as Partial<Record<PosterStyle, string>>;

      seen.set(slug, { slug, displayName, styles, previewUrls });
    }
  }

  return [...seen.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function buildPosterRedirectUrl(referralCode: string, campaignSlug: string) {
  const config = readPosterCampaignConfig(normalizeCampaignSlug(campaignSlug));
  const target = new URL(
    config.redirectBaseUrl ??
      optionalEnv("POSTER_REDIRECT_BASE_URL") ??
      optionalEnv("CURRENT_DOMAIN") ??
      DEFAULT_CURRENT_DOMAIN,
  );
  target.searchParams.set("ref", normalizePosterReferralCode(referralCode));
  return target.toString();
}
