"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { ArrowLeft, ArrowRight, CalendarIcon, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const dobMonthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const dobYears = Array.from({ length: 100 }, (_, index) =>
  String(currentYear - index),
);
const fieldSurfaceClass =
  "bg-card/40 hover:bg-card/50 data-[state=open]:bg-card/50 dark:bg-card/40 dark:hover:bg-card/50 dark:data-[state=open]:bg-card/50";

function DateOfBirthField({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(value ?? new Date(currentYear - 18, 0, 1));
  const timeZone =
    typeof window === "undefined"
      ? undefined
      : Intl.DateTimeFormat().resolvedOptions().timeZone;

  const selectedMonthIndex = month.getMonth();
  const selectedYear = String(month.getFullYear());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-14 w-full items-center justify-between rounded-lg px-4 text-left text-base font-normal text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/15",
            fieldSurfaceClass,
          )}
        >
          <span className={cn(!value && "text-accent")}>
            {value ? format(value, "MMMM d, yyyy") : "Select date"}
          </span>
          <CalendarIcon className="size-4 text-white" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[22rem] rounded-xl border border-white/10 bg-black p-3 text-white shadow-none ring-white/10"
      >
        <div className="mb-3 grid grid-cols-[1fr_7.5rem] gap-2">
          <Select
            value={String(selectedMonthIndex)}
            onValueChange={(nextMonth) =>
              setMonth(new Date(Number(selectedYear), Number(nextMonth), 1))
            }
          >
            <SelectTrigger className="h-10 w-full border-white/10 bg-card text-white hover:bg-card/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-black text-white">
              {dobMonthOptions.map((monthLabel, index) => (
                <SelectItem
                  key={monthLabel}
                  value={String(index)}
                  className="focus:bg-card focus:text-white"
                >
                  {monthLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear}
            onValueChange={(nextYear) =>
              setMonth(new Date(Number(nextYear), selectedMonthIndex, 1))
            }
          >
            <SelectTrigger className="h-10 w-full border-white/10 bg-card text-white hover:bg-card/80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72 border-white/10 bg-black text-white">
              {dobYears.map((year) => (
                <SelectItem
                  key={year}
                  value={year}
                  className="focus:bg-card focus:text-white"
                >
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Calendar
          mode="single"
          selected={value}
          month={month}
          onMonthChange={setMonth}
          onSelect={(date) => {
            onChange(date);
            if (date) {
              setMonth(date);
              setOpen(false);
            }
          }}
          startMonth={new Date(currentYear - 100, 0)}
          endMonth={new Date()}
          disabled={(date) => date > new Date()}
          timeZone={timeZone}
          className={cn(
            "bg-transparent p-0 [--cell-size:--spacing(9)]",
            "[&_[data-selected-single=true]]:bg-primary [&_[data-selected-single=true]]:text-white",
            "[&_[data-today=true]]:bg-card [&_[data-today=true]]:text-white",
          )}
          classNames={{
            nav: "hidden",
            month_caption: "hidden",
            month: "flex w-full flex-col gap-4",
            weekdays: "mb-2 grid grid-cols-7 gap-y-1",
            caption_label: "text-sm font-medium text-white",
            weekday: "w-10 text-center text-[0.8rem] text-white",
            week: "mt-0 grid grid-cols-7",
            day: "flex aspect-square items-center justify-center p-0 text-center",
            outside: "text-card aria-selected:text-card",
            disabled: "text-card opacity-50",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ExpandableTextarea({
  label,
  value,
  onChange,
  placeholder = "Start typing...",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const compactRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = compactRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 148) + "px";
  }, [value]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const wordCount = value.split(/\s+/).filter(Boolean).length;

  return (
    <div className="relative">
      <Textarea
        ref={compactRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{ minHeight: "88px", maxHeight: "148px" }}
        className={cn(
          "w-full resize-none rounded-lg border-0 px-4 pb-11 pt-3.5 text-base leading-relaxed text-white placeholder:text-accent focus-visible:ring-1 focus-visible:ring-white/15 md:text-base",
          fieldSurfaceClass,
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="absolute bottom-2.5 right-2.5 size-8 rounded-md text-white hover:bg-transparent hover:text-accent"
        aria-label={`Expand ${label}`}
        aria-haspopup="dialog"
      >
        <Maximize2 size={13} strokeWidth={2} />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-8 sm:items-center sm:p-8"
          style={{
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            backgroundColor: "var(--overlay-backdrop)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="flex h-[78vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black sm:max-w-xl"
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="flex h-14 shrink-0 items-stretch justify-between overflow-hidden border-b border-white/10 pl-5">
              <p className="flex items-center text-sm font-semibold text-white">
                {label}
              </p>
              <div className="flex self-stretch shrink-0 bg-card">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  className="h-full rounded-none border-0 bg-transparent px-5 text-sm font-medium text-white shadow-none hover:bg-card/80 hover:text-white focus-visible:ring-0"
                >
                  Done
                </Button>
              </div>
            </div>

            <Textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="flex-1 resize-none rounded-none border-0 bg-transparent px-5 py-5 text-base leading-7 text-white shadow-none placeholder:text-accent focus-visible:ring-0 md:text-base"
            />

            <div className="shrink-0 border-t border-white/10 px-5 py-3">
              <p className="text-xs text-white">
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormClient() {
  const [page, setPage] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({
    f1: "",
    f3: "",
    f4: "",
    f5: "",
    f6: "",
  });
  const [dob, setDob] = useState<Date>();

  const set = (key: keyof typeof fields) => (value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.f1,
          dateOfBirth: dob?.toISOString().split("T")[0],
          field3: fields.f3,
          field4: fields.f4,
          field5: fields.f5,
          field6: fields.f6,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(
        data?.error === "already_applied"
          ? "You've already submitted an application."
          : "Something went wrong. Try again.",
      );
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10">
        <div className="mx-auto w-full max-w-sm text-center">
          <h1 className="text-5xl text-white">Submitted!</h1>
          <p className="mt-4 font-body text-lg text-white">
            Your application is now under review.
          </p>
          <a
            href="/dashboard"
            className="mt-8 inline-flex h-12 items-center rounded-xl bg-primary px-8 text-lg tracking-wide text-white transition-opacity hover:opacity-80"
          >
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        {page === 1 ? (
          <div>
            <div className="mb-4 flex items-center gap-3">
              <h1 className="text-5xl text-white">Hey!</h1>
              <span className="text-4xl leading-none" aria-hidden="true">
                👋
              </span>
            </div>
            <p className="mb-8 max-w-[18rem] text-xl leading-tight text-white">
              I heard you want to be an <em className="text-primary">ambassador</em>?
            </p>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block font-body text-base tracking-wide text-white">
                  Name
                </label>
                <Input
                  type="text"
                  value={fields.f1}
                  onChange={(e) => set("f1")(e.target.value)}
                  placeholder="Type here..."
                  className={cn(
                    "h-14 border-0 px-4 text-base text-white placeholder:text-accent focus-visible:ring-1 focus-visible:ring-white/15 md:text-base",
                    fieldSurfaceClass,
                  )}
                />
              </div>

              <div>
                <label className="mb-2 block font-body text-base tracking-wide text-white">
                  Date of Birth
                </label>
                <DateOfBirthField value={dob} onChange={setDob} />
              </div>

              <div>
                <label className="mb-2 block font-body text-base tracking-wide text-white">
                  Something else
                </label>
                <ExpandableTextarea
                  label="Something else"
                  value={fields.f3}
                  onChange={set("f3")}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setPage(2);
                  window.scrollTo({ top: 0 });
                }}
                className="h-12 w-12 -translate-y-1 text-white hover:bg-transparent hover:text-accent"
                aria-label="Continue"
              >
                <ArrowRight size={16} strokeWidth={2.5} />
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPage(1);
                window.scrollTo({ top: 0 });
              }}
              className="-ml-2 mb-6 px-2 text-sm text-accent hover:bg-transparent hover:text-white"
            >
              <ArrowLeft size={15} strokeWidth={2.5} />
              Back
            </Button>
            <h1 className="mb-8 text-5xl text-white">
              Further Details
            </h1>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block font-body text-base tracking-wide text-white">
                  Background
                </label>
                <ExpandableTextarea
                  label="Background"
                  value={fields.f4}
                  onChange={set("f4")}
                />
              </div>

              <div>
                <label className="mb-2 block font-body text-base tracking-wide text-white">
                  Why do you want to be an ambassador?
                </label>
                <ExpandableTextarea
                  label="Why do you want to be an ambassador?"
                  value={fields.f5}
                  onChange={set("f5")}
                />
              </div>

              <div>
                <label className="mb-2 block font-body text-base tracking-wide text-white">
                  Anything else?
                </label>
                <ExpandableTextarea
                  label="Anything else?"
                  value={fields.f6}
                  onChange={set("f6")}
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 font-body text-base text-primary">{error}</p>
            )}

            <div className="mt-8 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-xl bg-primary px-8 py-3 text-lg tracking-wide text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
