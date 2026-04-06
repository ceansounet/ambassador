import Link from "next/link";

export function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 p-5 md:p-6">
      <h2 className="text-2xl text-white">{title}</h2>
      <p className="mt-2 max-w-3xl font-body text-base text-white">{description}</p>
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
  return (
    <div className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-5">
      <div className="text-sm text-secondary">{label}</div>
      <div
        className={[
          mono ? "font-body text-sm text-white" : "font-body text-base text-white",
          multiline ? "whitespace-pre-line" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value && value.trim().length > 0 ? value : emptyValue}
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

  const className = outlined
    ? "inline-flex rounded-xl border border-secondary px-3 py-1.5 font-body text-sm text-secondary transition-colors hover:border-white hover:text-white"
    : "inline-flex rounded-xl bg-secondary px-3 py-1.5 font-body text-sm text-black transition-opacity hover:opacity-80";

  return (
    <div className="flex items-center gap-2 pt-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={className}>
          &lt;
        </Link>
      ) : null}
      <div className="font-body text-sm text-white">{label}</div>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={className}>
          &gt;
        </Link>
      ) : null}
    </div>
  );
}
