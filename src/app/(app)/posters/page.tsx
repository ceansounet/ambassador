import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { listPosterCampaigns } from "@/lib/posters/config";
import { listPosterDataForUser } from "@/lib/posters/service";
import { getSession } from "@/lib/session";

import { PostersClient } from "./PostersClient";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("posters.metadata.title");
}

export default async function PostersPage() {
  const session = await getSession();
  if (!session) redirect("/");
  await ensureSchema();
  const t = await getTranslations();

  const [user] = await sql<{
    balance_cents: number | null;
    is_admin: boolean | null;
    posters_enabled: boolean | null;
  }[]>`
    SELECT balance_cents, is_admin, posters_enabled
    FROM users
    WHERE id = ${session.sub}
    LIMIT 1
  `;

  if (!user?.posters_enabled) {
    return (
      <main className="page-shell">
        <Navbar isAdmin={Boolean(user?.is_admin)} balanceCents={user?.balance_cents ?? 0} />
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-4xl text-white">{t("posters.unavailable")}</h1>
        </div>
      </main>
    );
  }

  const data = await listPosterDataForUser(session.sub);

  const campaigns = listPosterCampaigns();

  return (
    <main className="page-shell">
      <Navbar isAdmin={Boolean(user?.is_admin)} balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl text-white">{t("posters.heading")}</h1>
          <p className="mt-2 text-base text-muted-foreground">{t("posters.subheading")}</p>
        </header>
        <PostersClient
          initialCampaignSlug={campaigns[0]?.slug ?? null}
          campaigns={campaigns}
          initialData={data}
        />
      </div>
    </main>
  );
}
