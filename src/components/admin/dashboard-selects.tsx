"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Muted single-select dropdown matching the app's input surface (no red). */
export function SingleSelect<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const label = options.find((option) => option.value === value)?.label ?? "";

  return (
    <div ref={ref} className="relative w-full sm:w-44">
      <button
        type="button"
        data-slot="select-trigger"
        onClick={() => setOpen(!open)}
        className="ui-input-surface !bg-muted inline-flex h-8 w-full !rounded-none items-center justify-between gap-1.5 border-0 px-3 font-body text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/15"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div
          data-slot="select-content"
          className="absolute right-0 z-50 mt-1 w-full overflow-hidden bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5"
        >
          {options.map((option) => {
            const checked = option.value === value;
            return (
              <button
                key={String(option.value)}
                type="button"
                data-slot="select-item"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {checked ? (
                  <CheckIcon className="size-4 shrink-0 text-[var(--acceptance)]" aria-hidden="true" />
                ) : (
                  <span className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Muted multi-select dropdown; label collapses to a count past one selection. */
export function MultiSelect<T extends string>({
  options,
  selected,
  onChange,
  allLabel,
  selectionNoun,
}: {
  options: { value: T; label: string }[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  allLabel: string;
  selectionNoun: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  function toggle(value: T) {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(next);
  }

  const allSelected = selected.size === options.length;
  const label = allSelected
    ? allLabel
    : selected.size === 1
      ? (options.find((option) => selected.has(option.value))?.label ?? "")
      : `${selected.size} ${selectionNoun}`;

  return (
    <div ref={ref} className="relative w-full sm:w-56">
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
          className="absolute right-0 z-50 mt-1 w-full overflow-hidden bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5"
        >
          {options.map((option) => {
            const checked = selected.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                data-slot="multiselect-item"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {checked ? (
                  <CheckIcon className="size-4 shrink-0 text-[var(--acceptance)]" aria-hidden="true" />
                ) : (
                  <span className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
