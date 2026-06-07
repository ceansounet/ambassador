"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Settings, Wallet, X } from "lucide-react";

import Icon from "@hackclub/icons";

import { cn } from "@/lib/utils";

type Glyph = React.ComponentProps<typeof Icon>["glyph"];
export type NavLink = { href: string; label: string; glyph: Glyph };

/** Round Slack avatar backed by cachet, with an initial fallback. */
function ProfileAvatar({
  slackId,
  displayName,
  className,
}: {
  slackId?: string | null;
  displayName: string;
  className: string;
}) {
  const initial = displayName.charAt(0).toUpperCase() || "?";
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-full", className)}>
      {slackId ? (
        <div
          aria-hidden
          className="h-full w-full bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("https://cachet.dunkirk.sh/users/${slackId}/r")` }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-secondary text-xs text-secondary-foreground">
          {initial}
        </div>
      )}
    </div>
  );
}

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Text link with a leading glyph and an animated accent underline. Items stay
 * full strength at rest; the active state carries the colour — accent glyph,
 * accent underline, bold label.
 */
function BarLink({
  href,
  label,
  glyph,
  active,
}: {
  href: string;
  label: React.ReactNode;
  glyph: Glyph;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group inline-flex h-9 items-center px-1 text-sm tracking-wide text-topbar-foreground transition-colors sm:text-base",
        active && "font-bold",
      )}
    >
      <span className="relative inline-flex items-center gap-1.5">
        <span className={cn("transition-colors", active && "text-primary")}>
          <Icon glyph={glyph} size={18} />
        </span>
        {label}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 -bottom-1 h-0.5 origin-center rounded-full bg-primary transition-transform duration-200 ease-out",
            active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
          )}
        />
      </span>
    </Link>
  );
}

const iconButton =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-topbar-foreground transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Inline action that rides the profile's region line. No fixed box — it sizes
// to the icon so the row height (and the name/region spacing) stays put.
const profileAction =
  "inline-flex cursor-pointer items-center rounded text-topbar-foreground/60 transition-colors hover:text-topbar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function SignOutForm({
  label,
  variant,
}: {
  label: string;
  variant: "icon" | "row" | "compact";
}) {
  return (
    <form
      action="/api/auth/logout"
      method="POST"
      // Flex (not the default block) so the button centers on the cross axis
      // instead of sitting on the line box's baseline — otherwise the icon
      // rides ~1px high next to the settings link in the profile row.
      className={variant === "row" ? "w-full" : "inline-flex items-center"}
    >
      {variant === "compact" ? (
        <button type="submit" aria-label={label} className={profileAction}>
          <LogOut size={14} aria-hidden />
        </button>
      ) : variant === "icon" ? (
        <button type="submit" aria-label={label} className={iconButton}>
          <LogOut size={20} aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-topbar-foreground transition-colors"
        >
          <LogOut size={20} aria-hidden />
          {label}
        </button>
      )}
    </form>
  );
}

