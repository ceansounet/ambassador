"use client";

import type { ComponentProps, FormEvent, FormEventHandler } from "react";

type ConfirmSubmitFormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  confirmationMessage?: string;
  confirmationMessages?: string[];
  onSubmit?: FormEventHandler<HTMLFormElement>;
};

export function ConfirmSubmitForm({
  confirmationMessage,
  confirmationMessages,
  onSubmit,
  ...props
}: ConfirmSubmitFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit?.(event);

    const messages = confirmationMessages?.length
      ? confirmationMessages
      : confirmationMessage
        ? [confirmationMessage]
        : [];

    if (event.defaultPrevented || messages.length === 0) {
      return;
    }

    for (const message of messages) {
      if (!window.confirm(message)) {
        event.preventDefault();
        return;
      }
    }
  }

  return <form {...props} onSubmit={handleSubmit} />;
}
