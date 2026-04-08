"use client";

import { useEffect } from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";

import Icon from "@hackclub/icons";

import { useCanShowDevAdminSelector } from "@/components/dev-admin-selector";
import { Button } from "@/components/ui/button";
import { ErrorFrame } from "@/components/errors/error-frame";
import { clientMessages } from "@/i18n/client-messages";
import { instrumentSans, jersey25 } from "@/lib/fonts";

import "./(app)/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <NextIntlClientProvider locale="en-US" messages={clientMessages}>
      <GlobalErrorDocument error={error} reset={reset} />
    </NextIntlClientProvider>
  );
}

function GlobalErrorDocument({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const canShowDevAdminSelector = useCanShowDevAdminSelector();
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={`${instrumentSans.variable} ${jersey25.variable}`}>
      <head>
        <title>{`${t("error-pages.internal.metadata.title")} · ${t("app.metadata.title")}`}</title>
      </head>
      <body>
        <ErrorFrame
          code={t("error-pages.internal.code")}
          title={t("error-pages.internal.title")}
          description={t("error-pages.internal.description")}
          icon={<Icon glyph="bug" size={24} />}
          primaryAction={undefined}
          showDevAdminSelector={canShowDevAdminSelector}
        >
          <div className="mt-8">
            <Button size="app" onClick={reset}>
              {t("error-pages.internal.retry")}
            </Button>
          </div>
        </ErrorFrame>
      </body>
    </html>
  );
}
