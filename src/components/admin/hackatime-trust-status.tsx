"use client";

import Icon from "@hackclub/icons";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

export function HackatimeTrustStatus({
  slackId,
  trustLevel,
}: {
  slackId: string | null | undefined;
  trustLevel: string | null | undefined;
}) {
  const t = useTranslations("admin.hackatime-trust");
  const router = useRouter();
  const tooltipId = useId();
  const [refreshing, setRefreshing] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [error, setError] = useState(false);
  const trimmedSlackId = slackId?.trim() ?? "";
  const canRefresh = trimmedSlackId !== "" && !refreshing;

  async function refreshTrustLevel() {
    if (!canRefresh) {
      return;
    }

    setRefreshing(true);
    setError(false);

    try {
      const response = await fetch(
        `/api/admin/hackatime/${encodeURIComponent(trimmedSlackId)}/trust`,
        {
          method: "POST",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setError(true);
        return;
      }

      router.refresh();
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="font-body text-base text-foreground break-words [overflow-wrap:anywhere]">
        {trustLevel?.trim() || "-"}
      </span>
      <span className="relative inline-flex">
        <button
          type="button"
          data-slot="icon-link"
          aria-label={t("refresh-label")}
          aria-describedby={showTip ? tooltipId : undefined}
          className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center appearance-none border-0 bg-transparent p-0 text-foreground outline-none transition-colors hover:text-acceptance focus-visible:text-acceptance disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canRefresh}
          onClick={refreshTrustLevel}
          onFocus={() => setShowTip(true)}
          onBlur={() => setShowTip(false)}
          onMouseEnter={() => setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
          title={t("refresh-label")}
        >
          <Icon glyph="view-reload" size={18} />
        </button>
        {showTip ? (
          <span
            id={tooltipId}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 !rounded-none bg-foreground px-3 py-2 font-body text-xs leading-relaxed text-background shadow-lg"
          >
            {t("refresh-tip")}
          </span>
        ) : null}
      </span>
      {refreshing ? (
        <span className="font-body text-xs text-secondary">{t("refreshing")}</span>
      ) : error ? (
        <span className="font-body text-xs text-primary">{t("refresh-failed")}</span>
      ) : null}
    </div>
  );
}
