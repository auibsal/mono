import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    runtimeEnv: {
      ARCJET_KEY: process.env.ARCJET_KEY,
    },
    server: {
      ARCJET_KEY: z.string().startsWith("ajkey_").optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
