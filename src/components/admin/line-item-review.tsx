"use client";

import { useState } from "react";

export type LineItemReviewItem = {
  id: string;
  /** Still waiting on an accept/reject decision. */
  needsReview: boolean;
  content: React.ReactNode;
};

/**
 * Steps through payout line-items one at a time instead of dumping the whole
 * list. Opens on the first item that still needs a decision; after a decision
 * the page reloads and the widget lands on the next one.
 */
export function LineItemReview({ items }: { items: LineItemReviewItem[] }) {
  const firstNeedsReview = items.findIndex((item) => item.needsReview);
  const [index, setIndex] = useState(firstNeedsReview === -1 ? 0 : firstNeedsReview);

  const current = items[Math.min(index, items.length - 1)];
  const remaining = items.filter((item) => item.needsReview).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-foreground/10 pb-3">
        <span className="font-body text-sm text-muted-foreground">
          {Math.min(index, items.length - 1) + 1} of {items.length}
          {remaining > 0 ? ` · ${remaining} left to review` : " · all reviewed"}
        </span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIndex((value) => Math.max(value - 1, 0))}
            disabled={index <= 0}
            aria-label="Previous"
            className="ui-open-link font-body text-lg leading-none disabled:opacity-30"
          >
            <span aria-hidden>←</span>
          </button>
          <button
            type="button"
            onClick={() => setIndex((value) => Math.min(value + 1, items.length - 1))}
            disabled={index >= items.length - 1}
            aria-label="Next"
            className="ui-open-link font-body text-lg leading-none disabled:opacity-30"
          >
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
      <div className="pt-4">{current.content}</div>
    </div>
  );
}
