import { keys as auth } from "@repo/auth/keys";
import { keys as database } from "@repo/database/keys";
import { keys as email } from "@repo/email/keys";
import { envPresets, withPresets } from "@repo/next-config/env";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const presets = envPresets(
  auth(),
  core(),
  database(),
  email(),
  observability()
);

export const env = withPresets(
  createEnv({
    client: {},
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    extends: presets,
    runtimeEnv: {
      CRON_SECRET: process.env.CRON_SECRET,
      DATABASE_WEBHOOK_SECRET: process.env.DATABASE_WEBHOOK_SECRET,
      REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    },
    server: {
      // Shared secret Vercel Cron sends as a Bearer token. Generate with
      // `openssl rand -hex 32`. Cron routes reject every request when unset.
      CRON_SECRET: z.string().min(32).optional(),
      // Sent by the Supabase database webhook (outbox) as a Bearer token.
      DATABASE_WEBHOOK_SECRET: z.string().min(32).optional(),
      // Shared with apps/web's revalidation route.
      REVALIDATE_SECRET: z.string().min(32).optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  }),
  presets
);
