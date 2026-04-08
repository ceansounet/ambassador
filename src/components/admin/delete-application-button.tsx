"use client";

import { ConfirmSubmitForm } from "@/components/admin/confirm-submit-form";
import { buttonVariants } from "@/components/ui/button";

export function DeleteApplicationButton({
  applicationId,
  label,
  confirmationMessage,
}: {
  applicationId: string;
  label: string;
  confirmationMessage: string;
}) {
  return (
    <ConfirmSubmitForm
      action={`/api/admin/applications/${applicationId}/delete`}
      method="POST"
      className="max-w-xl space-y-3"
      confirmationMessage={confirmationMessage}
    >
      <input type="hidden" name="redirectTo" value="/admin/applications" />
      <button className={buttonVariants({ size: "app" })}>
        {label}
      </button>
    </ConfirmSubmitForm>
  );
}
