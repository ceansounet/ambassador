import { getTranslations } from "next-intl/server";

import Icon from "@hackclub/icons";

import { ErrorFrame } from "@/components/errors/error-frame";

export async function ForbiddenPage() {
  const t = await getTranslations("error-pages.forbidden");

  return (
    <ErrorFrame
      code={t("code")}
      title={t("title")}
      description={t("description")}
      icon={<Icon glyph="forbidden" size={24} />}
      primaryAction={{ href: "/dashboard", label: t("action") }}
    />
  );
}
