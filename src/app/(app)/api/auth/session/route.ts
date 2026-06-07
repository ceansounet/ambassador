import { isUserAdmin } from "@/lib/applications/review";
import { getActorSession, getSession } from "@/lib/session";

export async function GET() {
  const [session, actorSession] = await Promise.all([getSession(), getActorSession()]);

  if (!session) {
    return Response.json({
      isAuthenticated: false,
      isAdmin: false,
      isImpersonating: false,
      impersonation: null,
    });
  }

  // Read the live admin flag from the DB rather than trusting the JWT claim, so
  // a demoted admin stops seeing admin affordances without waiting for cookie
  // expiry. The acting user (impersonator, if any) owns the admin capability.
  const isAdmin = await isUserAdmin(actorSession?.sub ?? session.sub);

  return Response.json({
    isAuthenticated: true,
    isAdmin,
    isImpersonating: Boolean(session.impersonator),
    impersonation: session.impersonator
      ? {
          actorId: session.impersonator.sub,
          actorDisplayName: session.impersonator.displayName,
          subjectId: session.sub,
          subjectDisplayName: session.displayName,
        }
      : null,
  });
}
