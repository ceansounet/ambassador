import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type ErrorAction = {
  href: string;
  label: string;
};

type ErrorFrameProps = {
  code: string;
  title: string;
  description: string;
  icon: ReactNode;
  primaryAction?: ErrorAction;
  children?: ReactNode;
};

export function ErrorFrame({
  code,
  title,
  description,
  icon,
  primaryAction,
  children,
}: ErrorFrameProps) {
  return (
    <main className="page-shell flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg">
        <p className="text-8xl font-bold leading-none text-primary">{code}</p>

        <div className="mt-6 flex items-center gap-3">
          {icon}
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>

        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          {description}
        </p>

        {primaryAction ? (
          <div className="mt-8">
            <Button asChild size="app">
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          </div>
        ) : null}

        {children}
      </div>
    </main>
  );
}
