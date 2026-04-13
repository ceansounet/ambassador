"use client";

import Icon from "@hackclub/icons";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canPlaceAnotherShirtOrder,
  ORDER_STATUS_APPROVED,
  ORDER_STATUS_CANCELLED,
  ORDER_STATUS_FAILED,
  ORDER_STATUS_PENDING,
  ORDER_STATUS_REJECTED,
  SHIRT_SIZES,
  type ShirtSize,
} from "@/lib/shop";
import { formatHackClubAddress, type HackClubAddress } from "@/lib/settings";
import { cn } from "@/lib/utils";

export type ShirtOrderState = {
  id: string;
  status: string;
  size: string | null;
  warehouseUrl: string | null;
  publicOrderUrl: string | null;
  note: string | null;
};

export type ShirtOrderSectionProps = {
  addresses: HackClubAddress[];
  needsAddressRefresh: boolean;
  existingOrder: ShirtOrderState | null;
};

export default function ShirtOrderSection(props: ShirtOrderSectionProps) {
  const t = useTranslations("shirt");
  const retryableReason =
    props.existingOrder && canPlaceAnotherShirtOrder(props.existingOrder.status)
      ? props.existingOrder.note?.trim() || t("order.no-reason")
      : null;
  const retryableWarning = retryableReason
    ? t("order.retryable-warning", { reason: retryableReason })
    : null;
  const retryableWarningParts = retryableWarning?.split(/(rejected)/i);
  return (
    <section>
      <h2 className="font-sub text-2xl text-white md:text-3xl">{t("heading")}</h2>
      {retryableWarning ? (
        <p className="mt-2 text-base text-black">
          {retryableWarningParts?.map((part, index) =>
            /^rejected$/i.test(part) ? (
              <span key={`${part}-${index}`} className="text-primary">
                {part}
              </span>
            ) : (
              <span key={`${part}-${index}`}>{part}</span>
            ),
          )}
        </p>
      ) : null}
      <ShirtOrderBody {...props} />
    </section>
  );
}

function InlineAuthLink() {
  return (
    <a
      href="https://auth.hackclub.com/addresses"
      target="_blank"
      rel="noreferrer"
      className="!text-primary !underline hover:!opacity-80"
    >
      Hack Club Auth
    </a>
  );
}

