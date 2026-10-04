import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    client: {
      // GA4 measurement ID (G-…). Public site only; nothing loads when unset.
      NEXT_PUBLIC_GA_ID: z.string().startsWith("G-").optional(),
    },
    emptyStringAsUndefined: true,
    runtimeEnv: {
      NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
