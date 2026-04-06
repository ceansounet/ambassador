import { getTranslations } from "next-intl/server";

import Icon from "@hackclub/icons";

import { ErrorFrame } from "@/components/errors/error-frame";

export async function NotFoundPage() {
  const t = await getTranslations("error-pages.not-found");

  return (
    <ErrorFrame
      code={t("code")}
      title={t("title")}
      description={t("description")}
      icon={<Icon glyph="search" size={24} />}
      primaryAction={{ href: "/", label: t("action") }}
    />
  );
}
