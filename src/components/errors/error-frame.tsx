import type { ReactNode } from "react";
import Link from "next/link";

import { DevAdminSelector } from "@/components/dev-admin-selector";
import { isErrorCode, type ErrorCode } from "@/lib/dev-admin-selector";
import { instrumentSans } from "@/lib/fonts";
import { Button } from "@/components/ui/button";

type ErrorAction = {
  href: string;
  label: string;
  icon?: ReactNode;
};

type ErrorFrameProps = {
  code: string;
  title: string;
  description: string;
  icon: ReactNode;
  primaryAction?: ErrorAction;
  showDevAdminSelector?: boolean;
  children?: ReactNode;
};

export function ErrorFrame({
  code,
  title,
  description,
  icon,
  primaryAction,
  showDevAdminSelector = false,
  children,
}: ErrorFrameProps) {
  const currentErrorCode: ErrorCode = isErrorCode(code) ? code : "500";

  return (
    <main className="page-shell flex min-h-[100dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg text-left">
        <p className={`${instrumentSans.className} text-8xl font-bold leading-none text-primary`}>
          {code}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <span className="shrink-0">{icon}</span>
        </div>

        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted-foreground">
          {description}
        </p>

        {primaryAction ? (
          <div className="mt-8">
            <Button asChild size="app" data-icon={primaryAction.icon ? "inline-end" : undefined}>
              <Link href={primaryAction.href}>
                <span>{primaryAction.label}</span>
                {primaryAction.icon}
              </Link>
            </Button>
          </div>
        ) : null}

        {children}
      </div>
      {showDevAdminSelector ? (
        <DevAdminSelector mode="error" currentErrorCode={currentErrorCode} />
      ) : null}
    </main>
  );
}
