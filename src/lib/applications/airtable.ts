import { AirtableClient, AirtableError } from "@/lib/airtable";
import {
  APPLICATION_STATUS_ACCEPTED,
  type ApplicationStatus,
} from "@/lib/applications/status";

export type AirtableAttachment = {
  id?: string;
  url?: string;
  filename?: string;
  type?: string;
  size?: number;
};

export type AirtableApplicationFields = Record<string, unknown>;

export type AirtableApplicationRecord = {
  id: string;
  createdTime: string;
  fields: AirtableApplicationFields;
};

type ApplicationReviewSyncInput = {
  airtableRecordId?: string | null;
  status: ApplicationStatus;
  note?: string | null;
};

type TShirtSyncInput = {
  airtableRecordId?: string | null;
  shipped: boolean;
};

const DEFAULT_AIRTABLE_BASE_ID = "appwKApaCZvoa60hI";
const DEFAULT_AIRTABLE_APPLICATIONS_TABLE_ID = "tblnA85coBmjWawcN";

const applicationFieldCandidates = {
  status: ["status", "Status"],
  rejectionReason: ["rejection_reason", "Rejection Reason", "rejection reason"],
  tshirtShipped: ["tshirt-shipped", "tshirt_shipped", "T-Shirt Shipped"],
  name: ["name", "Name"],
  email: ["email", "Email"],
  slackId: ["slack_id", "Slack ID", "slack id"],
  birthdate: ["birthdate", "Birthdate", "Date of Birth"],
  addressLine1: ["address_line_1", "Address line 1"],
  addressLine2: ["address_line_2", "Address line 2"],
  addressCity: ["address_city", "City"],
  addressState: ["address_state", "State"],
  addressZip: ["address_zip", "ZIP", "Postal Code"],
  addressCountry: ["address_country", "Country"],
  phone: ["phone", "Phone"],
  tshirtSize: ["tshirt-size", "tshirt_size", "T-Shirt Size"],
  bio: ["bio", "Bio"],
  headshot: ["headshot", "Headshot"],
  githubUrl: ["github_url", "GitHub URL", "GitHub"],
  portfolioUrl: ["portfolio_url", "Portfolio URL", "Portfolio"],
  applicationFirstThingDo: [
    "application_first_thing_do",
    "Application First Thing Do",
  ],
  applicationBestPlacePoster: [
    "application_best_place_poster",
    "Application Best Place Poster",
  ],
  idvStatus: ["idv_status", "IDV Status", "idv status"],
} as const;

function getAirtableApplicationsClient() {
  const token = process.env.AIRTABLE_PAT?.trim();

  if (!token) return null;

  return new AirtableClient({
    baseId: process.env.AIRTABLE_BASE_ID?.trim() || DEFAULT_AIRTABLE_BASE_ID,
    token,
  });
}

export function getAirtableApplicationsTableId() {
  return (
    process.env.AIRTABLE_APPLICATIONS_TABLE_ID?.trim() ||
    DEFAULT_AIRTABLE_APPLICATIONS_TABLE_ID
  );
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveApplicationFieldName(
  fields: Record<string, unknown>,
  key: keyof typeof applicationFieldCandidates,
) {
  const availableFieldNames = Object.keys(fields);
  const normalizedFieldNames = new Map(
    availableFieldNames.map((fieldName) => [normalizeFieldName(fieldName), fieldName]),
  );

  for (const candidate of applicationFieldCandidates[key]) {
    const exactMatch = availableFieldNames.find((fieldName) => fieldName === candidate);
    if (exactMatch) return exactMatch;

    const normalizedMatch = normalizedFieldNames.get(normalizeFieldName(candidate));
    if (normalizedMatch) return normalizedMatch;
  }

  return null;
}

async function getRecordById(client: AirtableClient, recordId: string) {
  try {
    return await client.getRecord<Record<string, unknown>>(
      getAirtableApplicationsTableId(),
      recordId,
    );
  } catch (error) {
    if (error instanceof AirtableError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function listAirtableApplicationRecords() {
  const client = getAirtableApplicationsClient();

  if (!client) return [];

  const records: AirtableApplicationRecord[] = [];
  let offset: string | undefined;

  do {
    const response = await client.listRecords<Record<string, unknown>>(
      getAirtableApplicationsTableId(),
      {
        offset,
        pageSize: 100,
        sort: [{ field: "id", direction: "asc" }],
      },
    );

    records.push(...response.records);
    offset = response.offset;
  } while (offset);

  return records;
}

function buildReviewFields(
  record: AirtableApplicationRecord,
  input: ApplicationReviewSyncInput,
) {
  const statusFieldName = resolveApplicationFieldName(record.fields, "status");
  const rejectionReasonFieldName = resolveApplicationFieldName(
    record.fields,
    "rejectionReason",
  );

  return {
    ...(statusFieldName ? { [statusFieldName]: input.status } : {}),
    ...(rejectionReasonFieldName
      ? {
          [rejectionReasonFieldName]:
            input.status === APPLICATION_STATUS_ACCEPTED
              ? null
              : input.note?.trim() || null,
        }
      : {}),
  };
}

export async function syncApplicationReviewDecisionToAirtable(
  input: ApplicationReviewSyncInput,
) {
  const client = getAirtableApplicationsClient();
  const recordId = input.airtableRecordId?.trim();

  if (!client || !recordId) return null;

  const record = await getRecordById(client, recordId);

  if (!record) {
    throw new Error(`Unable to find Airtable application record ${recordId}`);
  }

  const reviewFields = buildReviewFields(record, input);

  if (Object.keys(reviewFields).length > 0) {
    await client.updateRecord(getAirtableApplicationsTableId(), record.id, reviewFields);
  }

  return {
    recordId: record.id,
    syncedAt: new Date(),
  };
}

export async function syncApplicationTshirtShippedToAirtable(input: TShirtSyncInput) {
  const client = getAirtableApplicationsClient();
  const recordId = input.airtableRecordId?.trim();

  if (!client || !recordId) return null;

  const record = await getRecordById(client, recordId);

  if (!record) {
    throw new Error(`Unable to find Airtable application record ${recordId}`);
  }

  const tshirtShippedFieldName = resolveApplicationFieldName(
    record.fields,
    "tshirtShipped",
  );

  if (!tshirtShippedFieldName) {
    return {
      recordId: record.id,
      syncedAt: new Date(),
    };
  }

  await client.updateRecord(getAirtableApplicationsTableId(), record.id, {
    [tshirtShippedFieldName]: input.shipped,
  });

  return {
    recordId: record.id,
    syncedAt: new Date(),
  };
}
