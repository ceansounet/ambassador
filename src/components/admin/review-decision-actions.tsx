"use client";

import { useEffect, useId, useState } from "react";

import { ConfirmSubmitForm } from "@/components/admin/confirm-submit-form";
import { DeleteApplicationButton } from "@/components/admin/delete-application-button";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ReviewDecisionActionsProps = {
  applicationId: string;
  canAccept: boolean;
  canReject: boolean;
  isOnHold: boolean;
  acceptLabel: string;
  deleteLabel: string;
  deleteConfirmationMessage: string;
  destructiveConfirmationMessage: string;
  putOnHoldConfirmationMessage: string;
  putOnHoldLabel: string;
  rejectLabel: string;
  rejectNoteLabel: string;
  rejectNotePlaceholder: string;
  rejectSubmitLabel: string;
  permanentRejectLabel: string;
  permanentRejectNoteLabel: string;
  permanentRejectNotePlaceholder: string;
  removeHoldConfirmationMessage: string;
  removeHoldLabel: string;
};

type DecisionModalState = "reject" | "reject-permanently" | null;

export function ReviewDecisionActions({
  applicationId,
  canAccept,
  canReject,
  isOnHold,
  acceptLabel,
  deleteLabel,
  deleteConfirmationMessage,
  destructiveConfirmationMessage,
  putOnHoldConfirmationMessage,
  putOnHoldLabel,
  rejectLabel,
  rejectNoteLabel,
  rejectNotePlaceholder,
  rejectSubmitLabel,
  permanentRejectLabel,
  permanentRejectNoteLabel,
  permanentRejectNotePlaceholder,
  removeHoldConfirmationMessage,
  removeHoldLabel,
}: ReviewDecisionActionsProps) {
  const [activeModal, setActiveModal] = useState<DecisionModalState>(null);

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        {canAccept ? (
          <form action={`/api/admin/applications/${applicationId}/approve`} method="POST">
            <input type="hidden" name="redirectTo" value={`/admin/applications/review/${applicationId}`} />
            <button className={buttonVariants({ variant: "success", size: "app" })}>
              {acceptLabel}
            </button>
          </form>
        ) : null}

        {canReject ? (
          <button
            type="button"
            className={buttonVariants({ size: "app" })}
            onClick={() => setActiveModal("reject")}
          >
            {rejectLabel}
          </button>
        ) : null}

        <ConfirmSubmitForm
          action={`/api/admin/applications/${applicationId}/hold`}
          method="POST"
          confirmationMessage={isOnHold ? removeHoldConfirmationMessage : putOnHoldConfirmationMessage}
        >
          <input type="hidden" name="redirectTo" value={`/admin/applications/review/${applicationId}`} />
          <input type="hidden" name="onHold" value={isOnHold ? "false" : "true"} />
          <button className={buttonVariants({ size: "app" })}>
            {isOnHold ? removeHoldLabel : putOnHoldLabel}
          </button>
        </ConfirmSubmitForm>

        <button
          type="button"
          className={buttonVariants({ size: "app" })}
          onClick={() => setActiveModal("reject-permanently")}
        >
          {permanentRejectLabel}
        </button>

        <DeleteApplicationButton
          applicationId={applicationId}
          label={deleteLabel}
          confirmationMessage={deleteConfirmationMessage}
        />
      </div>

      <DecisionReasonModal
        action={`/api/admin/applications/${applicationId}/reject`}
        applicationId={applicationId}
        confirmationMessage={destructiveConfirmationMessage}
        noteLabel={rejectNoteLabel}
        notePlaceholder={rejectNotePlaceholder}
        open={activeModal === "reject"}
        onOpenChange={(open) => setActiveModal(open ? "reject" : null)}
        submitLabel={rejectSubmitLabel}
        title={rejectLabel}
      />

      <DecisionReasonModal
        action={`/api/admin/applications/${applicationId}/reject-permanently`}
        applicationId={applicationId}
        confirmationMessage={destructiveConfirmationMessage}
        noteLabel={permanentRejectNoteLabel}
        notePlaceholder={permanentRejectNotePlaceholder}
        noteRequired={false}
        open={activeModal === "reject-permanently"}
        onOpenChange={(open) => setActiveModal(open ? "reject-permanently" : null)}
        submitLabel={permanentRejectLabel}
        title={permanentRejectLabel}
      />
    </>
  );
}

function DecisionReasonModal({
  action,
  applicationId,
  confirmationMessage,
  noteLabel,
  notePlaceholder,
  noteRequired = true,
  open,
  onOpenChange,
  submitLabel,
  title,
}: {
  action: string;
  applicationId: string;
  confirmationMessage: string;
  noteLabel: string;
  notePlaceholder: string;
  noteRequired?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitLabel: string;
  title: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="ui-modal-backdrop items-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <ConfirmSubmitForm
        action={action}
        method="POST"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg space-y-4 ui-card shadow-xl"
        confirmationMessage={confirmationMessage}
      >
        <input type="hidden" name="redirectTo" value={`/admin/applications/review/${applicationId}`} />

        <div className="space-y-1">
          <h3 id={titleId} className="text-xl text-foreground">
            {title}
          </h3>
          <p className="font-body text-sm text-secondary">Add a reason before submitting.</p>

          <p className="font-body text-sm text-secondary">This will be shared with the applicant.</p>

        </div>

        <label className="block text-sm text-secondary">
          {noteLabel}
          <Textarea
            name="note"
            required={noteRequired}
            rows={noteRequired ? 5 : 4}
            autoFocus
            className="ui-input-surface mt-2 min-h-24 resize-none border-foreground bg-transparent px-5 py-4 font-body text-base font-normal placeholder:font-normal hover:bg-transparent md:text-base"
            placeholder={notePlaceholder}
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            data-slot="open-link"
            className="ui-open-link inline-flex items-center gap-1 font-body text-lg leading-none"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button className={buttonVariants({ size: "app" })}>{submitLabel}</button>
        </div>
      </ConfirmSubmitForm>
    </div>
  );
}
