import sql from "@/lib/database/client";
import {
  type AirtableApplicationRecord,
  getAirtableApplicationFieldValue,
  listAirtableApplicationRecords,
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

type ApplicationIdentityRow = {
  id: string;
  user_id: string | null;
};

type ApplicationStatusRow = {
  status: string | null;
  rejection_reason: string | null;
};

function getTrimmedStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted !== true) return;

  throw signal.reason instanceof Error ? signal.reason : new Error("Airtable sync was aborted");
}

async function findMatchedUser(record: AirtableApplicationRecord): Promise<MatchedUser | null> {
  const slackIdValue = getAirtableApplicationFieldValue(record.fields, "slackId");
  const slackId = getTrimmedStringOrNull(slackIdValue);
  const emailValue = getAirtableApplicationFieldValue(record.fields, "email");
  const email = getTrimmedStringOrNull(emailValue);

  if (slackId === null && email === null) return null;

  const user = (await sql<MatchedUser[]>`
    SELECT id, hca_id
    FROM users
    WHERE (${slackId !== null} AND slack_id = ${slackId})
       OR (${email !== null} AND LOWER(email) = LOWER(${email}))
    ORDER BY
      CASE WHEN ${slackId !== null} AND slack_id = ${slackId} THEN 0 ELSE 1 END,
      updated_at DESC,
      created_at DESC
    LIMIT 1
  `).at(0) ?? null;

  return user;
}

