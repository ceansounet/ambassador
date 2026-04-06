const DEFAULT_WAREHOUSE_BASE_URL = "https://mail.hackclub.com"
const DEFAULT_AMBASSADOR_TAGS = ["Ambassadors"] as const

export type HackClubAuthAddress = {
  first_name?: string
  last_name?: string
  line_1?: string
  line_2?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  phone_number?: string
  primary?: boolean
}

export type WarehouseAddressInput = {
  name: string
  address: HackClubAuthAddress
}

export type WarehouseOrderAddress = {
  first_name: string
  last_name?: string
  line_1: string
  line_2?: string
  city: string
  state: string
  postal_code: string
  country: string
}

export type SendWarehouseSkuInput = {
  sku: string
  quantity?: number
  name: string
  email: string
  orderNumber: string
  address?: HackClubAuthAddress | null
  addresses?: HackClubAuthAddress[]
  userFacingTitle?: string
  idempotencyKey?: string
  metadata?: Record<string, unknown>
  tags?: string[]
}

export type WarehouseOrderResponse = {
  id: string
  status: string
  tags: string[]
  address: WarehouseOrderAddress
  metadata: Record<string, unknown>
  recipient_email: string
  dispatched_at?: string
  mailed_at?: string
  tracking_number?: string
  carrier?: string
  service?: string
  weight?: string | number
  contents_cost?: string | number
  labor_cost?: string | number
  postage_cost?: string | number
  idempotency_key?: string
}

type WarehouseCreatePayload = {
  warehouse_order: {
    recipient_email: string
    user_facing_title?: string
    idempotency_key?: string
    metadata?: Record<string, unknown>
    tags: string[]
  }
  address: WarehouseOrderAddress
  contents: Array<{
    sku: string
    quantity: number
  }>
}

type WarehouseApiClientOptions = {
  baseUrl?: string
  token?: string
}

type WarehouseRequestInit = Omit<RequestInit, "body"> & {
  body?: unknown
}

export class WarehouseApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, options: { status: number; body: unknown }) {
    super(message)
    this.name = "WarehouseApiError"
    this.status = options.status
    this.body = options.body
  }
}

function requireWarehouseApiToken() {
  const token = process.env.WAREHOUSE_API?.trim()

  if (!token) {
    throw new Error("WAREHOUSE_API is not set")
  }

  return token
}

function cleanInput(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function slugify(value: string) {
  const ascii = value
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")

  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "recipient"
}

function splitName(name: string) {
  const normalized = cleanInput(name)
  const [firstName, ...rest] = normalized.split(" ").filter(Boolean)

  if (!firstName) {
    throw new Error("Recipient name is required")
  }

  return {
    firstName,
    lastName: rest.join(" ") || undefined,
  }
}

function requireField(fieldName: string, value?: string) {
  const normalized = value ? cleanInput(value) : ""

  if (!normalized) {
    throw new Error(`Warehouse address is missing ${fieldName}`)
  }

  return normalized
}

export function pickPrimaryHackClubAddress(addresses: HackClubAuthAddress[]) {
  return addresses.find((address) => address.primary) ?? addresses[0] ?? null
}

export function normalizeHackClubAddress(input: WarehouseAddressInput): WarehouseOrderAddress {
  const splitRecipientName = splitName(input.name)

  const firstName = cleanInput(input.address.first_name || splitRecipientName.firstName)
  const lastName = cleanInput(input.address.last_name || splitRecipientName.lastName || "")

  return {
    first_name: requireField("first_name", firstName),
    last_name: lastName || undefined,
    line_1: requireField("line_1", input.address.line_1),
    line_2: cleanInput(input.address.line_2 || "") || undefined,
    city: requireField("city", input.address.city),
    state: requireField("state", input.address.state),
    postal_code: requireField("postal_code", input.address.postal_code),
    country: requireField("country", input.address.country),
  }
}

export function buildAmbassadorIdempotencyKey(orderNumber: string, name: string) {
  return `${cleanInput(orderNumber)}-ambassadors-${slugify(name)}`
}

export function buildWarehouseOrderPayload(input: SendWarehouseSkuInput): WarehouseCreatePayload {
  const selectedAddress = input.address ?? pickPrimaryHackClubAddress(input.addresses || [])

  if (!selectedAddress) {
    throw new Error("A Hack Club Auth address is required to create a warehouse order")
  }

  const quantity = input.quantity ?? 1

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Warehouse quantity must be a positive integer")
  }

  return {
    warehouse_order: {
      recipient_email: cleanInput(input.email),
      user_facing_title: input.userFacingTitle ? cleanInput(input.userFacingTitle) : undefined,
      idempotency_key: input.idempotencyKey
        ? cleanInput(input.idempotencyKey)
        : buildAmbassadorIdempotencyKey(input.orderNumber, input.name),
      metadata: input.metadata,
      tags: input.tags?.length ? input.tags.map((tag) => cleanInput(tag)) : [...DEFAULT_AMBASSADOR_TAGS],
    },
    address: normalizeHackClubAddress({
      name: input.name,
      address: selectedAddress,
    }),
    contents: [
      {
        sku: cleanInput(input.sku),
        quantity,
      },
    ],
  }
}

export class WarehouseApiClient {
  private readonly baseUrl: string
  private readonly token: string

  constructor(options: WarehouseApiClientOptions = {}) {
    this.baseUrl = options.baseUrl?.replace(/\/$/, "") || DEFAULT_WAREHOUSE_BASE_URL
    this.token = options.token?.trim() || requireWarehouseApiToken()
  }

  async createOrder(input: SendWarehouseSkuInput) {
    return this.request<{ id: string } & WarehouseOrderResponse>("/api/v1/warehouse_orders", {
      method: "POST",
      body: buildWarehouseOrderPayload(input),
    })
  }

  async sendSku(input: SendWarehouseSkuInput) {
    return this.createOrder(input)
  }

  async getOrder(orderId: string) {
    return this.request<WarehouseOrderResponse>(`/api/v1/warehouse_orders/${encodeURIComponent(orderId)}`, {
      method: "GET",
      cache: "no-store",
    })
  }

  private async request<TResult>(path: string, init: WarehouseRequestInit): Promise<TResult> {
    const requestBody =
      init.body === undefined || init.body === null
        ? undefined
        : typeof init.body === "string" ||
            init.body instanceof Blob ||
            init.body instanceof FormData ||
            init.body instanceof URLSearchParams ||
            init.body instanceof ArrayBuffer
          ? init.body
          : JSON.stringify(init.body)

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      body: requestBody,
    })

    const text = await response.text()
    const responseBody = text ? tryParseJson(text) : null

    if (!response.ok) {
      throw new WarehouseApiError(`Warehouse API request failed with status ${response.status}`, {
        status: response.status,
        body: responseBody,
      })
    }

    return responseBody as TResult
  }
}

export async function sendWarehouseSku(input: SendWarehouseSkuInput) {
  const client = new WarehouseApiClient()
  return client.sendSku(input)
}
import { tryParseJson } from "@/lib/parse"
