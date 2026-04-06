import { forbidden, unauthorized } from "next/navigation";

import { AdminTabs } from "@/components/admin/admin-tabs";
import { Navbar } from "@/components/navbar";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) unauthorized();

  const [user] = await sql`
    SELECT balance_cents, is_admin FROM users WHERE id = ${session.sub}
  `;
  if (!user?.is_admin) forbidden();

  return (
    <div className="page-shell">
      <Navbar isAdmin balanceCents={user?.balance_cents ?? 0} />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
