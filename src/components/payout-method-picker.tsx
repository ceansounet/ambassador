"use client";

import Icon from "@hackclub/icons";

import { Button } from "@/components/ui/button";

export type PayoutMethod = "wise" | "ach";

const METHODS = [
  { value: "wise", label: "Wise (IBAN)" },
  { value: "ach", label: "ACH (US bank)" },
] as const;

// Same selection language as the dashboard shirt-size picker: square filled
// tiles, and the chosen one turns black and gets a checkmark.
export function PayoutMethodPicker({
  value,
  onChange,
}: {
  value: PayoutMethod;
  onChange: (method: PayoutMethod) => void;
}) {
  return (
    <div role="group" aria-label="Transfer method">
      <span className="block font-body text-sm text-secondary">Transfer method</span>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {METHODS.map((method) => {
          const active = method.value === value;
          return (
            <Button
              key={method.value}
              type="button"
              onClick={() => onChange(method.value)}
              variant="destructive"
              size="app"
              selected={active}
              aria-pressed={active}
              className="w-full !rounded-none px-2"
            >
              {active ? <Icon glyph="checkmark" size={16} /> : null}
              {method.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
