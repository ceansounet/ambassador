import Link from "next/link";

import { cn } from "@/lib/utils";

export function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const hasDescription = description !== undefined && description.trim() !== "";

  return (
    <section className="!rounded-none border border-white/10 bg-card p-5 md:p-6">
      <h2 className="text-2xl text-white">{title}</h2>
      {hasDescription ? (
        <p className="mt-2 max-w-3xl font-body text-base text-white">{description}</p>
      ) : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function DetailFieldRow({
  label,
  value,
  emptyValue = "-",
  mono,
  multiline,
}: {
  label: string;
  value: string | null | undefined;
  emptyValue?: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  const displayValue = value !== null && value !== undefined && value.trim() !== "" ? value : emptyValue;

  return (
    <div className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-5">
      <div className="text-sm text-secondary">{label}</div>
      <div
        className={cn(
          mono === true ? "font-body text-sm text-white" : "font-body text-base text-white",
          "break-words [overflow-wrap:anywhere]",
          multiline === true && "whitespace-pre-line",
        )}
      >
        {displayValue}
      </div>
    </div>
  );
}

export function DetailPager({
  label,
  page,
  totalPages,
  href,
  outlined = false,
}: {
  label: string;
  page: number;
  totalPages: number;
  href: (page: number) => string;
  outlined?: boolean;
}) {
  if (totalPages <= 1) {
    return null;
  }

  void outlined;

  return (
    <div className="flex items-center gap-2 pt-1">
      {page > 1 && (
        <Link
          href={href(page - 1)}
          className="inline-flex items-center justify-center font-body text-sm text-white transition-opacity hover:opacity-80"
        >
          &lt;
        </Link>
      )}
      <div className="font-body text-sm text-white">{label}</div>
      {page < totalPages && (
        <Link
          href={href(page + 1)}
          className="inline-flex items-center justify-center font-body text-sm text-white transition-opacity hover:opacity-80"
        >
          &gt;
        </Link>
      )}
    </div>
  );
}
