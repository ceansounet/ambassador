export const POSTER_STYLES = ["color", "bw", "printer_efficient", "a4", "a4_bw"] as const;
export const POSTER_VERIFICATION_STATUSES = [
  "pending",
  "in_review",
  "success",
  "rejected",
  "digital",
] as const;
export const POSTER_GROUP_CHARSETS = ["alphanumeric", "numeric", "alpha"] as const;

export const MAX_POSTERS_PER_GROUP = 20;
export const MAX_POSTERS_PER_USER = 5000;
export const REFERRAL_CODE_LENGTH = 5;

export type PosterStyle = (typeof POSTER_STYLES)[number];
export type PosterVerificationStatus = (typeof POSTER_VERIFICATION_STATUSES)[number];
export type PosterGroupCharset = (typeof POSTER_GROUP_CHARSETS)[number];

export type PosterMetadata = Record<string, unknown>;

export type PosterGroupRow = {
  id: string;
  user_id: string;
  campaign_slug: string;
  name: string | null;
  poster_count: number;
  charset: PosterGroupCharset;
  metadata: PosterMetadata;
  created_at: Date;
  updated_at: Date;
};

export type PosterRow = {
  id: string;
  user_id: string;
  poster_group_id: string | null;
  campaign_slug: string;
  name: string | null;
  qr_code_token: string;
  referral_code: string;
  poster_type: PosterStyle;
  verification_status: PosterVerificationStatus;
  verified_at: Date | null;
  rejection_reason: string | null;
  location_description: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  proof_path: string | null;
  proof_original_name: string | null;
  proof_content_type: string | null;
  proof_size_bytes: number | null;
  detected_qr_codes: string[];
  metadata: PosterMetadata;
  submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type PosterScanRow = {
  id: string;
  poster_id: string;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  metadata: PosterMetadata;
  created_at: Date;
};

export type PosterTemplateCoordinates = {
  x: number;
  y: number;
  size: number;
};

export type PosterTemplateTextCoordinates = {
  x: number;
  y: number;
  size: number;
  color: string;
};

export type PosterCampaignDefinition = {
  slug: string;
  redirectBaseUrl: string;
};

export type CreatePosterInput = {
  userId: string;
  campaignSlug: string;
  posterType?: PosterStyle;
  posterGroupId?: string | null;
  charset?: PosterGroupCharset;
  name?: string | null;
  metadata?: PosterMetadata;
};

export type CreatePosterGroupInput = {
  userId: string;
  campaignSlug: string;
  count: number;
  name?: string | null;
  charset?: PosterGroupCharset;
  posterType?: PosterStyle;
};

export type SubmitPosterProofInput = {
  userId: string;
  posterId: string;
  file: File;
  locationDescription?: string | null;
  latitude: number;
  longitude: number;
  locationAccuracy?: number | null;
};

export type VerifiedPosterDisplay = {
  name: string | null;
  referralCode: string;
  groupName: string | null;
};

export type ScanMatchResult =
  | {
      status: "success" | "auto_matched" | "already_verified";
      detectedQrCodes: string[];
      poster: PosterRow;
      matchedPoster?: PosterRow;
      verifiedPoster: VerifiedPosterDisplay;
      message: string;
    }
  | {
      status: "no_match" | "no_qr";
      detectedQrCodes: string[];
      message: string;
      poster?: PosterRow | null;
      matchedPoster?: PosterRow | null;
    }
  | {
      status: "in_review";
      detectedQrCodes: string[];
      poster: PosterRow;
      message: string;
    };
