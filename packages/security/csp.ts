import { defaults, type Options } from "@nosecone/next";

type CspConfig = Exclude<
  NonNullable<Options["contentSecurityPolicy"]>,
  boolean
>;
type Directives = NonNullable<CspConfig["directives"]>;
type Source = Exclude<
  Extract<Directives["connectSrc"], readonly unknown[]>[number],
  () => unknown
>;

export interface CspSources {
  connect?: string[];
  font?: string[];
  frame?: string[];
  img?: string[];
  media?: string[];
  script?: string[];
  worker?: string[];
}

/**
 * Third-party origins used by the integrations bundled with this template.
 * Remove the ones a project does not use to tighten the policy further.
 */
export const defaultCspSources: CspSources = {
  connect: [
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
    "https://*.sentry.io",
  ],
  // Side Quest episodes: YouTube's privacy-enhanced (no-cookie) player only.
  frame: ["https://www.youtube-nocookie.com"],
  img: [
    "https://*.google-analytics.com",
    "https://*.googletagmanager.com",
    "https://i.ytimg.com",
  ],
  script: ["https://www.googletagmanager.com"],
};

/** Our own API (apps/api), called directly from the browser by apps/app. */
export const apiCspSources = (url: string | undefined): CspSources =>
  url ? { connect: [new URL(url).origin] } : {};

/** Supabase REST, Auth, Storage and Realtime (WebSocket) for a project URL. */
export const supabaseCspSources = (url: string | undefined): CspSources => {
  if (!url) {
    return {};
  }

  const { host, origin } = new URL(url);

  return {
    connect: [origin, `wss://${host}`],
    img: [origin],
    media: [origin],
  };
};

const isDevelopment = process.env.NODE_ENV === "development";

const merge = (sources: CspSources[], key: keyof CspSources): Source[] =>
  [...new Set(sources.flatMap((source) => source[key] ?? []))] as Source[];

/**
 * Builds a Content Security Policy for Nosecone.
 *
 * Default (`strict: false`) is compatible with statically rendered pages and
 * with static exports: scripts are limited to this origin and the
 * listed hosts, with `'unsafe-inline'` for Next.js' inline bootstrap scripts.
 *
 * `strict: true` switches to nonce + `'strict-dynamic'`, which is stronger but
 * requires every page to be dynamically rendered (Next.js can only attach a
 * per-request nonce to dynamic responses).
 */
export const createContentSecurityPolicy = (
  { strict = false }: { strict?: boolean } = {},
  ...sources: CspSources[]
): CspConfig => {
  const scriptSrc: NonNullable<Directives["scriptSrc"]> = strict
    ? [
        ...(defaults.contentSecurityPolicy.directives.scriptSrc ?? []),
        "'strict-dynamic'",
        ...merge(sources, "script"),
      ]
    : [
        "'self'",
        "'unsafe-inline'",
        ...(isDevelopment ? (["'unsafe-eval'"] as const) : []),
        ...merge(sources, "script"),
      ];

  return {
    directives: {
      ...defaults.contentSecurityPolicy.directives,
      connectSrc: ["'self'", ...merge(sources, "connect")],
      fontSrc: ["'self'", "data:", ...merge(sources, "font")],
      frameSrc: ["'self'", ...merge(sources, "frame")],
      imgSrc: ["'self'", "blob:", "data:", ...merge(sources, "img")],
      mediaSrc: ["'self'", "blob:", ...merge(sources, "media")],
      scriptSrc,
      upgradeInsecureRequests: !isDevelopment,
      workerSrc: ["'self'", "blob:", ...merge(sources, "worker")],
    },
  };
};
