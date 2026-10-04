import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    runtimeEnv: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    },
    server: {
      OPENAI_API_KEY: z.string().startsWith("sk-").optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
