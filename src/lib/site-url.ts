import { headers } from "next/headers";

/**
 * The public origin of this deployment, e.g. `https://theplan.vercel.app`.
 *
 * OAuth needs an absolute URL to come back to, and getting it from `request.url`
 * is wrong behind a proxy: Vercel routes through a load balancer, so `request.url`
 * can carry an internal host and the user lands on a URL that is not the site they
 * signed in from — or on `localhost` in production, if the fallback fires.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — set this on a custom domain and every redirect is
 *      deterministic, whichever deployment URL happened to serve the request.
 *   2. x-forwarded-host / x-forwarded-proto — what the proxy actually received.
 *   3. host — a direct request with no proxy in front.
 *   4. localhost, for `next dev`.
 */
export function siteUrlFromHeaders(h: Headers): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";

  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}

/** `siteUrlFromHeaders` for contexts that read the ambient request. */
export async function getSiteUrl(): Promise<string> {
  return siteUrlFromHeaders(await headers());
}
