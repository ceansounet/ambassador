import type { Metadata } from "next";
import { forbidden, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { Navbar } from "@/components/navbar";
import { pillVariants } from "@/components/ui/pill";
import { formatDateTime } from "@/lib/format";
import {
  formatUsdCents,
  listBalanceTransactionsForUser,
  listPayoutsForUser,
  MIN_AMBASSADOR_PAYOUT_CENTS,
  PAYOUT_STATUS_APPROVED,
  PAYOUT_STATUS_PENDING,
  PAYOUT_STATUS_REJECTED,
} from "@/lib/payouts/service";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { getEffectiveSafeguards } from "@/lib/safeguards";
import { getSession } from "@/lib/session";
import { canAccessStardanceReferrals } from "@/lib/stardance-referrals";

import { RequestPayoutForm } from "./RequestPayoutForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payouts" };

const STATUS_TONE = {
  [PAYOUT_STATUS_PENDING]: "black",
  [PAYOUT_STATUS_APPROVED]: "green",
  [PAYOUT_STATUS_REJECTED]: "red",
} as const;

const STATUS_LABEL = {
  [PAYOUT_STATUS_PENDING]: "Pending review",
  [PAYOUT_STATUS_APPROVED]: "Approved",
  [PAYOUT_STATUS_REJECTED]: "Rejected",
} as const;

const REASON_LABEL: Record<string, string> = {
  poster_verified: "Poster verified",
  poster_unverified: "Poster removed",
  referral_verified: "Referral verified",
  referral_unverified: "Referral removed",
  manual_adjustment: "Adjustment",
  payout_approved: "Payout sent",
  payout_reverted: "Payout returned",
  payout_forfeited: "Balance forfeited",
};

export default async function PayoutsPage() {
  const session = await getSession();
  if (!session) redirect("/");

  const [user, safeguards] = await Promise.all([
    getPosterAccessState(session.sub),
    getEffectiveSafeguards(session.sub),
  ]);
  if (user === null) forbidden();

  // The flag only gates *requesting* a payout; the page itself always works.
  const canSubmit = safeguards.payoutsEnabled;

  const canAccessAdmin =
    Boolean(session.impersonator) || Boolean(user?.is_admin ?? session.isAdmin);

  const [{ balance, payouts }, transactions, locale] = await Promise.all([
    listPayoutsForUser(session.sub),
    listBalanceTransactionsForUser(session.sub),
    getLocale(),
  ]);

  const hasPending = payouts.some((p) => p.status === PAYOUT_STATUS_PENDING);

  const showPostersLink =
    safeguards.postersEnabled &&
    canAccessPosters({
      latestApplicationStatus: user.latest_application_status ?? null,
      manualDashboardState: user.manual_dashboard_state ?? null,
      isOnboardingComplete: user.is_onboarding_complete,
      isAdmin: canAccessAdmin,
    });
  const showReferralsLink =
    safeguards.referralsEnabled &&
    canAccessStardanceReferrals({
      latestApplicationStatus: user.latest_application_status ?? null,
      manualDashboardState: user.manual_dashboard_state ?? null,
      isOnboardingComplete: user.is_onboarding_complete,
      isAdmin: canAccessAdmin,
    });

  return (
    <main className="page-shell">
      <Navbar
        isAdmin={canAccessAdmin}
        balanceCents={balance.balanceCents}
        showPostersLink={showPostersLink}
        showReferralsLink={showReferralsLink}
        showPayouts
      />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-8">
          <p className="font-body text-sm text-secondary">Your balance</p>
          <p className="text-5xl text-foreground">{formatUsdCents(balance.balanceCents)}</p>
          <p className="mt-2 font-body text-base text-muted-foreground">
            You earn $1.00 for every verified poster and $0.50 for every verified referral.{" "}
            {canSubmit
              ? `Request a payout once you reach ${formatUsdCents(MIN_AMBASSADOR_PAYOUT_CENTS)}.`
              : "Payout requests open soon."}
          </p>
        </header>

        {/* Request */}
        <section className="ui-card mb-8">
          <h2 className="text-2xl text-foreground">Request a payout</h2>
          {hasPending ? (
            <p className="mt-3 font-body text-base text-muted-foreground">
              You have a payout under review. You can request another once it&rsquo;s resolved.
            </p>
          ) : !canSubmit ? (
            <div className="mt-4 border border-foreground/15 bg-muted p-4">
              <p className="font-body text-base text-foreground">
                Payout requests aren&rsquo;t open yet.
              </p>
              <p className="mt-1 font-body text-sm text-muted-foreground">
                Your balance keeps growing with every verified poster and referral. Once requests
                open, you&rsquo;ll cash out the full amount right here.
              </p>
            </div>
          ) : balance.balanceCents < MIN_AMBASSADOR_PAYOUT_CENTS ? (
            <p className="mt-3 font-body text-base text-muted-foreground">
              You need at least {formatUsdCents(MIN_AMBASSADOR_PAYOUT_CENTS)} to request a payout.
              Keep placing posters!
            </p>
          ) : (
            <>
              <p className="mt-2 mb-4 font-body text-base text-muted-foreground">
                This pays out your full balance of {formatUsdCents(balance.balanceCents)}.
              </p>
              <RequestPayoutForm amountLabel={formatUsdCents(balance.balanceCents)} />
            </>
          )}
        </section>

        {/* Payout history */}
        <section className="ui-card mb-8">
          <h2 className="text-2xl text-foreground">Payouts</h2>
          <div className="mt-5 space-y-4">
            {payouts.length === 0 ? (
              <p className="font-body text-base text-muted-foreground">No payouts yet.</p>
            ) : (
              payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/5 pt-4 first:border-t-0 first:pt-0"
                >
                  <div>
                    <p className="font-body text-base text-foreground">
                      {formatUsdCents(payout.amountCents)}{" "}
                      <span className="text-sm text-muted-foreground uppercase">
                        · {payout.bankTransferMethod}
                      </span>
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {formatDateTime(payout.submittedAt, locale)}
                    </p>
                    {payout.publicComment ? (
                      <p className="mt-1 font-body text-sm text-foreground">{payout.publicComment}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={pillVariants({ tone: STATUS_TONE[payout.status] })}>
                      {STATUS_LABEL[payout.status]}
                    </span>
                    {payout.status === PAYOUT_STATUS_APPROVED ? (
                      <a
                        href={`/api/payouts/${payout.id}/invoice`}
                        className="font-body text-sm text-primary hover:underline"
                      >
                        Invoice
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Transactions */}
        <section className="ui-card">
          <h2 className="text-2xl text-foreground">Transactions</h2>
          <div className="mt-5 space-y-2">
            {transactions.length === 0 ? (
              <p className="font-body text-base text-muted-foreground">No transactions yet.</p>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 border-t border-foreground/5 py-2 first:border-t-0"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm text-foreground">
                      {tx.publicNote ?? REASON_LABEL[tx.reason] ?? tx.reason.replaceAll("_", " ")}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {formatDateTime(tx.createdAt, locale)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-body text-sm ${tx.amountCents < 0 ? "text-primary" : "text-acceptance"}`}
                    >
                      {tx.amountCents >= 0 ? "+" : ""}
                      {formatUsdCents(tx.amountCents)}
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      {formatUsdCents(tx.balanceAfterCents)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
