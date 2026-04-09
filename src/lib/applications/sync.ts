import sql from "@/lib/database/client";
import {
  type AirtableApplicationRecord,
  listAirtableApplicationRecords,
  resolveApplicationFieldName,
} from "@/lib/applications/airtable";
import {
  APPLICATION_STATUS_PENDING_REVIEW,
  isRejectedPermanentlyApplicationStatus,
  normalizeApplicationStatus,
} from "@/lib/applications/status";

type SyncApplicationsResult = {
  inserted: number;
  matchedUsers: number;
  processed: number;
  unmatchedApplications: number;
  updated: number;
};

type SyncApplicationsOptions = {
  signal?: AbortSignal;
};

type LinkApplicationsToUserInput = {
  email?: string | null;
  hcaId?: string | null;
  slackId?: string | null;
  userId: string;
};

type MatchedUser = {
  hca_id: string;
  id: string;
};

function getRecordField(record: AirtableApplicationRecord, key: Parameters<typeof resolveApplicationFieldName>[1]) {
  const fieldName = resolveApplicationFieldName(record.fields, key);

  return fieldName ? record.fields[fieldName] : null;
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;

  throw signal.reason instanceof Error ? signal.reason : new Error("Airtable sync was aborted");
}

function getStringField(
  record: AirtableApplicationRecord,
  key: Parameters<typeof resolveApplicationFieldName>[1],
) {
  const value = getRecordField(record, key);

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getApplicationName(record: AirtableApplicationRecord) {
  const explicitName = getStringField(record, "name");
  if (explicitName) return explicitName;

  const preferredName = getStringField(record, "preferredName");
  const firstName = getStringField(record, "firstName");
  const lastName = getStringField(record, "lastName");

  const parts = [preferredName ?? firstName, lastName].filter(
    (value): value is string => Boolean(value),
  );

  return parts.length > 0 ? parts.join(" ") : null;
}

async function findMatchedUser(record: AirtableApplicationRecord): Promise<MatchedUser | null> {
  const slackId = getStringField(record, "slackId");

  if (slackId) {
    const [user] = await sql<MatchedUser[]>`
      SELECT id, hca_id
      FROM users
      WHERE slack_id = ${slackId}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `;

    if (user) return user;
  }

  const email = getStringField(record, "email");

  if (!email) return null;

  const [user] = await sql<MatchedUser[]>`
    SELECT id, hca_id
    FROM users
    WHERE LOWER(email) = LOWER(${email})
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `;

  return user ?? null;
}

async function syncPermanentRejectionStateForUser(userId: string) {
  const [latestApplication] = await sql<
    Array<{ rejection_reason: string | null; status: string | null }>
  >`
    SELECT status, rejection_reason
    FROM applications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `;

  if (!latestApplication) return;

  if (isRejectedPermanentlyApplicationStatus(latestApplication.status)) {
    await sql`
      UPDATE users
      SET permanently_rejected_at = COALESCE(permanently_rejected_at, NOW()),
          permanent_rejection_note = ${latestApplication.rejection_reason},
          updated_at = NOW()
      WHERE id = ${userId}
    `;

    return;
  }

  await sql`
    UPDATE users
    SET permanently_rejected_at = NULL,
        permanent_rejection_note = NULL,
        updated_at = NOW()
    WHERE id = ${userId}
  `;
}

export async function linkApplicationsToUser(input: LinkApplicationsToUserInput) {
  const slackId = input.slackId?.trim() || null;
  const email = input.email?.trim() || null;
  const hcaId = input.hcaId?.trim() || null;
  const hasSlackId = slackId !== null;
  const hasEmail = email !== null;

  if (!slackId && !email && !hcaId) return 0;

  const matchedApplications = await sql<Array<{ id: string }>>`
    UPDATE applications
    SET user_id = ${input.userId},
        applicant_hca_id = COALESCE(${hcaId}, applicant_hca_id),
        applicant_email = COALESCE(applicant_email, ${email}),
        applicant_slack_id = COALESCE(applicant_slack_id, ${slackId}),
        updated_at = NOW()
    WHERE (user_id IS NULL OR user_id = ${input.userId})
      AND (
        (${hasSlackId} AND applicant_slack_id = ${slackId})
        OR (${hasEmail} AND LOWER(applicant_email) = LOWER(${email}))
      )
    RETURNING id
  `;

  await sql`
    UPDATE applications
    SET applicant_hca_id = COALESCE(${hcaId}, applicant_hca_id),
        applicant_email = COALESCE(applicant_email, ${email}),
        applicant_slack_id = COALESCE(applicant_slack_id, ${slackId}),
        updated_at = NOW()
    WHERE user_id = ${input.userId}
  `;

  if (matchedApplications.length > 0) {
    await syncPermanentRejectionStateForUser(input.userId);
  }

  return matchedApplications.length;
}

export async function syncAirtableApplicationsToPostgres(
  options: SyncApplicationsOptions = {},
): Promise<SyncApplicationsResult> {
  throwIfAborted(options.signal);

  const records = await listAirtableApplicationRecords({ signal: options.signal });
  const result: SyncApplicationsResult = {
    inserted: 0,
    matchedUsers: 0,
    processed: records.length,
    unmatchedApplications: 0,
    updated: 0,
  };

  const matchedUserIds = new Set<string>();
  const touchedUserIds = new Set<string>();

  for (const record of records) {
    throwIfAborted(options.signal);

    const matchedUser = await findMatchedUser(record);
    throwIfAborted(options.signal);

    const [existingApplication] = await sql<
      Array<{ id: string; user_id: string | null }>
    >`
      SELECT id, user_id
      FROM applications
      WHERE airtable_record_id = ${record.id}
      LIMIT 1
    `;
    throwIfAborted(options.signal);

    const status =
      normalizeApplicationStatus(getStringField(record, "status")) ||
      APPLICATION_STATUS_PENDING_REVIEW;
    const rejectionReason = getStringField(record, "rejectionReason");
    const userId = matchedUser?.id ?? existingApplication?.user_id ?? null;
    const payload = record.fields;
    const createdAt = new Date(record.createdTime).toISOString();
    const syncedAt = new Date().toISOString();

    if (userId) {
      touchedUserIds.add(userId);
      matchedUserIds.add(userId);
    } else {
      result.unmatchedApplications += 1;
    }

    if (existingApplication) {
      await sql`
        UPDATE applications
        SET user_id = ${userId},
            status = ${status},
            name = ${getApplicationName(record)},
            applicant_email = ${getStringField(record, "email")},
            applicant_slack_id = ${getStringField(record, "slackId")},
            applicant_hca_id = ${matchedUser?.hca_id ?? null},
            applicant_phone = ${getStringField(record, "phone")},
            date_of_birth = ${getStringField(record, "birthdate")},
            address_line_1 = ${getStringField(record, "addressLine1")},
            address_line_2 = ${getStringField(record, "addressLine2")},
            address_city = ${getStringField(record, "addressCity")},
            address_state = ${getStringField(record, "addressState")},
            address_zip = ${getStringField(record, "addressZip")},
            address_country = ${getStringField(record, "addressCountry")},
            github_url = ${getStringField(record, "githubUrl")},
            portfolio_url = ${getStringField(record, "portfolioUrl")},
            application_first_thing_do = ${getStringField(
              record,
              "applicationFirstThingDo",
            )},
            application_best_place_poster = ${getStringField(
              record,
              "applicationBestPlacePoster",
            )},
            idv_status = ${getStringField(record, "idvStatus")},
            rejection_reason = ${rejectionReason},
            decision_note = ${rejectionReason},
            airtable_created_time = ${createdAt},
            airtable_last_synced_at = ${syncedAt},
            airtable_payload = ${JSON.stringify(payload)},
            updated_at = NOW()
        WHERE id = ${existingApplication.id}
      `;
      throwIfAborted(options.signal);

      result.updated += 1;
      continue;
    }

    await sql`
      INSERT INTO applications (
        id,
        user_id,
        status,
        name,
        applicant_email,
        applicant_slack_id,
        applicant_hca_id,
        applicant_phone,
        date_of_birth,
        address_line_1,
        address_line_2,
        address_city,
        address_state,
        address_zip,
        address_country,
        github_url,
        portfolio_url,
        application_first_thing_do,
        application_best_place_poster,
        idv_status,
        rejection_reason,
        decision_note,
        airtable_record_id,
        airtable_created_time,
        airtable_last_synced_at,
        airtable_payload,
        created_at,
        updated_at
      )
      VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${status},
        ${getApplicationName(record)},
        ${getStringField(record, "email")},
        ${getStringField(record, "slackId")},
        ${matchedUser?.hca_id ?? null},
        ${getStringField(record, "phone")},
        ${getStringField(record, "birthdate")},
        ${getStringField(record, "addressLine1")},
        ${getStringField(record, "addressLine2")},
        ${getStringField(record, "addressCity")},
        ${getStringField(record, "addressState")},
        ${getStringField(record, "addressZip")},
        ${getStringField(record, "addressCountry")},
        ${getStringField(record, "githubUrl")},
        ${getStringField(record, "portfolioUrl")},
        ${getStringField(record, "applicationFirstThingDo")},
        ${getStringField(record, "applicationBestPlacePoster")},
        ${getStringField(record, "idvStatus")},
        ${rejectionReason},
        ${rejectionReason},
        ${record.id},
        ${createdAt},
        ${syncedAt},
        ${JSON.stringify(payload)},
        ${createdAt},
        NOW()
      )
    `;
    throwIfAborted(options.signal);

    result.inserted += 1;
  }

  throwIfAborted(options.signal);
  await Promise.all(
    Array.from(touchedUserIds, (userId) => syncPermanentRejectionStateForUser(userId)),
  );

  result.matchedUsers = matchedUserIds.size;

  return result;
}
