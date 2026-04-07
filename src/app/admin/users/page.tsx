import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { SlackAvatar } from "@/components/admin/slack-profile";
import { StatusBadge } from "@/components/admin/status-badge";
import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";

export default async function AdminUsersPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  await ensureSchema();
  const users = await sql`
    SELECT u.id, u.email, u.display_name, u.slack_id, u.slack_name, u.is_admin,
           u.created_at, latest.id AS latest_application_id, latest.status AS latest_application_status,
           app_count.application_count
    FROM users u
    LEFT JOIN LATERAL (
      SELECT id, status
      FROM applications
      WHERE user_id = u.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS application_count
      FROM applications
      WHERE user_id = u.id
    ) app_count ON true
    ORDER BY u.created_at DESC
    LIMIT 100
  `;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl text-white">{t("admin.users-list.title")}</h1>
      </header>
      <div className="overflow-x-auto border border-white/10 bg-card p-3 md:p-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white">
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.users-list.columns.name")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.users-list.columns.email")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.users-list.columns.latest-app")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.users-list.columns.apps")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.users-list.columns.admin")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.users-list.columns.joined")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.users-list.columns.open")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-white">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <SlackAvatar
                      slackId={user.slack_id}
                      fallbackName={user.slack_name ?? user.display_name}
                      sizeClassName="h-12 w-12"
                    />
                    <div className="font-body text-base text-white">{user.display_name}</div>
                  </div>
                </td>
                <td className="px-5 py-4 font-body text-base text-white">{user.email ?? "-"}</td>
                <td className="px-5 py-4">
                  {user.latest_application_status ? (
                    <StatusBadge status={user.latest_application_status} />
                  ) : (
                    <span className="font-body text-base text-white">{t("admin.users-list.no-application")}</span>
                  )}
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {user.application_count ?? 0}
                </td>
                <td className="px-5 py-4 font-body text-base">
                  {user.is_admin ? (
                    <span className="text-acceptance">{t("common.yes")}</span>
                  ) : (
                    <span className="text-white">{t("common.no")}</span>
                  )}
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {new Date(user.created_at).toLocaleDateString(locale)}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="inline-flex rounded-xl bg-secondary px-3 py-1.5 font-body text-sm text-black transition-opacity hover:opacity-80"
                  >
                    {t("admin.users-list.view-user")}
                  </Link>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center font-body text-base text-white">
                  {t("admin.users-list.empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
