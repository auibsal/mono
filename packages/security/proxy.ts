import {
  defaults,
  nosecone,
  type Options,
  withVercelToolbar,
} from "@nosecone/next";
import {
  apiCspSources,
  createContentSecurityPolicy,
  defaultCspSources,
  supabaseCspSources,
} from "./csp";

// Nosecone security headers configuration
// https://docs.arcjet.com/nosecone/quick-start
const baseOptions: Options = {
  ...defaults,
  contentSecurityPolicy: createContentSecurityPolicy(
    {},
    defaultCspSources,
    supabaseCspSources(process.env.NEXT_PUBLIC_SUPABASE_URL),
    apiCspSources(process.env.NEXT_PUBLIC_API_URL)
  ),
  // `require-corp` blocks third-party images, pixels and iframes that do not
  // send a Cross-Origin-Resource-Policy header (most analytics endpoints).
  crossOriginEmbedderPolicy: false,
  // Keeps the origin on cross-site requests so analytics attribution works,
  // without leaking full URLs (paths, query strings) to third parties.
  referrerPolicy: { policy: ["strict-origin-when-cross-origin"] },
};

/**
 * Security headers for every app. The Vercel Toolbar's origins are allowed
 * only when it is enabled (`FLAGS_SECRET` is set).
 */
export const noseconeOptions: Options = process.env.FLAGS_SECRET
  ? withVercelToolbar(baseOptions)
  : baseOptions;

/**
 * The same headers as static `headers()` entries for next.config, for apps
 * without a proxy (apps/app is client-first and also builds as a static
 * export, where headers come from the host instead).
 */
export const securityHeaders = (options: Options = noseconeOptions) => [
  {
    headers: [...nosecone(options)].map(([key, value]) => ({ key, value })),
    source: "/:path*",
  },
];

/**
 * Adds Nosecone's security headers to an existing proxy response (for example
 * one that carries refreshed auth cookies or an i18n rewrite) instead of
 * replacing it.
 */
export const withSecurityHeaders = <T extends Response>(
  response: T,
  options: Options = noseconeOptions
): T => {
  for (const [name, value] of nosecone(options)) {
    response.headers.set(name, value);
  }

  return response;
};
