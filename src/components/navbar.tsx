import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { NavbarActions, type NavLink } from "@/components/navbar-actions";
import { cn } from "@/lib/utils";

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export async function Navbar({
  isAdmin = false,
  balanceCents = 0,
  showPostersLink = false,
  showReferralsLink = false,
  showBottomBorder = true,
  slackId,
  displayName,
  region,
}: {
  isAdmin?: boolean;
  balanceCents?: number;
  showPostersLink?: boolean;
  showReferralsLink?: boolean;
  showBottomBorder?: boolean;
  slackId?: string | null;
  displayName?: string | null;
  region?: string | null;
}) {
  const t = await getTranslations();
  const balance = usdFormatter.format(balanceCents / 100);

  const links: NavLink[] = [
    ...(isAdmin ? [{ href: "/admin", label: t("app.navbar.admin-link"), glyph: "admin" as const }] : []),
    ...(showPostersLink ? [{ href: "/posters", label: t("app.navbar.posters-link"), glyph: "announcement" as const }] : []),
    ...(showReferralsLink ? [{ href: "/referrals", label: t("app.navbar.referrals-link"), glyph: "people-3" as const }] : []),
  ];

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 border-t-[3px] border-t-primary bg-topbar px-3 py-3 sm:px-6",
        showBottomBorder && "border-b border-topbar-foreground/10",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <a
          href="/dashboard"
          className="flex shrink-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Image
            src="/dashboard-logo.avif"
            alt={t("app.navbar.logo-alt")}
            width={787}
            height={798}
            className="h-9 w-auto"
            sizes="2.25rem"
          />
        </a>
        <NavbarActions
          balance={balance}
          balanceLabel={t("app.navbar.balance-label")}
          links={links}
          settingsHref="/settings"
          settingsLabel={t("app.navbar.settings-label")}
          signOutLabel={t("app.navbar.sign-out-label")}
          menuLabel={t("app.navbar.menu-label")}
          slackId={slackId}
          displayName={displayName}
          region={region}
        />
      </div>
    </nav>
  );
}
