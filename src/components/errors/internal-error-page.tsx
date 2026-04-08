"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import Icon from "@hackclub/icons";

import { Button } from "@/components/ui/button";
import { ErrorFrame } from "@/components/errors/error-frame";

type InternalErrorPageProps = {
  onRetry?: () => void;
  showDevAdminSelector?: boolean;
};

export function InternalErrorPage({ onRetry, showDevAdminSelector = false }: InternalErrorPageProps) {
  const t = useTranslations("error-pages.internal");

  return (
    <ErrorFrame
      code={t("code")}
      title={t("title")}
      description={t("description")}
      icon={<Icon glyph="bug" size={24} />}
      primaryAction={onRetry ? undefined : { href: "/", label: t("action") }}
      showDevAdminSelector={showDevAdminSelector}
    >
      <div className="mt-8">
        {onRetry ? (
          <Button variant="success" size="app" onClick={onRetry}>
            {t("retry")}
          </Button>
        ) : (
          <Button asChild size="app">
            <Link href="/">{t("action")}</Link>
          </Button>
        )}
      </div>
    </ErrorFrame>
  );
}
