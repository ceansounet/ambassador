const AIRTABLE_API_BASE_URL = "https://api.airtable.com/v0"

export type AirtableRecord<TFields extends Record<string, unknown> = Record<string, unknown>> = {
  id: string
  createdTime: string
  fields: TFields
}

export type AirtableListResponse<TFields extends Record<string, unknown>> = {
  records: AirtableRecord<TFields>[]
  offset?: string
}

export class AirtableError extends Error {
  status: number
  body: unknown

  constructor(message: string, options: { status: number; body: unknown }) {
    super(message)
    this.name = "AirtableError"
    this.status = options.status
    this.body = options.body
  }
}

type AirtableClientOptions = {
  baseId: string
  token?: string
  baseUrl?: string
}

type AirtableListOptions = {
  view?: string
  maxRecords?: number
  pageSize?: number
  fields?: string[]
  sort?: Array<{
    field: string
    direction?: "asc" | "desc"
  }>
  filterByFormula?: string
  offset?: string
}

type AirtableRequestInit = Omit<RequestInit, "body"> & {
  query?: URLSearchParams
  body?: unknown
}

function requireAirtablePat() {
  const token = process.env.AIRTABLE_PAT?.trim()

  if (!token) {
    throw new Error("AIRTABLE_PAT is not set")
  }

  return token
}

function sanitizeAirtableString(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .trim()
}

function sanitizeAirtableValue(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null

  if (typeof value === "string") {
    return sanitizeAirtableString(value)
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeAirtableValue(item))
      .filter((item) => item !== undefined)
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const sanitized = sanitizeAirtableValue(entry)
        return sanitized === undefined ? [] : [[key, sanitized]]
      }),
    )
  }

  return String(value)
}

export function sanitizeAirtableFields<TFields extends Record<string, unknown>>(fields: TFields) {
  return sanitizeAirtableValue(fields) as Partial<TFields>
}

export function escapeAirtableFormulaValue(value: string | number | boolean) {
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "TRUE()" : "FALSE()"

  const sanitized = sanitizeAirtableString(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")

  return `'${sanitized}'`
}

export function buildAirtableEqualsFormula(fieldName: string, value: string | number | boolean) {
  return `{${fieldName}}=${escapeAirtableFormulaValue(value)}`
}

export class AirtableClient {
  private readonly baseId: string
  private readonly token: string
  private readonly baseUrl: string

  constructor(options: AirtableClientOptions) {
    this.baseId = options.baseId
    this.token = options.token?.trim() || requireAirtablePat()
    this.baseUrl = options.baseUrl?.replace(/\/$/, "") || AIRTABLE_API_BASE_URL
  }

  async listRecords<TFields extends Record<string, unknown>>(
    table: string,
    options: AirtableListOptions = {},
  ) {
    const query = new URLSearchParams()

    if (options.view) query.set("view", options.view)
    if (options.maxRecords) query.set("maxRecords", String(options.maxRecords))
    if (options.pageSize) query.set("pageSize", String(options.pageSize))
    if (options.filterByFormula) query.set("filterByFormula", options.filterByFormula)
    if (options.offset) query.set("offset", options.offset)

    options.fields?.forEach((field) => query.append("fields[]", field))
    options.sort?.forEach((sort, index) => {
      query.set(`sort[${index}][field]`, sort.field)
      query.set(`sort[${index}][direction]`, sort.direction || "asc")
    })

    return this.request<AirtableListResponse<TFields>>(table, {
      method: "GET",
      query,
      cache: "no-store",
    })
  }

  async getRecord<TFields extends Record<string, unknown>>(table: string, recordId: string) {
    return this.request<AirtableRecord<TFields>>(`${table}/${recordId}`, {
      method: "GET",
      cache: "no-store",
    })
  }

  async createRecord<TFields extends Record<string, unknown>>(table: string, fields: TFields) {
    return this.request<AirtableRecord<TFields>>(table, {
      method: "POST",
      body: {
        fields: sanitizeAirtableFields(fields),
      },
    })
  }

  async updateRecord<TFields extends Record<string, unknown>>(
    table: string,
    recordId: string,
    fields: Partial<TFields>,
  ) {
    return this.request<AirtableRecord<TFields>>(`${table}/${recordId}`, {
      method: "PATCH",
      body: {
        fields: sanitizeAirtableFields(fields),
      },
    })
  }

  private async request<TResult>(path: string, init: AirtableRequestInit): Promise<TResult> {
    const url = new URL(`${this.baseUrl}/${this.baseId}/${path}`)
    init.query?.forEach((value, key) => url.searchParams.append(key, value))

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })

    const text = await response.text()
    let body: unknown = null

    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    if (!response.ok) {
      throw new AirtableError(`Airtable request failed with status ${response.status}`, {
        status: response.status,
        body,
      })
    }

    return body as TResult
  }
}
