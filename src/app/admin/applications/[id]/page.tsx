import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DeleteApplicationButton } from "@/components/admin/delete-application-button";
import { DetailFieldRow, DetailPager, DetailSection } from "@/components/admin/detail";
import { SlackAvatar, SlackProfile } from "@/components/admin/slack-profile";
import { StatusBadge } from "@/components/admin/status-badge";
import { Textarea } from "@/components/ui/textarea";
import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";
import { formatDate, formatDateTime, joinNonEmpty } from "@/lib/format";
import { tryParseJson } from "@/lib/parse";

export default async function AdminApplicationDetailPage({
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

  const [application] = await sql`
    SELECT a.id, a.user_id, a.status, a.name, a.applicant_email, a.applicant_slack_id,
           a.applicant_hca_id,
           a.applicant_phone, a.date_of_birth, a.address_line_1, a.address_line_2,
           a.address_city, a.address_state, a.address_zip, a.address_country,
           a.tshirt_size, a.bio, a.headshot_attachments, a.github_url, a.portfolio_url,
           a.application_first_thing_do, a.application_best_place_poster, a.idv_status,
           a.tshirt_shipped, a.airtable_record_id, a.field_3, a.field_4, a.field_5, a.field_6,
           a.submitted_ip, a.latitude, a.longitude, a.city, a.region, a.country_code, a.country_name,
           a.decision_note, a.rejection_reason, a.reviewed_at, a.created_at, a.updated_at, a.reviewed_by,
           COALESCE(latest.id, a.id) AS latest_application_id,
           u.display_name AS user_name, u.email AS user_email, u.hca_first_name, u.hca_last_name,
           u.hca_street_address, u.hca_locality, u.hca_region, u.hca_postal_code, u.hca_country,
           u.slack_id AS user_slack_id, u.slack_name AS user_slack_name,
           u.slack_avatar_url AS user_slack_avatar_url, u.hca_id AS user_hca_id, u.verification_status,
           u.last_ip AS user_last_ip, u.city AS user_city, u.region AS user_region,
           u.country_code AS user_country_code, u.country_name AS user_country_name,
           u.postal_code AS user_postal_code, u.timezone AS user_timezone, u.org AS user_org,
           u.created_at AS user_created_at, reviewer.display_name AS reviewed_by_name
    FROM applications a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN users reviewer ON reviewer.id = a.reviewed_by
    LEFT JOIN LATERAL (
      SELECT id
      FROM applications
      WHERE user_id = a.user_id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) latest ON true
    WHERE a.id = ${id}
    LIMIT 1
  `;

  if (!application) notFound();

  const [history, visitCountResult, visits, orders] = await Promise.all([
    application.user_id
      ? sql`
          SELECT id, status, name, decision_note, created_at
          FROM applications
          WHERE user_id = ${application.user_id}
          ORDER BY created_at DESC, id DESC
        `
      : sql`
          SELECT id, status, name, decision_note, created_at
          FROM applications
          WHERE id = ${application.id}
        `,
    application.user_id
      ? sql`
          SELECT COUNT(*)::int AS count
          FROM ip_visits
          WHERE user_id = ${application.user_id}
        `.then((rows) => rows[0]?.count ?? 0)
      : Promise.resolve(0),
    application.user_id
      ? sql`
          SELECT id, ip, visit_type, city, region, country_code, org, created_at
          FROM ip_visits
          WHERE user_id = ${application.user_id}
          ORDER BY created_at DESC
          LIMIT 3
          OFFSET ${(visitsPage - 1) * 3}
        `
      : Promise.resolve([]),
    application.user_id
      ? sql`
          SELECT id, status, created_at
          FROM orders
          WHERE user_id = ${application.user_id}
          ORDER BY created_at DESC
          LIMIT 10
        `
      : Promise.resolve([]),
  ]);

  const isLatest = application.latest_application_id === application.id;
  const totalVisitPages = Math.max(1, Math.ceil(visitCountResult / 3));
  const currentVisitPage = Math.min(visitsPage, totalVisitPages);

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
          <Link href="/admin/applications" className="hover:text-white">
            {t("admin.application-detail.breadcrumb")}
          </Link>
          <span>/</span>
          <span className="font-body text-white">{application.id}</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <SlackAvatar
                slackId={application.user_slack_id ?? application.applicant_slack_id}
                fallbackName={application.user_slack_name ?? application.user_name ?? application.name}
                sizeClassName="h-16 w-16"
                textClassName="text-lg"
              />
              <h1 className="text-4xl text-white">{application.name ?? application.user_name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={application.status} />
              {isLatest ? (
                <span className="rounded-lg bg-acceptance px-3 py-1 text-sm text-black">
                  {t("admin.application-detail.latest-application")}
                </span>
              ) : (
                <span className="text-sm text-white">{t("admin.application-detail.historical-application")}</span>
              )}
            </div>
          </div>
          {application.user_id ? (
            <Link
              href={`/admin/users/${application.user_id}`}
              className="inline-flex rounded-xl border border-secondary px-4 py-2 font-body text-sm text-secondary transition-colors hover:border-white hover:text-white"
            >
              {t("admin.application-detail.open-user-page")}
            </Link>
          ) : null}
        </div>
      </header>

      {!isLatest && (
        <section className="pt-4">
          <h2 className="text-2xl text-white">{t("admin.application-detail.locked.title")}</h2>
          <p className="mt-2 max-w-3xl font-body text-base text-white">
            {t("admin.application-detail.locked.body")}
          </p>
          <Link
            href={`/admin/applications/${application.latest_application_id}`}
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 font-body text-sm text-white transition-colors hover:bg-white hover:text-black"
          >
            {t("admin.application-detail.locked.cta")}
          </Link>
        </section>
      )}

      <DetailSection
        title={t("admin.application-detail.sections.review-actions.title")}
        description={t("admin.application-detail.sections.review-actions.description")}
      >
        <DeleteApplicationButton
          applicationId={application.id}
          label={t("admin.application-detail.actions.delete")}
        />

        {isLatest ? (
          <div className="space-y-6">
            <form action={`/api/admin/applications/${application.id}/approve`} method="POST" className="max-w-xl space-y-3">
              <input type="hidden" name="redirectTo" value={`/admin/applications/${application.id}`} />
              <button className="rounded-xl bg-acceptance px-6 py-3 font-body text-sm text-black transition-colors hover:bg-white">
                {t("admin.application-detail.actions.accept")}
              </button>
            </form>

            <form action={`/api/admin/applications/${application.id}/reject`} method="POST" className="max-w-xl space-y-3">
              <input type="hidden" name="redirectTo" value={`/admin/applications/${application.id}`} />
              <label className="block text-sm text-secondary">
                {t("admin.application-detail.actions.reject-note-label")}
                <Textarea
                  name="note"
                  required
                  rows={5}
                  className="ui-input-surface mt-2 min-h-24 resize-none border-white bg-transparent px-5 py-4 text-base hover:bg-transparent md:text-base"
                  placeholder={t("admin.application-detail.actions.reject-note-placeholder")}
                />
              </label>
              <button className="rounded-xl bg-rejection px-6 py-3 font-body text-sm text-white transition-colors hover:bg-white hover:text-black">
                {t("admin.application-detail.actions.reject-with-note")}
              </button>
            </form>

            <form
              action={`/api/admin/applications/${application.id}/reject-permanently`}
              method="POST"
              className="max-w-xl space-y-3"
            >
              <input type="hidden" name="redirectTo" value={`/admin/applications/${application.id}`} />
              <label className="block text-sm text-secondary">
                {t("admin.application-detail.actions.permanent-rejection-note-label")}
                <Textarea
                  name="note"
                  rows={4}
                  className="ui-input-surface mt-2 min-h-20 resize-none border-white bg-transparent px-5 py-4 text-base hover:bg-transparent md:text-base"
                  placeholder={t("admin.application-detail.actions.permanent-rejection-note-placeholder")}
                />
              </label>
              <button className="rounded-xl bg-rejection px-6 py-3 font-body text-sm text-white transition-colors hover:bg-white hover:text-black">
                {t("admin.application-detail.actions.reject-permanently")}
              </button>
            </form>

            <form
              action={`/api/admin/applications/${application.id}/tshirt-shipped`}
              method="POST"
              className="max-w-xl space-y-3"
            >
              <input type="hidden" name="redirectTo" value={`/admin/applications/${application.id}`} />
              <input
                type="hidden"
                name="shipped"
                value={application.tshirt_shipped ? "false" : "true"}
              />
              <button className="rounded-xl bg-secondary px-6 py-3 font-body text-sm text-black transition-colors hover:bg-white">
                {application.tshirt_shipped
                  ? t("admin.application-detail.actions.mark-tshirt-unshipped")
                  : t("admin.application-detail.actions.mark-tshirt-shipped")}
              </button>
            </form>
          </div>
        ) : (
          <p className="font-body text-base text-white">
            {t("admin.application-detail.actions.historical-disabled")}
          </p>
        )}
      </DetailSection>

      <DetailSection
        title={t("admin.application-detail.sections.application-answers.title")}
        description={t("admin.application-detail.sections.application-answers.description")}
      >
        <DetailFieldRow label={t("admin.application-detail.answers.name")} value={application.name} />
        <DetailFieldRow
          label={t("admin.application-detail.answers.date-of-birth")}
          value={formatDate(application.date_of_birth, locale)}
        />
        <DetailFieldRow label={t("admin.application-detail.answers.email")} value={application.applicant_email} />
        <DetailFieldRow label={t("admin.application-detail.answers.slack-id")} value={application.applicant_slack_id} mono />
        <DetailFieldRow label={t("admin.application-detail.answers.hca-id")} value={application.applicant_hca_id} mono />
        <DetailFieldRow label={t("admin.application-detail.answers.phone")} value={application.applicant_phone} />
        <DetailFieldRow
          label={t("admin.application-detail.answers.address")}
          value={joinNonEmpty(
            application.address_line_1,
            application.address_line_2,
            application.address_city,
            application.address_state,
            application.address_zip,
            application.address_country,
          )}
        />
        <DetailFieldRow label={t("admin.application-detail.answers.tshirt-size")} value={application.tshirt_size} />
        <TextAnswer label={t("admin.application-detail.answers.bio")} value={application.bio} />
        <DetailFieldRow label={t("admin.application-detail.answers.github-url")} value={application.github_url} />
        <DetailFieldRow label={t("admin.application-detail.answers.portfolio-url")} value={application.portfolio_url} />
        <AttachmentAnswer
          attachments={application.headshot_attachments}
          label={t("admin.application-detail.answers.headshot")}
        />
        <TextAnswer
          label={t("admin.application-detail.answers.first-thing-do")}
          value={application.application_first_thing_do}
        />
        <TextAnswer
          label={t("admin.application-detail.answers.best-place-poster")}
          value={application.application_best_place_poster}
        />
        <TextAnswer label={t("admin.application-detail.answers.something-else")} value={application.field_3} />
        <TextAnswer label={t("admin.application-detail.answers.background")} value={application.field_4} />
        <TextAnswer label={t("admin.application-detail.answers.why-ambassador")} value={application.field_5} />
        <TextAnswer label={t("admin.application-detail.answers.anything-else")} value={application.field_6} />
      </DetailSection>

      <DetailSection
        title={t("admin.application-detail.sections.application-metadata.title")}
        description={t("admin.application-detail.sections.application-metadata.description")}
      >
        <DetailFieldRow label={t("admin.application-detail.metadata.submitted")} value={formatDateTime(application.created_at, locale)} />
        <DetailFieldRow label={t("admin.application-detail.metadata.last-updated")} value={formatDateTime(application.updated_at, locale)} />
        <DetailFieldRow label={t("admin.application-detail.metadata.reviewed")} value={formatDateTime(application.reviewed_at, locale)} />
        <DetailFieldRow label={t("admin.application-detail.metadata.reviewed-by")} value={application.reviewed_by_name} />
        <DetailFieldRow label={t("admin.application-detail.metadata.airtable-record-id")} value={application.airtable_record_id} mono />
        <DetailFieldRow label={t("admin.application-detail.metadata.submitted-ip")} value={application.submitted_ip} mono />
        <DetailFieldRow
          label={t("admin.application-detail.metadata.application-location")}
          value={joinNonEmpty(
            application.address_city ?? application.city,
            application.address_state ?? application.region,
            application.address_country ?? application.country_name,
            application.country_code,
          )}
        />
        <DetailFieldRow
          label={t("admin.application-detail.metadata.coordinates")}
          value={
            application.latitude == null || application.longitude == null
              ? null
              : `${application.latitude.toFixed(4)}, ${application.longitude.toFixed(4)}`
          }
          mono
        />
        <DetailFieldRow label={t("admin.application-detail.metadata.idv-status")} value={application.idv_status} />
        <DetailFieldRow
          label={t("admin.application-detail.metadata.tshirt-shipped")}
          value={application.tshirt_shipped ? t("common.yes") : t("common.no")}
        />
        <DetailFieldRow
          label={t("admin.application-detail.metadata.decision-note")}
          value={application.rejection_reason ?? application.decision_note}
        />
      </DetailSection>

      <DetailSection
        title={t("admin.application-detail.sections.applicant.title")}
        description={t("admin.application-detail.sections.applicant.description")}
      >
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.display-name")} value={application.user_name} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.first-name")} value={application.hca_first_name} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.last-name")} value={application.hca_last_name} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.email")} value={application.user_email} />
        <SlackProfile
          label={t("admin.application-detail.applicant-fields.slack")}
          slackName={application.user_slack_name ?? application.applicant_slack_id}
          slackId={application.user_slack_id ?? application.applicant_slack_id}
          fallbackName={application.user_name ?? application.name}
        />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.hca-id")} value={application.user_hca_id} mono />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.verification-status")} value={application.verification_status} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.street-address")} value={application.hca_street_address} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.hca-city-and-region")} value={joinNonEmpty(application.hca_locality, application.hca_region)} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.hca-postal-code")} value={application.hca_postal_code} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.hca-country")} value={application.hca_country} />
        <DetailFieldRow
          label={t("admin.application-detail.applicant-fields.user-location")}
          value={joinNonEmpty(
            application.user_city,
            application.user_region,
            application.user_country_name,
            application.user_country_code,
          )}
        />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.postal-code")} value={application.user_postal_code} mono />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.timezone")} value={application.user_timezone} mono />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.network-org")} value={application.user_org} />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.last-seen-ip")} value={application.user_last_ip} mono />
        <DetailFieldRow label={t("admin.application-detail.applicant-fields.user-created")} value={formatDateTime(application.user_created_at, locale)} />
      </DetailSection>

      <DetailSection
        title={t("admin.application-detail.sections.history.title")}
        description={t("admin.application-detail.sections.history.description")}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white">
                <th className="px-0 py-3 font-body text-base text-secondary">{t("admin.application-detail.history.when")}</th>
                <th className="px-4 py-3 font-body text-base text-secondary">{t("admin.application-detail.history.status")}</th>
                <th className="px-4 py-3 font-body text-base text-secondary">{t("admin.application-detail.history.name")}</th>
                <th className="px-4 py-3 font-body text-base text-secondary">{t("admin.application-detail.history.open")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.id} className="border-b border-white">
                  <td className="px-0 py-4 font-body text-sm text-white">{formatDateTime(entry.created_at, locale)}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={entry.status} />
                      {entry.id === application.latest_application_id && (
                        <span className="rounded-lg bg-acceptance px-3 py-1 text-sm text-black">{t("common.latest")}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-body text-sm text-white">{entry.name ?? "-"}</td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/admin/applications/${entry.id}`}
                      className="inline-flex rounded-xl border border-secondary px-3 py-1.5 font-body text-sm text-secondary transition-colors hover:border-white hover:text-white"
                    >
                      {t("admin.application-detail.history.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailSection>

      <DetailSection
        title={t("admin.application-detail.sections.visits.title")}
        description={t("admin.application-detail.sections.visits.description")}
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
                <div className="mt-1 font-body text-sm text-white">{visit.org ?? t("admin.application-detail.visits.unknown-network")}</div>
                <div className="mt-1 text-xs text-white">{formatDateTime(visit.created_at, locale)}</div>
              </div>
            ))
          ) : (
            <p className="font-body text-base text-white">{t("admin.application-detail.visits.empty")}</p>
          )}
        </div>
        <DetailPager
          label={t("common.page-fraction", { page: currentVisitPage, totalPages: totalVisitPages })}
          page={currentVisitPage}
          totalPages={totalVisitPages}
          href={(page) => `?visitsPage=${page}`}
          outlined
        />
      </DetailSection>

      <DetailSection
        title={t("admin.application-detail.sections.orders.title")}
        description={t("admin.application-detail.sections.orders.description")}
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
            <p className="font-body text-base text-white">{t("admin.application-detail.orders.empty")}</p>
          )}
        </div>
      </DetailSection>
    </div>
  );
}

