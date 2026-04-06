"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatHackClubAddress,
  resolveAmbassadorRegion,
  SUPPORTED_AMBASSADOR_REGIONS,
  type HackClubAddress,
} from "@/lib/settings";

export default function SettingsClient({
  displayName,
  email,
  firstName,
  lastName,
  slackName,
  verificationStatus,
  addresses,
  selectedAddressIndex,
  currentRegion,
  detectedRegion,
}: {
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  slackName: string;
  verificationStatus: string;
  addresses: HackClubAddress[];
  selectedAddressIndex: number;
  currentRegion: string | null;
  detectedRegion: string | null;
}) {
  const t = useTranslations("settings.form");
  const [addressIndex, setAddressIndex] = useState(selectedAddressIndex);
  const [region, setRegion] = useState(() =>
    resolveAmbassadorRegion(currentRegion, detectedRegion),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const surfaceClass = cn(
    "ui-input-surface h-14 w-full rounded-lg border-0 px-4 text-base focus-visible:ring-1 focus-visible:ring-white/15",
    "disabled:cursor-not-allowed disabled:text-white/50",
  );

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedAddressIndex: addresses.length > 0 ? addressIndex : undefined,
          ambassadorRegion: region,
        }),
      });
      if (res.ok) {
        setSaved(true);
      } else {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error === "invalid_address_index"
            ? t("errors.invalid-address-index")
            : data?.error === "invalid_region"
              ? t("errors.invalid-region")
              : data?.error === "unauthorized"
                ? t("errors.unauthorized")
                : t("errors.generic"),
        );
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <label className="mb-2 block font-body text-base tracking-wide text-white">
          {t("labels.name")}
        </label>
        <input
          type="text"
          disabled
          value={displayName}
          className={surfaceClass}
        />
      </div>

      {(firstName || lastName) && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block font-body text-base tracking-wide text-white">
              {t("labels.first-name")}
            </label>
            <input
              type="text"
              disabled
              value={firstName}
              className={surfaceClass}
            />
          </div>
          <div>
            <label className="mb-2 block font-body text-base tracking-wide text-white">
              {t("labels.last-name")}
            </label>
            <input
              type="text"
              disabled
              value={lastName}
              className={surfaceClass}
            />
          </div>
        </div>
      )}

      <div>
        <label className="mb-2 block font-body text-base tracking-wide text-white">
          {t("labels.email")}
        </label>
        <input
          type="email"
          disabled
          value={email}
          className={surfaceClass}
        />
      </div>

      {slackName && (
        <div>
          <label className="mb-2 block font-body text-base tracking-wide text-white">
            {t("labels.slack")}
          </label>
          <input
            type="text"
            disabled
            value={slackName}
            className={surfaceClass}
          />
        </div>
      )}

      {verificationStatus && (
        <div>
          <label className="mb-2 block font-body text-base tracking-wide text-white">
            {t("labels.verification-status")}
          </label>
          <input
            type="text"
            disabled
            value={verificationStatus}
            className={surfaceClass}
          />
        </div>
      )}

      <hr className="border-white/10" />

      {addresses.length > 0 && (
        <div>
          <label className="mb-2 block font-body text-base tracking-wide text-white">
            {t("labels.shipping-address")}
          </label>
          {addresses.length === 1 ? (
            <input
              type="text"
              disabled
              value={formatHackClubAddress(addresses[0])}
              className={surfaceClass}
            />
          ) : (
            <Select
              value={String(addressIndex)}
              onValueChange={(v) => setAddressIndex(Number(v))}
            >
              <SelectTrigger
                className={cn(
                  surfaceClass,
                  "data-[state=open]:bg-card/50",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-black text-white">
                {addresses.map((addr, i) => (
                  <SelectItem
                    key={i}
                    value={String(i)}
                    className="focus:bg-card focus:text-white"
                  >
                    {formatHackClubAddress(addr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div>
        <label className="mb-2 block font-body text-base tracking-wide text-white">
          {t("labels.region")}
        </label>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger
            className={cn(
              surfaceClass,
              "data-[state=open]:bg-card/50",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" side="bottom" className="max-h-72 border-white/10 bg-black text-white">
            {SUPPORTED_AMBASSADOR_REGIONS.map((regionName) => (
              <SelectItem
                key={regionName}
                value={regionName}
                className="focus:bg-card focus:text-white"
              >
                {regionName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="font-body text-base text-primary">{error}</p>
      )}

      <div className="border-t border-white/10 pt-5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-primary px-8 py-3 text-lg tracking-wide text-white transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          {saving ? t("actions.saving") : saved ? t("actions.saved") : t("actions.save")}
        </button>
      </div>
    </div>
  );
}
