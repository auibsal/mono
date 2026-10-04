import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const DIGITS = /^\d+$/;

export const keys = () =>
  createEnv({
    client: {
      NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().startsWith("G-").optional(),
      // When set, Google Tag Manager loads instead of the direct tags below and
      // GA4, Meta and TikTok tags are configured inside the container.
      NEXT_PUBLIC_GTM_ID: z.string().startsWith("GTM-").optional(),
      NEXT_PUBLIC_META_PIXEL_ID: z.string().regex(DIGITS).optional(),
      NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
      NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith("phc_").optional(),
      NEXT_PUBLIC_TIKTOK_PIXEL_ID: z.string().min(1).optional(),
      // Set automatically on Vercel; enables Vercel Web Analytics.
      NEXT_PUBLIC_VERCEL_ENV: z.string().optional(),
    },
    // Treat KEY="" (as in .env.example) as unset.
    emptyStringAsUndefined: true,
    runtimeEnv: {
      META_CONVERSIONS_ACCESS_TOKEN: process.env.META_CONVERSIONS_ACCESS_TOKEN,
      META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      NEXT_PUBLIC_GTM_ID: process.env.NEXT_PUBLIC_GTM_ID,
      NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_TIKTOK_PIXEL_ID: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
      NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
      TIKTOK_EVENTS_ACCESS_TOKEN: process.env.TIKTOK_EVENTS_ACCESS_TOKEN,
      TIKTOK_TEST_EVENT_CODE: process.env.TIKTOK_TEST_EVENT_CODE,
    },
    server: {
      // Server-side conversions (Meta Conversions API, TikTok Events API).
      META_CONVERSIONS_ACCESS_TOKEN: z.string().min(1).optional(),
      META_TEST_EVENT_CODE: z.string().min(1).optional(),
      TIKTOK_EVENTS_ACCESS_TOKEN: z.string().min(1).optional(),
      TIKTOK_TEST_EVENT_CODE: z.string().min(1).optional(),
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });
