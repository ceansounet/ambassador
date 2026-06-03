import { isUserAdmin } from "@/lib/applications/review";
import { PayoutRequestError } from "@/lib/payouts/service";
import { getEffectiveSafeguards } from "@/lib/safeguards";
import { getActorSession, getSession } from "@/lib/session";

export async function readJsonObject(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new PayoutRequestError("invalid_body", 400);
  }

  return Object.fromEntries(Object.entries(body));
}

/**
 * Accept both JSON (programmatic callers, e.g. the meetup balance script) and
 * HTML form posts (the admin UI, which then redirects back).
 */
export async function readJsonOrForm(
  request: Request,
): Promise<{ data: Record<string, unknown>; isForm: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return { data: await readJsonObject(request), isForm: false };
  }

  const form = await request.formData();
  const data: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    data[key] = typeof value === "string" ? value : null;
  }
  return { data, isForm: true };
}

/**
 * The payouts_enabled flag (global, or a per-user override) gates *submitting*
 * a payout request only. Viewing balances, history, and the admin review side
 * works regardless.
 */
export async function requirePayoutsEnabled(userId: string | null) {
  const safeguards = await getEffectiveSafeguards(userId);
  if (!safeguards.payoutsEnabled) {
    throw new PayoutRequestError("payouts_disabled", 403);
  }
}

export async function requirePayoutSession() {
  const session = await getSession();
  if (!session) {
    throw new PayoutRequestError("unauthorized", 401);
  }
  return session;
}

export async function requireAdminActorSession() {
  const session = await getActorSession();
  if (!session) {
    throw new PayoutRequestError("forbidden", 403);
  }

  if (!(await isUserAdmin(session.sub))) {
    throw new PayoutRequestError("forbidden", 403);
  }

  return session;
}

export function payoutErrorResponse(error: unknown, fallbackMessage = "payout_error") {
  if (error instanceof PayoutRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof Error) {
    console.error(error);
  }

  return Response.json({ error: fallbackMessage }, { status: 500 });
}
