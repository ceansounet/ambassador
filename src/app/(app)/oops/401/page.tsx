import type { Metadata } from "next";

import { UnauthorizedPage } from "@/components/errors/unauthorized-page";
import { getTranslatedPageMetadata } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("error-pages.unauthorized.metadata.title");
}

export default function Oops401Page() {
  return <UnauthorizedPage />;
}