async function syncPermanentRejectionStateForUser(userId: string) {
  const latestApplication = (await sql<ApplicationStatusRow[]>`
    SELECT status, rejection_reason
    FROM applications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).at(0) ?? null;

  if (latestApplication === null) return;

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
  const slackId = getTrimmedStringOrNull(input.slackId);
  const email = getTrimmedStringOrNull(input.email);
  const hcaId = getTrimmedStringOrNull(input.hcaId);
  const hasSlackId = slackId !== null;
  const hasEmail = email !== null;

  if (slackId === null && email === null && hcaId === null) return 0;

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

    const [matchedUser, existingApplication] = await Promise.all([
      findMatchedUser(record),
      sql<ApplicationIdentityRow[]>`
        SELECT id, user_id
        FROM applications
        WHERE airtable_record_id = ${record.id}
        LIMIT 1
      `.then((rows) => rows.at(0) ?? null),
    ]);
    throwIfAborted(options.signal);

    const rawStatus = getAirtableApplicationFieldValue(record.fields, "status");
    const rawPreferredName = getAirtableApplicationFieldValue(record.fields, "preferredName");
    const rawFirstName = getAirtableApplicationFieldValue(record.fields, "firstName");
    const rawLastName = getAirtableApplicationFieldValue(record.fields, "lastName");
    const rawRejectionReason = getAirtableApplicationFieldValue(record.fields, "rejectionReason");
    const rawEmail = getAirtableApplicationFieldValue(record.fields, "email");
    const rawSlackId = getAirtableApplicationFieldValue(record.fields, "slackId");
    const rawPhone = getAirtableApplicationFieldValue(record.fields, "phone");
    const rawBirthdate = getAirtableApplicationFieldValue(record.fields, "birthdate");
    const rawAddressLine1 = getAirtableApplicationFieldValue(record.fields, "addressLine1");
    const rawAddressLine2 = getAirtableApplicationFieldValue(record.fields, "addressLine2");
    const rawAddressCity = getAirtableApplicationFieldValue(record.fields, "addressCity");
    const rawAddressState = getAirtableApplicationFieldValue(record.fields, "addressState");
    const rawAddressZip = getAirtableApplicationFieldValue(record.fields, "addressZip");
    const rawAddressCountry = getAirtableApplicationFieldValue(record.fields, "addressCountry");
    const rawGithubUrl = getAirtableApplicationFieldValue(record.fields, "githubUrl");
    const rawPortfolioUrl = getAirtableApplicationFieldValue(record.fields, "portfolioUrl");
    const rawApplicationFirstThingDo = getAirtableApplicationFieldValue(record.fields, "applicationFirstThingDo");
    const rawApplicationBestPlacePoster = getAirtableApplicationFieldValue(record.fields, "applicationBestPlacePoster");
    const rawIdvStatus = getAirtableApplicationFieldValue(record.fields, "idvStatus");
    const fieldValues = {
      status: getTrimmedStringOrNull(rawStatus),
      preferredName: getTrimmedStringOrNull(rawPreferredName),
      firstName: getTrimmedStringOrNull(rawFirstName),
      lastName: getTrimmedStringOrNull(rawLastName),
      rejectionReason: getTrimmedStringOrNull(rawRejectionReason),
      email: getTrimmedStringOrNull(rawEmail),
      slackId: getTrimmedStringOrNull(rawSlackId),
      phone: getTrimmedStringOrNull(rawPhone),
      birthdate: getTrimmedStringOrNull(rawBirthdate),
      addressLine1: getTrimmedStringOrNull(rawAddressLine1),
      addressLine2: getTrimmedStringOrNull(rawAddressLine2),
      addressCity: getTrimmedStringOrNull(rawAddressCity),
      addressState: getTrimmedStringOrNull(rawAddressState),
      addressZip: getTrimmedStringOrNull(rawAddressZip),
      addressCountry: getTrimmedStringOrNull(rawAddressCountry),
      githubUrl: getTrimmedStringOrNull(rawGithubUrl),
      portfolioUrl: getTrimmedStringOrNull(rawPortfolioUrl),
      applicationFirstThingDo: getTrimmedStringOrNull(rawApplicationFirstThingDo),
      applicationBestPlacePoster: getTrimmedStringOrNull(rawApplicationBestPlacePoster),
      idvStatus: getTrimmedStringOrNull(rawIdvStatus),
    };
    const status =
      normalizeApplicationStatus(fieldValues.status) ||
      APPLICATION_STATUS_PENDING_REVIEW;
    const applicationNameParts = [fieldValues.preferredName ?? fieldValues.firstName, fieldValues.lastName]
      .filter((value): value is string => value !== null && value !== "");
    const applicationName = applicationNameParts.length > 0 ? applicationNameParts.join(" ") : null;
    const rejectionReason = fieldValues.rejectionReason;
    const userId = matchedUser?.id ?? existingApplication?.user_id ?? null;
    const payload = record.fields;
    const createdAt = new Date(record.createdTime).toISOString();
    const syncedAt = new Date().toISOString();

    if (userId !== null) {
      touchedUserIds.add(userId);
      matchedUserIds.add(userId);
    } else {
      result.unmatchedApplications += 1;
    }

    if (existingApplication !== null) {
      await sql`
        UPDATE applications
        SET user_id = ${userId},
            status = ${status},
            name = ${applicationName},
            applicant_email = ${fieldValues.email},
            applicant_slack_id = ${fieldValues.slackId},
            applicant_hca_id = ${matchedUser?.hca_id ?? null},
            applicant_phone = ${fieldValues.phone},
            date_of_birth = ${fieldValues.birthdate},
            address_line_1 = ${fieldValues.addressLine1},
            address_line_2 = ${fieldValues.addressLine2},
            address_city = ${fieldValues.addressCity},
            address_state = ${fieldValues.addressState},
            address_zip = ${fieldValues.addressZip},
            address_country = ${fieldValues.addressCountry},
            github_url = ${fieldValues.githubUrl},
            portfolio_url = ${fieldValues.portfolioUrl},
            application_first_thing_do = ${fieldValues.applicationFirstThingDo},
            application_best_place_poster = ${fieldValues.applicationBestPlacePoster},
            idv_status = ${fieldValues.idvStatus},
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
        ${applicationName},
        ${fieldValues.email},
        ${fieldValues.slackId},
        ${matchedUser?.hca_id ?? null},
        ${fieldValues.phone},
        ${fieldValues.birthdate},
        ${fieldValues.addressLine1},
        ${fieldValues.addressLine2},
        ${fieldValues.addressCity},
        ${fieldValues.addressState},
        ${fieldValues.addressZip},
        ${fieldValues.addressCountry},
        ${fieldValues.githubUrl},
        ${fieldValues.portfolioUrl},
        ${fieldValues.applicationFirstThingDo},
        ${fieldValues.applicationBestPlacePoster},
        ${fieldValues.idvStatus},
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
