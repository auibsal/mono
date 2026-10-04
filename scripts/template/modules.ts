/**
 * Optional modules that `bun run init` can remove. Code that belongs to a
 * module but lives in shared files is wrapped in marker comments:
 *
 *   // <module:id> … // </module:id>          (TS, JS, JSONC)
 *   {/* <module:id> *\/} … {/* </module:id> *\/}  (JSX)
 *   # <module:id> … # </module:id>            (.env, YAML, TOML)
 */
export interface TemplateModule {
  /** Extra third-party dependencies only this module needs, per manifest. */
  dependencies?: Record<string, string[]>;
  description: string;
  id: string;
  name: string;
  /** Workspace packages owned by the module; their `@repo/*` deps are removed too. */
  packages: string[];
  /** Other files or directories that only this module uses. */
  paths: string[];
}

export const templateModules: TemplateModule[] = [
  {
    description:
      "Blog and legal pages on the marketing site, edited in BaseHub.",
    id: "cms",
    name: "CMS (BaseHub)",
    packages: ["packages/cms"],
    paths: [
      "apps/web/app/[locale]/blog",
      "apps/web/app/[locale]/legal",
      "apps/web/components/sidebar.tsx",
      "apps/web/app/[locale]/(home)/components/latest-post-announcement.tsx",
      "apps/web/app/[locale]/components/footer-legal-column.tsx",
    ],
  },
  {
    dependencies: { "apps/app/package.json": ["fuse.js"] },
    description: "Live cursors, presence avatars and mentions (Liveblocks).",
    id: "collaboration",
    name: "Real-time collaboration",
    packages: ["packages/collaboration"],
    paths: [
      "apps/app/liveblocks.config.ts",
      "apps/app/components/collaboration",
      "apps/api/app/collaboration",
    ],
  },
  {
    description: "In-app notification feed (Knock).",
    id: "notifications",
    name: "Notifications",
    packages: ["packages/notifications"],
    paths: ["apps/app/components/notifications-provider.tsx"],
  },
  {
    description: "Outbound webhooks and a customer webhook portal (Svix).",
    id: "webhooks",
    name: "Outbound webhooks",
    packages: ["packages/webhooks"],
    paths: [
      "apps/app/app/[locale]/(app)/webhooks",
      "apps/app/components/screens/webhooks.tsx",
      "apps/api/app/webhooks/portal",
    ],
  },
  {
    description:
      "Vercel Flags with PostHog-backed decisions and the toolbar (marketing site).",
    id: "feature-flags",
    name: "Feature flags",
    packages: ["packages/feature-flags"],
    paths: ["apps/web/app/.well-known"],
  },
  {
    description: "Redis-backed rate limiting for forms and APIs (Upstash).",
    id: "rate-limit",
    name: "Rate limiting",
    packages: ["packages/rate-limit"],
    paths: [],
  },
  {
    description: "AI SDK helpers and chat UI components.",
    id: "ai",
    name: "AI utilities",
    packages: ["packages/ai"],
    paths: [],
  },
];

export const moduleIds = templateModules.map((module) => module.id);
