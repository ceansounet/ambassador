import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { SlackAvatar } from "@/components/admin/slack-profile";
import { StatusBadge } from "@/components/admin/status-badge";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";

type CountRow = { total: number };

type UserListRow = {
  id: string;
  email: string | null;
  display_name: string;
  slack_id: string | null;
  slack_name: string | null;
  is_admin: boolean | null;
  created_at: string;
  latest_application_id: string | null;
  latest_application_status: string | null;
  application_count: number;
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.users-list.metadata.title");
}

export default async function AdminUsersPage({
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

  const [users, countResult] = await Promise.all([
    sql<UserListRow[]>`
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
      WHERE (${searchFilter}::text IS NULL OR (
        u.display_name ILIKE ${searchFilter}
        OR u.email ILIKE ${searchFilter}
        OR u.slack_id ILIKE ${searchFilter}
        OR u.slack_name ILIKE ${searchFilter}
      ))
      ORDER BY u.created_at DESC
      LIMIT ${20} OFFSET ${offset}
    `,
    sql<CountRow[]>`
      SELECT COUNT(*)::int AS total
      FROM users u
      WHERE (${searchFilter}::text IS NULL OR (
        u.display_name ILIKE ${searchFilter}
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
        <h1 className="text-4xl text-white">{t("admin.users-list.title")}</h1>
      </header>
      <SearchBar placeholder={t("admin.search-placeholder")} />
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
                  {user.latest_application_status !== null ? (
                    <StatusBadge status={user.latest_application_status} />
                  ) : (
                    <span className="font-body text-base text-white">{t("admin.users-list.no-application")}</span>
                  )}
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {user.application_count}
                </td>
                <td className="px-5 py-4 font-body text-base">
                  {user.is_admin === true ? (
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
                    aria-label={t("admin.users-list.view-user")}
                    className="ui-open-link inline-flex font-body text-lg leading-none"
                  >
                    <span aria-hidden="true">↗</span>
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
