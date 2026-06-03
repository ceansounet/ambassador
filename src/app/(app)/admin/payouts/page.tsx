import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { ManualPayoutForm } from "@/components/admin/manual-payout-form";
import { buttonVariants } from "@/components/ui/button";
import { pillVariants } from "@/components/ui/pill";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  formatUsdCents,
  listAdminPayouts,
  PAYOUT_STATUS_APPROVED,
  PAYOUT_STATUS_PENDING,
  PAYOUT_STATUS_REJECTED,
} from "@/lib/payouts/service";
import { getActorSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payouts" };

const STATUS_TONE = {
  [PAYOUT_STATUS_PENDING]: "black",
  [PAYOUT_STATUS_APPROVED]: "green",
  [PAYOUT_STATUS_REJECTED]: "red",
} as const;

const STATUS_LABEL = {
  [PAYOUT_STATUS_PENDING]: "Pending",
  [PAYOUT_STATUS_APPROVED]: "Approved",
  [PAYOUT_STATUS_REJECTED]: "Rejected",
} as const;

export default async function AdminPayoutsPage() {
  const session = await getActorSession();
  if (!session) redirect("/");

  const [{ payouts }, locale] = await Promise.all([listAdminPayouts(), getLocale()]);

  // Queue = pending, oldest first (order received).
  const pending = payouts
    .filter((p) => p.status === PAYOUT_STATUS_PENDING)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const finalized = payouts.filter((p) => p.status !== PAYOUT_STATUS_PENDING);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl text-foreground">Payouts</h1>
        <div className="flex flex-wrap items-center gap-4">
          {pending.length > 0 ? (
            <Link
              href={`/admin/payouts/${pending[0].id}`}
              className="ui-open-link inline-flex items-center gap-1 whitespace-nowrap font-body text-lg leading-none"
            >
              Review queue ({pending.length}) <span aria-hidden="true">↗</span>
            </Link>
          ) : null}
          <ManualPayoutForm />
        </div>
      </div>

      <section className="ui-card">
        <h2 className="text-2xl text-foreground">Review queue</h2>
        <p className="mt-2 font-body text-base text-muted-foreground">Oldest first.</p>
        <div className="mt-5">
          {pending.length === 0 ? (
            <p className="font-body text-base text-muted-foreground">Nothing waiting for review.</p>
          ) : (
            <PayoutTable payouts={pending} locale={locale} />
          )}
        </div>
      </section>

      <section className="ui-card">
        <h2 className="text-2xl text-foreground">Recent decisions</h2>
        <div className="mt-5">
          {finalized.length === 0 ? (
            <p className="font-body text-base text-muted-foreground">No decisions yet.</p>
          ) : (
            <PayoutTable payouts={finalized.slice(0, 50)} locale={locale} />
          )}
        </div>
      </section>
    </div>
  );
}

function PayoutTable({
  payouts,
  locale,
}: {
  payouts: Awaited<ReturnType<typeof listAdminPayouts>>["payouts"];
  locale: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-body text-sm">
        <thead>
          <tr className="border-b border-foreground/10 text-left text-secondary">
            <th className="py-2 pr-4 font-normal">Ambassador</th>
            <th className="py-2 pr-4 font-normal">Amount</th>
            <th className="py-2 pr-4 font-normal">Method</th>
            <th className="py-2 pr-4 font-normal">Submitted</th>
            <th className="py-2 pr-4 font-normal">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.id} className="border-b border-foreground/5">
              <td className="py-3 pr-4 text-foreground">
                {payout.ambassador.legalName ?? payout.ambassador.displayName}
                <span className="block text-xs text-muted-foreground">
                  {payout.ambassador.email}
                </span>
              </td>
              <td className="py-3 pr-4 text-foreground">{formatUsdCents(payout.amountCents)}</td>
              <td className="py-3 pr-4 text-foreground uppercase">{payout.bankTransferMethod}</td>
              <td className="py-3 pr-4 text-muted-foreground">
                {formatDateTime(payout.submittedAt, locale)}
              </td>
              <td className="py-3 pr-4">
                <span className={pillVariants({ tone: STATUS_TONE[payout.status] })}>
                  {STATUS_LABEL[payout.status]}
                </span>
              </td>
              <td className="py-3 text-right">
                <Link
                  href={`/admin/payouts/${payout.id}`}
                  className={cn(buttonVariants({ size: "app-sm" }), "!bg-foreground hover:!bg-foreground/85")}
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
