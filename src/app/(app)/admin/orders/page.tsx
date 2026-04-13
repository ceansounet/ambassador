import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { SlackAvatar } from "@/components/admin/slack-profile";
import { pillVariants } from "@/components/ui/pill";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import {
  ORDER_STATUS_APPROVED,
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_FAILED,
  ORDER_STATUS_PENDING,
  ORDER_STATUS_REJECTED,
} from "@/lib/shop";
import { formatHackClubAddress, type HackClubAddress } from "@/lib/settings";

type OrderRow = {
  id: string;
  status: string;
  sku: string | null;
  variant: string | null;
  address: HackClubAddress | null;
  note: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  user_slack_id: string | null;
  user_slack_name: string | null;
};

type CountRow = {
  total: number;
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.orders.metadata.title");
}

export default async function AdminOrdersPage({
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

  const [orders, countResult] = await Promise.all([
    sql<OrderRow[]>`
      SELECT o.id, o.status, o.sku, o.variant, o.address, o.note, o.created_at,
             u.display_name AS user_name, u.email AS user_email,
             u.slack_id AS user_slack_id, u.slack_name AS user_slack_name
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      WHERE (${searchFilter}::text IS NULL OR (
        u.display_name ILIKE ${searchFilter}
        OR u.email ILIKE ${searchFilter}
        OR u.slack_id ILIKE ${searchFilter}
        OR u.slack_name ILIKE ${searchFilter}
      ))
      ORDER BY
        CASE WHEN o.status = ${ORDER_STATUS_PENDING} THEN 0 ELSE 1 END,
        o.created_at DESC
      LIMIT ${20} OFFSET ${offset}
    `,
    sql<CountRow[]>`
      SELECT COUNT(*)::int AS total
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
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
        <h1 className="text-4xl text-white">{t("admin.orders.title")}</h1>
      </header>
      <SearchBar placeholder={t("admin.search-placeholder")} />
      <div className="overflow-x-auto border border-white/10 bg-card p-3 md:p-4">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white">
              <th className="px-5 py-4 font-body text-base text-secondary">
                {t("admin.orders.columns.user")}
              </th>
              <th className="px-5 py-4 font-body text-base text-secondary">
                {t("admin.orders.columns.item")}
              </th>
              <th className="px-5 py-4 font-body text-base text-secondary">
                {t("admin.orders.columns.address")}
              </th>
              <th className="px-5 py-4 font-body text-base text-secondary">
                {t("admin.orders.columns.status")}
              </th>
              <th className="px-5 py-4 font-body text-base text-secondary">
                {t("admin.orders.columns.placed")}
              </th>
              <th className="px-5 py-4 font-body text-base text-secondary">
                {t("admin.orders.columns.open")}
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-white align-top">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <SlackAvatar
                      slackId={order.user_slack_id}
                      fallbackName={order.user_slack_name ?? order.user_name}
                      sizeClassName="h-12 w-12"
                    />
                    <div>
                      <div className="font-body text-base text-white">
                        {order.user_name ?? "-"}
                      </div>
                      <div className="font-body text-sm text-black">
                        {order.user_email ?? "-"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  <div>{order.sku ?? "-"}</div>
                  {order.variant !== null && order.variant !== "" ? (
                    <div className="font-body text-sm text-black">
                      {t("admin.orders.size", { size: order.variant })}
                    </div>
                  ) : null}
                </td>
                <td className="px-5 py-4 max-w-xs font-body text-sm text-white">
                  {formatHackClubAddress(order.address) || "-"}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={pillVariants({
                      tone:
                        order.status === ORDER_STATUS_APPROVED
                          ? "green"
                          : order.status === ORDER_STATUS_REJECTED ||
                              order.status === ORDER_STATUS_FAILED ||
                              order.status === ORDER_STATUS_CANCELLED
                            ? "red"
                            : "black",
                    })}
                  >
                    {order.status}
                  </span>
                  {order.note !== null && order.note.trim() !== "" ? (
                    <p className="mt-2 max-w-xs font-body text-sm text-primary">
                      {order.note}
                    </p>
                  ) : null}
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  {new Date(order.created_at).toLocaleDateString(locale)}
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    aria-label={t("admin.orders.view-order")}
                    className="ui-open-link inline-flex font-body text-lg leading-none"
                  >
                    <span aria-hidden="true">↗</span>
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center font-body text-base text-white">
                  {t("admin.orders.empty")}
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
