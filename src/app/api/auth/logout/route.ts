import { clearSession } from "@/lib/session";

export async function GET() {
  await clearSession();

  return Response.redirect(`${process.env.CURRENT_DOMAIN}/`);
}
