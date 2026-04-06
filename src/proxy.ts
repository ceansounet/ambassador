import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { verifyToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("ambassador_token")?.value;
  const { pathname } = request.nextUrl;

  const isProtected = [
    "/dashboard",
    "/form",
    "/admin",
    "/api/applications",
    "/api/posters",
    "/api/poster-groups",
    "/api/qr",
  ].some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    if (!token) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const payload = await verifyToken(token);
    if (!payload) {
      const res = NextResponse.redirect(new URL("/", request.url));
      res.cookies.delete("ambassador_token");
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/form/:path*",
    "/admin/:path*",
    "/api/applications/:path*",
    "/api/posters/:path*",
    "/api/poster-groups/:path*",
    "/api/qr/:path*",
  ],
};
