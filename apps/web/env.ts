import { keys as analytics } from "@repo/analytics/keys";
import { keys as cms } from "@repo/cms/keys";
import { keys as email } from "@repo/email/keys";
import { keys as flags } from "@repo/feature-flags/keys";
import { envPresets, withPresets } from "@repo/next-config/env";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { keys as rateLimit } from "@repo/rate-limit/keys";
import { keys as security } from "@repo/security/keys";
import { createEnv } from "@t3-oss/env-nextjs";

const presets = envPresets(
  analytics(),
  // <module:cms>
  cms(),
  // </module:cms>
  core(),
  email(),
  observability(),
  // <module:feature-flags>
  flags(),
  // </module:feature-flags>
  security(),
  // <module:rate-limit>
  rateLimit()
  // </module:rate-limit>
);

export const env = withPresets(
  createEnv({
    client: {},
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    extends: presets,
    runtimeEnv: {},
    server: {},
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  }),
  presets
);
