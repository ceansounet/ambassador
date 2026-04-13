"use client";

import Icon from "@hackclub/icons";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pillVariants } from "@/components/ui/pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PosterCampaignSummary } from "@/lib/posters/config";
import type { PosterStyle, PosterVerificationStatus } from "@/lib/posters/types";
import { cn } from "@/lib/utils";

type ClientPoster = {
  id: string;
  referral_code: string;
  poster_type: PosterStyle;
  verification_status: PosterVerificationStatus;
  campaign_slug: string;
  poster_group_id: string | null;
  location_description: string | null;
};

type ClientPosterGroup = {
  id: string;
  name: string | null;
  campaign_slug: string;
  poster_count: number;
  posters: ClientPoster[];
};

type ClientPosterData = {
  groups: ClientPosterGroup[];
  standalonePosters: ClientPoster[];
};

type ScanResult = {
  status:
    | "success"
    | "auto_matched"
    | "already_verified"
    | "in_review"
    | "no_qr"
    | "no_match"
    | "wrong_group";
  detectedQrCodes: string[];
  message: string;
};

type GeoState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; latitude: number; longitude: number; accuracy: number }
  | { kind: "error"; message: string };

type VerifyTarget =
  | { kind: "poster"; poster: ClientPoster }
  | { kind: "group"; group: ClientPosterGroup };

const POSTER_STYLES: PosterStyle[] = ["color", "bw", "printer_efficient"];
const SUPPORTED_PROOF_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".heic", ".heif", ".webp"];
const SUPPORTED_PROOF_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const SUPPORTED_PROOF_IMAGE_FORMATS = "PNG, JPG, HEIC, WebP";
const PROOF_IMAGE_ACCEPT = [
  ...SUPPORTED_PROOF_IMAGE_MIME_TYPES,
  ...SUPPORTED_PROOF_IMAGE_EXTENSIONS,
].join(",");

function isSafePreviewUrl(value: string) {
  try {
    return new URL(value).protocol === "blob:";
  } catch {
    return false;
  }
}

function isSupportedProofImage(file: File) {
  const type = file.type.trim().toLowerCase();
  if (type && SUPPORTED_PROOF_IMAGE_MIME_TYPES.has(type)) {
    return true;
  }

  const name = file.name.trim().toLowerCase();
  return SUPPORTED_PROOF_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function PostersClient({
  campaigns,
  initialCampaignSlug,
  initialData,
}: {
  campaigns: PosterCampaignSummary[];
  initialCampaignSlug: string | null;
  initialData: ClientPosterData;
}) {
  const t = useTranslations("posters");
  const data = initialData;
  const [campaignSlug, setCampaignSlug] = useState<string | null>(initialCampaignSlug);
  const [posterType, setPosterType] = useState<PosterStyle>("color");
  const [groupName, setGroupName] = useState("");
  const [groupSize, setGroupSize] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget | null>(null);

  const campaign = useMemo(
    () => campaigns.find((c) => c.slug === campaignSlug) ?? null,
    [campaigns, campaignSlug],
  );
  const availableStyles = campaign?.styles ?? POSTER_STYLES;

  useEffect(() => {
    if (!availableStyles.includes(posterType)) {
      setPosterType(availableStyles[0] ?? "color");
    }
  }, [availableStyles, posterType]);

  const refresh = useCallback(async () => {
    window.location.reload();
  }, []);

  const createPoster = useCallback(async () => {
    if (campaignSlug === null) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/posters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignSlug, posterType }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await refresh();
    } catch {
      setError(t("errors.create-failed"));
    } finally {
      setBusy(false);
    }
  }, [campaignSlug, posterType, refresh, t]);

  const createGroup = useCallback(async () => {
    if (campaignSlug === null) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/poster-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignSlug,
          posterType,
          count: groupSize,
          name: groupName.trim() || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setGroupName("");
      setGroupSize(3);
      await refresh();
    } catch {
      setError(t("errors.create-failed"));
    } finally {
      setBusy(false);
    }
  }, [campaignSlug, posterType, groupSize, groupName, refresh, t]);

  const handleVerified = useCallback(async () => {
    setVerifyTarget(null);
    await refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-10">
      {error !== null ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <CreateSection
        campaigns={campaigns}
        campaignSlug={campaignSlug}
        setCampaignSlug={setCampaignSlug}
        availableStyles={availableStyles}
        posterType={posterType}
        setPosterType={setPosterType}
        groupName={groupName}
        setGroupName={setGroupName}
        groupSize={groupSize}
        setGroupSize={setGroupSize}
        busy={busy}
        createPoster={createPoster}
        createGroup={createGroup}
      />

      <GroupsSection groups={data.groups} onVerifyGroup={(group) => setVerifyTarget({ kind: "group", group })} />

      <StandaloneSection
        posters={data.standalonePosters}
        onVerifyPoster={(poster) => setVerifyTarget({ kind: "poster", poster })}
      />

      {verifyTarget ? (
        <VerifyModal
          target={verifyTarget}
          onClose={() => setVerifyTarget(null)}
          onDone={handleVerified}
        />
      ) : null}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} className="text-primary/80 hover:text-primary">
        <Icon glyph="view-close" size={16} />
      </button>
    </div>
  );
}

