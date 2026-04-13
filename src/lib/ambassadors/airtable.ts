import { AirtableClient, AirtableError } from "@/lib/airtable";
import {
  getAirtableApplicationsTableId,
  getAirtableBaseId,
} from "@/lib/applications/airtable";

const DEFAULT_AIRTABLE_AMBASSADORS_TABLE_ID = "tblo8106uaVFMWyXk";

const ambassadorFieldCandidates = ["ambassadors", "ambassador"];
const onboardingCompleteFieldCandidates = [
  "onboarding_complete",
  "onboarding complete",
  "onboardingComplete",
];
const tshirtSentFieldCandidates = ["tshirt-sent", "tshirt_sent", "T-Shirt Sent"];

function getAirtableAmbassadorsClient() {
  const token = process.env.AIRTABLE_PAT?.trim();

  if (!token) return null;

  return new AirtableClient({
    baseId: getAirtableBaseId(),
    token,
  });
}

export function getAirtableAmbassadorsTableId() {
  return (
    process.env.AIRTABLE_AMBASSADORS_TABLE_ID?.trim() ||
    DEFAULT_AIRTABLE_AMBASSADORS_TABLE_ID
  );
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveFieldName(
  fields: Record<string, unknown>,
  candidates: readonly string[],
) {
  const availableFieldNames = Object.keys(fields);
  const normalizedFieldNames = new Map(
    availableFieldNames.map((fieldName) => [normalizeFieldName(fieldName), fieldName]),
  );

  for (const candidate of candidates) {
    const exactMatch = availableFieldNames.find((fieldName) => fieldName === candidate);
    if (exactMatch) return exactMatch;

    const normalizedMatch = normalizedFieldNames.get(normalizeFieldName(candidate));
    if (normalizedMatch) return normalizedMatch;
  }

  return null;
}

function getLinkedRecordIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function getRecordById(
  client: AirtableClient,
  tableId: string,
  recordId: string,
) {
  try {
    return await client.getRecord<Record<string, unknown>>(tableId, recordId);
  } catch (error) {
    if (error instanceof AirtableError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export type AmbassadorOnboardingStatus = {
  hasAmbassadorRecord: boolean;
  onboardingComplete: boolean;
};

function getAmbassadorRecordIdsFromApplicationPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const ambassadorFieldName = resolveFieldName(
    payload as Record<string, unknown>,
    ambassadorFieldCandidates,
  );

  return ambassadorFieldName
    ? getLinkedRecordIds((payload as Record<string, unknown>)[ambassadorFieldName])
    : [];
}

async function getAmbassadorRecordIds(input: {
  client: AirtableClient;
  applicationAirtableRecordId?: string | null;
  applicationAirtablePayload?: unknown;
}) {
  const applicationAirtableRecordId = input.applicationAirtableRecordId?.trim();
  let ambassadorRecordIds = getAmbassadorRecordIdsFromApplicationPayload(
    input.applicationAirtablePayload,
  );

  if (ambassadorRecordIds.length === 0 && applicationAirtableRecordId) {
    try {
      const applicationRecord = await getRecordById(
        input.client,
        getAirtableApplicationsTableId(),
        applicationAirtableRecordId,
      );

      ambassadorRecordIds = applicationRecord
        ? getAmbassadorRecordIdsFromApplicationPayload(applicationRecord.fields)
        : [];
    } catch (error) {
      if (error instanceof AirtableError) {
        console.warn(
          `[airtable] unable to load application record ${applicationAirtableRecordId}: ${error.message}`,
        );
      } else {
        console.warn("[airtable] unable to load application record for ambassador sync", error);
      }
    }
  }

  return ambassadorRecordIds;
}

export async function getAmbassadorOnboardingStatus(input: {
  applicationAirtableRecordId?: string | null;
  applicationAirtablePayload?: unknown;
}): Promise<AmbassadorOnboardingStatus> {
  const applicationAirtableRecordId = input.applicationAirtableRecordId?.trim();
  const client = getAirtableAmbassadorsClient();
  const cachedAmbassadorRecordIds = getAmbassadorRecordIdsFromApplicationPayload(
    input.applicationAirtablePayload,
  );

  if (!client) {
    return {
      hasAmbassadorRecord: cachedAmbassadorRecordIds.length > 0,
      onboardingComplete: false,
    };
  }

  const ambassadorRecordIds = await getAmbassadorRecordIds({
    client,
    applicationAirtableRecordId,
    applicationAirtablePayload: input.applicationAirtablePayload,
  });

  if (ambassadorRecordIds.length === 0) {
    return {
      hasAmbassadorRecord: false,
      onboardingComplete: false,
    };
  }

  const ambassadorRecords = (
    await Promise.all(
      ambassadorRecordIds.map(async (recordId) => {
        try {
          return await getRecordById(client, getAirtableAmbassadorsTableId(), recordId);
        } catch (error) {
          if (error instanceof AirtableError) {
            console.warn(
              `[airtable] unable to load ambassador record ${recordId}: ${error.message}`,
            );
            return null;
          }

          throw error;
        }
      }),
    )
  ).filter((record): record is NonNullable<typeof record> => Boolean(record));

  if (ambassadorRecords.length === 0) {
    return {
      hasAmbassadorRecord: true,
      onboardingComplete: false,
    };
  }

  const onboardingComplete = ambassadorRecords.some((record) => {
    const onboardingCompleteFieldName = resolveFieldName(
      record.fields,
      onboardingCompleteFieldCandidates,
    );

    return onboardingCompleteFieldName
      ? Boolean(record.fields[onboardingCompleteFieldName])
      : false;
  });

  return {
    hasAmbassadorRecord: true,
    onboardingComplete,
  };
}

export async function syncAmbassadorTshirtSentToAirtable(input: {
  applicationAirtableRecordId?: string | null;
  applicationAirtablePayload?: unknown;
  sent: boolean;
}) {
  const client = getAirtableAmbassadorsClient();

  if (!client) return null;

  const ambassadorRecordIds = await getAmbassadorRecordIds({
    client,
    applicationAirtableRecordId: input.applicationAirtableRecordId,
    applicationAirtablePayload: input.applicationAirtablePayload,
  });

  if (ambassadorRecordIds.length === 0) return null;

  let updatedCount = 0;

  await Promise.all(
    ambassadorRecordIds.map(async (recordId) => {
      try {
        const record = await getRecordById(client, getAirtableAmbassadorsTableId(), recordId);

        if (!record) return;

        const tshirtSentFieldName = resolveFieldName(record.fields, tshirtSentFieldCandidates)
          ?? tshirtSentFieldCandidates[0];

        await client.updateRecord(getAirtableAmbassadorsTableId(), record.id, {
          [tshirtSentFieldName]: input.sent,
        });
        updatedCount += 1;
      } catch (error) {
        if (error instanceof AirtableError) {
          console.warn(
            `[airtable] unable to sync ambassador tshirt-sent for ${recordId}: ${error.message}`,
          );
          return;
        }

        throw error;
      }
    }),
  );

  return {
    recordIds: ambassadorRecordIds,
    updatedCount,
    syncedAt: new Date(),
  };
}
