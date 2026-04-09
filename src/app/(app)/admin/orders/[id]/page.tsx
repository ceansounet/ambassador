import Icon from "@hackclub/icons";
import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ConfirmSubmitForm } from "@/components/admin/confirm-submit-form";
import { DetailFieldRow, DetailSection } from "@/components/admin/detail";
import { SlackAvatar } from "@/components/admin/slack-profile";
import { buttonVariants } from "@/components/ui/button";
import { pillVariants } from "@/components/ui/pill";
import { Textarea } from "@/components/ui/textarea";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { formatDateTime } from "@/lib/format";
import { formatHackClubAddress, type HackClubAddress } from "@/lib/settings";
import {
  buildWarehousePublicOrderUrl,
  buildWarehouseTrackingUrl,
  ORDER_STATUS_APPROVED,
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_FAILED,
  ORDER_STATUS_REJECTED,
} from "@/lib/shop";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.order-detail.page-title");
}

type OrderDetailRow = {
  id: string;
  user_id: string;
  status: string;
  sku: string | null;
  variant: string | null;
  quantity: number | null;
  address: HackClubAddress | null;
  warehouse_order_id: string | null;
  warehouse_status: string | null;
  note: string | null;
  internal_fail_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
  user_slack_id: string | null;
  user_slack_name: string | null;
  reviewed_by_name: string | null;
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, t, locale] = await Promise.all([
    params,
    getTranslations(),
    getLocale(),
  ]);
  await ensureSchema();

  const [order] = (await sql`
    SELECT o.id, o.user_id, o.status, o.sku, o.variant, o.quantity, o.address,
           o.warehouse_order_id, o.warehouse_status, o.note, o.internal_fail_reason,
           o.reviewed_at, o.created_at, o.updated_at,
           u.display_name AS user_name, u.email AS user_email,
           u.slack_id AS user_slack_id, u.slack_name AS user_slack_name,
           reviewer.display_name AS reviewed_by_name
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    LEFT JOIN users reviewer ON reviewer.id = o.reviewed_by
    WHERE o.id = ${id}
    LIMIT 1
  `) as unknown as OrderDetailRow[];

  if (!order) notFound();

  const redirectTo = `/admin/orders/${order.id}`;
  const addressString = order.address ? formatHackClubAddress(order.address) : null;
  const [latestOrder] = order.user_id
    ? await sql`
        SELECT id
        FROM orders
        WHERE user_id = ${order.user_id}
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `
    : [null];
  const isLatestOrder = latestOrder?.id === order.id;
  const warehouseUrl = order.warehouse_order_id
    ? buildWarehouseTrackingUrl(order.warehouse_order_id)
    : null;
  const publicOrderUrl = order.warehouse_order_id
    ? buildWarehousePublicOrderUrl(order.warehouse_order_id)
    : null;

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
          <Link href="/admin/orders" className="hover:text-white">
            {t("admin.order-detail.breadcrumb")}
          </Link>
          <span>/</span>
          <span className="font-body text-white">{order.id}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <SlackAvatar
                slackId={order.user_slack_id}
                fallbackName={order.user_slack_name ?? order.user_name}
                sizeClassName="h-16 w-16"
                textClassName="text-lg"
              />
              <h1 className="text-4xl text-white">
                {order.user_name ?? t("admin.order-detail.unknown-user")}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
          {order.user_id ? (
            <Link
              href={`/admin/users/${order.user_id}`}
              aria-label={t("admin.order-detail.open-user-page")}
              className="ui-open-link inline-flex font-body text-lg leading-none"
            >
              <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
        </div>
      </header>

      <DetailSection
        title={t("admin.order-detail.sections.review-actions.title")}
        description={t("admin.order-detail.sections.review-actions.description")}
      >
        {isLatestOrder ? (
          <div className="space-y-6">
            <form
              action={`/api/admin/orders/${order.id}/approve`}
              method="POST"
              className="max-w-xl space-y-3"
            >
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button className={buttonVariants({ variant: "success", size: "app" })}>
                {order.warehouse_order_id
                  ? t("admin.order-detail.actions.approve-existing")
                  : t("admin.order-detail.actions.approve")}
              </button>
            </form>

            <ConfirmSubmitForm
              action={`/api/admin/orders/${order.id}/reject`}
              method="POST"
              className="max-w-xl space-y-3"
              confirmationMessage={t("common.confirm-destructive")}
            >
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label className="block text-sm text-secondary">
                {t("admin.order-detail.actions.reject-note-label")}
                <Textarea
                  name="note"
                  rows={4}
                  className="ui-input-surface mt-2 min-h-20 resize-none border-white bg-transparent px-5 py-4 font-body text-base font-normal placeholder:font-normal hover:bg-transparent md:text-base"
                  placeholder={t("admin.order-detail.actions.reject-note-placeholder")}
                />
              </label>
              <button className={buttonVariants({ size: "app" })}>
                {t("admin.order-detail.actions.reject")}
              </button>
            </ConfirmSubmitForm>
          </div>
        ) : (
          <p className="font-body text-base text-white">
            {t("admin.order-detail.actions.historical-order")}
          </p>
        )}
      </DetailSection>

      <DetailSection
        title={t("admin.order-detail.sections.order.title")}
        description={t("admin.order-detail.sections.order.description")}
      >
        <DetailFieldRow label={t("admin.order-detail.fields.order-id")} value={order.id} mono />
        <DetailFieldRow label={t("admin.order-detail.fields.sku")} value={order.sku} mono />
        <DetailFieldRow label={t("admin.order-detail.fields.variant")} value={order.variant} />
        <DetailFieldRow
          label={t("admin.order-detail.fields.quantity")}
          value={order.quantity != null ? String(order.quantity) : null}
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.address")}
          value={addressString}
          multiline
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.note")}
          value={order.note}
          multiline
        />
      </DetailSection>

      <DetailSection
        title={t("admin.order-detail.sections.warehouse.title")}
        description={t("admin.order-detail.sections.warehouse.description")}
      >
        <DetailFieldRow
          label={t("admin.order-detail.fields.warehouse-order-id")}
          value={order.warehouse_order_id}
          mono
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.warehouse-status")}
          value={order.warehouse_status}
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.internal-fail-reason")}
          value={order.internal_fail_reason}
          multiline
        />
        {warehouseUrl || publicOrderUrl ? (
          <div className="flex flex-wrap gap-3">
            {warehouseUrl ? (
              <a
                href={warehouseUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "app-sm" })}
              >
                {t("admin.order-detail.actions.open-warehouse-order")}
                <Icon glyph="external-fill" size={16} />
              </a>
            ) : null}
            {publicOrderUrl ? (
              <a
                href={publicOrderUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: "app-sm" })}
              >
                {t("admin.order-detail.actions.open-public-order")}
                <Icon glyph="external-fill" size={16} />
              </a>
            ) : null}
          </div>
        ) : null}
      </DetailSection>

      <DetailSection
        title={t("admin.order-detail.sections.metadata.title")}
        description={t("admin.order-detail.sections.metadata.description")}
      >
        <DetailFieldRow
          label={t("admin.order-detail.fields.placed")}
          value={formatDateTime(order.created_at, locale)}
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.last-updated")}
          value={formatDateTime(order.updated_at, locale)}
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.reviewed")}
          value={formatDateTime(order.reviewed_at, locale)}
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.reviewed-by")}
          value={order.reviewed_by_name}
        />
        <DetailFieldRow
          label={t("admin.order-detail.fields.user-email")}
          value={order.user_email}
        />
      </DetailSection>
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
