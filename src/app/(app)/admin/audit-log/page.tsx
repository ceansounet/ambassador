import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { SearchBar } from "@/components/admin/search-bar";
import { SortToggle } from "@/components/admin/sort-toggle";
import { Pagination } from "@/components/admin/pagination";
import { EventTypeFilter, UserMultiSelect } from "@/components/admin/audit-log-filters";
import { LocalDateTime } from "@/components/admin/local-date-time";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import {
  formatAuditEventSummary,
  formatEventType,
} from "@/lib/admin-action-event-format";
import type { AdminActionEvent } from "@/lib/admin-action-events";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";

type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_display_name: string | null;
  target_display_name: string | null;
};

type AuditLogResultRow = {
  events: AuditLogRow[];
  total: number;
};

type AdminUser = {
  id: string;
  display_name: string;
  slack_id: string | null;
};

const EVENT_TYPES: AdminActionEvent[] = [
  "application_deleted",
  "application_review_hold_updated",
  "application_tshirt_sent_updated",
  "global_safeguard_updated",
  "hcb_credentials_reauthorized",
  "poster_deleted",
  "poster_group_deleted",
  "user_admin_password_rejected",
  "user_demoted_from_admin",
  "user_impersonation_started",
  "user_impersonation_stopped",
  "user_hcb_grant_linked",
  "user_hcb_grant_provisioned",
  "user_hcb_grant_unlinked",
  "user_manual_dashboard_state_updated",
  "user_posters_enabled_updated",
  "user_feature_flag_override_updated",
  "user_promoted_to_admin",
];

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.audit-log.metadata.title");
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; event?: string; users?: string; sort?: string }>;
}) {
  const [t, locale, query] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  await ensureSchema();

  const page = Math.max(1, Number(query.page ?? "1"));
  const offset = (page - 1) * 20;
  const sortOrder = query.sort === "oldest" ? "ASC" : "DESC";
  const search = query.q?.trim() ?? "";
  const searchFilter = search ? `%${search}%` : null;
  const eventFilter = query.event?.trim() ?? "";
  const filterByEvent = eventFilter !== "" && eventFilter !== "all" ? eventFilter : null;

  const usersParam = query.users?.trim() ?? "";
  const filterUserIds =
    usersParam && usersParam !== "__none__"
      ? usersParam.split(",").filter(Boolean)
      : null;
  const filterNone = usersParam === "__none__";

  const [eventList, adminUsers] = await Promise.all([
    sql<AuditLogResultRow[]>`
      WITH filtered AS (
        SELECT
          e.id, e.actor_user_id, e.target_user_id, e.action, e.metadata, e.created_at,
          actor.display_name AS actor_display_name,
          target.display_name AS target_display_name
        FROM admin_action_events e
        LEFT JOIN users actor ON actor.id = e.actor_user_id
        LEFT JOIN users target ON target.id = e.target_user_id
        WHERE (${searchFilter}::text IS NULL OR (
          actor.display_name ILIKE ${searchFilter}
          OR actor.email ILIKE ${searchFilter}
          OR actor.slack_id ILIKE ${searchFilter}
          OR actor.slack_name ILIKE ${searchFilter}
          OR target.display_name ILIKE ${searchFilter}
          OR target.email ILIKE ${searchFilter}
          OR target.slack_id ILIKE ${searchFilter}
          OR target.slack_name ILIKE ${searchFilter}
        ))
        AND (${filterByEvent}::text IS NULL OR e.action = ${filterByEvent})
        AND (
          ${filterNone} = false AND (
            ${filterUserIds}::text[] IS NULL
            OR e.actor_user_id = ANY(${filterUserIds ?? []})
          )
        )
      ),
      page AS (
        SELECT *, COUNT(*) OVER()::int AS total
        FROM filtered
        ORDER BY created_at ${sortOrder === "ASC" ? sql`ASC` : sql`DESC`}, id ${sortOrder === "ASC" ? sql`ASC` : sql`DESC`}
        LIMIT ${20} OFFSET ${offset}
      )
      SELECT
        COALESCE(
          jsonb_agg(to_jsonb(page) - 'total' ORDER BY page.created_at ${sortOrder === "ASC" ? sql`ASC` : sql`DESC`}, page.id ${sortOrder === "ASC" ? sql`ASC` : sql`DESC`}),
          '[]'::jsonb
        ) AS events,
        COALESCE(MAX(page.total), (SELECT COUNT(*)::int FROM filtered)) AS total
      FROM page
    `,
    sql<AdminUser[]>`
      SELECT id, display_name, slack_id
      FROM users
      WHERE is_admin = true
      ORDER BY display_name ASC
    `,
  ]);

  const events = eventList.at(0)?.events ?? [];
  const totalCount = eventList.at(0)?.total ?? 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl text-foreground">{t("admin.audit-log.title")}</h1>
      </header>
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <div className="w-full max-w-sm">
          <SearchBar placeholder={t("admin.search-placeholder")} strongPlaceholder />
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:ml-auto sm:w-auto sm:flex-nowrap">
          <EventTypeFilter
            placeholder={t("admin.audit-log.event-filter.all")}
            options={EVENT_TYPES.map((event) => ({
              value: event,
              label: formatEventType(event),
            }))}
          />
          <UserMultiSelect
            users={adminUsers.map((u) => ({ id: u.id, displayName: u.display_name, slackId: u.slack_id }))}
            allLabel={t("admin.audit-log.user-filter.all")}
            selectAllLabel={t("admin.audit-log.user-filter.select-all")}
            deselectAllLabel={t("admin.audit-log.user-filter.deselect-all")}
            noneLabel={t("admin.audit-log.user-filter.none")}
            selectionNoun={t("admin.audit-log.user-filter.selection-noun")}
          />
          <SortToggle defaultSort="newest" />
        </div>
      </div>
      <div className="ui-table-card">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-foreground">
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.audit-log.columns.event")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.audit-log.columns.actor")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.audit-log.columns.target")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.audit-log.columns.details")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.audit-log.columns.when")}</th>
              <th className="px-5 py-4 font-body text-base text-secondary">{t("admin.audit-log.columns.open")}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-foreground last:border-b-0">
                <td className="px-5 py-4 font-body text-base text-foreground">
                  {formatEventType(event.action)}
                </td>
                <td className="px-5 py-4 font-body text-base text-foreground">
                  {event.actor_user_id ? (
                    <Link
                      href={`/admin/users/${event.actor_user_id}`}
                      className="ui-open-link"
                    >
                      {event.actor_display_name ?? t("admin.audit-log.unknown-user")}
                    </Link>
                  ) : (
                    <span className="text-secondary">{t("admin.audit-log.system")}</span>
                  )}
                </td>
                <td className="px-5 py-4 font-body text-base text-foreground">
                  {event.target_user_id ? (
                    <Link
                      href={`/admin/users/${event.target_user_id}`}
                      className="ui-open-link"
                    >
                      {event.target_display_name ?? t("admin.audit-log.unknown-user")}
                    </Link>
                  ) : (
                    <span className="text-secondary">-</span>
                  )}
                </td>
                <td className="max-w-sm px-5 py-4 font-body text-sm font-bold text-foreground">
                  <span className="line-clamp-2" title={formatAuditEventSummary(event)}>
                    {formatAuditEventSummary(event)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 font-body text-base text-foreground">
                  <LocalDateTime value={event.created_at} locale={locale} />
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/audit-log/${event.id}`}
                    aria-label={t("admin.audit-log.view-event")}
                    className="ui-open-link inline-flex font-body text-lg leading-none"
                  >
                    <span aria-hidden="true">↗</span>
                  </Link>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center font-body text-base text-foreground">
                  {t("admin.audit-log.empty")}
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
