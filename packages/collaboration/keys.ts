import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    client: {
      // Turns on live presence and co-editing in the Nexus. The secret key
      // lives only in apps/api, which authorizes each room.
      NEXT_PUBLIC_LIVEBLOCKS_ENABLED: z.enum(["true", "false"]).optional(),
    },
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    runtimeEnv: {
      LIVEBLOCKS_SECRET: process.env.LIVEBLOCKS_SECRET,
      NEXT_PUBLIC_LIVEBLOCKS_ENABLED:
        process.env.NEXT_PUBLIC_LIVEBLOCKS_ENABLED,
    },
    server: {
      LIVEBLOCKS_SECRET: z.string().startsWith("sk_").optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
