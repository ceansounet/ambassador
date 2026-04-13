import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { SlackAvatar } from "@/components/admin/slack-profile";
import { StatusBadge } from "@/components/admin/status-badge";
import { pillVariants } from "@/components/ui/pill";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";

type CountRow = { total: number };

type ApplicationListRow = {
  id: string;
  status: string;
  name: string | null;
  applicant_email: string | null;
  applicant_slack_id: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string | null;
  submitted_ip: string | null;
  city: string | null;
  country_code: string | null;
  created_at: string;
  is_latest: boolean;
  user_name: string | null;
  user_email: string | null;
  slack_id: string | null;
  slack_name: string | null;
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.applications-list.metadata.title");
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const [t, locale, query] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  await ensureSchema();

  const page = Math.max(1, Number(query.page ?? "1"));
  const offset = (page - 1) * 20;
  const search = query.q?.trim() ?? "";
  const searchFilter = search ? `%${search}%` : null;

  const [applications, countResult] = await Promise.all([
    sql<ApplicationListRow[]>`
      SELECT a.id, a.status, a.name, a.applicant_email, a.applicant_slack_id,
             a.address_city, a.address_state, a.address_country, a.submitted_ip,
             a.city, a.country_code, a.created_at,
             COALESCE(latest.id = a.id, TRUE) AS is_latest,
             u.display_name AS user_name, u.email AS user_email, u.slack_id, u.slack_name
      FROM applications a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN LATERAL (
        SELECT id
        FROM applications
        WHERE (a.user_id IS NOT NULL AND user_id = a.user_id)
           OR (a.user_id IS NULL AND a.applicant_email IS NOT NULL AND user_id IS NULL AND LOWER(applicant_email) = LOWER(a.applicant_email))
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      ) latest ON true
      WHERE (${searchFilter}::text IS NULL OR (
        a.name ILIKE ${searchFilter}
        OR a.applicant_email ILIKE ${searchFilter}
        OR a.applicant_slack_id ILIKE ${searchFilter}
        OR u.display_name ILIKE ${searchFilter}
        OR u.email ILIKE ${searchFilter}
        OR u.slack_id ILIKE ${searchFilter}
        OR u.slack_name ILIKE ${searchFilter}
      ))
      ORDER BY a.created_at DESC
      LIMIT ${20} OFFSET ${offset}
    `,
    sql<CountRow[]>`
      SELECT COUNT(*)::int AS total
      FROM applications a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE (${searchFilter}::text IS NULL OR (
        a.name ILIKE ${searchFilter}
        OR a.applicant_email ILIKE ${searchFilter}
        OR a.applicant_slack_id ILIKE ${searchFilter}
        OR u.display_name ILIKE ${searchFilter}
        OR u.email ILIKE ${searchFilter}
        OR u.slack_id ILIKE ${searchFilter}
        OR u.slack_name ILIKE ${searchFilter}
      ))
    `,
  ]);

  const totalCount = countResult.at(0)?.total ?? 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl text-white">{t("admin.applications-list.title")}</h1>
      </header>
      <SearchBar placeholder={t("admin.search-placeholder")} />
      <div className="overflow-x-auto border border-white/10 bg-card p-3 md:p-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white">
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.applications-list.columns.applicant")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.applications-list.columns.name-on-app")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.applications-list.columns.status")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.applications-list.columns.location")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.applications-list.columns.submitted")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.applications-list.columns.open")}</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-white">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <SlackAvatar
                      slackId={application.slack_id ?? application.applicant_slack_id}
                      fallbackName={application.slack_name ?? application.user_name ?? application.name}
                      sizeClassName="h-12 w-12"
                    />
                    <div>
                      <div className="font-body text-base text-white">
                        {application.user_name ?? application.name ?? "-"}
                      </div>
                      <div className="font-body text-sm text-white">
                        {application.user_email ?? application.applicant_email ?? "-"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {application.name ?? "-"}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={application.status} />
                    {application.is_latest === true ? (
                      <span className={pillVariants({ tone: "green" })}>
                        {t("admin.applications-list.latest")}
                      </span>
                    ) : (
                      <span className={pillVariants({ tone: "black" })}>
                        {t("admin.applications-list.history")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {application.city !== null && application.country_code !== null
                    ? `${application.city}, ${application.country_code}`
                    : application.address_city !== null && application.address_country !== null
                      ? `${application.address_city}, ${application.address_country}`
                      : "-"}
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {new Date(application.created_at).toLocaleDateString(locale)}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/applications/${application.id}`}
                    aria-label={t("admin.applications-list.view-details")}
                    className="ui-open-link inline-flex font-body text-lg leading-none"
                  >
                    <span aria-hidden="true">↗</span>
                  </Link>
                </td>
              </tr>
            ))}
            {applications.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center font-body text-base text-white">
                  {t("admin.applications-list.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          totalCount={totalCount}
          pageSize={20}
          labels={{
            previous: t("admin.pagination.previous"),
            next: t("admin.pagination.next"),
            page: t("admin.pagination.page"),
          }}
        />
      </div>
    </div>
  );
}
