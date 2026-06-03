"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusOption = { value: string; label: string };

export function StatusFilter({
  placeholder,
  options,
}: {
  placeholder: string;
  options: StatusOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const current = searchParams.get("status") ?? "all";

  return (
    <div className={isPending ? "opacity-60" : ""}>
      <Select
        value={current}
        onValueChange={(value) => {
          const params = new URLSearchParams(searchParams.toString());
          if (value && value !== "all") {
            params.set("status", value);
          } else {
            params.delete("status");
          }
          params.delete("page");
          startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`);
          });
        }}
      >
        <SelectTrigger
          size="sm"
          className="ui-input-surface !bg-muted w-full !rounded-none border-0 px-3 text-sm focus-visible:ring-foreground/15 aria-[invalid]:!border-transparent aria-[invalid]:!ring-0 sm:w-60"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="end">
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
