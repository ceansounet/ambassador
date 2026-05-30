"use client";

import { useEffect, useState } from "react";

export function ExpandableImage({
  src,
  alt,
  thumbnailClassName,
}: {
  src: string;
  alt: string;
  thumbnailClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          thumbnailClassName ??
          "block h-16 w-16 overflow-hidden border border-white/30 bg-black transition-opacity hover:opacity-80"
        }
        aria-label={alt}
      >
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-6 top-6 font-body text-base text-white underline hover:opacity-80"
          >
            Close
          </button>
        </div>
      ) : null}
    </>
  );
}
