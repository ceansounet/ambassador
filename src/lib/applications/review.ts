import { syncAmbassadorTshirtSentToAirtable } from "@/lib/ambassadors/airtable";
import {
  syncApplicationReviewDecisionToAirtable,
} from "@/lib/applications/airtable";
import {
  canChangeApplicationReviewStatus,
  type ApplicationStatus,
  APPLICATION_STATUS_ACCEPTED,
  APPLICATION_STATUS_REJECTED_PERMANENT,
} from "@/lib/applications/status";
import sql from "@/lib/database/client";

type AdminUserRow = {
  is_admin: boolean | null;
};

type ReviewApplicationRow = {
  id: string;
  user_id: string | null;
  applicant_email?: string | null;
  status: ApplicationStatus;
  airtable_record_id?: string | null;
  airtable_payload?: unknown | null;
};

type UpdatedTshirtStatusRow = {
  id: string;
  tshirt_sent: boolean | null;
};

export class DuplicateReviewDecisionError extends Error {
  constructor(readonly status: ApplicationStatus) {
    super(`Application is already in status ${status}`);
    this.name = "DuplicateReviewDecisionError";
  }
}

export async function isUserAdmin(userId: string) {
  const user = (await sql<AdminUserRow[]>`
    SELECT is_admin
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `).at(0);

  return Boolean(user?.is_admin);
}

type ReviewDecisionInput = {
  note?: string | null;
  reviewedBy?: string | null;
  status: ApplicationStatus;
};

export async function getLatestApplicationForUser(userId: string) {
  const application = (await sql<ReviewApplicationRow[]>`
    SELECT id, user_id, applicant_email, status, airtable_record_id, airtable_payload
    FROM applications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).at(0);

  return application ?? null;
}

export async function getLatestApplicationForApplicationId(applicationId: string) {
  const application = (await sql<ReviewApplicationRow[]>`
    SELECT id, user_id, applicant_email, status
    FROM applications
    WHERE id = ${applicationId}
    LIMIT 1
  `).at(0);

  if (!application) return null;

  if (application.user_id !== null) {
    return getLatestApplicationForUser(application.user_id);
  }

  const applicantEmail = application.applicant_email?.trim();

  if (applicantEmail === undefined || applicantEmail === "") {
    return application;
  }

  const latestByEmail = (await sql<ReviewApplicationRow[]>`
    SELECT id, user_id, applicant_email, status
    FROM applications
    WHERE user_id IS NULL
      AND LOWER(applicant_email) = LOWER(${applicantEmail})
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).at(0);

  return latestByEmail ?? application;
}

async function syncPermanentRejectionStateForUser(
  userId: string,
  status: ApplicationStatus,
  note: string | null,
) {
  if (status === APPLICATION_STATUS_REJECTED_PERMANENT) {
    await sql`
      UPDATE users
      SET permanently_rejected_at = COALESCE(permanently_rejected_at, NOW()),
          permanent_rejection_note = ${note},
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

async function applyApplicationReview(
  application: ReviewApplicationRow,
  input: ReviewDecisionInput,
) {
  const trimmedNote = input.note?.trim();
  const note = trimmedNote !== undefined && trimmedNote !== "" ? trimmedNote : null;

  if (!canChangeApplicationReviewStatus(application.status, input.status)) {
    throw new DuplicateReviewDecisionError(input.status);
  }

  const airtableSync = await syncApplicationReviewDecisionToAirtable({
    airtableRecordId: application.airtable_record_id,
    status: input.status,
    note,
  });

  return sql.begin(async (transaction) => {
    const updatedApplication = (await transaction<ReviewApplicationRow[]>`
      UPDATE applications
      SET status = ${input.status},
          rejection_reason = ${input.status === APPLICATION_STATUS_ACCEPTED ? null : note},
          decision_note = ${input.status === APPLICATION_STATUS_ACCEPTED ? null : note},
          reviewed_at = NOW(),
          reviewed_by = ${input.reviewedBy ?? null},
          airtable_last_synced_at = COALESCE(
            ${airtableSync ? airtableSync.syncedAt.toISOString() : null},
            airtable_last_synced_at
          ),
          updated_at = NOW()
      WHERE id = ${application.id}
      RETURNING id, user_id, status
    `).at(0);

    if (application.user_id !== null) {
      await syncPermanentRejectionStateForUser(application.user_id, input.status, note);
    }

    return updatedApplication;
  });
}

export async function reviewApplication(applicationId: string, input: ReviewDecisionInput) {
  const application = (await sql<ReviewApplicationRow[]>`
    SELECT id, user_id, airtable_record_id, status
    FROM applications
    WHERE id = ${applicationId}
    LIMIT 1
  `).at(0);

  if (!application) return null;

  return applyApplicationReview(application, input);
}

export async function reviewLatestApplicationForUser(
  userId: string,
  input: ReviewDecisionInput,
) {
  const latestApplication = await getLatestApplicationForUser(userId);

  if (!latestApplication) return null;

  return applyApplicationReview(latestApplication, input);
}

async function applyApplicationTshirtSent(
  application: ReviewApplicationRow,
  sent: boolean,
) {
  const ambassadorAirtableSync = await syncAmbassadorTshirtSentToAirtable({
    applicationAirtableRecordId: application.airtable_record_id,
    applicationAirtablePayload: application.airtable_payload ?? null,
    sent,
  });

  const updatedApplication = (await sql<UpdatedTshirtStatusRow[]>`
    UPDATE applications
    SET tshirt_shipped = ${sent},
        airtable_last_synced_at = COALESCE(
          ${ambassadorAirtableSync ? ambassadorAirtableSync.syncedAt.toISOString() : null},
          airtable_last_synced_at
        ),
        updated_at = NOW()
    WHERE id = ${application.id}
    RETURNING id, tshirt_shipped AS tshirt_sent
  `).at(0);

  return updatedApplication ?? null;
}

export async function setApplicationTshirtSent(
  applicationId: string,
  sent: boolean,
) {
  const application = (await sql<ReviewApplicationRow[]>`
    SELECT id, airtable_record_id, airtable_payload
    FROM applications
    WHERE id = ${applicationId}
    LIMIT 1
  `).at(0);

  if (!application) return null;

  return applyApplicationTshirtSent(application, sent);
}

export async function setLatestApplicationTshirtSentForUser(
  userId: string,
  sent: boolean,
) {
  const latestApplication = await getLatestApplicationForUser(userId);

  if (!latestApplication) return null;

  return applyApplicationTshirtSent(latestApplication, sent);
}
