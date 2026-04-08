"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { useCanShowDevAdminSelector } from "@/components/dev-admin-selector";
import { InternalErrorPage } from "@/components/errors/internal-error-page";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const canShowDevAdminSelector = useCanShowDevAdminSelector();
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <title>{`${t("error-pages.internal.metadata.title")} · ${t("app.metadata.title")}`}</title>
      <InternalErrorPage onRetry={unstable_retry} showDevAdminSelector={canShowDevAdminSelector} />
    </>
  );
}
