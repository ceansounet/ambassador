import type { Metadata } from "next";

import { NotFoundPage } from "@/components/errors/not-found-page";
import { getTranslatedPageMetadata } from "@/i18n/metadata";

import "./(app)/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("error-pages.not-found.metadata.title");
}

export default function NotFound() {
  return <NotFoundPage />;
}
