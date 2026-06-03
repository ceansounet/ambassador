"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/admin/payout-review-actions";
import { PayoutMethodPicker, type PayoutMethod } from "@/components/payout-method-picker";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const fieldClass =
  "mt-2 w-full rounded-none border border-foreground/15 bg-muted px-4 py-3 font-body text-base font-normal text-foreground";

const ERROR_MESSAGES: Record<string, string> = {
  user_not_found: "No ambassador with that email or user id.",
  invalid_amount: "Enter a positive dollar amount.",
  invalid_iban: "That IBAN doesn't look right.",
  invalid_account_number: "That account number doesn't look right.",
  invalid_routing_number: "Routing numbers must be 9 digits.",
  invalid_banking_institution_name: "Enter the bank's name.",
};

// Creates a *manual* payout: a one-off, fixed-amount payment that has nothing
// to do with the ambassador's balance. It lands in the same review queue and
// is approved with an HCB transfer link like any other payout.
export function ManualPayoutForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>("wise");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      user: String(form.get("user") ?? ""),
      amountUsd: String(form.get("amountUsd") ?? ""),
      bankTransferMethod: method,
      bankingInstitutionName: String(form.get("bankingInstitutionName") ?? ""),
      iban: String(form.get("iban") ?? ""),
      accountNumber: String(form.get("accountNumber") ?? ""),
      routingNumber: String(form.get("routingNumber") ?? ""),
      internalNote: String(form.get("internalNote") ?? ""),
    };

    try {
      const response = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | { payout?: { id: string }; error?: string }
        | null;

      if (!response.ok || !data?.payout) {
        setError(ERROR_MESSAGES[data?.error ?? ""] ?? "Could not create the payout. Try again.");
        setSubmitting(false);
        return;
      }

      router.push(`/admin/payouts/${data.payout.id}`);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={buttonVariants({ variant: "default", size: "app" })}
        onClick={() => setOpen(true)}
      >
        New manual payout
      </button>

      {open ? (
        <Modal title="New manual payout" onClose={() => setOpen(false)}>
          <p className="font-body text-sm text-muted-foreground">
            A one-off payment outside the balance system: no posters or referrals involved. It
            still goes through review and needs an HCB transfer link to be approved.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm text-secondary">
              Ambassador email (or user id)
              <Input name="user" type="text" required placeholder="orpheus@hackclub.com" className={fieldClass} />
            </label>
            <label className="block text-sm text-secondary">
              Amount in USD
              <Input name="amountUsd" type="number" step="0.01" min="0.01" required placeholder="25.00" className={fieldClass} />
            </label>

            <PayoutMethodPicker value={method} onChange={setMethod} />

            <label className="block text-sm text-secondary">
              Banking institution name
              <Input name="bankingInstitutionName" type="text" required maxLength={200} className={fieldClass} />
            </label>

            {method === "wise" ? (
              <label className="block text-sm text-secondary">
                IBAN
                <Input name="iban" type="text" required placeholder="GB29 NWBK ..." className={fieldClass} />
              </label>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-secondary">
                  Account number
                  <Input name="accountNumber" type="text" required inputMode="numeric" className={fieldClass} />
                </label>
                <label className="block text-sm text-secondary">
                  Routing number
                  <Input name="routingNumber" type="text" required inputMode="numeric" placeholder="9 digits" className={fieldClass} />
                </label>
              </div>
            )}

            <label className="block text-sm text-secondary">
              Internal note (optional)
              <Textarea name="internalNote" rows={2} className={fieldClass} placeholder="Why this payout exists (admins only)" />
            </label>

            {error ? <p className="font-body text-sm text-primary">{error}</p> : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                className="ui-open-link inline-flex items-center gap-1 font-body text-lg leading-none"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={buttonVariants({ variant: "default", size: "app" })}
              >
                {submitting ? "Creating…" : "Create payout"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
