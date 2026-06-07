import { forbidden, unauthorized } from "next/navigation";

import { AdminTabs } from "@/components/admin/admin-tabs";
import { Navbar } from "@/components/navbar";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { getEffectiveSafeguards } from "@/lib/safeguards";
import { getActorSession } from "@/lib/session";
import { canAccessStardanceReferrals } from "@/lib/stardance-referrals";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getActorSession();
  if (!session) unauthorized();

  const [user, safeguards] = await Promise.all([
    getPosterAccessState(session.sub),
    getEffectiveSafeguards(session.sub),
  ]);
  if (user === null || user.is_admin !== true) forbidden();
  const showPostersLink = safeguards.postersEnabled && canAccessPosters({
    latestApplicationStatus: user.latest_application_status ?? null,
    manualDashboardState: user.manual_dashboard_state ?? null,
    isOnboardingComplete: user.is_onboarding_complete,
    isAdmin: true,
  });
  const showReferralsLink = safeguards.referralsEnabled && canAccessStardanceReferrals({
    latestApplicationStatus: user.latest_application_status ?? null,
    manualDashboardState: user.manual_dashboard_state ?? null,
    isOnboardingComplete: user.is_onboarding_complete,
    isAdmin: true,
  });

  return (
    <div className="page-shell">
      <Navbar
        isAdmin
        balanceCents={user.balance_cents ?? 0}
        showPostersLink={showPostersLink}
        showReferralsLink={showReferralsLink}
        slackId={user.slack_id ?? null}
        displayName={user.display_name ?? null}
        region={user.ambassador_region ?? null}
      />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
