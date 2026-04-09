import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

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
};

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.orders.metadata.title");
}

export default async function AdminOrdersPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  await ensureSchema();

  const orders = (await sql`
    SELECT o.id, o.status, o.sku, o.variant, o.address, o.note, o.created_at,
           u.display_name AS user_name, u.email AS user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ORDER BY
      CASE WHEN o.status = ${ORDER_STATUS_PENDING} THEN 0 ELSE 1 END,
      o.created_at DESC
    LIMIT 200
  `) as unknown as OrderRow[];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl text-white">{t("admin.orders.title")}</h1>
      </header>

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
                  <div className="font-body text-base text-white">
                    {order.user_name ?? "-"}
                  </div>
                  <div className="font-body text-sm text-white/70">
                    {order.user_email ?? "-"}
                  </div>
                </td>
                <td className="px-5 py-4 font-body text-base text-white">
                  <div>{order.sku ?? "-"}</div>
                  {order.variant ? (
                    <div className="font-body text-sm text-white/70">
                      {t("admin.orders.size", { size: order.variant })}
                    </div>
                  ) : null}
                </td>
                <td className="px-5 py-4 max-w-xs font-body text-sm text-white">
                  {order.address ? formatHackClubAddress(order.address) : "-"}
                </td>
                <td className="px-5 py-4">
                  <OrderStatusBadge status={order.status} />
                  {order.note ? (
                    <p className="mt-2 max-w-xs font-body text-sm text-rejection">
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
      </div>
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const tone =
    status === ORDER_STATUS_APPROVED
      ? "green"
      : status === ORDER_STATUS_REJECTED ||
          status === ORDER_STATUS_FAILED ||
          status === ORDER_STATUS_CANCELLED
        ? "red"
        : "black";

  return <span className={pillVariants({ tone })}>{status}</span>;
}
