import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    runtimeEnv: {
      SVIX_TOKEN: process.env.SVIX_TOKEN,
    },
    server: {
      SVIX_TOKEN: z
        .union([z.string().startsWith("sk_"), z.string().startsWith("testsk_")])
        .optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
