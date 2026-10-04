import { keys as analytics } from "@repo/analytics/keys";
import { keys as auth } from "@repo/auth/keys";
import { keys as email } from "@repo/email/keys";
import { envPresets, withPresets } from "@repo/next-config/env";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as rateLimit } from "@repo/rate-limit/keys";
import { keys as security } from "@repo/security/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const presets = envPresets(
  analytics(),
  auth(),
  core(),
  email(),
  observability(),
  security(),
  rateLimit()
);

export const env = withPresets(
  createEnv({
    client: {},
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    extends: presets,
    runtimeEnv: {
      REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
    },
    server: {
      // Shared with apps/api, which calls /api/revalidate on publish.
      REVALIDATE_SECRET: z.string().min(32).optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  }),
  presets
);