function NoAddressMessage({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const t = useTranslations("shirt");
  const body = t("no-address.body");
  const linkLabel = "Hack Club Auth";
  const [beforeLink, afterLink = ""] = body.split(linkLabel);

  return (
    <p className="font-body text-base text-white">
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          {beforeLink}
          <InlineAuthLink />
          {afterLink}
        </span>
        <RefreshAddressButton
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      </span>
    </p>
  );
}

function ShirtOrderBody({
  addresses,
  needsAddressRefresh,
  existingOrder,
}: ShirtOrderSectionProps) {
  const t = useTranslations("shirt");
  const router = useRouter();
  const refreshAddressesHref = "/api/auth/refresh?next=%2Fdashboard";
  useAddressRefreshRedirect(needsAddressRefresh);
  useAddressReturnRefresh(addresses.length === 0 && !existingOrder);
  const [size, setSize] = useState<ShirtSize>(
    existingOrder?.size && SHIRT_SIZES.includes(existingOrder.size as ShirtSize)
      ? (existingOrder.size as ShirtSize)
      : "M",
  );
  const [addressIndex, setAddressIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingAddresses, setRefreshingAddresses] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<ShirtOrderState | null>(existingOrder);
  const canPlaceOrder = !order || canPlaceAnotherShirtOrder(order.status);

  const handleRefreshAddresses = async () => {
    if (refreshingAddresses) {
      return;
    }

    if (needsAddressRefresh) {
      window.location.assign(refreshAddressesHref);
      return;
    }

    setRefreshingAddresses(true);

    try {
      const res = await fetch("/api/hca/addresses/refresh", {
        method: "POST",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (data?.error === "reauth_required") {
          window.location.assign(refreshAddressesHref);
          return;
        }

        window.alert(t("errors.refresh-failed-alert"));
        return;
      }

      router.refresh();
    } catch {
      window.alert(t("errors.refresh-failed-alert"));
    } finally {
      setRefreshingAddresses(false);
    }
  };

  const surfaceClass = cn(
    "ui-input-surface h-14 w-full !rounded-none [border-radius:0!important] border-0 px-4 text-base focus-visible:ring-1 focus-visible:ring-white/15",
    "disabled:cursor-not-allowed disabled:text-white/50",
  );
  const readOnlySurfaceClass = cn(
    surfaceClass,
    "text-foreground disabled:opacity-100 disabled:text-foreground disabled:[-webkit-text-fill-color:var(--foreground)]",
  );
  const selectContentClass =
    "!rounded-none [border-radius:0!important] border-white/10 bg-black text-white !duration-0 !data-open:animate-none !data-closed:animate-none !data-[side=bottom]:translate-y-0 !data-[side=top]:translate-y-0 !data-[side=left]:translate-x-0 !data-[side=right]:translate-x-0";

  if (needsAddressRefresh && !order) {
    return (
      <div className="mt-5 space-y-3">
        <p className="font-body text-base text-white">{t("refresh-addresses.body")}</p>
        <a href={refreshAddressesHref} className={buttonVariants({ size: "app" })}>
          {t("refresh-addresses.cta")}
        </a>
      </div>
    );
  }

  if (addresses.length === 0 && !order) {
    return (
      <div className="mt-5">
        <NoAddressMessage
          onRefresh={handleRefreshAddresses}
          refreshing={refreshingAddresses}
        />
      </div>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/shirt/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size, addressIndex }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { id?: string } | null;
        setOrder({
          id: data?.id ?? "",
          status: ORDER_STATUS_PENDING,
          size,
          warehouseUrl: null,
          publicOrderUrl: null,
          note: null,
        });
      } else {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          data?.error === "no_address"
            ? t("errors.no-address")
            : data?.error === "not_ambassador"
              ? t("errors.not-ambassador")
              : data?.error === "unauthorized"
                ? t("errors.refresh-addresses")
                : data?.error === "already_ordered"
                  ? t("errors.already-ordered")
                  : data?.error === "invalid_size"
                    ? t("errors.invalid-size")
                    : t("errors.generic"),
        );
      }
    } catch {
      setError(t("errors.generic"));
    } finally {
      setSubmitting(false);
    }
  };

  if (order && !canPlaceOrder) {
    return (
      <div className="mt-5">
        <LatestOrderCard order={order} />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-5">
      {addresses.length === 0 ? (
        needsAddressRefresh ? (
          <div className="space-y-4">
            <p className="font-body text-base text-white">{t("refresh-addresses.body")}</p>
            <a href={refreshAddressesHref} className={buttonVariants({ size: "app" })}>
              {t("refresh-addresses.cta")}
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <NoAddressMessage
              onRefresh={handleRefreshAddresses}
              refreshing={refreshingAddresses}
            />
          </div>
        )
      ) : (
        <>
          <div>
            <label className="mb-2 block font-body text-base tracking-wide text-white">
              {t("labels.size")}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {SHIRT_SIZES.map((shirtSize) => {
                const active = shirtSize === size;
                return (
                  <Button
                    key={shirtSize}
                    type="button"
                    onClick={() => setSize(shirtSize)}
                    variant="destructive"
                    size="app"
                    selected={active}
                    className={cn(
                      "h-14 w-full !rounded-none [border-radius:0!important] font-body text-base tracking-wide shadow-none",
                      !active && "bg-primary !text-white hover:opacity-100",
                    )}
                  >
                    {shirtSize}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="block font-body text-base tracking-wide text-white">
                {t("labels.shipping-address")}
              </label>
              <RefreshAddressButton
                onRefresh={handleRefreshAddresses}
                refreshing={refreshingAddresses}
              />
            </div>
            {addresses.length === 1 ? (
              <Input
                type="text"
                disabled
                value={formatHackClubAddress(addresses[0])}
                className={readOnlySurfaceClass}
              />
            ) : (
              <Select
                value={String(addressIndex)}
                onValueChange={(value) => setAddressIndex(Number(value))}
              >
                <SelectTrigger
                  className={cn(
                    surfaceClass,
                    "!h-14 !bg-muted data-[state=open]:!bg-muted/80",
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  side="bottom"
                  sideOffset={0}
                  avoidCollisions={false}
                  className={selectContentClass}
                >
                  {addresses.map((address, index) => (
                    <SelectItem
                      key={index}
                      value={String(index)}
                      className="focus:bg-card focus:text-white"
                    >
                      {formatHackClubAddress(address)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="mt-1 text-right">
              <ExternalArrowLink
                href="https://auth.hackclub.com/addresses"
                label={t("manage-addresses")}
              />
            </div>
          </div>

          {error ? <p className="font-body text-base text-primary">{error}</p> : null}

          <div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={buttonVariants({ size: "app" })}
            >
              {submitting ? t("actions.placing") : t("actions.place")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function useAddressRefreshRedirect(needsAddressRefresh: boolean) {
  useEffect(() => {
    const storageKey = "shirt-address-refresh-attempted";

    if (!needsAddressRefresh) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    if (window.sessionStorage.getItem(storageKey) === "1") {
      return;
    }

    window.sessionStorage.setItem(storageKey, "1");
    window.location.assign("/api/auth/refresh?next=%2Fdashboard");
  }, [needsAddressRefresh]);
}

function useAddressReturnRefresh(enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let lastRefreshAt = 0;
    const refreshThrottleMs = 1500;

    const refresh = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      if (now - lastRefreshAt < refreshThrottleMs) {
        return;
      }

      lastRefreshAt = now;
      router.refresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        refresh();
      }
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, router]);
}

function LatestOrderCard({ order }: { order: ShirtOrderState }) {
  const t = useTranslations("shirt");
  const approvedTrackingUrl = order.publicOrderUrl ?? order.warehouseUrl;

  if (order.status === ORDER_STATUS_APPROVED) {
    return (
      <div>
        <p className="font-body text-base text-muted-foreground">
          {approvedTrackingUrl ? (
            t.rich("order.approved-message", {
              link: (chunks) => (
                <a
                  href={approvedTrackingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="!text-primary !underline hover:!opacity-80"
                >
                  {chunks}
                </a>
              ),
            })
          ) : (
            t("order.approved-message-no-link")
          )}
        </p>
      </div>
    );
  }

  const title =
    order.status === ORDER_STATUS_REJECTED
        ? t("order.rejected-title")
        : order.status === ORDER_STATUS_FAILED
          ? t("order.failed-title")
          : order.status === ORDER_STATUS_CANCELLED
            ? t("order.cancelled-title")
            : t("order.pending-title");
  const body =
    order.status === ORDER_STATUS_REJECTED
        ? t("order.rejected-body")
        : order.status === ORDER_STATUS_FAILED
          ? t("order.failed-body")
          : order.status === ORDER_STATUS_CANCELLED
            ? t("order.cancelled-body")
            : t("order.pending-body", { size: order.size ?? "" });

  return (
    <div>
      <h3 className="font-sub text-2xl text-white">{title}</h3>
      <p className="mt-2 font-body text-base text-muted-foreground">{body}</p>

      {(order.status === ORDER_STATUS_REJECTED ||
        order.status === ORDER_STATUS_FAILED ||
        order.status === ORDER_STATUS_CANCELLED) &&
      order.note ? (
        <p className="mt-3 font-body text-sm text-primary">{order.note}</p>
      ) : null}

      {order.warehouseUrl || order.publicOrderUrl ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {order.warehouseUrl ? (
            <a
              href={order.warehouseUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "app" })}
            >
              {t("order.track-cta")}
            </a>
          ) : null}
          {order.publicOrderUrl ? (
            <a
              href={order.publicOrderUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: "app" })}
            >
              {t("order.public-cta")}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RefreshAddressButton({
  onRefresh,
  refreshing,
}: {
  onRefresh: () => void | Promise<void>;
  refreshing: boolean;
}) {
  return (
    <button
      type="button"
      data-slot="icon-link"
      aria-label="Refresh addresses"
      disabled={refreshing}
      onClick={onRefresh}
      className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center appearance-none border-0 bg-transparent p-0 text-foreground outline-none transition-colors hover:text-acceptance focus-visible:text-acceptance disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon glyph="view-reload" size={18} />
    </button>
  );
}

function ExternalArrowLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center !text-primary !underline hover:!opacity-80"
    >
      <span>{label} ↗</span>
    </a>
  );
}
