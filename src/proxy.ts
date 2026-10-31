import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect only (no database call): sends signed-out visitors to sign-in before
 * private pages render. Real authorization happens server-side in every page and action.
 */
export function proxy(req: NextRequest) {
  if (getSessionCookie(req)) return NextResponse.next();
  const url = new URL("/login", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/orders/:path*", "/checkout", "/delivery", "/delivery/((?!join|ended).*)"],
};
