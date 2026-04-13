"use client";

import Icon from "@hackclub/icons";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef, useTransition } from "react";

export function SearchBar({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div className={`relative max-w-sm ${isPending ? "opacity-60" : ""}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-foreground/40">
        <Icon glyph="search" size={18} />
      </span>
      <input
        type="search"
        placeholder={placeholder}
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(event) => {
          const term = event.target.value;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (term) {
              params.set("q", term);
            } else {
              params.delete("q");
            }
            params.delete("page");
            startTransition(() => {
              router.replace(`${pathname}?${params.toString()}`);
            });
          }, 300);
        }}
        className="ui-input-surface !bg-muted h-8 w-full !rounded-none [border-radius:0!important] border-0 pl-9 pr-4 font-body text-sm text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/15"
      />
    </div>
  );
}
