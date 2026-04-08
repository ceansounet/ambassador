"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import Icon from "@hackclub/icons";

import { Button } from "@/components/ui/button";
import { ErrorFrame } from "@/components/errors/error-frame";

type InternalErrorPageProps = {
  onRetry?: () => void;
};

export function InternalErrorPage({ onRetry }: InternalErrorPageProps) {
  const t = useTranslations("error-pages.internal");

  return (
    <ErrorFrame
      code={t("code")}
      title={t("title")}
      description={t("description")}
      icon={<Icon glyph="bug" size={24} />}
      primaryAction={undefined}
    >
      <div className="mt-8 flex flex-wrap gap-3">
        {onRetry ? (
          <Button variant="success" size="app" onClick={onRetry}>
            {t("retry")}
          </Button>
        ) : null}
        <Button asChild size="app">
          <Link href="/dashboard">{t("action")}</Link>
        </Button>
      </div>
    </ErrorFrame>
  );
}
