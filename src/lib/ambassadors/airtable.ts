import {
  AirtableClient,
  AirtableError,
  type AirtableRecord,
  createAirtableClient,
} from "@/lib/airtable";
import {
  getAirtableApplicationFieldValue,
  getAirtableApplicationsTableId,
} from "@/lib/applications/airtable";
import {
  type AmbassadorFieldKey,
  type OnboardingFieldKey,
  getAirtableBaseId,
  getAirtableFieldChoiceNames,
  getAirtableFieldId,
  getAirtableFieldValue,
  getAirtableTableId,
} from "@/lib/airtable-schema";

function getAirtableAmbassadorsClient() {
  return createAirtableClient(getAirtableBaseId());
}

function getAirtableAmbassadorsTableId() {
  return getAirtableTableId("ambassadors");
}

function getAirtableOnboardingTableId() {
  return getAirtableTableId("onboarding");
}

function getAirtableAmbassadorFieldId(
  fieldKey: AmbassadorFieldKey,
) {
  return getAirtableFieldId("ambassadors", fieldKey);
}

function getAirtableAmbassadorFieldValue(
  fields: Record<string, unknown>,
  fieldKey: AmbassadorFieldKey,
) {
  return getAirtableFieldValue(fields, "ambassadors", fieldKey);
}

function getAirtableOnboardingFieldId(
  fieldKey: OnboardingFieldKey,
) {
  return getAirtableFieldId("onboarding", fieldKey);
}

function getAirtableOnboardingFieldValue(
  fields: Record<string, unknown>,
  fieldKey: OnboardingFieldKey,
) {
  return getAirtableFieldValue(fields, "onboarding", fieldKey);
}

