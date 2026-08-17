import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrlFromHeaders } from "@/lib/site-url";

/**
 * OAuth redirect target. Google sends the user back here with a `code`, which we
 * exchange for a session; @supabase/ssr writes the session cookies via the
 * cookie adapter.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // From the forwarded headers, not request.url: behind Vercel's load balancer
  // request.url can carry an internal host, and the user would be redirected off
  // the site they signed in from.
  const origin = siteUrlFromHeaders(request.headers);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Only ever redirect to a relative path, so a crafted `next` cannot bounce
  // the user (and their fresh session) to another origin.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
