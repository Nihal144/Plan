import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next 16 renamed the `middleware` file convention to `proxy` (same behaviour,
 * new file and export name). Published Supabase SSR guides still say
 * `middleware.ts` — this is the current equivalent.
 *
 * Two jobs, both deliberately cheap:
 *   1. Refresh the Supabase session cookies, which Server Components cannot do.
 *   2. An *optimistic* redirect for signed-out visitors.
 *
 * `getClaims()` verifies the JWT locally rather than calling the Auth server, so
 * this stays fast on every request including prefetches. Real authorisation lives
 * in the DAL and in RLS — per the Next auth guide, proxy is not a line of defense.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/login" || pathname.startsWith("/auth");

  if (!isSignedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isSignedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets and images so this never runs where it cannot help.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|planner.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
