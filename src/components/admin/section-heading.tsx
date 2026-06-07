import type { ReactNode } from "react";

/**
 * Open-layout section heading: a small colour kicker (eyebrow), the title, and
 * optional right-aligned controls. No rules or boxes — sections are set apart by
 * whitespace alone, and colour is carried by the data/charts, not the chrome.
 * The kicker top-aligns with the controls so a section reads as one tidy block.
 */
export function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
      <div>
        {eyebrow !== undefined ? (
          <p className="font-body text-sm font-bold leading-4 text-secondary">{eyebrow}</p>
        ) : null}
        <h2 className="flex items-center gap-2 text-2xl font-bold leading-8 text-foreground">{title}</h2>
      </div>
      {children !== undefined ? (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
