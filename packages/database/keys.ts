import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
        .string()
        .startsWith("sb_publishable_")
        .optional(),
      NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    },
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    runtimeEnv: {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    },
    server: {
      // Server-only. Bypasses Row Level Security — never expose to the client.
      SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_").optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
