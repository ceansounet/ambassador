import { getTranslations } from "next-intl/server";

import Icon from "@hackclub/icons";

import { ErrorFrame } from "@/components/errors/error-frame";
import { canShowDevAdminSelector } from "@/lib/dev-admin-selector";
import { getSession } from "@/lib/session";

export async function NotFoundPage() {
  const session = await getSession();
  const t = await getTranslations("error-pages.not-found");

  return (
    <ErrorFrame
      code={t("code")}
      title={t("title")}
      description={t("description")}
      icon={<Icon glyph="search" size={24} />}
      primaryAction={{ href: "/", label: t("action") }}
      showDevAdminSelector={canShowDevAdminSelector(Boolean(session?.isAdmin))}
    />
  );
}