async function getRecordById(
  client: AirtableClient,
  tableId: string,
  recordId: string,
) {
  try {
    return await client.getRecord<Record<string, unknown>>(tableId, recordId, {
      returnFieldsByFieldId: true,
    });
  } catch (error) {
    if (error instanceof AirtableError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export type AmbassadorOnboardingStatus = {
  hasAmbassadorRecord: boolean;
  status: string;
  isOnboardingComplete: boolean;
};

function getRequiredChoiceName(choices: Record<string, string>, key: string) {
  const value = choices[key];

  if (value === undefined || value === "") {
    throw new Error(`Airtable onboarding_status choice ${key} is not defined`);
  }

  return value;
}

const onboardingStatusChoices = getAirtableFieldChoiceNames("ambassadors", "onboardingStatus");
const onboardingRecordStatusChoices = getAirtableFieldChoiceNames("onboarding", "status");

export const AMBASSADOR_ONBOARDING_STATUS = {
  unsubmitted: "Unsubmitted",
  submitted: getRequiredChoiceName(onboardingStatusChoices, "submitted"),
  pendingSignature: getRequiredChoiceName(onboardingStatusChoices, "pendingSignature"),
  completed: getRequiredChoiceName(onboardingStatusChoices, "completed"),
} as const;

const airtableOnboardingStatuses = new Set(Object.values(onboardingStatusChoices));
const completedOnboardingRecordStatus = getRequiredChoiceName(
  onboardingRecordStatusChoices,
  "completed",
);

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item !== "")
    : typeof value === "string" && value !== ""
      ? [value]
      : [];
}

function getAmbassadorRecordIdsFromApplicationPayload(payload: unknown) {
  if (payload === null || payload === undefined || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const fields = Object.fromEntries(Object.entries(payload));
  const linkedRecordIds = getAirtableApplicationFieldValue(fields, "ambassadors");

  return Array.isArray(linkedRecordIds)
    ? linkedRecordIds.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

async function getAmbassadorRecordIds(input: {
  client: AirtableClient;
  applicationAirtableRecordId?: string | null;
  cachedAmbassadorRecordIds: string[];
}) {
  const applicationAirtableRecordId = input.applicationAirtableRecordId?.trim();
  let ambassadorRecordIds = input.cachedAmbassadorRecordIds;

  if (
    ambassadorRecordIds.length === 0 &&
    applicationAirtableRecordId !== undefined &&
    applicationAirtableRecordId !== ""
  ) {
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
      status: AMBASSADOR_ONBOARDING_STATUS.unsubmitted,
      isOnboardingComplete: false,
    };
  }

  const ambassadorRecordIds = await getAmbassadorRecordIds({
    client,
    applicationAirtableRecordId,
    cachedAmbassadorRecordIds,
  });

  if (ambassadorRecordIds.length === 0) {
    return {
      hasAmbassadorRecord: false,
      status: AMBASSADOR_ONBOARDING_STATUS.unsubmitted,
      isOnboardingComplete: false,
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
      status: AMBASSADOR_ONBOARDING_STATUS.unsubmitted,
      isOnboardingComplete: false,
    };
  }

  let status: string = AMBASSADOR_ONBOARDING_STATUS.unsubmitted;

  for (const record of ambassadorRecords) {
    const value = getAirtableAmbassadorFieldValue(record.fields, "onboardingStatus");
    const statuses =
      typeof value === "string"
        ? [value]
        : Array.isArray(value)
          ? value.filter((item): item is string => typeof item === "string")
          : [];
    const unknownStatus = statuses.find((item) => !airtableOnboardingStatuses.has(item));

    if (unknownStatus !== undefined) {
      throw new Error(`Airtable onboarding_status value is not defined in src/lib/airtable.yaml: ${unknownStatus}`);
    }

    if (statuses.includes(AMBASSADOR_ONBOARDING_STATUS.completed)) {
      status = AMBASSADOR_ONBOARDING_STATUS.completed;
      break;
    }

    if (statuses.includes(AMBASSADOR_ONBOARDING_STATUS.pendingSignature)) {
      status = AMBASSADOR_ONBOARDING_STATUS.pendingSignature;
    } else if (
      status === AMBASSADOR_ONBOARDING_STATUS.unsubmitted &&
      statuses.includes(AMBASSADOR_ONBOARDING_STATUS.submitted)
    ) {
      status = AMBASSADOR_ONBOARDING_STATUS.submitted;
    }
  }

  return {
    hasAmbassadorRecord: true,
    status,
    isOnboardingComplete: status === AMBASSADOR_ONBOARDING_STATUS.completed,
  };
}

export type AmbassadorOnboardingGrantContact = {
  hasAmbassadorRecord: boolean;
  hasCompletedOnboarding: boolean;
  hcbEmail: string | null;
};

export async function getAmbassadorOnboardingGrantContact(input: {
  applicationAirtableRecordId?: string | null;
  applicationAirtablePayload?: unknown;
}): Promise<AmbassadorOnboardingGrantContact> {
  const applicationAirtableRecordId = input.applicationAirtableRecordId?.trim();
  const client = getAirtableAmbassadorsClient();
  const cachedAmbassadorRecordIds = getAmbassadorRecordIdsFromApplicationPayload(
    input.applicationAirtablePayload,
  );

  if (!client) {
    return {
      hasAmbassadorRecord: cachedAmbassadorRecordIds.length > 0,
      hasCompletedOnboarding: false,
      hcbEmail: null,
    };
  }

  const ambassadorRecordIds = await getAmbassadorRecordIds({
    client,
    applicationAirtableRecordId,
    cachedAmbassadorRecordIds,
  });

  if (ambassadorRecordIds.length === 0) {
    return {
      hasAmbassadorRecord: false,
      hasCompletedOnboarding: false,
      hcbEmail: null,
    };
  }

  const ambassadorRecordIdSet = new Set(ambassadorRecordIds);
  const onboardingFields = [
    getAirtableOnboardingFieldId("id"),
    getAirtableOnboardingFieldId("ambassador"),
    getAirtableOnboardingFieldId("status"),
    getAirtableOnboardingFieldId("hcbEmail"),
  ];
  const onboardingRecords: AirtableRecord<Record<string, unknown>>[] = [];
  let offset: string | undefined;

  do {
    const response = await client.listRecords<Record<string, unknown>>(
      getAirtableOnboardingTableId(),
      {
        fields: onboardingFields,
        offset,
        pageSize: 100,
      },
      {
        returnFieldsByFieldId: true,
      },
    );

    onboardingRecords.push(
      ...response.records.filter((record) =>
        toStringArray(getAirtableOnboardingFieldValue(record.fields, "ambassador"))
          .some((recordId) => ambassadorRecordIdSet.has(recordId)),
      ),
    );
    offset = response.offset;
  } while (offset !== undefined && offset !== "");

  const completedOnboardingRecords = onboardingRecords
    .filter((record) =>
      toStringArray(getAirtableOnboardingFieldValue(record.fields, "status"))
        .includes(completedOnboardingRecordStatus),
    )
    .sort((left, right) => {
      const leftId = getAirtableOnboardingFieldValue(left.fields, "id");
      const rightId = getAirtableOnboardingFieldValue(right.fields, "id");
      const leftAutoNumber = typeof leftId === "number" ? leftId : Number.NEGATIVE_INFINITY;
      const rightAutoNumber = typeof rightId === "number" ? rightId : Number.NEGATIVE_INFINITY;

      return rightAutoNumber - leftAutoNumber;
    });

  const latestCompletedOnboardingRecord = completedOnboardingRecords[0];

  return {
    hasAmbassadorRecord: true,
    hasCompletedOnboarding: latestCompletedOnboardingRecord !== undefined,
    hcbEmail: latestCompletedOnboardingRecord === undefined
      ? null
      : (() => {
          const email = toTrimmedString(
            getAirtableOnboardingFieldValue(latestCompletedOnboardingRecord.fields, "hcbEmail"),
          );
          return email === "" ? null : email;
        })(),
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
    cachedAmbassadorRecordIds: getAmbassadorRecordIdsFromApplicationPayload(
      input.applicationAirtablePayload,
    ),
  });

  if (ambassadorRecordIds.length === 0) return null;

  let updatedCount = 0;

  await Promise.all(
    ambassadorRecordIds.map(async (recordId) => {
      try {
        await client.updateRecord(getAirtableAmbassadorsTableId(), recordId, {
          [getAirtableAmbassadorFieldId("tshirtSent")]: input.sent,
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
