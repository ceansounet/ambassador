"use client";

import { useEffect } from "react";

import Icon from "@hackclub/icons";

import { Button } from "@/components/ui/button";
import { ErrorFrame } from "@/components/errors/error-frame";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorFrame
          code="500"
          title="Something went wrong"
          description="An unexpected error interrupted this page."
          icon={<Icon glyph="bug" size={24} />}
        >
          <div className="mt-8">
            <Button size="lg" onClick={reset}>
              Try again
            </Button>
          </div>
        </ErrorFrame>
      </body>
    </html>
  );
}
