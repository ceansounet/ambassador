"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  isErrorCode,
  type DevState,
  type ErrorCode,
} from "@/lib/dev-admin-selector";

export function DevAdminSelector({
  mode = "dashboard",
  current,
  currentErrorCode = "500",
  targetPath,
}: (
  | {
      mode?: "dashboard";
      current: DevState;
      targetPath?: string;
      currentErrorCode?: never;
    }
  | {
      mode: "error";
      currentErrorCode: ErrorCode;
      current?: never;
      targetPath?: never;
    }
)) {
  const t = useTranslations("dev-admin-selector");
  const selectValue = mode === "error" ? currentErrorCode : current;
  const stateOptions: ReadonlyArray<{ value: DevState; label: string }> = [
    { value: "apply", label: t("states.apply") },
    { value: "ineligible", label: t("states.ineligible") },
    { value: "pending-checks", label: t("states.pending-checks") },
    { value: "pending", label: t("states.pending") },
    { value: "approved", label: t("states.approved") },
    { value: "rejected", label: t("states.rejected") },
    { value: "banned", label: t("states.banned") },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-xs text-muted-foreground">{t("label")}</span>
      <select
        value={selectValue}
        onChange={(e) => {
          if (mode === "error") {
            if (!isErrorCode(e.target.value)) return;
            window.location.href =
              e.target.value === "401"
                ? "/oops/401"
                : e.target.value === "403"
                  ? "/oops/403"
                  : e.target.value === "404"
                    ? "/__dev_selector_404__"
                    : "/oops/500";
            return;
          }

          const baseUrl = targetPath
            ? new URL(targetPath, window.location.origin)
            : new URL(window.location.href);
          baseUrl.searchParams.set("devState", e.target.value);
          window.location.href = baseUrl.toString();
        }}
        className="cursor-pointer rounded bg-card text-sm text-foreground outline-none"
      >
        {(mode === "error"
          ? [
              { value: "401", label: "401" },
              { value: "403", label: "403" },
              { value: "404", label: "404" },
              { value: "500", label: "500" },
            ]
          : stateOptions).map((state) => (
          <option key={state.value} value={state.value}>
            {state.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function useCanShowDevAdminSelector() {
  const [canShow, setCanShow] = useState(process.env.NODE_ENV === "development");

  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;

    let isActive = true;

    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { isAdmin?: boolean };
      })
      .then((session) => {
        if (!isActive || !session) return;
        setCanShow(Boolean(session.isAdmin));
      })
      .catch((error) => {
        console.error("Failed to load dev admin selector session", error);
      });

    return () => {
      isActive = false;
    };
  }, []);

  return canShow;
}
