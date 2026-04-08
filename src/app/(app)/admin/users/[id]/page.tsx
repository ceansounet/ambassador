import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ConfirmSubmitForm } from "@/components/admin/confirm-submit-form";
import { DetailFieldRow, DetailPager, DetailSection } from "@/components/admin/detail";
import { SlackAvatar, SlackProfile } from "@/components/admin/slack-profile";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { pillVariants } from "@/components/ui/pill";
import { Textarea } from "@/components/ui/textarea";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import {
  APPLICATION_STATUS_ACCEPTED,
  APPLICATION_STATUS_REJECTED,
  APPLICATION_STATUS_REJECTED_PERMANENT,
  canChangeApplicationReviewStatus,
  isRejectedPermanentlyApplicationStatus,
} from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { formatDate, formatDateTime, joinNonEmpty } from "@/lib/format";
import { ensureUserAddressSchema } from "@/lib/database/user-address-schema";

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.user-detail.metadata.title");
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visitsPage?: string }>;
}) {
  const [{ id }, query, t, locale] = await Promise.all([
    params,
    searchParams,
    getTranslations(),
    getLocale(),
  ]);
  const requestedVisitsPage = Number(query.visitsPage ?? "1");
  const visitsPage = Number.isFinite(requestedVisitsPage) && requestedVisitsPage > 0
    ? Math.floor(requestedVisitsPage)
    : 1;

  await ensureSchema();
  await ensureUserAddressSchema();

  const [user] = await sql`
    SELECT id, hca_id, email, display_name, hca_first_name, hca_last_name, hca_street_address,
           hca_locality, hca_region, hca_postal_code, hca_country, slack_id, slack_name,
           slack_avatar_url, verification_status, is_admin, last_ip, latitude, longitude, city,
           region, country_code, country_name, postal_code, timezone, org, hca_addresses,
           posters_enabled,
           permanently_rejected_at, permanent_rejection_note, created_at, updated_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!user) notFound();

  const addresses = Array.isArray(user.hca_addresses)
    ? user.hca_addresses.filter(
        (address): address is Record<string, unknown> =>
          !!address && typeof address === "object",
      )
    : [];

  const [latestApplication, applications, visitCountResult, visits, orders] = await Promise.all([
    sql`
      SELECT id, status, name, date_of_birth, decision_note, created_at, updated_at
      FROM applications
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `.then((rows) => rows[0] ?? null),
    sql`
      SELECT id, status, name, decision_note, created_at
      FROM applications
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC, id DESC
    `,
    sql`
      SELECT COUNT(*)::int AS count
      FROM ip_visits
      WHERE user_id = ${user.id}
    `.then((rows) => rows[0]?.count ?? 0),
    sql`
      SELECT id, ip, visit_type, city, region, country_code, org, created_at
      FROM ip_visits
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 3
      OFFSET ${(visitsPage - 1) * 3}
    `,
    sql`
      SELECT id, status, created_at
      FROM orders
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 10
    `,
  ]);

  const totalVisitPages = Math.max(1, Math.ceil(visitCountResult / 3));
  const currentVisitPage = Math.min(visitsPage, totalVisitPages);
  const shouldShowLatestApplicationLabel =
    !!latestApplication && !isRejectedPermanentlyApplicationStatus(latestApplication.status);
  const shouldShowPermanentRejectionLabel =
    !!user.permanently_rejected_at &&
    !isRejectedPermanentlyApplicationStatus(latestApplication?.status);
  const canAccept = latestApplication
    ? canChangeApplicationReviewStatus(latestApplication.status, APPLICATION_STATUS_ACCEPTED)
    : false;
  const canReject = latestApplication
    ? canChangeApplicationReviewStatus(latestApplication.status, APPLICATION_STATUS_REJECTED)
    : false;
  const canRejectPermanently = latestApplication
    ? canChangeApplicationReviewStatus(
        latestApplication.status,
        APPLICATION_STATUS_REJECTED_PERMANENT,
      )
    : false;

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
          <Link href="/admin/users" className="hover:text-white">
            {t("admin.user-detail.breadcrumb")}
          </Link>
          <span>/</span>
          <span className="font-body text-white">{user.id}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <SlackAvatar
                slackId={user.slack_id}
                fallbackName={user.slack_name ?? user.display_name}
                sizeClassName="h-16 w-16"
                textClassName="text-lg"
              />
              <h1 className="text-4xl text-white">{user.display_name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {latestApplication ? (
                <>
                  <StatusBadge status={latestApplication.status} />
                  {shouldShowLatestApplicationLabel ? (
                    <span className={pillVariants({ tone: "green" })}>
                      {t("admin.user-detail.latest-application")}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-sm text-white">{t("admin.user-detail.no-application")}</span>
              )}
              {shouldShowPermanentRejectionLabel && (
                <span className={pillVariants({ tone: "red" })}>
                  {t("admin.user-detail.user-permanently-rejected")}
                </span>
              )}
            </div>
          </div>
          {latestApplication ? (
            <Link
              href={`/admin/applications/${latestApplication.id}`}
              aria-label={t("admin.user-detail.open-latest-application")}
              className="ui-open-link inline-flex font-body text-lg leading-none"
            >
              <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
        </div>
      </header>

      <DetailSection
        title={t("admin.user-detail.sections.user-actions.title")}
        description={t("admin.user-detail.sections.user-actions.description")}
      >
        <a
          href={`/api/auth/refresh?next=${encodeURIComponent(`/admin/users/${user.id}`)}`}
          className={buttonVariants({ size: "app" })}
        >
          {t("app.navbar.refresh-session")}
        </a>

        {latestApplication ? (
          <div className="space-y-6">
            <div className="pb-2">
              <div className="text-sm text-secondary">{t("admin.user-detail.actions.current-review-target")}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="font-body text-sm text-white">{latestApplication.id}</span>
                <StatusBadge status={latestApplication.status} />
                {shouldShowLatestApplicationLabel ? (
                  <span className={pillVariants({ tone: "green" })}>
                    {t("admin.user-detail.latest-application")}
                  </span>
                ) : null}
              </div>
            </div>

            {canAccept ? (
              <form action={`/api/admin/users/${user.id}/approve`} method="POST" className="max-w-xl space-y-3">
                <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                <button className={buttonVariants({ variant: "success", size: "app" })}>
                  {t("admin.user-detail.actions.bypass-approval")}
                </button>
              </form>
            ) : null}

            {canReject ? (
              <ConfirmSubmitForm
                action={`/api/admin/users/${user.id}/reject`}
                method="POST"
                className="max-w-xl space-y-3"
                confirmationMessage={t("common.confirm-destructive")}
              >
                <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                <label className="block text-sm text-secondary">
                  {t("admin.user-detail.actions.reject-note-label")}
                  <Textarea
                    name="note"
                    required
                    rows={5}
                    className="ui-input-surface mt-2 min-h-24 resize-none border-white bg-transparent px-5 py-4 font-body text-base font-normal placeholder:font-normal hover:bg-transparent md:text-base"
                    placeholder={t("admin.user-detail.actions.reject-note-placeholder")}
                  />
                </label>
                <button className={buttonVariants({ size: "app" })}>
                  {t("admin.user-detail.actions.reject")}
                </button>
              </ConfirmSubmitForm>
            ) : null}

            {canRejectPermanently ? (
              <ConfirmSubmitForm
                action={`/api/admin/users/${user.id}/reject-permanently`}
                method="POST"
                className="max-w-xl space-y-3"
                confirmationMessage={t("common.confirm-destructive")}
              >
                <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                <label className="block text-sm text-secondary">
                  {t("admin.user-detail.actions.permanent-rejection-note-label")}
                  <Textarea
                    name="note"
                    rows={4}
                    className="ui-input-surface mt-2 min-h-20 resize-none border-white bg-transparent px-5 py-4 font-body text-base font-normal placeholder:font-normal hover:bg-transparent md:text-base"
                    placeholder={t("admin.user-detail.actions.permanent-rejection-note-placeholder")}
                  />
                </label>
                <button className={buttonVariants({ size: "app" })}>
                  {t("admin.user-detail.actions.reject-permanently")}
                </button>
              </ConfirmSubmitForm>
            ) : null}
          </div>
        ) : (
          <p className="font-body text-base text-white">
            {t("admin.user-detail.actions.no-review-target")}
          </p>
        )}
      </DetailSection>

      <DetailSection
        title={t("admin.user-detail.sections.flags.title")}
        description={t("admin.user-detail.sections.flags.description")}
      >
        <form action={`/api/admin/users/${user.id}/flags`} method="POST" className="max-w-xl space-y-4">
          <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="postersEnabled"
              value="true"
              defaultChecked={Boolean(user.posters_enabled)}
              className="h-4 w-4 accent-primary"
            />
            <span className="font-body text-sm text-white">
              {t("admin.user-detail.flags.posters-enabled")}
            </span>
          </label>
          <button className={buttonVariants({ size: "app" })}>
            {t("admin.user-detail.actions.save-flags")}
          </button>
        </form>
      </DetailSection>

      <DetailSection
        title={t("admin.user-detail.sections.user-profile.title")}
        description={t("admin.user-detail.sections.user-profile.description")}
      >
        <DetailFieldRow label={t("admin.user-detail.profile-fields.display-name")} value={user.display_name} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.first-name")} value={user.hca_first_name} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.last-name")} value={user.hca_last_name} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.email")} value={user.email} />
        <SlackProfile
          label={t("admin.user-detail.profile-fields.slack")}
          slackName={user.slack_name}
          slackId={user.slack_id}
          fallbackName={user.display_name}
        />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.hca-id")} value={user.hca_id} mono />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.verification-status")} value={user.verification_status} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.street-address")} value={user.hca_street_address} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.hca-city-and-region")} value={joinNonEmpty(user.hca_locality, user.hca_region)} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.hca-postal-code")} value={user.hca_postal_code} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.hca-country")} value={user.hca_country} />
        <DetailFieldRow
          label={t("admin.user-detail.profile-fields.hca-addresses")}
          value={addresses.length > 0 ? addresses.map(formatAddress).join("\n\n") : null}
          multiline
        />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.location")} value={joinNonEmpty(user.city, user.region, user.country_name, user.country_code)} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.postal-code")} value={user.postal_code} mono />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.timezone")} value={user.timezone} mono />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.network-org")} value={user.org} />
        <DetailFieldRow
          label={t("admin.user-detail.profile-fields.coordinates")}
          value={
            user.latitude == null || user.longitude == null
              ? null
              : `${user.latitude.toFixed(4)}, ${user.longitude.toFixed(4)}`
          }
          mono
        />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.last-seen-ip")} value={user.last_ip} mono />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.admin")} value={user.is_admin ? t("common.yes") : t("common.no")} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.posters-enabled")} value={user.posters_enabled ? t("common.yes") : t("common.no")} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.created")} value={formatDateTime(user.created_at, locale)} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.updated")} value={formatDateTime(user.updated_at, locale)} />
      </DetailSection>

      <DetailSection
        title={t("admin.user-detail.sections.applications.title")}
        description={t("admin.user-detail.sections.applications.description")}
      >
        {applications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white">
                  <th className="px-0 py-3 font-body text-base text-secondary">{t("admin.user-detail.applications.submitted")}</th>
                  <th className="px-4 py-3 font-body text-base text-secondary">{t("admin.user-detail.applications.status")}</th>
                  <th className="px-4 py-3 font-body text-base text-secondary">{t("admin.user-detail.applications.name")}</th>
                  <th className="px-4 py-3 font-body text-base text-secondary">{t("admin.user-detail.applications.open")}</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application) => (
                  <tr key={application.id} className="border-b border-white">
                    <td className="px-0 py-4 font-body text-sm text-white">{formatDateTime(application.created_at, locale)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={application.status} />
                        {latestApplication?.id === application.id ? (
                          <span className={pillVariants({ tone: "green" })}>
                            {t("common.latest")}
                          </span>
                        ) : (
                          <span className={pillVariants({ tone: "black" })}>
                            {t("admin.applications-list.history")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-body text-sm text-white">{application.name ?? "-"}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/applications/${application.id}`}
                        aria-label={t("admin.user-detail.applications.view")}
                        className="ui-open-link inline-flex font-body text-lg leading-none"
                      >
                        <span aria-hidden="true">↗</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-body text-base text-white">{t("admin.user-detail.applications.empty")}</p>
        )}
      </DetailSection>

      <DetailSection
        title={t("admin.user-detail.sections.latest-application-snapshot.title")}
        description={t("admin.user-detail.sections.latest-application-snapshot.description")}
      >
        {latestApplication ? (
          <>
            <DetailFieldRow label={t("admin.user-detail.latest-application-snapshot.application-id")} value={latestApplication.id} mono />
            <DetailFieldRow label={t("admin.user-detail.latest-application-snapshot.submitted")} value={formatDateTime(latestApplication.created_at, locale)} />
            <DetailFieldRow label={t("admin.user-detail.latest-application-snapshot.updated")} value={formatDateTime(latestApplication.updated_at, locale)} />
            <DetailFieldRow label={t("admin.user-detail.latest-application-snapshot.name-on-app")} value={latestApplication.name} />
            <DetailFieldRow label={t("admin.user-detail.latest-application-snapshot.date-of-birth")} value={formatDate(latestApplication.date_of_birth, locale)} />
            <DetailFieldRow label={t("admin.user-detail.latest-application-snapshot.decision-note")} value={latestApplication.decision_note} />
          </>
        ) : (
          <p className="font-body text-base text-white">{t("admin.user-detail.latest-application-snapshot.empty")}</p>
        )}
      </DetailSection>

      <DetailSection
        title={t("admin.user-detail.sections.permanent-rejection.title")}
        description={t("admin.user-detail.sections.permanent-rejection.description")}
      >
        <DetailFieldRow label={t("admin.user-detail.permanent-rejection.rejected-permanently-at")} value={formatDateTime(user.permanently_rejected_at, locale)} />
        <DetailFieldRow label={t("admin.user-detail.permanent-rejection.permanent-note")} value={user.permanent_rejection_note} />
      </DetailSection>

      <DetailSection
        title={t("admin.user-detail.sections.visits.title")}
        description={t("admin.user-detail.sections.visits.description", { duration: "10 minutes" })}
      >
        <div className="space-y-4">
          {visits.length > 0 ? (
            visits.map((visit) => (
              <div key={visit.id} className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-body text-sm text-white">{visit.ip}</span>
                  <span className="text-xs text-secondary">{visit.visit_type}</span>
                </div>
                <div className="mt-1 font-body text-sm text-white">
                  {joinNonEmpty(visit.city, visit.region, null, visit.country_code) ?? "-"}
                </div>
                <div className="mt-1 font-body text-sm text-white">{visit.org ?? t("admin.user-detail.visits.unknown-network")}</div>
                <div className="mt-1 text-xs text-white">{formatDateTime(visit.created_at, locale)}</div>
              </div>
            ))
          ) : (
            <p className="font-body text-base text-white">{t("admin.user-detail.visits.empty")}</p>
          )}
        </div>
        <DetailPager
          label={t("common.page-fraction", { page: currentVisitPage, totalPages: totalVisitPages })}
          page={currentVisitPage}
          totalPages={totalVisitPages}
          href={(page) => `?visitsPage=${page}`}
        />
      </DetailSection>

      <DetailSection
        title={t("admin.user-detail.sections.orders.title")}
        description={t("admin.user-detail.sections.orders.description")}
      >
        <div className="space-y-4">
          {orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <span className="font-body text-sm text-white">{order.id}</span>
                <div className="flex items-center gap-3">
                  <StatusBadge status={order.status} />
                  <span className="text-xs text-white">{formatDateTime(order.created_at, locale)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="font-body text-base text-white">{t("admin.user-detail.orders.empty")}</p>
          )}
        </div>
      </DetailSection>
    </div>
  );
}

function formatAddress(address: Record<string, unknown>) {
  return [
    typeof address.line_1 === "string" ? address.line_1 : null,
    typeof address.line_2 === "string" ? address.line_2 : null,
    joinNonEmpty(
      typeof address.city === "string" ? address.city : null,
      typeof address.state === "string" ? address.state : null,
      typeof address.postal_code === "string" ? address.postal_code : null,
      typeof address.country === "string" ? address.country : null,
    ),
  ]
    .filter((part): part is string => !!part)
    .join("\n");
}
