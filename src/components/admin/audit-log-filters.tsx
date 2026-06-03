"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition, useRef, useEffect } from "react";
import { ChevronDownIcon, CheckIcon } from "lucide-react";

import { SlackAvatar } from "@/components/admin/slack-profile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserOption = { id: string; displayName: string; slackId: string | null };

function SelectionIndicator({ checked }: { checked: boolean }) {
  if (!checked) {
    return <span className="size-4 shrink-0" aria-hidden="true" />;
  }

  return <CheckIcon className="size-4 shrink-0 text-[var(--acceptance)]" aria-hidden="true" />;
}

function getPathWithParams(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}

export function EventTypeFilter({
  placeholder,
  options,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = searchParams.get("event") ?? "all";

  return (
    <div className={`w-full sm:w-64 ${isPending ? "opacity-60" : ""}`}>
      <Select
        value={current}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          if (value && value !== "all") {
            params.set("event", value);
          } else {
            params.delete("event");
          }
          params.delete("page");
          startTransition(() => {
            router.replace(getPathWithParams(pathname, params));
          });
        }}
      >
        <SelectTrigger
          size="sm"
          className="ui-input-surface !bg-muted w-full !rounded-none border-0 px-3 text-sm focus-visible:ring-foreground/15 aria-[invalid]:!border-transparent aria-[invalid]:!ring-0"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent
          align="start"
          position="popper"
          className="w-(--radix-select-trigger-width) min-w-(--radix-select-trigger-width)"
        >
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function UserMultiSelect({
  users,
  allLabel,
  selectAllLabel,
  deselectAllLabel,
  noneLabel,
  selectionNoun = "users",
}: {
  users: UserOption[];
  allLabel: string;
  selectAllLabel: string;
  deselectAllLabel: string;
  noneLabel: string;
  selectionNoun?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedParam = searchParams.get("users");
  const noneSelected = selectedParam === "__none__";
  const selectedIdsFromUrl: Set<string> = noneSelected
    ? new Set()
    : selectedParam
    ? new Set(selectedParam.split(",").filter(Boolean))
    : new Set();
  const availableUserIds = new Set(users.map((user) => user.id));
  const selectedIds = new Set(
    Array.from(selectedIdsFromUrl).filter((userId) => availableUserIds.has(userId)),
  );

  const allSelected =
    noneSelected === false &&
    (selectedParam === null ||
      selectedParam === "" ||
      (users.length > 0 && selectedIds.size === users.length));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function applySelection(ids: Set<string>, mode: "all" | "custom" | "none" = "custom") {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "none") {
      params.set("users", "__none__");
    } else if (mode === "all" || ids.size === users.length) {
      params.delete("users");
    } else if (ids.size === 0) {
      params.set("users", "__none__");
    } else {
      params.set("users", Array.from(ids).join(","));
    }
    params.delete("page");
    startTransition(() => {
      router.replace(getPathWithParams(pathname, params));
    });
  }

  function toggleUser(userId: string) {
    const next = noneSelected ? new Set<string>() : new Set(selectedIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    applySelection(next);
  }

  const label = allSelected
    ? allLabel
    : selectedIds.size === 1
      ? users.find((u) => selectedIds.has(u.id))?.displayName ?? allLabel
      : noneSelected
        ? noneLabel
        : `${selectedIds.size} ${selectionNoun}`;

  return (
    <div ref={ref} className={`relative w-full sm:w-56 ${isPending ? "opacity-60" : ""}`}>
      <button
        type="button"
        data-slot="multiselect-trigger"
        onClick={() => setOpen(!open)}
        className="ui-input-surface !bg-muted inline-flex h-8 w-full !rounded-none items-center justify-between gap-1.5 border-0 px-3 font-body text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/15"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div
          data-slot="multiselect-content"
          className="absolute right-0 z-50 mt-1 max-h-72 w-full overflow-y-auto bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5"
        >
          <button
            type="button"
            data-slot="multiselect-item"
            onClick={() => {
              applySelection(new Set(), "all");
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <SelectionIndicator checked={allSelected} />
            {selectAllLabel}
          </button>
          <button
            type="button"
            data-slot="multiselect-item"
            onClick={() => {
              applySelection(new Set(), "none");
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <SelectionIndicator checked={noneSelected} />
            {deselectAllLabel}
          </button>
          {users.map((user) => {
            const checked = allSelected || selectedIds.has(user.id);
            return (
              <button
                key={user.id}
                type="button"
                data-slot="multiselect-item"
                onClick={() => {
                  if (allSelected) {
                    const allExceptThis = new Set(
                      users.filter((u) => u.id !== user.id).map((u) => u.id),
                    );
                    applySelection(allExceptThis);
                  } else {
                    toggleUser(user.id);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <SelectionIndicator checked={checked} />
                <SlackAvatar
                  slackId={user.slackId}
                  fallbackName={user.displayName}
                  sizeClassName="h-6 w-6"
                  textClassName="text-xs"
                />
                <span className="truncate">{user.displayName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
