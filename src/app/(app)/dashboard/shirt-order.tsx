"use client";

import { useEffect, useState } from "react";
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
  shirtEnabled: boolean;
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
  return (
    <section>
      <h2 className="font-sub text-2xl text-white md:text-3xl">{t("heading")}</h2>
      {retryableReason ? (
        <p className="mt-2 text-base text-muted-foreground">
          <span className="text-rejection">
            {t("order.retryable-warning", { reason: retryableReason })}
          </span>
        </p>
      ) : null}
      <ShirtOrderBody {...props} />
    </section>
  );
}

function ShirtOrderBody({
  shirtEnabled,
  addresses,
  needsAddressRefresh,
  existingOrder,
}: ShirtOrderSectionProps) {
  const t = useTranslations("shirt");
  useAddressRefreshRedirect(needsAddressRefresh);
  const [size, setSize] = useState<ShirtSize>(
    existingOrder?.size && SHIRT_SIZES.includes(existingOrder.size as ShirtSize)
      ? (existingOrder.size as ShirtSize)
      : "M",
  );
  const [addressIndex, setAddressIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<ShirtOrderState | null>(existingOrder);
  const canPlaceOrder = !order || canPlaceAnotherShirtOrder(order.status);

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

  if (!shirtEnabled) {
    return <p className="mt-5 font-body text-base text-white">{t("unavailable")}</p>;
  }

  if (needsAddressRefresh && !order) {
    return (
      <div className="mt-5 space-y-3">
        <p className="font-body text-base text-white">{t("refresh-addresses.body")}</p>
        <a href="/api/auth/login" className={buttonVariants({ size: "app" })}>
          {t("refresh-addresses.cta")}
        </a>
      </div>
    );
  }

  if (addresses.length === 0 && !order) {
    return (
      <div className="mt-5 space-y-3">
        <p className="font-body text-base text-white">{t("no-address.body")}</p>
        <ExternalArrowLink
          href="https://auth.hackclub.com/addresses"
          label={t("no-address.cta")}
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
              : data?.error === "shirt_unavailable"
                ? t("errors.unavailable")
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
            <a href="/api/auth/login" className={buttonVariants({ size: "app" })}>
              {t("refresh-addresses.cta")}
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-body text-base text-white">{t("no-address.body")}</p>
            <ExternalArrowLink
              href="https://auth.hackclub.com/addresses"
              label={t("no-address.cta")}
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
            <label className="mb-2 block font-body text-base tracking-wide text-white">
              {t("labels.shipping-address")}
            </label>
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
            <div className="mt-2 text-right">
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
    window.location.assign("/api/auth/login");
  }, [needsAddressRefresh]);
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
        <p className="mt-3 font-body text-sm text-rejection">{order.note}</p>
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
