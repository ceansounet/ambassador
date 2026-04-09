import Image from "next/image";
import { getTranslations } from "next-intl/server";

import Icon from "@hackclub/icons";

export async function Navbar({
  isAdmin = false,
  balanceCents = 0,
  showBottomBorder = true,
}: {
  isAdmin?: boolean;
  balanceCents?: number;
  showBottomBorder?: boolean;
}) {
  const t = await getTranslations();

  const dollars = (balanceCents / 100).toFixed(2);

  return (
    <nav
      className={[
        "bg-[var(--topbar)] px-6 py-4",
        showBottomBorder ? "border-b border-foreground/10" : "",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-3">
          <Image
            src="/dashboard-logo.png"
            alt={t("app.navbar.logo-alt")}
            width={787}
            height={798}
            className="h-9 w-auto"
          />
        </a>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 items-center rounded-lg px-3 text-base tracking-wide text-acceptance">
            ${dollars}
          </span>
          {isAdmin && (
            <a
              href="/admin"
              className="inline-flex h-9 items-center rounded-lg px-3 text-base tracking-wide text-accent transition-opacity hover:opacity-70"
            >
              {t("app.navbar.admin-link")}
            </a>
          )}
          <a
            href="/posters"
            className="inline-flex h-9 items-center rounded-lg px-3 text-base tracking-wide text-white transition-opacity hover:opacity-70"
          >
            {t("app.navbar.posters-link")}
          </a>
          <a
            href="/settings"
            aria-label={t("app.navbar.settings-label")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-70"
          >
            <Icon glyph="settings" size={20} />
          </a>
          <a
            href="/api/auth/logout"
            aria-label={t("app.navbar.sign-out-label")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity hover:opacity-70"
          >
            <Icon glyph="door-leave" size={20} />
          </a>
        </div>
      </div>
    </nav>
  );
}