function TextAnswer({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-secondary">{label}</div>
      <p className="whitespace-pre-wrap font-body text-base leading-relaxed text-white">
        {value ?? "-"}
      </p>
    </div>
  );
}

function AttachmentAnswer({
  attachments,
  label,
}: {
  attachments: unknown;
  label: string;
}) {
  const normalizedAttachments =
    typeof attachments === "string" ? tryParseJson(attachments) : attachments;
  const items = Array.isArray(normalizedAttachments)
    ? normalizedAttachments.filter(
        (attachment): attachment is { filename?: string; id?: string; url?: string } =>
          !!attachment && typeof attachment === "object",
      )
    : [];

  return (
    <div className="space-y-1">
      <div className="text-sm text-secondary">{label}</div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((attachment) => (
            attachment.url ? (
              <a
                key={attachment.id ?? attachment.url ?? attachment.filename}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="block font-body text-base text-white underline hover:opacity-80"
              >
                {attachment.filename ?? attachment.url}
              </a>
            ) : (
              <p
                key={attachment.id ?? attachment.filename}
                className="font-body text-base text-white"
              >
                {attachment.filename ?? "-"}
              </p>
            )
          ))}
        </div>
      ) : (
        <p className="font-body text-base leading-relaxed text-white">-</p>
      )}
    </div>
  );
}
