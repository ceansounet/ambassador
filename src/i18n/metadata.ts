import "server-only";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function getTranslatedPageMetadata(titleKey: string): Promise<Metadata> {
  const t = await getTranslations();

  return {
    title: `${t(titleKey)} · ${t("app.metadata.title")}`,
  };
}
