"use client";

import { useTranslations } from "next-intl";

import { SingleSelect } from "@/components/admin/dashboard-selects";
import { setPriorityScope, usePriorityScope, type Scope } from "@/components/admin/priority-scope";

// The region scope picker for the priority dashboard, lifted into the page
// header so it sits beside the view toggle. It writes the shared scope that the
// dashboard reads, so the two stay in sync without prop drilling.
export function PriorityScopeSelect({ initialScope }: { initialScope?: Scope }) {
  const t = useTranslations("admin.overview.priority");
  const scope = usePriorityScope(initialScope);

  return (
    <SingleSelect
      value={scope}
      options={[
        { value: "us", label: t("region-us") },
        { value: "all", label: t("region-all") },
        { value: "other", label: t("region-other") },
      ]}
      onChange={setPriorityScope}
    />
  );
}
