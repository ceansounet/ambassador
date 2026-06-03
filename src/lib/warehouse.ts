import {
  buildEmptyShirtStockBySize,
  SHIRT_SIZES,
  shirtSku,
  type ShirtStockBySize,
} from "@/lib/shop";

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

type WarehouseAddressInput = {
  name: string
  address: HackClubAuthAddress
}

type WarehouseOrderAddress = {
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
  address: HackClubAuthAddress | null
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

type WarehouseSkuResponse = {
  name: string
  in_stock: number | null
  inbound: number | null
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

  if (token === undefined || token === "") {
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

  return slug !== "" ? slug : "recipient"
}

function splitName(name: string) {
  const normalized = cleanInput(name)
  const [firstName, ...rest] = normalized.split(" ").filter(Boolean)

  if (!firstName) {
    throw new Error("Recipient name is required")
  }

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(" ") : undefined,
  }
}

function requireField(fieldName: string, value?: string) {
  const normalized = value !== undefined && value !== "" ? cleanInput(value) : ""

  if (!normalized) {
    throw new Error(`Warehouse address is missing ${fieldName}`)
  }

  return normalized
}

function coerceHackClubAuthAddress(value: unknown): HackClubAuthAddress | null {
  if (typeof value === "string") {
    try {
      return coerceHackClubAuthAddress(JSON.parse(value) as unknown)
    } catch {
      return null
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  const record = Object.entries(value).reduce<Record<string, unknown>>((next, [key, entry]) => {
    next[key] = entry
    return next
  }, {})

  return {
    first_name: typeof record.first_name === "string" ? record.first_name : undefined,
    last_name: typeof record.last_name === "string" ? record.last_name : undefined,
    line_1: typeof record.line_1 === "string" ? record.line_1 : undefined,
    line_2: typeof record.line_2 === "string" ? record.line_2 : undefined,
    city: typeof record.city === "string" ? record.city : undefined,
    state: typeof record.state === "string" ? record.state : undefined,
    postal_code: typeof record.postal_code === "string" ? record.postal_code : undefined,
    country: typeof record.country === "string" ? record.country : undefined,
    phone_number: typeof record.phone_number === "string" ? record.phone_number : undefined,
    primary: typeof record.primary === "boolean" ? record.primary : undefined,
  }
}

function unwrapWarehouseOrderResponse(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return unwrapWarehouseOrderResponse(JSON.parse(value) as unknown)
    } catch {
      return null
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  const record = Object.entries(value).reduce<Record<string, unknown>>((next, [key, entry]) => {
    next[key] = entry
    return next
  }, {})
  const warehouseOrder = record.warehouse_order

  if (
    typeof warehouseOrder === "object" &&
    warehouseOrder !== null &&
    !Array.isArray(warehouseOrder)
  ) {
    return Object.entries(warehouseOrder).reduce<Record<string, unknown>>((next, [key, entry]) => {
      next[key] = entry
      return next
    }, {})
  }

  return record
}

function unwrapWarehouseSkuResponse(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return unwrapWarehouseSkuResponse(JSON.parse(value) as unknown)
    } catch {
      return null
    }
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  const record = Object.entries(value).reduce<Record<string, unknown>>((next, [key, entry]) => {
    next[key] = entry
    return next
  }, {})
  const sku = record.sku

  if (
    typeof sku === "object" &&
    sku !== null &&
    !Array.isArray(sku)
  ) {
    return Object.entries(sku).reduce<Record<string, unknown>>((next, [key, entry]) => {
      next[key] = entry
      return next
    }, {})
  }

  return record
}

export function parseWarehouseOrderResponse(value: unknown): WarehouseOrderResponse | null {
  const payload = unwrapWarehouseOrderResponse(value)

  if (payload === null) {
    return null
  }

  const id = typeof payload.id === "string" ? payload.id : undefined
  const status = typeof payload.status === "string" ? payload.status : undefined
  const recipientEmail =
    typeof payload.recipient_email === "string" ? payload.recipient_email : undefined

  if (
    id === undefined ||
    id === "" ||
    status === undefined ||
    status === "" ||
    recipientEmail === undefined ||
    recipientEmail === ""
  ) {
    return null
  }

  return {
    id,
    status,
    tags: Array.isArray(payload.tags)
      ? payload.tags.filter((item): item is string => typeof item === "string")
      : [],
    address: coerceHackClubAuthAddress(payload.address),
    metadata:
      typeof payload.metadata === "object" &&
      payload.metadata !== null &&
      !Array.isArray(payload.metadata)
        ? Object.entries(payload.metadata).reduce<Record<string, unknown>>((next, [key, entry]) => {
            next[key] = entry
            return next
          }, {})
        : {},
    recipient_email: recipientEmail,
    dispatched_at: typeof payload.dispatched_at === "string" ? payload.dispatched_at : undefined,
    mailed_at: typeof payload.mailed_at === "string" ? payload.mailed_at : undefined,
    tracking_number:
      typeof payload.tracking_number === "string" ? payload.tracking_number : undefined,
    carrier: typeof payload.carrier === "string" ? payload.carrier : undefined,
    service: typeof payload.service === "string" ? payload.service : undefined,
    weight:
      typeof payload.weight === "string" || typeof payload.weight === "number"
        ? payload.weight
        : undefined,
    contents_cost:
      typeof payload.contents_cost === "string" || typeof payload.contents_cost === "number"
        ? payload.contents_cost
        : undefined,
    labor_cost:
      typeof payload.labor_cost === "string" || typeof payload.labor_cost === "number"
        ? payload.labor_cost
        : undefined,
    postage_cost:
      typeof payload.postage_cost === "string" || typeof payload.postage_cost === "number"
        ? payload.postage_cost
        : undefined,
    idempotency_key:
      typeof payload.idempotency_key === "string" ? payload.idempotency_key : undefined,
  }
}

function parseWarehouseSkuResponse(value: unknown): WarehouseSkuResponse | null {
  const payload = unwrapWarehouseSkuResponse(value)

  if (payload === null) {
    return null
  }

  const name = typeof payload.name === "string" ? payload.name : undefined
  const inStock = typeof payload.in_stock === "number" ? payload.in_stock : null
  const inbound = typeof payload.inbound === "number" ? payload.inbound : null

  if (name === undefined || name === "") {
    return null
  }

  return {
    name,
    in_stock: inStock,
    inbound,
  }
}

function pickPrimaryHackClubAddress(addresses: HackClubAuthAddress[]) {
  const normalizedAddresses = addresses
    .map((address) => coerceHackClubAuthAddress(address))
    .filter((address): address is HackClubAuthAddress => address !== null)

  return normalizedAddresses.find((address) => address.primary === true) ?? normalizedAddresses.at(0) ?? null
}

function normalizeHackClubAddress(input: WarehouseAddressInput): WarehouseOrderAddress {
  const splitRecipientName = splitName(input.name)

  const firstNameSource =
    typeof input.address.first_name === "string" && input.address.first_name !== ""
      ? input.address.first_name
      : splitRecipientName.firstName
  const lastNameSource =
    typeof input.address.last_name === "string" && input.address.last_name !== ""
      ? input.address.last_name
      : splitRecipientName.lastName ?? ""
  const firstName = cleanInput(firstNameSource)
  const lastName = cleanInput(lastNameSource)
  const line2 = cleanInput(input.address.line_2 ?? "")

  return {
    first_name: requireField("first_name", firstName),
    last_name: lastName !== "" ? lastName : undefined,
    line_1: requireField("line_1", input.address.line_1),
    line_2: line2 !== "" ? line2 : undefined,
    city: requireField("city", input.address.city),
    state: requireField("state", input.address.state),
    postal_code: requireField("postal_code", input.address.postal_code),
    country: requireField("country", input.address.country),
  }
}

function buildAmbassadorIdempotencyKey(orderNumber: string, name: string) {
  return `${cleanInput(orderNumber)}-ambassadors-${slugify(name)}`
}

function buildWarehouseOrderPayload(input: SendWarehouseSkuInput): WarehouseCreatePayload {
  const selectedAddress =
    coerceHackClubAuthAddress(input.address) ?? pickPrimaryHackClubAddress(input.addresses ?? [])

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
      user_facing_title:
        input.userFacingTitle !== undefined && input.userFacingTitle !== ""
          ? cleanInput(input.userFacingTitle)
          : undefined,
      idempotency_key:
        input.idempotencyKey !== undefined && input.idempotencyKey !== ""
        ? cleanInput(input.idempotencyKey)
        : buildAmbassadorIdempotencyKey(input.orderNumber, input.name),
      metadata: input.metadata,
      tags:
        Array.isArray(input.tags) && input.tags.length > 0
          ? input.tags.map((tag) => cleanInput(tag))
          : ["Ambassadors"],
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
    const baseUrl = options.baseUrl?.replace(/\/$/, "")
    this.baseUrl = baseUrl !== undefined && baseUrl !== "" ? baseUrl : "https://mail.hackclub.com"
    const token = options.token?.trim()
    this.token = token !== undefined && token !== "" ? token : requireWarehouseApiToken()
  }

  async createOrder(input: SendWarehouseSkuInput) {
    const response = await this.request("/api/v1/warehouse_orders", {
      method: "POST",
      body: buildWarehouseOrderPayload(input),
    })

    const order = parseWarehouseOrderResponse(response)

    if (order === null) {
      throw new Error("Warehouse API returned an unexpected order payload")
    }

    return order
  }

  async listOrders(): Promise<WarehouseOrderResponse[]> {
    const response = await this.request("/api/v1/warehouse_orders", {
      method: "GET",
      cache: "no-store",
    })

    if (typeof response !== "object" || response === null || Array.isArray(response)) {
      return []
    }

    const record: Record<string, unknown> = Object.fromEntries(Object.entries(response))

    if (!Array.isArray(record.warehouse_orders)) {
      return []
    }

    return (record.warehouse_orders as unknown[])
      .map(parseWarehouseOrderResponse)
      .filter((o): o is WarehouseOrderResponse => o !== null)
  }

  async getOrder(orderId: string) {
    const response = await this.request(
      `/api/v1/warehouse_orders/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    )

    const order = parseWarehouseOrderResponse(response)

    if (order === null) {
      throw new Error("Warehouse API returned an unexpected order payload")
    }

    return order
  }

  async getSku(sku: string) {
    const response = await this.request(
      `/api/v1/warehouse/skus/${encodeURIComponent(sku)}`,
      {
        method: "GET",
        cache: "no-store",
      },
    )

    const warehouseSku = parseWarehouseSkuResponse(response)

    if (warehouseSku === null) {
      throw new Error("Warehouse API returned an unexpected SKU payload")
    }

    return warehouseSku
  }

  private async request(path: string, init: WarehouseRequestInit): Promise<unknown> {
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
    let responseBody: unknown = null

    if (text) {
      try {
        responseBody = JSON.parse(text)
      } catch {
        responseBody = text
      }
    }

    if (response.ok !== true) {
      throw new WarehouseApiError(`Warehouse API request failed with status ${response.status}`, {
        status: response.status,
        body: responseBody,
      })
    }

    return responseBody
  }
}

export async function loadShirtStockBySize() {
  const client = new WarehouseApiClient({
    baseUrl: "https://mail.hackclub.com",
  })
  const stockBySize = buildEmptyShirtStockBySize()

  const stocks = await Promise.all(
    SHIRT_SIZES.map(async (size) => {
      const sku = await client.getSku(shirtSku(size))

      return [size, sku.in_stock] as const
    }),
  )

  for (const [size, inStock] of stocks) {
    stockBySize[size] = inStock
  }

  return stockBySize satisfies ShirtStockBySize
}
