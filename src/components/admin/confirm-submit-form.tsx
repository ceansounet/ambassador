"use client";

import type { ComponentProps, FormEvent, FormEventHandler } from "react";

type ConfirmSubmitFormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  confirmationMessage?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function ConfirmSubmitForm({
  confirmationMessage,
  onSubmit,
  ...props
}: ConfirmSubmitFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit?.(event);

    if (event.defaultPrevented || !confirmationMessage) {
      return;
    }

    if (!window.confirm(confirmationMessage)) {
      event.preventDefault();
    }
  }

  return <form {...props} onSubmit={handleSubmit} />;
}