export function NavbarActions({
  balance,
  balanceLabel,
  links,
  settingsHref,
  settingsLabel,
  signOutLabel,
  menuLabel,
  slackId,
  displayName,
  region,
}: {
  balance: string;
  balanceLabel: string;
  links: NavLink[];
  settingsHref: string;
  settingsLabel: string;
  signOutLabel: string;
  menuLabel: string;
  slackId?: string | null;
  displayName?: string | null;
  region?: string | null;
}) {
  const isActive = useActive();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const name = displayName?.trim() || "";
  const profileRegion = region?.trim() || "";
  const hasProfile = name !== "";

  // Close the mobile menu on Escape; navigation closes it via each link's onClick.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Balance is always visible — the most glanceable bit of the bar. */}
      <Link
        href="/payouts"
        aria-label={balanceLabel}
        aria-current={isActive("/payouts") ? "page" : undefined}
        className="group inline-flex h-9 items-center px-1 text-sm font-bold tracking-wide text-acceptance transition-colors sm:text-base"
      >
        <span className="relative inline-flex items-center gap-1.5">
          <Wallet size={16} aria-hidden />
          {balance}
          <span
            aria-hidden
            className={cn(
              "absolute inset-x-0 -bottom-1 h-0.5 origin-center rounded-full bg-acceptance transition-transform duration-200 ease-out",
              isActive("/payouts") ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
            )}
          />
        </span>
      </Link>

      {/* Desktop: full inline cluster. */}
      <div className="hidden items-center gap-3 sm:flex">
        {links.length > 0 && <span aria-hidden className="h-5 w-px bg-topbar-foreground/15" />}
        {links.map((link) => (
          <BarLink
            key={link.href}
            href={link.href}
            label={link.label}
            glyph={link.glyph}
            active={isActive(link.href)}
          />
        ))}
        <span aria-hidden className="h-5 w-px bg-topbar-foreground/15" />
        {hasProfile ? (
          <div className="flex items-center gap-2.5">
            <ProfileAvatar slackId={slackId} displayName={name} className="h-9 w-9" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-bold leading-tight text-topbar-foreground">{name}</span>
              {/* leading-none makes the line box hug the glyphs, so the icons
                  center on the visible "Other" text and the two lines sit tight */}
              <div className="flex items-center gap-1.5 text-xs leading-none text-topbar-foreground/60">
                {profileRegion !== "" && <span className="truncate">{profileRegion}</span>}
                <Link href={settingsHref} aria-label={settingsLabel} className={profileAction}>
                  <Settings size={14} aria-hidden />
                </Link>
                <SignOutForm label={signOutLabel} variant="compact" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <Link href={settingsHref} aria-label={settingsLabel} className={iconButton}>
              <Settings size={20} aria-hidden />
            </Link>
            <SignOutForm label={signOutLabel} variant="icon" />
          </>
        )}
      </div>

      {/* Mobile: hamburger toggles a dropdown panel. */}
      <button
        type="button"
        aria-label={menuLabel}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(iconButton, "sm:hidden")}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Click-away backdrop (mobile only). */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 cursor-default sm:hidden",
          open ? "block" : "hidden",
        )}
      />

      {/* Mobile dropdown panel. */}
      <div
        className={cn(
          "absolute inset-x-0 top-full z-50 origin-top border-b border-topbar-foreground/10 bg-topbar shadow-lg transition-[opacity,transform] duration-200 ease-out sm:hidden",
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-3 py-3">
          {hasProfile && (
            <>
              <div className="flex items-center gap-3 px-3 py-2">
                <ProfileAvatar slackId={slackId} displayName={name} className="h-10 w-10" />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-bold text-topbar-foreground">{name}</span>
                  {profileRegion !== "" && (
                    <span className="truncate text-sm text-topbar-foreground/60">{profileRegion}</span>
                  )}
                </div>
              </div>
              <span aria-hidden className="my-1 h-px w-full bg-topbar-foreground/10" />
            </>
          )}
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg border-l-2 px-3 tracking-wide text-topbar-foreground transition-colors",
                  active ? "border-primary font-bold" : "border-transparent",
                )}
              >
                <span className={cn("transition-colors", active && "text-primary")}>
                  <Icon glyph={link.glyph} size={20} />
                </span>
                {link.label}
              </Link>
            );
          })}
          <span aria-hidden className="my-1 h-px w-full bg-topbar-foreground/10" />
          <Link
            href={settingsHref}
            onClick={close}
            aria-current={isActive(settingsHref) ? "page" : undefined}
            className="flex h-11 items-center gap-3 rounded-lg px-3 text-topbar-foreground transition-colors"
          >
            <Settings size={20} aria-hidden />
            {settingsLabel}
          </Link>
          <SignOutForm label={signOutLabel} variant="row" />
        </div>
      </div>
    </div>
  );
}
