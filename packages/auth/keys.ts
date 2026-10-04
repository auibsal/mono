import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    client: {
      // Parent domain for the session cookie, e.g. ".auibsal.org", so one
      // sign-in carries across auibsal.org, nexus. and api. Unset locally.
      NEXT_PUBLIC_AUTH_COOKIE_DOMAIN: z.string().startsWith(".").optional(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
        .string()
        .startsWith("sb_publishable_")
        .optional(),
      NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    },
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    runtimeEnv: {
      NEXT_PUBLIC_AUTH_COOKIE_DOMAIN: process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
