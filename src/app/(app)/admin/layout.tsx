import { forbidden, unauthorized } from "next/navigation";

import { AdminTabs } from "@/components/admin/admin-tabs";
import { Navbar } from "@/components/navbar";
import { canAccessPosters, getPosterAccessState } from "@/lib/posters/access";
import { getActorSession } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getActorSession();
  if (!session) unauthorized();

  const user = await getPosterAccessState(session.sub);
  if (!user?.is_admin) forbidden();
  const showPostersLink = canAccessPosters({
    latestApplicationStatus: user.latest_application_status ?? null,
    manualDashboardState: user.manual_dashboard_state ?? null,
  });

  return (
    <div className="page-shell">
      <Navbar
        isAdmin
        balanceCents={user?.balance_cents ?? 0}
        showPostersLink={showPostersLink}
      />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
