import {
  AdminDashboardCharts,
  type DashboardActivityPoint,
  type DashboardBreakdownPoint,
  type DashboardFunnelPoint,
} from "@/components/admin/admin-dashboard-charts";
import Icon from "@hackclub/icons";
import type { ComponentProps } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import {
  APPLICATION_STATUS_ACCEPTED,
  APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS,
  APPLICATION_STATUS_PENDING_REVIEW,
  APPLICATION_STATUS_REJECTED,
  APPLICATION_STATUS_REJECTED_PERMANENT,
} from "@/lib/applications";
import sql from "@/lib/db";
import { ensureSchema } from "@/lib/ensure-schema";

type SummaryRow = {
  visitor_count: number;
  total_visit_count: number;
  signup_count: number;
  applicant_count: number;
  pending_count: number;
  approved_count: number;
  denied_count: number;
};

type ActivityRow = {
  day: Date | string;
  visits: number;
  signups: number;
  applications: number;
};

const activityRangeDays = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
} as const;

type ActivityRange = keyof typeof activityRangeDays;

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const [t, locale, query] = await Promise.all([getTranslations(), getLocale(), searchParams]);
  const activeRange = isActivityRange(query.range) ? query.range : "14d";
  const rangeDays = activityRangeDays[activeRange];
  await ensureSchema();
  const numberFormatter = new Intl.NumberFormat(locale);
  const activityLabelFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  const [summaryRows, activityRows] = await Promise.all([
    sql<SummaryRow[]>`
      WITH latest_applications AS (
        SELECT DISTINCT ON (user_id) user_id, status
        FROM applications
        ORDER BY user_id, created_at DESC, id DESC
      )
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
          FROM latest_applications
          WHERE status IN (
            ${APPLICATION_STATUS_PENDING_AUTOMATIC_CHECKS},
            ${APPLICATION_STATUS_PENDING_REVIEW}
          )
        ) AS pending_count,
        (
          SELECT COUNT(*)::int
          FROM latest_applications
          WHERE status = ${APPLICATION_STATUS_ACCEPTED}
        ) AS approved_count,
        (
          SELECT COUNT(*)::int
          FROM latest_applications
          WHERE status IN (
            ${APPLICATION_STATUS_REJECTED},
            ${APPLICATION_STATUS_REJECTED_PERMANENT}
          )
        ) AS denied_count
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
  ]);

  const summary = summaryRows[0];

  const activityData: DashboardActivityPoint[] = activityRows.map((row) => ({
    label: activityLabelFormatter.format(new Date(row.day)),
    visits: row.visits,
    signups: row.signups,
    applications: row.applications,
  }));

  const decisionData: DashboardBreakdownPoint[] = [
    {
      label: t("admin.overview.charts.series.pending"),
      value: summary.pending_count,
      fill: "var(--secondary)",
    },
    {
      label: t("admin.overview.charts.series.approved"),
      value: summary.approved_count,
      fill: "var(--acceptance)",
    },
    {
      label: t("admin.overview.charts.series.denied"),
      value: summary.denied_count,
      fill: "var(--rejection)",
    },
  ];

  const funnelData: DashboardFunnelPoint[] = [
    {
      name: t("admin.overview.charts.series.visited-website"),
      value: summary.visitor_count,
      fill: "var(--foreground)",
    },
    {
      name: t("admin.overview.charts.series.signed-up"),
      value: summary.signup_count,
      fill: "var(--secondary)",
    },
    {
      name: t("admin.overview.charts.series.filled-form"),
      value: summary.applicant_count,
      fill: "var(--primary)",
    },
    {
      name: t("admin.overview.charts.series.approved"),
      value: summary.approved_count,
      fill: "var(--acceptance)",
    },
    {
      name: t("admin.overview.charts.series.denied"),
      value: summary.denied_count,
      fill: "var(--rejection)",
    },
  ];

  const rangeOptions = [
    { value: "7d", label: t("admin.overview.charts.ranges.seven-days") },
    { value: "14d", label: t("admin.overview.charts.ranges.fourteen-days") },
    { value: "30d", label: t("admin.overview.charts.ranges.thirty-days") },
    { value: "90d", label: t("admin.overview.charts.ranges.ninety-days") },
  ] as const;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:items-center">
          <h1 className="text-4xl leading-none text-white">{t("admin.overview.title")}</h1>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 xl:flex-nowrap xl:justify-end">
            <StatValue
              icon="view"
              label={t("admin.overview.stats.visitors")}
              value={numberFormatter.format(summary.total_visit_count)}
            />
            <StatValue
              icon="person"
              label={t("admin.overview.stats.signups")}
              value={numberFormatter.format(summary.signup_count)}
            />
            <StatValue
              icon="send"
              label={t("admin.overview.stats.applicants")}
              value={numberFormatter.format(summary.applicant_count)}
            />
            <StatValue
              icon="clock"
              label={t("admin.overview.stats.pending-review")}
              value={numberFormatter.format(summary.pending_count)}
            />
          </div>
        </div>

        <p className="font-body text-base text-white">{t("admin.overview.description")}</p>
      </header>

      <AdminDashboardCharts
        activityData={activityData}
        decisionData={decisionData}
        funnelData={funnelData}
        pendingCount={summary.pending_count}
        locale={locale}
        activeRange={activeRange}
        rangeOptions={rangeOptions}
        messages={{
          recentActivityEyebrow: t("admin.overview.charts.recent-activity-eyebrow"),
          recentActivityTitle: t("admin.overview.charts.recent-activity-title"),
          decisionSplitEyebrow: t("admin.overview.charts.decision-split-eyebrow"),
          decisionSplitTitle: t("admin.overview.charts.decision-split-title"),
          applicationFlowEyebrow: t("admin.overview.charts.application-flow-eyebrow"),
          applicationFlowTitle: t("admin.overview.charts.application-flow-title"),
          noFlowData: t("admin.overview.charts.no-flow-data"),
          stillPending: t("admin.overview.charts.still-pending"),
          visitsSeries: t("admin.overview.charts.series.visits"),
          signupsSeries: t("admin.overview.charts.series.signups"),
          applicationsSeries: t("admin.overview.charts.series.applications"),
        }}
      />
    </div>
  );
}

function StatValue({
  icon,
  label,
  value,
}: {
  icon: ComponentProps<typeof Icon>["glyph"];
  label: string;
  value: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
      <Icon glyph={icon} size={24} className="self-center text-white" />
      <span className="text-2xl leading-none text-white">{value}</span>
      <span className="font-body text-base leading-none text-white">{label}</span>
    </div>
  );
}

function isActivityRange(value: string | undefined): value is ActivityRange {
  return value === "7d" || value === "14d" || value === "30d" || value === "90d";
}
