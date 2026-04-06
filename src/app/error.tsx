"use client";

import { useEffect } from "react";

import { InternalErrorPage } from "@/components/errors/internal-error-page";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <InternalErrorPage onRetry={unstable_retry} />;
}
