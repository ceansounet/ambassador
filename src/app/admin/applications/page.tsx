import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { SlackAvatar } from "@/components/admin/slack-profile";
import { StatusBadge } from "@/components/admin/status-badge";
import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";

export default async function AdminApplicationsPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  await ensureSchema();
  const applications = await sql`
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
      WHERE user_id = a.user_id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) latest ON true
    ORDER BY a.created_at DESC
    LIMIT 100
  `;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl text-white">{t("admin.applications-list.title")}</h1>
      </header>
      <div className="overflow-x-auto rounded-3xl border border-white/10 p-3 md:p-4">
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
                    {application.is_latest ? (
                      <span className="rounded-lg bg-acceptance px-2 py-1 text-xs text-black">
                        {t("admin.applications-list.latest")}
                      </span>
                    ) : (
                      <span className="rounded-lg border border-white px-2 py-1 text-xs text-white">
                        {t("admin.applications-list.history")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {application.city && application.country_code
                    ? `${application.city}, ${application.country_code}`
                    : application.address_city && application.address_country
                      ? `${application.address_city}, ${application.address_country}`
                    : "-"}
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {new Date(application.created_at).toLocaleDateString(locale)}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/applications/${application.id}`}
                    className="inline-flex rounded-xl bg-secondary px-3 py-1.5 font-body text-sm text-black transition-opacity hover:opacity-80"
                  >
                    {t("admin.applications-list.view-details")}
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
      </div>
    </div>
  );
}
