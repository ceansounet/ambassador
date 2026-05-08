import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ApproveWithGrantForm } from "@/components/admin/approve-with-grant-form";
import { ConfirmSubmitForm } from "@/components/admin/confirm-submit-form";
import { DetailFieldRow, DetailPager, DetailRow, DetailSection } from "@/components/admin/detail";
import { HackatimeTrustStatus } from "@/components/admin/hackatime-trust-status";
import { SlackAvatar, SlackProfile } from "@/components/admin/slack-profile";
import { StatusBadge } from "@/components/admin/status-badge";
import { SuperuserPasswordForm } from "@/components/admin/superuser-password-form";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pillVariants } from "@/components/ui/pill";
import { Textarea } from "@/components/ui/textarea";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import { fetchHackClubAddresses } from "@/lib/auth";
import {
  APPLICATION_STATUS_ACCEPTED,
  APPLICATION_STATUS_REJECTED,
  APPLICATION_STATUS_REJECTED_PERMANENT,
  canChangeApplicationReviewStatus,
  isRejectedPermanentlyApplicationStatus,
} from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";
import { formatDate, formatDateTime, formatTimeInTimeZone, joinNonEmpty } from "@/lib/format";
import {
  getOfficeGrantDashboardMessage,
  refreshOfficeGrantBalanceForUser,
} from "@/lib/hcb/grants";
import { getCachedHackatimeTrustLevel } from "@/lib/hackatime";
import { OFFICE_GRANT_AMOUNT_CENTS, OFFICE_GRANT_PURPOSE } from "@/lib/hcb/constants";
import { readHcaAccessToken } from "@/lib/hca-access-token";
import { ensureUserAddressSchema } from "@/lib/database/user-address-schema";
import {
  getUserManualDashboardStateLabel,
  isUserManualDashboardState,
} from "@/lib/user-dashboard-state";
import { getActorSession } from "@/lib/session";
import { normalizeHackClubAddresses } from "@/lib/settings";
import { isSuperuserConfigured } from "@/lib/superuser";

type AdminUserRow = {
  id: string;
  hca_id: string | null;
  email: string | null;
  hca_first_name: string | null;
  hca_last_name: string | null;
  verification_status: string | null;
  is_admin: boolean | null;
  last_ip: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  region: string | null;
  country_code: string | null;
  country_name: string | null;
  postal_code: string | null;
  timezone: string | null;
  org: string | null;
  hca_addresses: unknown;
  hca_access_token: string | null;
  posters_enabled: boolean | null;
  permanently_rejected_at: string | null;
  permanent_rejection_note: string | null;
  created_at: string;
  updated_at: string;
  manual_dashboard_state: string | null;
  slack_id: string | null;
  slack_name: string | null;
  display_name: string;
};

type ApplicationListRow = {
  id: string;
  status: string;
  name: string;
  date_of_birth?: string | null;
  decision_note?: string | null;
  created_at: string;
  updated_at?: string;
};

type CountRow = { count: number };
type LatestNoteEventRow = { note: string | null };
type VisitRow = {
  id: string;
  ip: string;
  visit_type: string;
  city: string | null;
  region: string | null;
  country_code: string | null;
  org: string | null;
  timezone: string | null;
  created_at: string;
};

