import { keys as auth } from "@repo/auth/keys";
import { envPresets, withPresets } from "@repo/next-config/env";
import { keys as core } from "@repo/next-config/keys";
import { keys as observability } from "@repo/observability/keys";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Static and client-first: everything the Nexus reads is public
// (NEXT_PUBLIC_*). Secrets live in apps/api, called with the member's token.
const presets = envPresets(auth(), core(), observability());

export const env = withPresets(
  createEnv({
    client: {
      // Live co-editing (Liveblocks). The secret key stays in apps/api.
      NEXT_PUBLIC_LIVEBLOCKS_ENABLED: z.enum(["true", "false"]).optional(),
    },
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    extends: presets,
    runtimeEnv: {
      NEXT_PUBLIC_LIVEBLOCKS_ENABLED:
        process.env.NEXT_PUBLIC_LIVEBLOCKS_ENABLED,
    },
    server: {},
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  }),
  presets
);
