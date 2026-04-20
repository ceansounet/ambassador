import {
  AdminDashboardCharts,
  type DashboardActivityPoint,
  type DashboardBreakdownPoint,
  type DashboardFunnelPoint,
} from "@/components/admin/admin-dashboard-charts";
import Icon from "@hackclub/icons";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getTranslatedPageMetadata } from "@/i18n/metadata";
import {
  APPLICATION_STATUS_ACCEPTED,
  APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS,
  APPLICATION_STATUS_PENDING_REVIEW,
  APPLICATION_STATUS_REJECTED,
  APPLICATION_STATUS_REJECTED_PERMANENT,
} from "@/lib/applications/status";
import sql from "@/lib/database/client";
import { ensureSchema } from "@/lib/database/ensure-schema";

type SummaryRow = {
  visitor_count: number;
  total_visit_count: number;
  signup_count: number;
  applicant_count: number;
  pending_count: number;
};

type ActivityRow = {
  day: Date | string;
  visits: number;
  signups: number;
  applications: number;
};

type OutcomeSummaryRow = {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  banned_count: number;
};

const activityRangeDays = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
} as const;

type ActivityRange = keyof typeof activityRangeDays;

export async function generateMetadata(): Promise<Metadata> {
  return getTranslatedPageMetadata("admin.overview.metadata.title");
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const [t, locale, query] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  const activeRange: ActivityRange =
    query.range === "7d" ||
    query.range === "14d" ||
    query.range === "30d" ||
    query.range === "90d"
      ? query.range
      : "14d";
  const rangeDays = activityRangeDays[activeRange];
  await ensureSchema();
  const numberFormatter = new Intl.NumberFormat(locale);
  const activityLabelFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  const [summaryRows, activityRows, outcomeRows] = await Promise.all([
    sql<SummaryRow[]>`
      SELECT
        (
          SELECT COUNT(DISTINCT COALESCE(user_id, ip))::int
          FROM ip_visits
        ) AS visitor_count,
        (
          SELECT COUNT(*)::int
          FROM ip_visits
        ) AS total_visit_count,
        (
          SELECT COUNT(*)::int
          FROM users
        ) AS signup_count,
        (
          SELECT COUNT(*)::int
          FROM applications
        ) AS applicant_count,
        (
          SELECT COUNT(*)::int
          FROM applications
          WHERE status IN (
            ${APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS},
            ${APPLICATION_STATUS_PENDING_REVIEW}
          )
        ) AS pending_count
    `,
    sql<ActivityRow[]>`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - ${rangeDays - 1} * INTERVAL '1 day',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ),
      visit_totals AS (
        SELECT DATE(created_at) AS day, COUNT(*)::int AS visits
        FROM ip_visits
        WHERE created_at >= CURRENT_DATE - ${rangeDays - 1} * INTERVAL '1 day'
        GROUP BY 1
      ),
      signup_totals AS (
        SELECT DATE(created_at) AS day, COUNT(*)::int AS signups
        FROM users
        WHERE created_at >= CURRENT_DATE - ${rangeDays - 1} * INTERVAL '1 day'
        GROUP BY 1
      ),
      application_totals AS (
        SELECT DATE(created_at) AS day, COUNT(*)::int AS applications
        FROM applications
        WHERE created_at >= CURRENT_DATE - ${rangeDays - 1} * INTERVAL '1 day'
        GROUP BY 1
      )
      SELECT
        days.day,
        COALESCE(visit_totals.visits, 0)::int AS visits,
        COALESCE(signup_totals.signups, 0)::int AS signups,
        COALESCE(application_totals.applications, 0)::int AS applications
      FROM days
      LEFT JOIN visit_totals ON visit_totals.day = days.day
      LEFT JOIN signup_totals ON signup_totals.day = days.day
      LEFT JOIN application_totals ON application_totals.day = days.day
      ORDER BY days.day ASC
    `,
    sql<OutcomeSummaryRow[]>`
      SELECT
        COUNT(*) FILTER (
          WHERE status IN (
            ${APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS},
            ${APPLICATION_STATUS_PENDING_REVIEW}
          )
        )::int AS pending_count,
        COUNT(*) FILTER (
          WHERE LOWER(status) = LOWER(${APPLICATION_STATUS_ACCEPTED}::text)
        )::int AS approved_count,
        COUNT(*) FILTER (
          WHERE LOWER(status) = LOWER(${APPLICATION_STATUS_REJECTED}::text)
        )::int AS rejected_count,
        COUNT(*) FILTER (
          WHERE LOWER(status) IN (
            LOWER(${APPLICATION_STATUS_REJECTED_PERMANENT}::text),
            LOWER('Rejected Permanent')
          )
        )::int AS banned_count
      FROM applications
    `,
  ]);

  const summary = summaryRows[0];
  const outcomeSummary = outcomeRows[0];

  const activityData: DashboardActivityPoint[] = activityRows.map((row) => ({
    label: activityLabelFormatter.format(new Date(row.day)),
    visits: row.visits,
    signups: row.signups,
    applications: row.applications,
  }));

  const decisionData: DashboardBreakdownPoint[] = [
    {
      label: t("admin.overview.charts.series.pending"),
      value: outcomeSummary.pending_count,
      fill: "var(--chart-pending)",
    },
    {
      label: t("admin.overview.charts.series.approved"),
      value: outcomeSummary.approved_count,
      fill: "var(--chart-approved)",
    },
    {
      label: t("admin.overview.charts.series.rejected"),
      value: outcomeSummary.rejected_count,
      fill: "var(--chart-rejected)",
    },
    {
      label: t("admin.overview.charts.series.banned"),
      value: outcomeSummary.banned_count,
      fill: "var(--chart-banned)",
    },
  ];

  const funnelData: DashboardFunnelPoint[] = [
    {
      name: t("admin.overview.charts.series.visited-website"),
      value: summary.visitor_count,
      fill: "var(--chart-visits)",
    },
    {
      name: t("admin.overview.charts.series.signed-up"),
      value: summary.signup_count,
      fill: "var(--chart-signups)",
    },
    {
      name: t("admin.overview.charts.series.filled-form"),
      value: summary.applicant_count,
      fill: "var(--chart-applications)",
    },
    {
      name: t("admin.overview.charts.series.approved"),
      value: outcomeSummary.approved_count,
      fill: "var(--chart-approved)",
    },
    {
      name: t("admin.overview.charts.series.rejected"),
      value: outcomeSummary.rejected_count,
      fill: "var(--chart-rejected)",
    },
    {
      name: t("admin.overview.charts.series.banned"),
      value: outcomeSummary.banned_count,
      fill: "var(--chart-banned)",
    },
  ];

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:items-center">
          <h1 className="text-4xl leading-none text-white">{t("admin.overview.title")}</h1>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 xl:flex-nowrap xl:justify-end">
            {[
              {
                icon: "view" as const,
                label: t("admin.overview.stats.visitors"),
                value: numberFormatter.format(summary.total_visit_count),
              },
              {
                icon: "person" as const,
                label: t("admin.overview.stats.signups"),
                value: numberFormatter.format(summary.signup_count),
              },
              {
                icon: "send" as const,
                label: t("admin.overview.stats.applicants"),
                value: numberFormatter.format(summary.applicant_count),
              },
              {
                icon: "clock" as const,
                label: t("admin.overview.stats.pending-review"),
                value: numberFormatter.format(summary.pending_count),
              },
            ].map((stat) => (
              <div key={stat.label} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
                <Icon glyph={stat.icon} size={24} className="self-center text-white" />
                <span className="text-2xl leading-none text-white">{stat.value}</span>
                <span className="font-body text-base leading-none text-white">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="font-body text-base text-white">{t("admin.overview.description")}</p>
      </header>

      <AdminDashboardCharts
        activityData={activityData}
        decisionData={decisionData}
        funnelData={funnelData}
        pendingCount={outcomeSummary.pending_count}
        locale={locale}
        activeRange={activeRange}
        rangeOptions={[
          { value: "7d", label: t("admin.overview.charts.ranges.seven-days") },
          { value: "14d", label: t("admin.overview.charts.ranges.fourteen-days") },
          { value: "30d", label: t("admin.overview.charts.ranges.thirty-days") },
          { value: "90d", label: t("admin.overview.charts.ranges.ninety-days") },
        ]}
        messages={{
          recentActivityEyebrow: t("admin.overview.charts.recent-activity-eyebrow"),
          recentActivityTitle: t("admin.overview.charts.recent-activity-title"),
          decisionSplitEyebrow: t("admin.overview.charts.decision-split-eyebrow"),
          decisionSplitTitle: t("admin.overview.charts.decision-split-title"),
          applicationFlowEyebrow: t("admin.overview.charts.application-flow-eyebrow"),
          applicationFlowTitle: t("admin.overview.charts.application-flow-title"),
          stillPending: t("admin.overview.charts.still-pending"),
          visitsSeries: t("admin.overview.charts.series.visits"),
          signupsSeries: t("admin.overview.charts.series.signups"),
          applicationsSeries: t("admin.overview.charts.series.applications"),
        }}
      />
    </div>
  );
}