const HCB_GRANT_STATUS_KEYS = new Set([
  "linked",
  "queued",
  "already_linked",
  "already_pending",
  "not_onboarded",
  "provision_failed",
  "unlinked",
  "invalid",
  "not_found",
  "link_failed",
  "unlink_failed",
]);

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.user-detail.metadata.title");
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    visitsPage?: string;
    notesPage?: string;
    hcbGrant?: string;
    superuser?: string;
  }>;
}) {
  const [{ id }, query, t, locale, actorSession] = await Promise.all([
    params,
    searchParams,
    getTranslations(),
    getLocale(),
    getActorSession(),
  ]);
  const requestedVisitsPage = Number(query.visitsPage ?? "1");
  const visitsPage = Number.isFinite(requestedVisitsPage) && requestedVisitsPage > 0
    ? Math.floor(requestedVisitsPage)
    : 1;
  const requestedNotesPage = Number(query.notesPage ?? "1");
  const notesPage = Number.isFinite(requestedNotesPage) && requestedNotesPage > 0
    ? Math.floor(requestedNotesPage)
    : 1;

  await ensureSchema();
  await ensureUserAddressSchema();

  const user = (await sql<AdminUserRow[]>`
    SELECT id, hca_id, email, display_name, hca_first_name, hca_last_name, slack_id, slack_name,
           slack_avatar_url, verification_status, is_admin, last_ip, latitude, longitude, city,
           region, country_code, country_name, postal_code, timezone, org, hca_addresses,
           hca_access_token,
           posters_enabled, manual_dashboard_state,
           permanently_rejected_at, permanent_rejection_note, created_at, updated_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `).at(0);

  if (!user) notFound();

  const storedAddresses = Array.isArray(user.hca_addresses)
    ? user.hca_addresses.filter(
        (address): address is Record<string, unknown> =>
          address !== null && typeof address === "object",
      )
    : [];
  const hcaAccessToken = readHcaAccessToken(user.hca_access_token);
  const liveAddresses = hcaAccessToken !== null
    ? await fetchHackClubAddresses(hcaAccessToken).catch((error) => {
        console.error("Failed to load live Hack Club Auth addresses", {
          userId: user.id,
          error,
        });
        return [];
      })
    : [];
  const addresses = normalizeHackClubAddresses(
    liveAddresses.length > 0 ? liveAddresses : storedAddresses,
  );
  const hackatimeTrust = await getCachedHackatimeTrustLevel(user.slack_id);

  const [
    latestApplication,
    applications,
    visitCountResult,
    visits,
    orders,
    latestNoteEvent,
    noteCountResult,
    noteHistory,
  ] = await Promise.all([
    sql<ApplicationListRow[]>`
      SELECT id, status, name, date_of_birth, decision_note, created_at, updated_at
      FROM applications
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `.then((rows) => rows.at(0) ?? null),
    sql<ApplicationListRow[]>`
      SELECT id, status, name, decision_note, created_at
      FROM applications
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC, id DESC
    `,
    sql<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM ip_visits
      WHERE user_id = ${user.id}
    `.then((rows) => rows.at(0)?.count ?? 0),
    sql<VisitRow[]>`
      SELECT id, ip, visit_type, city, region, country_code, org, timezone, created_at
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
    sql<LatestNoteEventRow[]>`
      SELECT note
      FROM user_note_events
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `.then((rows) => rows.at(0) ?? null),
    sql<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM user_note_events
      WHERE user_id = ${user.id}
    `.then((rows) => rows.at(0)?.count ?? 0),
    sql`
      SELECT une.id, une.note, une.created_at, une.created_by,
             actor.display_name AS actor_display_name, actor.email AS actor_email
      FROM user_note_events une
      LEFT JOIN users actor ON actor.id = une.created_by
      WHERE une.user_id = ${user.id}
      ORDER BY une.created_at DESC, une.id DESC
      LIMIT 3
      OFFSET ${(notesPage - 1) * 3}
    `,
  ]);
  const currentUserNote =
    typeof latestNoteEvent?.note === "string" && latestNoteEvent.note.trim().length > 0
      ? latestNoteEvent.note
      : null;
  const officeGrant = await refreshOfficeGrantBalanceForUser(user.id);
  const usdFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });
  const officeGrantDashboardMessage = getOfficeGrantDashboardMessage({ grant: officeGrant });
  const officeGrantUrl = officeGrantDashboardMessage.href;
  const officeGrantDashboardBody = officeGrantDashboardMessage.messageKey === "linked"
    ? `${t("office-grant.messages.linked-open-label")} ↗`
    : t(`office-grant.messages.${officeGrantDashboardMessage.messageKey}`);
  const officeGrantBalance =
    officeGrant?.balanceCents !== null &&
    officeGrant?.balanceCents !== undefined &&
    Number.isFinite(officeGrant.balanceCents)
      ? usdFormatter.format(officeGrant.balanceCents / 100)
      : null;
  const hcbGrantStatus = query.hcbGrant?.trim() ?? "";
  const hcbGrantFlashMessage =
    hcbGrantStatus !== "" && HCB_GRANT_STATUS_KEYS.has(hcbGrantStatus)
      ? t(`office-grant.admin-status.${hcbGrantStatus}`)
      : null;
  const superuserStatus = query.superuser?.trim() ?? "";
  const superuserFlashMessage = superuserStatus === ""
    ? null
    : superuserStatus === "missing"
      ? t("admin.user-detail.superuser.missing")
      : superuserStatus === "invalid"
        ? t("admin.user-detail.superuser.invalid")
        : null;
  const superuserConfigured = isSuperuserConfigured();

  const totalVisitPages = Math.max(1, Math.ceil(visitCountResult / 3));
  const currentVisitPage = Math.min(visitsPage, totalVisitPages);
  const totalNotePages = Math.max(1, Math.ceil(noteCountResult / 3));
  const currentNotePage = Math.min(notesPage, totalNotePages);
  const shouldShowPermanentRejectionLabel =
    Boolean(user.permanently_rejected_at) &&
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
  const manualDashboardState = isUserManualDashboardState(
    user.manual_dashboard_state,
  )
    ? user.manual_dashboard_state
    : null;
  const manualDashboardStateLabel = manualDashboardState
    ? getUserManualDashboardStateLabel(t, manualDashboardState)
    : t("admin.user-detail.dashboard-state.no-manual-state");
  const headerStatus = manualDashboardState
    ? manualDashboardState
    : shouldShowPermanentRejectionLabel
      ? "rejected_permanently"
      : latestApplication?.status ?? null;
  const shouldShowHeaderLatestApplicationLabel =
    !manualDashboardState &&
    latestApplication !== null &&
    !shouldShowPermanentRejectionLabel;
  const canImpersonateUser = Boolean(actorSession && actorSession.sub !== user.id);
  const canRemoveAdmin = user.is_admin === true && actorSession?.sub !== user.id;

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
              {headerStatus !== null ? (
                <>
                  <StatusBadge status={headerStatus} />
                  {manualDashboardState ? (
                    <span className={pillVariants({ tone: "black" })}>
                      {t("admin.user-detail.sections.dashboard-state.title")}
                    </span>
                  ) : null}
                  {shouldShowHeaderLatestApplicationLabel ? (
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
        <div className="space-y-6">
          {superuserFlashMessage !== null ? (
            <p className="max-w-xl font-body text-base text-white">
              {superuserFlashMessage}
            </p>
          ) : !superuserConfigured ? (
            <p className="max-w-xl font-body text-base text-white">
              {t("admin.user-detail.superuser.missing")}
            </p>
          ) : null}

          {canImpersonateUser ? (
            <form action={`/api/admin/users/${user.id}/impersonate`} method="POST">
              <input type="hidden" name="redirectTo" value="/dashboard" />
              <button className={buttonVariants({ size: "app" })}>
                {t("admin.user-detail.actions.impersonate")}
              </button>
            </form>
          ) : null}

          {user.is_admin !== true ? (
            <SuperuserPasswordForm
              action={`/api/admin/users/${user.id}/make-admin`}
              buttonLabel={t("admin.user-detail.actions.make-admin")}
              confirmationMessage={t("admin.user-detail.actions.make-admin-confirmation")}
              disabled={!superuserConfigured}
              passwordPrompt={t("admin.user-detail.superuser.password-label")}
              redirectTo={`/admin/users/${user.id}`}
              variant="success"
            />
          ) : null}

          {canRemoveAdmin ? (
            <SuperuserPasswordForm
              action={`/api/admin/users/${user.id}/remove-admin`}
              buttonLabel={t("admin.user-detail.actions.remove-admin")}
              confirmationMessage={t("admin.user-detail.actions.remove-admin-confirmation")}
              disabled={!superuserConfigured}
              passwordPrompt={t("admin.user-detail.superuser.password-label")}
              redirectTo={`/admin/users/${user.id}`}
            />
          ) : null}

          {latestApplication ? (
            <div className="space-y-6">
              <div className="pb-2">
                <div className="text-sm text-secondary">{t("admin.user-detail.actions.current-review-target")}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-body text-sm text-white">{latestApplication.id}</span>
                  <StatusBadge status={latestApplication.status} />
                  {shouldShowHeaderLatestApplicationLabel ? (
                    <span className={pillVariants({ tone: "green" })}>
                      {t("admin.user-detail.latest-application")}
                    </span>
                  ) : null}
                </div>
              </div>

              {canAccept ? (
                <ApproveWithGrantForm
                  action={`/api/admin/users/${user.id}/approve`}
                  method="POST"
                  className="max-w-xl space-y-3"
                >
                  <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                  <button className={buttonVariants({ variant: "success", size: "app" })}>
                    {t("admin.user-detail.actions.bypass-approval")}
                  </button>
                </ApproveWithGrantForm>
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

          <div className="space-y-4 border-t border-white/10 pt-6">
            <div className="space-y-2">
              <h3 className="text-2xl text-white">
                {t("admin.user-detail.sections.dashboard-state.title")}
              </h3>
              <p className="max-w-3xl font-body text-base text-white">
                {t("admin.user-detail.sections.dashboard-state.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <form action={`/api/admin/users/${user.id}/state`} method="POST">
                <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                <input type="hidden" name="state" value="approved" />
                <button className={buttonVariants({ variant: "success", size: "app-sm" })}>
                  {t("admin.user-detail.dashboard-state.set-approved")}
                </button>
              </form>
              <form action={`/api/admin/users/${user.id}/state`} method="POST">
                <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                <input type="hidden" name="state" value="rejected" />
                <button className={buttonVariants({ size: "app-sm" })}>
                  {t("admin.user-detail.dashboard-state.set-rejected")}
                </button>
              </form>
              <form action={`/api/admin/users/${user.id}/state`} method="POST">
                <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                <input type="hidden" name="state" value="banned" />
                <button className={buttonVariants({ size: "app-sm" })}>
                  {t("admin.user-detail.dashboard-state.set-banned")}
                </button>
              </form>
              <form action={`/api/admin/users/${user.id}/state`} method="POST">
                <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}`} />
                <input type="hidden" name="state" value="" />
                <button className={buttonVariants({ size: "app-sm" })}>
                  {t("admin.user-detail.dashboard-state.clear-state")}
                </button>
              </form>
            </div>
          </div>
        </div>
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
              defaultChecked={user.posters_enabled === true}
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

      <div id="office-grant">
        <DetailSection
          title="Office Grant"
          description="Manage the linked HCB office-expenses grant for this ambassador."
        >
          {hcbGrantFlashMessage !== null ? (
            <p className="font-body text-base text-white">{hcbGrantFlashMessage}</p>
          ) : null}
          <DetailFieldRow
            label="Provisioning state"
            value={officeGrant?.provisioningState ?? "none"}
          />
          <DetailFieldRow
            label="Provisioning source"
            value={officeGrant?.provisioningSource}
          />
          <DetailFieldRow
            label="Grant ID"
            value={officeGrant?.grantId}
            mono
          />
          <DetailFieldRow
            label="Purpose"
            value={officeGrant?.purpose ?? OFFICE_GRANT_PURPOSE}
          />
          <DetailFieldRow
            label="Amount"
            value={usdFormatter.format((officeGrant?.amountCents ?? OFFICE_GRANT_AMOUNT_CENTS) / 100)}
          />
          <div className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-5">
            <div className="text-sm text-secondary">Current balance</div>
            <div className="font-body text-base text-acceptance break-words [overflow-wrap:anywhere]">
              {officeGrantBalance ?? "-"}
            </div>
          </div>
          <DetailFieldRow
            label="Grant link"
            value={officeGrantUrl}
            mono
          />
          <DetailFieldRow
            label="User-facing status"
            value={officeGrantDashboardBody}
          />
          <DetailFieldRow
            label="Last error"
            value={officeGrant?.lastError}
          />
          <DetailFieldRow
            label="Next retry"
            value={formatDateTime(officeGrant?.nextRetryAt, locale)}
          />
          <DetailFieldRow
            label="Balance synced"
            value={formatDateTime(officeGrant?.balanceSyncedAt, locale)}
          />
          <DetailFieldRow
            label="Linked at"
            value={formatDateTime(officeGrant?.linkedAt, locale)}
          />

          <div className="flex flex-wrap items-end gap-4">
            {officeGrantUrl !== null ? (
              <a
                href={officeGrantUrl}
                target="_blank"
                rel="noreferrer"
                className="ui-open-link inline-flex font-body text-lg leading-none"
                aria-label="Open office grant"
              >
                <span aria-hidden="true">↗</span>
              </a>
            ) : null}

            <ConfirmSubmitForm
              action={`/api/admin/users/${user.id}/hcb-grant/provision`}
              method="POST"
              confirmationMessage="Are you sure?"
            >
              <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}#office-grant`} />
              <button className={buttonVariants({ variant: "success", size: "app" })}>
                Provision grant
              </button>
            </ConfirmSubmitForm>

            <ConfirmSubmitForm
              action={`/api/admin/users/${user.id}/hcb-grant/unlink`}
              method="POST"
              confirmationMessage="Are you sure?"
            >
              <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}#office-grant`} />
              <button className={buttonVariants({ size: "app" })}>
                Unlink grant
              </button>
            </ConfirmSubmitForm>
          </div>

          <ConfirmSubmitForm
            action={`/api/admin/users/${user.id}/hcb-grant/link`}
            method="POST"
            className="max-w-sm space-y-3"
            confirmationMessage="Are you sure?"
          >
            <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}#office-grant`} />
            <label className="block text-sm text-secondary">
              Link to grant ID
              <Input
                name="grantId"
                type="text"
                placeholder="grt_..."
                className="ui-input-surface !bg-muted mt-2 h-11 !rounded-none [border-radius:0!important] border-0 px-4 font-body text-base text-foreground placeholder:text-foreground/40 hover:!bg-muted md:text-base"
              />
            </label>
            <button className={buttonVariants({ variant: "success", size: "app" })}>
              Link grant
            </button>
          </ConfirmSubmitForm>
        </DetailSection>
      </div>

      <div id="internal-notes">
        <DetailSection
          title={t("admin.user-detail.sections.notes.title")}
          description={t("admin.user-detail.sections.notes.description")}
        >
          <DetailFieldRow
            label={t("admin.user-detail.notes.current-note")}
            value={currentUserNote}
            multiline
          />

          <form action={`/api/admin/users/${user.id}/note`} method="POST" className="max-w-xl space-y-3">
            <input type="hidden" name="redirectTo" value={`/admin/users/${user.id}#internal-notes`} />
            <label className="block text-sm text-secondary">
              {t("admin.user-detail.notes.note-label")}
              <Textarea
                name="note"
                rows={5}
                defaultValue={currentUserNote ?? ""}
                className="ui-input-surface mt-2 min-h-24 resize-none border-white bg-transparent px-5 py-4 font-body text-base font-normal placeholder:font-normal hover:bg-transparent md:text-base"
                placeholder={t("admin.user-detail.notes.note-placeholder")}
              />
            </label>
            <button className={buttonVariants({ size: "app" })}>
              {t("admin.user-detail.actions.save-note")}
            </button>
          </form>

          <div className="space-y-4">
            <h3 className="font-body text-sm text-secondary">
              {t("admin.user-detail.notes.history-title")}
            </h3>
            {noteHistory.length > 0 ? (
              noteHistory.map((entry) => (
                <div key={entry.id} className="border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-body text-sm text-white">
                      {entry.actor_display_name ??
                        entry.actor_email ??
                        entry.created_by ??
                        t("admin.user-detail.notes.unknown-actor")}
                    </span>
                    <span className="text-xs text-secondary">
                      {formatDateTime(entry.created_at, locale)}
                    </span>
                  </div>
                  <div className="mt-2 whitespace-pre-line font-body text-base text-white break-words [overflow-wrap:anywhere]">
                      {typeof entry.note === "string" && entry.note.trim() !== ""
                        ? entry.note
                        : t("admin.user-detail.notes.cleared")}
                  </div>
                </div>
              ))
            ) : (
              <p className="font-body text-base text-white">{t("admin.user-detail.notes.empty")}</p>
            )}
          </div>
          <DetailPager
            label={t("common.page-fraction", { page: currentNotePage, totalPages: totalNotePages })}
            page={currentNotePage}
            totalPages={totalNotePages}
            href={(page) => {
              const search = new URLSearchParams();

              if (currentVisitPage > 1) {
                search.set("visitsPage", String(currentVisitPage));
              }

              if (page > 1) {
                search.set("notesPage", String(page));
              }

              const query = search.toString();
              return `${query ? `?${query}` : ""}#internal-notes`;
            }}
          />
        </DetailSection>
      </div>

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
        <DetailRow label={t("admin.user-detail.profile-fields.hackatime-trust-level")}>
          <HackatimeTrustStatus
            slackId={user.slack_id}
            trustLevel={hackatimeTrust?.trustLevel}
          />
        </DetailRow>
        <DetailFieldRow label={t("admin.user-detail.profile-fields.hca-id")} value={user.hca_id} mono />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.verification-status")} value={user.verification_status} />
        <DetailFieldRow
          label={t("admin.user-detail.profile-fields.hca-addresses")}
          value={
            addresses.length > 0
              ? addresses
                  .map(
                    (address, index) =>
                      `(${index + 1})\n${[
                        address.line_1 ?? null,
                        address.line_2 ?? null,
                        joinNonEmpty(
                          address.city ?? null,
                          address.state ?? null,
                          address.postal_code ?? null,
                          address.country ?? null,
                        ),
                      ]
                          .filter((part): part is string => part !== null && part !== "")
                        .join("\n")}`,
                  )
                  .join("\n\n")
              : null
          }
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
        <DetailFieldRow label={t("admin.user-detail.profile-fields.admin")} value={user.is_admin === true ? t("common.yes") : t("common.no")} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.posters-enabled")} value={user.posters_enabled === true ? t("common.yes") : t("common.no")} />
        <DetailFieldRow label={t("admin.user-detail.profile-fields.manual-dashboard-state")} value={manualDashboardStateLabel} />
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
                    <td className="px-4 py-4 font-body text-sm text-white">{application.name}</td>
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
            visits.map((visit) => {
              const localVisitTime = formatTimeInTimeZone(
                visit.created_at,
                locale,
                visit.timezone ?? user.timezone,
              );

              return (
                <div key={visit.id} className="pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-body text-sm text-white">{visit.ip}</span>
                    <span className="text-xs text-secondary">{visit.visit_type}</span>
                  </div>
                  <div className="mt-1 font-body text-sm text-white">
                    {joinNonEmpty(visit.city, visit.region, null, visit.country_code) ?? "-"}
                  </div>
                  <div className="mt-1 font-body text-sm text-white">{visit.org ?? t("admin.user-detail.visits.unknown-network")}</div>
                  <div className="mt-1 text-xs text-white">
                    {formatDateTime(visit.created_at, locale)}
                    {localVisitTime !== null ? ` (${t("admin.user-detail.visits.local-time", { time: localVisitTime })})` : ""}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="font-body text-base text-white">{t("admin.user-detail.visits.empty")}</p>
          )}
        </div>
        <DetailPager
          label={t("common.page-fraction", { page: currentVisitPage, totalPages: totalVisitPages })}
          page={currentVisitPage}
          totalPages={totalVisitPages}
          href={(page) => {
            const search = new URLSearchParams();

            if (page > 1) {
              search.set("visitsPage", String(page));
            }

            if (currentNotePage > 1) {
              search.set("notesPage", String(currentNotePage));
            }

            const query = search.toString();
            return query ? `?${query}` : "";
          }}
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
