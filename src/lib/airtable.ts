export type AirtableRecord<TFields extends Record<string, unknown> = Record<string, unknown>> = {
  id: string
  createdTime: string
  fields: TFields
}

type AirtableListResponse<TFields extends Record<string, unknown>> = {
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

type AirtableCallOptions = Pick<RequestInit, "signal">
type AirtableReadOptions = AirtableCallOptions & {
  returnFieldsByFieldId?: boolean
}

function requireAirtablePat() {
  const token = process.env.AIRTABLE_PAT?.trim()

  if (token === undefined || token === "") {
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

function sanitizeAirtableFields<TFields extends Record<string, unknown>>(fields: TFields) {
  const sanitized = sanitizeAirtableValue(fields)
  return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized)
    ? Object.fromEntries(Object.entries(sanitized))
    : {}
}

export function createAirtableClient(baseId: string) {
  const token = process.env.AIRTABLE_PAT?.trim()

  if (token === undefined || token === "") return null

  return new AirtableClient({
    baseId,
    token,
  })
}

export class AirtableClient {
  private readonly baseId: string
  private readonly token: string
  private readonly baseUrl: string

  constructor(options: AirtableClientOptions) {
    this.baseId = options.baseId
    const token = options.token?.trim()
    this.token = token !== undefined && token !== "" ? token : requireAirtablePat()
    const baseUrl = options.baseUrl?.replace(/\/$/, "")
    this.baseUrl = baseUrl !== undefined && baseUrl !== "" ? baseUrl : "https://api.airtable.com/v0"
  }

  async listRecords<TFields extends Record<string, unknown>>(
    table: string,
    options: AirtableListOptions = {},
    requestOptions: AirtableReadOptions = {},
  ) {
    const { returnFieldsByFieldId, ...callOptions } = requestOptions
    const query = new URLSearchParams()

    if (options.view !== undefined && options.view !== "") query.set("view", options.view)
    if (options.maxRecords !== undefined) query.set("maxRecords", String(options.maxRecords))
    if (options.pageSize !== undefined) query.set("pageSize", String(options.pageSize))
    if (options.filterByFormula !== undefined && options.filterByFormula !== "") {
      query.set("filterByFormula", options.filterByFormula)
    }
    if (options.offset !== undefined && options.offset !== "") query.set("offset", options.offset)
    if (returnFieldsByFieldId === true) query.set("returnFieldsByFieldId", "true")

    options.fields?.forEach((field) => query.append("fields[]", field))
    options.sort?.forEach((sort, index) => {
      query.set(`sort[${index}][field]`, sort.field)
      query.set(`sort[${index}][direction]`, sort.direction || "asc")
    })

    return this.request<AirtableListResponse<TFields>>(table, {
      method: "GET",
      query,
      cache: "no-store",
      ...callOptions,
    })
  }

  async getRecord<TFields extends Record<string, unknown>>(
    table: string,
    recordId: string,
    requestOptions: AirtableReadOptions = {},
  ) {
    const { returnFieldsByFieldId, ...callOptions } = requestOptions

    return this.request<AirtableRecord<TFields>>(`${table}/${recordId}`, {
      method: "GET",
      query: returnFieldsByFieldId === true
        ? new URLSearchParams({ returnFieldsByFieldId: "true" })
        : undefined,
      cache: "no-store",
      ...callOptions,
    })
  }

  async createRecord<TFields extends Record<string, unknown>>(
    table: string,
    fields: TFields,
    requestOptions: AirtableCallOptions = {},
  ) {
    return this.request<AirtableRecord<TFields>>(table, {
      method: "POST",
      body: {
        fields: sanitizeAirtableFields(fields),
      },
      ...requestOptions,
    })
  }

  async updateRecord<TFields extends Record<string, unknown>>(
    table: string,
    recordId: string,
    fields: Partial<TFields>,
    requestOptions: AirtableCallOptions = {},
  ) {
    return this.request<AirtableRecord<TFields>>(`${table}/${recordId}`, {
      method: "PATCH",
      body: {
        fields: sanitizeAirtableFields(fields),
      },
      ...requestOptions,
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
    let body = null

    if (text !== "") {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    if (response.ok !== true) {
      throw new AirtableError(`Airtable request failed with status ${response.status}`, {
        status: response.status,
        body,
      })
    }

    return body
  }
}