function CreateSection({
  campaigns,
  campaignSlug,
  setCampaignSlug,
  availableStyles,
  posterType,
  setPosterType,
  groupName,
  setGroupName,
  groupSize,
  setGroupSize,
  busy,
  createPoster,
  createGroup,
}: {
  campaigns: PosterCampaignSummary[];
  campaignSlug: string | null;
  setCampaignSlug: (value: string) => void;
  availableStyles: PosterStyle[];
  posterType: PosterStyle;
  setPosterType: (value: PosterStyle) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  groupSize: number;
  setGroupSize: (value: number) => void;
  busy: boolean;
  createPoster: () => void;
  createGroup: () => void;
}) {
  const t = useTranslations("posters");

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("campaign.label")}
          </label>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("campaign.empty")}</p>
          ) : (
            <Select value={campaignSlug ?? undefined} onValueChange={setCampaignSlug}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("campaign.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("styles.color").replace("Full colour", "Style")}
          </label>
          <div className="flex flex-wrap gap-2">
            {availableStyles.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setPosterType(style)}
                className={cn(
                  "font-body transition-opacity hover:opacity-80",
                  posterType === style
                    ? pillVariants({ tone: "red" })
                    : pillVariants({ tone: "black" }),
                )}
              >
                {t(`styles.${style}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-t border-white/10 pt-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-white">{t("singles.title")}</p>
          <Button size="app" onClick={createPoster} disabled={busy || campaignSlug === null}>
            <Icon glyph="plus" size={16} />
            {t("actions.create-poster")}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-white">{t("groups.title")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder={t("groups.name-placeholder")}
              className="flex-1"
            />
            <Input
              type="number"
              min={1}
              max={10}
              value={groupSize}
              onChange={(event) => setGroupSize(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
              aria-label={t("groups.size-label")}
              className="w-24"
            />
          </div>
          <Button size="app" onClick={createGroup} disabled={busy || campaignSlug === null}>
            <Icon glyph="plus" size={16} />
            {t("actions.create-group")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function GroupsSection({
  groups,
  onVerifyGroup,
}: {
  groups: ClientPosterGroup[];
  onVerifyGroup: (group: ClientPosterGroup) => void;
}) {
  const t = useTranslations("posters");

  return (
    <section>
      <h2 className="font-sub text-2xl text-white">{t("groups.title")}</h2>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("groups.empty")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {groups.map((group) => (
            <li
              key={group.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg text-white">
                    {group.name !== null && group.name.trim() !== "" ? group.name : t("groups.unnamed")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t("groups.count", { count: group.poster_count })} · {group.campaign_slug}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="secondary" size="app-sm">
                    <a href={`/api/poster-groups/${group.id}/pdf`}>
                      <Icon glyph="download" size={16} />
                      {t("actions.download")}
                    </a>
                  </Button>
                  <Button size="app-sm" onClick={() => onVerifyGroup(group)}>
                    <Icon glyph="photo" size={16} />
                    {t("actions.verify-group")}
                  </Button>
                </div>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.posters.map((poster) => (
                  <PosterTile key={poster.id} poster={poster} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StandaloneSection({
  posters,
  onVerifyPoster,
}: {
  posters: ClientPoster[];
  onVerifyPoster: (poster: ClientPoster) => void;
}) {
  const t = useTranslations("posters");

  return (
    <section>
      <h2 className="font-sub text-2xl text-white">{t("singles.title")}</h2>
      {posters.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("singles.empty")}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posters.map((poster) => (
            <li key={poster.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <PosterTile poster={poster} dense={false} />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="app-sm">
                  <a href={`/api/posters/${poster.id}/pdf`}>
                    <Icon glyph="download" size={14} />
                    {t("actions.download")}
                  </a>
                </Button>
                {poster.verification_status === "pending" ? (
                  <Button size="app-sm" onClick={() => onVerifyPoster(poster)}>
                    <Icon glyph="photo" size={14} />
                    {t("actions.verify")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PosterTile({ poster, dense = true }: { poster: ClientPoster; dense?: boolean }) {
  const t = useTranslations("posters");
  const statusTone: Record<PosterVerificationStatus, string> = {
    pending: "text-accent",
    in_review: "text-accent",
    success: "text-acceptance",
    rejected: "text-primary",
    digital: "text-primary",
  };

  return (
    <div className={cn("rounded-lg border border-white/10 bg-white/[0.03]", dense ? "p-3" : "p-0")}>
      <p className="font-mono text-sm text-white">{t("poster-card.referral", { code: poster.referral_code })}</p>
      <p className={cn("text-xs", statusTone[poster.verification_status])}>
        {t(`status.${poster.verification_status}`)}
      </p>
    </div>
  );
}

function useGeolocation(enabled: boolean) {
  const t = useTranslations("posters");
  const [state, setState] = useState<GeoState>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const geolocation = typeof navigator === "undefined" ? null : navigator.geolocation;
  const unavailableState: GeoState = { kind: "error", message: t("errors.geolocation-unavailable") };

  const retry = useCallback(() => {
    setState({ kind: "pending" });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (geolocation === null) return;

    let cancelled = false;

    const watchId = geolocation.watchPosition(
      (position) => {
        if (cancelled) return;
        setState({
          kind: "ok",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err.code === err.PERMISSION_DENIED ? t("errors.geolocation-denied") : err.message,
        });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );

    return () => {
      cancelled = true;
      geolocation.clearWatch(watchId);
    };
  }, [enabled, attempt, geolocation, t]);

  const resolvedState: GeoState = !enabled
    ? { kind: "idle" }
    : geolocation === null
      ? unavailableState
      : state.kind === "idle"
        ? { kind: "pending" }
        : state;

  return { state: resolvedState, start: retry };
}

function VerifyModal({
  target,
  onClose,
  onDone,
}: {
  target: VerifyTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("posters");
  const { state: geoState, start: retryGeo } = useGeolocation(true);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [locationDescription, setLocationDescription] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file === null) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canSubmit =
    !submitting &&
    file !== null &&
    locationDescription.trim().length > 0 &&
    geoState.kind === "ok";

  const targetLabel =
    target.kind === "group"
      ? target.group.name !== null && target.group.name.trim() !== ""
        ? target.group.name
        : t("groups.unnamed")
      : t("poster-card.referral", { code: target.poster.referral_code });
  const safePreviewUrl = previewUrl !== null && isSafePreviewUrl(previewUrl) ? previewUrl : null;
  const handleSelectedFile = useCallback(
    (nextFile: File | null) => {
      if (!nextFile) {
        setFile(null);
        return;
      }

      if (!isSupportedProofImage(nextFile)) {
        setFile(null);
        setError(t("errors.invalid-image-format", { formats: SUPPORTED_PROOF_IMAGE_FORMATS }));
        return;
      }

      setError(null);
      setFile(nextFile);
    },
    [t],
  );

  const handleSubmit = useCallback(async () => {
    if (geoState.kind !== "ok" || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("proof", file);
      formData.append("locationDescription", locationDescription);
      formData.append("latitude", String(geoState.latitude));
      formData.append("longitude", String(geoState.longitude));
      formData.append("locationAccuracy", String(geoState.accuracy));

      const url =
        target.kind === "group"
          ? `/api/poster-groups/${target.group.id}/scan`
          : `/api/posters/${target.poster.id}/proof`;

      const response = await fetch(url, { method: "POST", body: formData });
      const data = await response.json().catch(() => null);
      const payload: Record<string, unknown> | null =
        typeof data === "object" && data !== null && !Array.isArray(data)
          ? Object.fromEntries(Object.entries(data))
          : null;
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : t("errors.upload-failed"));
      }
      const status = payload?.status;
      const detectedQrCodes = Array.isArray(payload?.detectedQrCodes)
        ? payload.detectedQrCodes.filter((code): code is string => typeof code === "string")
        : null;
      const message = payload?.message;
      if (
        status !== "success" &&
        status !== "auto_matched" &&
        status !== "already_verified" &&
        status !== "in_review" &&
        status !== "no_qr" &&
        status !== "no_match" &&
        status !== "wrong_group"
      ) {
        throw new Error(t("errors.upload-failed"));
      }
      if (detectedQrCodes === null || typeof message !== "string") {
        throw new Error(t("errors.upload-failed"));
      }
      setResult({ status, detectedQrCodes, message });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.upload-failed"));
    } finally {
      setSubmitting(false);
    }
  }, [file, geoState, locationDescription, target, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-8">
      <div className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[var(--topbar)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{targetLabel}</p>
            <h3 className="font-sub text-xl text-white">{t("verify-modal.title")}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white"
            aria-label={t("actions.cancel")}
          >
            <Icon glyph="view-close" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {result ? (
            <ResultView result={result} />
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{t("verify-modal.description")}</p>

              <GeolocationStatus state={geoState} onRetry={retryGeo} />

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("verify-modal.location-description-label")}
                </label>
                <Textarea
                  value={locationDescription}
                  onChange={(event) => setLocationDescription(event.target.value)}
                  placeholder={t("verify-modal.location-description-placeholder")}
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-3">
                {safePreviewUrl !== null ? (
                  <div className="relative h-48 overflow-hidden rounded-lg border border-white/10">
                    <Image
                      src={safePreviewUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, 32rem"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept={PROOF_IMAGE_ACCEPT}
                    capture="environment"
                    className="hidden"
                    onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={PROOF_IMAGE_ACCEPT}
                    className="hidden"
                    onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <Button type="button" size="app" onClick={() => cameraInputRef.current?.click()}>
                    <Icon glyph="photo" size={16} />
                    {t("actions.use-camera")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="app"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon glyph="attachment" size={16} />
                    {t("actions.choose-file")}
                  </Button>
                  {file ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="app"
                      onClick={() => setFile(null)}
                    >
                      {t("actions.retake")}
                    </Button>
                  ) : null}
                </div>
              </div>

              {target.kind === "group" ? (
                <p className="text-xs text-muted-foreground">{t("verify-modal.auto-detect")}</p>
              ) : null}

              {error !== null ? (
                <p className="text-sm text-primary">{error}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-black/30 px-6 py-4">
          {result ? (
            <Button
              size="app"
              onClick={() => {
                setResult(null);
                onDone();
              }}
            >
              {t("actions.cancel")}
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="app" onClick={onClose}>
                {t("actions.cancel")}
              </Button>
              <Button size="app" onClick={handleSubmit} disabled={!canSubmit}>
                {submitting ? t("actions.submitting") : t("actions.submit")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GeolocationStatus({ state, onRetry }: { state: GeoState; onRetry: () => void }) {
  const t = useTranslations("posters");

  if (state.kind === "ok") {
    return (
      <div className="rounded-lg border border-acceptance/40 bg-acceptance/5 px-4 py-3 text-sm text-acceptance">
        <p>{t("verify-modal.coordinates", { lat: state.latitude.toFixed(6), lng: state.longitude.toFixed(6) })}</p>
        <p className="text-xs text-acceptance/80">
          {t("verify-modal.accuracy", { meters: Math.round(state.accuracy) })}
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-sm text-primary">
        <p>{state.message}</p>
        <Button type="button" variant="secondary" size="app-sm" onClick={onRetry} className="mt-2">
          {t("verify-modal.location-retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
      {t("verify-modal.location-pending")}
    </div>
  );
}

function ResultView({ result }: { result: ScanResult }) {
  const t = useTranslations("posters");
  const tone =
    result.status === "success" || result.status === "auto_matched" || result.status === "already_verified"
      ? "text-acceptance"
      : result.status === "in_review"
        ? "text-accent"
        : "text-primary";

  return (
    <div className="space-y-3">
      <p className={cn("text-lg", tone)}>{t(`results.${result.status}`)}</p>
      <p className="text-sm text-muted-foreground">{result.message}</p>
      {result.detectedQrCodes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {result.detectedQrCodes.map((code) => (
            <li key={code} className="break-all font-mono">
              {code}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
