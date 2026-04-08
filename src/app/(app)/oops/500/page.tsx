import Icon from "@hackclub/icons";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ErrorFrame } from "@/components/errors/error-frame";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { canShowDevAdminSelector } from "@/lib/dev-admin-selector";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("error-pages.internal.metadata.title");
}

export default async function Oops500Page() {
  const session = await getSession();
  const t = await getTranslations("error-pages.internal");

  return (
    <ErrorFrame
      code={t("code")}
      title={t("title")}
      description={t("description")}
      icon={<Icon glyph="bug" size={24} />}
      primaryAction={{ href: "/", label: t("action") }}
      showDevAdminSelector={canShowDevAdminSelector(Boolean(session?.isAdmin))}
    />
  );
}
