import "server-only";

import { randomUUID } from "node:crypto";

import type postgres from "postgres";

import { APPLICATION_STATUS_ACCEPTED } from "@/lib/applications/status";
import { getAmbassadorOnboardingGrantContact } from "@/lib/ambassadors/airtable";
import { logAdminActionEvent } from "@/lib/admin-action-events";
import sql from "@/lib/database/client";
import { clearOfficeGrantCostCache } from "@/lib/hcb/office-grant-cost";
import {
  createHcbOrganizationCardGrant,
  fetchHcbCardGrant,
  getHcbOauthConnection,
  HcbApiError,
  listHcbOrganizationCardGrants,
  type HcbCardGrant,
} from "@/lib/hcb/service";

type GrantQueryClient = postgres.Sql | postgres.TransactionSql;

type UserGrantRow = {
  id: string;
  user_id: string;
  grant_id: string | null;
  organization_id: string | null;
  provisioning_state: string;
  provisioning_source: string | null;
  purpose: string;
  amount_cents: number;
  balance_cents: number | null;
  balance_synced_at: string | null;
  linked_at: string | null;
  linked_by_user_id: string | null;
  last_attempted_at: string | null;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type PendingGrantRow = UserGrantRow & {
  display_name: string;
};

type CandidateRow = {
  user_id: string;
  airtable_record_id: string | null;
  airtable_payload: unknown;
};

type LatestApplicationRow = {
  status: string;
  airtable_record_id: string | null;
  airtable_payload: unknown;
};

type GrantProvisioningTarget = {
  hasCompletedOnboarding: boolean;
  email: string | null;
};

export type OfficeGrantRecord = {
  id: string;
  userId: string;
  grantId: string | null;
  organizationId: string | null;
  provisioningState: string;
  provisioningSource: string | null;
  purpose: string;
  amountCents: number;
  balanceCents: number | null;
  balanceSyncedAt: string | null;
  linkedAt: string | null;
  linkedByUserId: string | null;
  lastAttemptedAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OfficeGrantProvisionRequestResult =
  | "already_linked"
  | "already_pending"
  | "linked"
  | "not_onboarded"
  | "provision_failed"
  | "queued";

function toOfficeGrantRecord(row: UserGrantRow): OfficeGrantRecord {
  return {
    id: row.id,
    userId: row.user_id,
    grantId: row.grant_id,
    organizationId: row.organization_id,
    provisioningState: row.provisioning_state,
    provisioningSource: row.provisioning_source,
    purpose: row.purpose,
    amountCents: row.amount_cents,
    balanceCents: row.balance_cents,
    balanceSyncedAt: row.balance_synced_at,
    linkedAt: row.linked_at,
    linkedByUserId: row.linked_by_user_id,
    lastAttemptedAt: row.last_attempted_at,
    nextRetryAt: row.next_retry_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildOfficeGrantUrl(grantId: string | null) {
  if (grantId === null) return null;

  const grantHashid = grantId.startsWith("cdg_") ? grantId.slice("cdg_".length) : grantId;

  return `${"https://hcb.hackclub.com"}/grants/${encodeURIComponent(grantHashid)}`;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isMatchingOfficeGrantPurpose(purpose: string | null) {
  const normalizedPurpose = purpose ?? "Office Expenses";

  return normalizedPurpose === "Office grant!" || normalizedPurpose === "Office Expenses";
}

function isActiveGrantStatus(status: string | null) {
  return status === "active";
}

function isMatchingOfficeGrant(grant: HcbCardGrant, email: string) {
  return (
    grant.organizationId === "org_lbu4gX" &&
    grant.amountCents === 2_000 &&
    isMatchingOfficeGrantPurpose(grant.purpose) &&
    isActiveGrantStatus(grant.status) &&
    normalizeEmail(grant.email) === normalizeEmail(email)
  );
}

function assertValidOfficeGrant(
  grant: HcbCardGrant,
  options?: { email?: string | null },
) {
  if (grant.organizationId !== "org_lbu4gX") {
    throw new Error("Grant does not belong to the Hack Club Ambassador Program organization");
  }

  if (!isActiveGrantStatus(grant.status)) {
    throw new Error("Grant is not active");
  }

  if (grant.amountCents !== 2_000) {
    throw new Error("Grant amount does not match the configured office grant amount");
  }

  if (!isMatchingOfficeGrantPurpose(grant.purpose)) {
    throw new Error("Grant purpose does not match the configured office grant purpose");
  }

  if (options?.email !== undefined && normalizeEmail(options.email) !== normalizeEmail(grant.email)) {
    throw new Error("Grant email does not match the expected email address");
  }
}

function getRetryAtDate() {
  return new Date(Date.now() + 10 * 60 * 1000);
}

function normalizeHcbError(error: unknown) {
  if (error instanceof HcbApiError) {
    const body = error.body;

    if (typeof body === "string" && body.trim() !== "") {
      return body;
    }

    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      const messages = Reflect.get(body, "messages");
      if (Array.isArray(messages)) {
        const joined = messages
          .filter((message): message is string => typeof message === "string" && message.trim() !== "")
          .join("; ");

        if (joined !== "") {
          return joined;
        }
      }

      const errorCode = Reflect.get(body, "error");
      if (typeof errorCode === "string" && errorCode.trim() !== "") {
        return `${error.status}: ${errorCode}`;
      }
    }

    return `HCB API ${error.status}`;
  }

  return error instanceof Error ? error.message : String(error);
}

async function queuePendingGrant(input: {
  userId: string;
  source: "automatic" | "manual";
}) {
  await sql`
    INSERT INTO user_hcb_grants (
      id,
      user_id,
      provisioning_state,
      provisioning_source,
      purpose,
      amount_cents,
      created_at,
      updated_at
    )
    VALUES (
      ${randomUUID()},
      ${input.userId},
      'pending',
      ${input.source},
      ${"Office grant!"},
      ${2_000},
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      provisioning_state = CASE
        WHEN user_hcb_grants.provisioning_state = 'linked' THEN user_hcb_grants.provisioning_state
        ELSE 'pending'
      END,
      provisioning_source = CASE
        WHEN user_hcb_grants.provisioning_state = 'linked' THEN user_hcb_grants.provisioning_source
        ELSE ${input.source}
      END,
      purpose = CASE
        WHEN user_hcb_grants.provisioning_state = 'linked' THEN user_hcb_grants.purpose
        ELSE ${"Office grant!"}
      END,
      amount_cents = CASE
        WHEN user_hcb_grants.provisioning_state = 'linked' THEN user_hcb_grants.amount_cents
        ELSE ${2_000}
      END,
      next_retry_at = CASE
        WHEN user_hcb_grants.provisioning_state = 'linked' THEN user_hcb_grants.next_retry_at
        ELSE NULL
      END,
      last_error = CASE
        WHEN user_hcb_grants.provisioning_state = 'linked' THEN user_hcb_grants.last_error
        ELSE NULL
      END,
      updated_at = NOW()
  `;
}

async function setPendingGrantError(
  grantRowId: string,
  message: string,
  db: GrantQueryClient = sql,
) {
  await db`
    UPDATE user_hcb_grants
    SET last_error = ${message},
        last_attempted_at = NOW(),
        next_retry_at = ${getRetryAtDate()},
        updated_at = NOW()
    WHERE id = ${grantRowId}
  `;
}

async function linkGrantRecord(
  input: {
    rowId: string;
    userId: string;
    grant: HcbCardGrant;
    source: "automatic" | "manual";
    actorUserId: string | null;
  },
  db: GrantQueryClient = sql,
) {
  await db`
    UPDATE user_hcb_grants
    SET grant_id = ${input.grant.id},
        organization_id = ${input.grant.organizationId ?? "org_lbu4gX"},
        provisioning_state = 'linked',
        provisioning_source = ${input.source},
        purpose = ${input.grant.purpose ?? "Office grant!"},
        amount_cents = ${input.grant.amountCents},
        balance_cents = ${input.grant.balanceCents},
        balance_synced_at = ${new Date()},
        linked_at = NOW(),
        linked_by_user_id = ${input.actorUserId},
        last_attempted_at = NOW(),
        next_retry_at = NULL,
        last_error = NULL,
        updated_at = NOW()
    WHERE id = ${input.rowId}
  `;

  await logAdminActionEvent({
    actorUserId: input.actorUserId,
    targetUserId: input.userId,
    action: input.source === "manual" ? "user_hcb_grant_linked" : "user_hcb_grant_provisioned",
    metadata: {
      grantId: input.grant.id,
      organizationId: input.grant.organizationId ?? "org_lbu4gX",
      amountCents: input.grant.amountCents,
      purpose: input.grant.purpose ?? "Office grant!",
      source: input.source,
    },
  });

  // A freshly provisioned grant changes the campaign's grant spend; drop the
  // cached total so the stats endpoint re-reads it on the next call.
  clearOfficeGrantCostCache();
}

async function loadLatestApplication(userId: string) {
  return (await sql<LatestApplicationRow[]>`
    SELECT status, airtable_record_id, airtable_payload
    FROM applications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).at(0) ?? null;
}

async function isEligibleForOfficeGrantProvisioning(userId: string) {
  const provisioningTarget = await getOfficeGrantProvisioningTarget(userId);
  return provisioningTarget.hasCompletedOnboarding;
}

async function getOfficeGrantProvisioningTarget(userId: string): Promise<GrantProvisioningTarget> {
  const latestApplication = await loadLatestApplication(userId);

  if (latestApplication === null || latestApplication.status !== APPLICATION_STATUS_ACCEPTED) {
    return {
      hasCompletedOnboarding: false,
      email: null,
    };
  }

  const onboardingGrantContact = await getAmbassadorOnboardingGrantContact({
    applicationAirtableRecordId: latestApplication.airtable_record_id,
    applicationAirtablePayload: latestApplication.airtable_payload,
  });

  return {
    hasCompletedOnboarding: onboardingGrantContact.hasCompletedOnboarding,
    email: onboardingGrantContact.hcbEmail,
  };
}

async function findMatchingExistingGrant(input: {
  grants: HcbCardGrant[];
  email: string;
}) {
  const matches = input.grants.filter((grant) => isMatchingOfficeGrant(grant, input.email));

  if (matches.length !== 1) {
    return null;
  }

  return matches[0];
}

async function listRetryablePendingGrantRows() {
  return sql<PendingGrantRow[]>`
    SELECT grants.id, grants.user_id, grants.grant_id, grants.organization_id,
           grants.provisioning_state, grants.provisioning_source, grants.purpose,
           grants.amount_cents, grants.balance_cents, grants.balance_synced_at,
           grants.linked_at, grants.linked_by_user_id, grants.last_attempted_at,
           grants.next_retry_at, grants.last_error, grants.created_at, grants.updated_at,
           users.display_name
    FROM user_hcb_grants grants
    JOIN users ON users.id = grants.user_id
    WHERE grants.provisioning_state = 'pending'
      AND (grants.next_retry_at IS NULL OR grants.next_retry_at <= NOW())
    ORDER BY grants.created_at ASC
    LIMIT 25
  `;
}

async function getRetryablePendingGrantRowForUser(userId: string) {
  return (await sql<PendingGrantRow[]>`
    SELECT grants.id, grants.user_id, grants.grant_id, grants.organization_id,
           grants.provisioning_state, grants.provisioning_source, grants.purpose,
           grants.amount_cents, grants.balance_cents, grants.balance_synced_at,
           grants.linked_at, grants.linked_by_user_id, grants.last_attempted_at,
           grants.next_retry_at, grants.last_error, grants.created_at, grants.updated_at,
           users.display_name
    FROM user_hcb_grants grants
    JOIN users ON users.id = grants.user_id
    WHERE grants.user_id = ${userId}
      AND grants.provisioning_state = 'pending'
      AND (grants.next_retry_at IS NULL OR grants.next_retry_at <= NOW())
    LIMIT 1
  `).at(0) ?? null;
}

async function processPendingGrantRow(
  row: PendingGrantRow,
  input: {
    existingGrants: HcbCardGrant[];
    actorUserId: string | null;
  },
) {
  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`hcb-grant:${row.user_id}`})::bigint)`;

      const current = (await tx<{ provisioning_state: string }[]>`
        SELECT provisioning_state
        FROM user_hcb_grants
        WHERE id = ${row.id}
        LIMIT 1
      `).at(0) ?? null;

      if (current === null || current.provisioning_state !== "pending") {
        return current?.provisioning_state === "linked";
      }

      const provisioningTarget = await getOfficeGrantProvisioningTarget(row.user_id);

      if (!provisioningTarget.hasCompletedOnboarding) {
        await setPendingGrantError(row.id, "User is not yet onboarded for office grant provisioning", tx);
        return false;
      }

      const email = provisioningTarget.email?.trim() ?? "";
      if (email === "") {
        await setPendingGrantError(row.id, "Completed onboarding record is missing hcb_email for grant provisioning", tx);
        return false;
      }

      const matchedGrant = await findMatchingExistingGrant({
        grants: input.existingGrants,
        email,
      });

      const grant = matchedGrant ?? await createHcbOrganizationCardGrant({
        organizationId: "org_lbu4gX",
        email,
        amountCents: 2_000,
        purpose: "Office grant!",
        instructions: "Please ask if you are unsure about your purchase counting as an office expense, you may face consequences if it does not.",
        idempotencyKey: `office-grant:${row.user_id}`,
      });

      assertValidOfficeGrant(grant, { email });

      if (matchedGrant === null) {
        input.existingGrants.push(grant);
      }

      const resolvedGrant = grant.balanceCents === null
        ? await fetchHcbCardGrant(grant.id).catch(() => grant)
        : grant;

      assertValidOfficeGrant(resolvedGrant, { email });

      await linkGrantRecord({
        rowId: row.id,
        userId: row.user_id,
        grant: resolvedGrant,
        source: row.provisioning_source === "manual" ? "manual" : "automatic",
        actorUserId: input.actorUserId,
      }, tx);

      return true;
    });
  } catch (error) {
    await setPendingGrantError(row.id, normalizeHcbError(error));
    return false;
  }
}

async function getOfficeGrantRecordForUser(userId: string) {
  const row = (await sql<UserGrantRow[]>`
    SELECT id, user_id, grant_id, organization_id, provisioning_state, provisioning_source,
           purpose, amount_cents, balance_cents, balance_synced_at, linked_at, linked_by_user_id,
           last_attempted_at, next_retry_at, last_error, created_at, updated_at
    FROM user_hcb_grants
    WHERE user_id = ${userId}
    LIMIT 1
  `).at(0) ?? null;

  return row === null ? null : toOfficeGrantRecord(row);
}

export async function refreshOfficeGrantBalanceForUser(userId: string) {
  const grant = await getOfficeGrantRecordForUser(userId);
  if (grant === null || grant.provisioningState !== "linked" || grant.grantId === null) {
    return grant;
  }

  try {
    const liveGrant = await fetchHcbCardGrant(grant.grantId);

    await sql`
      UPDATE user_hcb_grants
      SET balance_cents = ${liveGrant.balanceCents},
          balance_synced_at = NOW(),
          last_error = NULL,
          updated_at = NOW()
      WHERE id = ${grant.id}
    `;

    return {
      ...grant,
      balanceCents: liveGrant.balanceCents,
      balanceSyncedAt: new Date().toISOString(),
      lastError: null,
      organizationId: liveGrant.organizationId ?? grant.organizationId,
      purpose: liveGrant.purpose ?? grant.purpose,
    } satisfies OfficeGrantRecord;
  } catch (error) {
    console.error("Failed to refresh HCB office grant balance", { userId, error });
    return grant;
  }
}

export async function queueEligibleOfficeGrants() {
  const candidates = await sql<CandidateRow[]>`
    SELECT latest.user_id, latest.airtable_record_id, latest.airtable_payload
    FROM (
      SELECT DISTINCT ON (a.user_id)
             a.user_id,
             a.status,
             a.airtable_record_id,
             a.airtable_payload
      FROM applications a
      WHERE a.user_id IS NOT NULL
      ORDER BY a.user_id, a.created_at DESC, a.id DESC
    ) latest
    LEFT JOIN user_hcb_grants grants ON grants.user_id = latest.user_id
    WHERE latest.status = ${APPLICATION_STATUS_ACCEPTED}
      AND grants.user_id IS NULL
  `;

  let queued = 0;

  for (const candidate of candidates) {
    const onboardingGrantContact = await getAmbassadorOnboardingGrantContact({
      applicationAirtableRecordId: candidate.airtable_record_id,
      applicationAirtablePayload: candidate.airtable_payload,
    });

    if (!onboardingGrantContact.hasCompletedOnboarding || onboardingGrantContact.hcbEmail === null) {
      continue;
    }

    await queuePendingGrant({
      userId: candidate.user_id,
      source: "automatic",
    });
    queued += 1;
  }

  return queued;
}

export async function processPendingOfficeGrants() {
  const pendingCount = (await sql<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM user_hcb_grants
    WHERE provisioning_state = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  `).at(0)?.count ?? 0;

  if (pendingCount === 0) {
    return {
      attempted: 0,
      linked: 0,
      failed: 0,
    };
  }

  const connection = await getHcbOauthConnection();

  const pendingRows = await listRetryablePendingGrantRows();

  if (pendingRows.length === 0) {
    return {
      attempted: 0,
      linked: 0,
      failed: 0,
    };
  }

  if (connection === null) {
    for (const row of pendingRows) {
      await setPendingGrantError(row.id, "HCB has not been authorized yet");
    }

    return {
      attempted: pendingRows.length,
      linked: 0,
      failed: pendingRows.length,
    };
  }

  let existingGrants: HcbCardGrant[] = [];

  try {
    existingGrants = await listHcbOrganizationCardGrants("org_lbu4gX");
  } catch (error) {
    const message = normalizeHcbError(error);

    for (const row of pendingRows) {
      await setPendingGrantError(row.id, message);
    }

    return {
      attempted: pendingRows.length,
      linked: 0,
      failed: pendingRows.length,
    };
  }

  let linked = 0;
  let failed = 0;

  for (const row of pendingRows) {
    if (await processPendingGrantRow(row, { existingGrants, actorUserId: null })) {
      linked += 1;
    } else {
      failed += 1;
    }
  }

  return {
    attempted: pendingRows.length,
    linked,
    failed,
  };
}

async function validateManualGrantLink(input: {
  grantId: string;
  email: string | null;
}) {
  const grant = await fetchHcbCardGrant(input.grantId);
  assertValidOfficeGrant(grant, { email: input.email });

  return grant;
}

export async function linkOfficeGrantToUser(input: {
  userId: string;
  grantId: string;
  actorUserId: string;
}) {
  const user = (await sql<Array<{ email: string | null }>>`
    SELECT email
    FROM users
    WHERE id = ${input.userId}
    LIMIT 1
  `).at(0) ?? null;

  if (user === null) {
    throw new Error("User not found");
  }

  const provisioningTarget = await getOfficeGrantProvisioningTarget(input.userId);
  const expectedGrantEmail =
    provisioningTarget.hasCompletedOnboarding && provisioningTarget.email !== null
      ? provisioningTarget.email
      : user.email;

  const grant = await validateManualGrantLink({
    grantId: input.grantId,
    email: expectedGrantEmail,
  });

  const conflictingUser = (await sql<Array<{ user_id: string }>>`
    SELECT user_id
    FROM user_hcb_grants
    WHERE grant_id = ${grant.id}
      AND user_id <> ${input.userId}
    LIMIT 1
  `).at(0) ?? null;

  if (conflictingUser !== null) {
    throw new Error("This HCB grant is already linked to another user");
  }

  const existingRow = await getOfficeGrantRecordForUser(input.userId);
  const rowId = existingRow?.id ?? randomUUID();

  if (existingRow === null) {
    await sql`
      INSERT INTO user_hcb_grants (
        id,
        user_id,
        provisioning_state,
        provisioning_source,
        purpose,
        amount_cents,
        created_at,
        updated_at
      )
      VALUES (
        ${rowId},
        ${input.userId},
        'pending',
        'manual',
        ${"Office grant!"},
        ${2_000},
        NOW(),
        NOW()
      )
    `;
  }

  await linkGrantRecord({
    rowId,
    userId: input.userId,
    grant,
    source: "manual",
    actorUserId: input.actorUserId,
  });
}

export async function unlinkOfficeGrantFromUser(input: {
  userId: string;
  actorUserId: string;
}) {
  const existingGrant = await getOfficeGrantRecordForUser(input.userId);
  if (existingGrant === null) {
    return;
  }

  await sql`
    UPDATE user_hcb_grants
    SET grant_id = NULL,
        organization_id = NULL,
        provisioning_state = 'unlinked',
        provisioning_source = 'manual',
        balance_cents = NULL,
        balance_synced_at = NULL,
        linked_at = NULL,
        linked_by_user_id = ${input.actorUserId},
        next_retry_at = NULL,
        last_error = NULL,
        updated_at = NOW()
    WHERE id = ${existingGrant.id}
  `;

  await logAdminActionEvent({
    actorUserId: input.actorUserId,
    targetUserId: input.userId,
    action: "user_hcb_grant_unlinked",
    metadata: {
      previousGrantId: existingGrant.grantId,
      previousOrganizationId: existingGrant.organizationId,
    },
  });
}

export async function requestOfficeGrantProvisioningForUser(
  input: {
    userId: string;
    actorUserId: string;
  },
): Promise<OfficeGrantProvisionRequestResult> {
  const existingGrant = await getOfficeGrantRecordForUser(input.userId);

  if (existingGrant?.provisioningState === "linked") {
    return "already_linked";
  }

  if (!(await isEligibleForOfficeGrantProvisioning(input.userId))) {
    return "not_onboarded";
  }

  await queuePendingGrant({
    userId: input.userId,
    source: "manual",
  });

  const pendingGrant = await getRetryablePendingGrantRowForUser(input.userId);
  if (pendingGrant === null) {
    return existingGrant?.provisioningState === "pending" ? "already_pending" : "queued";
  }

  const connection = await getHcbOauthConnection();
  if (connection === null) {
    await setPendingGrantError(pendingGrant.id, "HCB has not been authorized yet");
    return "provision_failed";
  }

  let existingGrants: HcbCardGrant[] = [];

  try {
    existingGrants = await listHcbOrganizationCardGrants("org_lbu4gX");
  } catch (error) {
    await setPendingGrantError(pendingGrant.id, normalizeHcbError(error));
    return "provision_failed";
  }

  const linked = await processPendingGrantRow(pendingGrant, {
    existingGrants,
    actorUserId: input.actorUserId,
  });

  if (linked) {
    return "linked";
  }

  return existingGrant?.provisioningState === "pending" ? "already_pending" : "provision_failed";
}

export function getOfficeGrantDashboardMessage(input: {
  grant: OfficeGrantRecord | null;
}) {
  const grant = input.grant;

  if (grant === null || grant.provisioningState === "unlinked") {
    return {
      state: grant?.provisioningState ?? "none",
      href: null,
      messageKey: "none",
    } as const;
  }

  if (grant.provisioningState !== "linked" || grant.grantId === null) {
    return {
      state: grant.provisioningState,
      href: null,
      messageKey: "failed",
    } as const;
  }

  return {
    state: grant.provisioningState,
    href: buildOfficeGrantUrl(grant.grantId),
    messageKey: "linked",
  } as const;
}
