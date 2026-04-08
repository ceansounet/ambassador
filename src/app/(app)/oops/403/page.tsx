import type { Metadata } from "next";

import { ForbiddenPage } from "@/components/errors/forbidden-page";
import { getTranslatedPageMetadata } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("error-pages.forbidden.metadata.title");
}

export default function Oops403Page() {
  return <ForbiddenPage />;
}
