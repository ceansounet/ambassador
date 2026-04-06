import { getTranslations } from "next-intl/server";
import {
  getApplicationStatusMeta,
  normalizeApplicationStatus,
} from "@/lib/applications";

export async function StatusBadge({ status }: { status: string | null | undefined }) {
  const t = await getTranslations();
  const applicationStatusMeta = getApplicationStatusMeta(t);
  const normalizedStatus = normalizeApplicationStatus(status);
  const meta = normalizedStatus
    ? applicationStatusMeta[normalizedStatus]
    : {
        label: status ?? t("common.unknown"),
        className: "bg-white/20 text-white",
      };

  return (
    <span className={`inline-flex rounded-lg px-3 py-1 font-body text-sm ${meta.className}`}>
      {meta.label}
    </span>
  );
}
