import { keys as analytics } from "@repo/analytics/keys";
import { keys as auth } from "@repo/auth/keys";
import { keys as collaboration } from "@repo/collaboration/keys";
import { envPresets, withPresets } from "@repo/next-config/env";
import { keys as core } from "@repo/next-config/keys";
import { keys as notifications } from "@repo/notifications/keys";
import { keys as observability } from "@repo/observability/keys";
import { createEnv } from "@t3-oss/env-nextjs";

// Client-first: everything the app reads at runtime is public (NEXT_PUBLIC_*).
// Secrets live in apps/api, which this app calls with the user's token.
const presets = envPresets(
  auth(),
  analytics(),
  // <module:collaboration>
  collaboration(),
  // </module:collaboration>
  core(),
  // <module:notifications>
  notifications(),
  // </module:notifications>
  observability()
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
