import "server-only";

import { type AirtableRecord, createAirtableClient } from "@/lib/airtable";
import {
  type MeetupFieldKey,
  getAirtableBaseId,
  getAirtableFieldId,
  getAirtableFieldValue,
  getAirtableTableId,
  getAirtableViewId,
} from "@/lib/airtable-schema";

export type Expedition = {
  id: string;
  name: string | null;
  prettyName: string | null;
  slug: string | null;
  season: string | null;
  date: string | null;
  concluded: boolean;
  venue: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  };
  latitude: number | null;
  longitude: number | null;
  channelId: string | null;
  ambassadorSlackId: string | null;
};

/** Lookup and lookup-backed formula fields come back as arrays; flatten to one string. */
function toText(value: unknown): string | null {
  const text = Array.isArray(value) ? value.find((item) => typeof item === "string") : value;

  if (typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

function toCoordinate(value: unknown): number | null {
  const parsed = Number.parseFloat(toText(value) ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function getExpeditionsClient() {
  const client = createAirtableClient(getAirtableBaseId());

  if (!client) {
    throw new Error("AIRTABLE_PAT is not set");
  }

  return client;
}

async function listAllRecords(
  table: string,
  options: { view?: string; fields: string[] },
) {
  const client = getExpeditionsClient();
  const records: AirtableRecord<Record<string, unknown>>[] = [];
  let offset: string | undefined;

  do {
    const response = await client.listRecords<Record<string, unknown>>(
      table,
      {
        view: options.view,
        fields: options.fields,
        pageSize: 100,
        offset,
      },
      {
        returnFieldsByFieldId: true,
      },
    );

    records.push(...response.records);
    offset = response.offset;
  } while (offset !== undefined && offset !== "");

  return records;
}

/**
 * Stardance polls these endpoints per visitor, so every read is served from a
 * short-lived in-process cache and concurrent misses share one Airtable fetch.
 */
const CACHE_TTL_MS = 60_000;

function cached<T>(load: () => Promise<T>) {
  let entry: { promise: Promise<T>; expiresAt: number } | null = null;

  return () => {
    if (entry === null || Date.now() > entry.expiresAt) {
      const next = {
        promise: load(),
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      next.promise.catch(() => {
        if (entry === next) {
          entry = null;
        }
      });
      entry = next;
    }

    return entry.promise;
  };
}

const MEETUP_FIELD_KEYS: MeetupFieldKey[] = [
  "name",
  "prettyName",
  "slug",
  "season",
  "date",
  "concluded",
  "channelId",
  "ambassadorSlackId",
  "venueName",
  "venueAddress",
  "venueCity",
  "venueState",
  "venueZip",
  "venueCountry",
  "latitude",
  "longitude",
];

async function fetchPublicExpeditions(): Promise<Expedition[]> {
  const records = await listAllRecords(getAirtableTableId("meetups"), {
    view: getAirtableViewId("meetups", "publicStardance"),
    fields: MEETUP_FIELD_KEYS.map((key) => getAirtableFieldId("meetups", key)),
  });

  return records.map((record) => {
    const field = (key: MeetupFieldKey) => getAirtableFieldValue(record.fields, "meetups", key);

    return {
      id: record.id,
      name: toText(field("name")),
      prettyName: toText(field("prettyName")),
      slug: toText(field("slug")),
      season: toText(field("season")),
      date: toText(field("date")),
      concluded: field("concluded") === true,
      venue: {
        name: toText(field("venueName")),
        address: toText(field("venueAddress")),
        city: toText(field("venueCity")),
        state: toText(field("venueState")),
        zip: toText(field("venueZip")),
        country: toText(field("venueCountry")),
      },
      latitude: toCoordinate(field("latitude")),
      longitude: toCoordinate(field("longitude")),
      channelId: toText(field("channelId")),
      ambassadorSlackId: toText(field("ambassadorSlackId")),
    };
  });
}

type AttendanceIndex = {
  byEmail: Map<string, Set<string>>;
  bySlackId: Map<string, Set<string>>;
};

async function fetchAttendanceIndex(): Promise<AttendanceIndex> {
  const records = await listAllRecords(getAirtableTableId("meetupParticipants"), {
    fields: (["meetup", "email", "slackId"] as const).map((key) =>
      getAirtableFieldId("meetupParticipants", key),
    ),
  });

  const byEmail = new Map<string, Set<string>>();
  const bySlackId = new Map<string, Set<string>>();

  for (const record of records) {
    const meetupIds = getAirtableFieldValue(record.fields, "meetupParticipants", "meetup");

    if (!Array.isArray(meetupIds) || meetupIds.length === 0) {
      continue;
    }

    const add = (index: Map<string, Set<string>>, key: string | null) => {
      if (key === null) return;
      const ids = index.get(key) ?? new Set<string>();
      meetupIds.forEach((id) => {
        if (typeof id === "string") ids.add(id);
      });
      index.set(key, ids);
    };

    add(
      byEmail,
      toText(getAirtableFieldValue(record.fields, "meetupParticipants", "email"))?.toLowerCase() ?? null,
    );
    add(bySlackId, toText(getAirtableFieldValue(record.fields, "meetupParticipants", "slackId")));
  }

  return { byEmail, bySlackId };
}

export const listPublicExpeditions = cached(fetchPublicExpeditions);
const getAttendanceIndex = cached(fetchAttendanceIndex);

/**
 * Public expeditions the person signed up for, matched by email (case
 * insensitive) or Slack id. A meetup the team pulled out of the public view
 * is never returned, even if the person is a participant.
 */
export async function findExpeditionsForPerson(input: {
  email?: string | null;
  slackId?: string | null;
}): Promise<Expedition[]> {
  const email = input.email?.trim().toLowerCase() ?? "";
  const slackId = input.slackId?.trim() ?? "";

  if (email === "" && slackId === "") {
    return [];
  }

  const [expeditions, attendance] = await Promise.all([
    listPublicExpeditions(),
    getAttendanceIndex(),
  ]);

  const meetupIds = new Set([
    ...(email === "" ? [] : attendance.byEmail.get(email) ?? []),
    ...(slackId === "" ? [] : attendance.bySlackId.get(slackId) ?? []),
  ]);

  return expeditions.filter((expedition) => meetupIds.has(expedition.id));
}
