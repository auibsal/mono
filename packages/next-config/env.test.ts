import { createEnv } from "@t3-oss/env-nextjs";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { envPresets, withPresets } from "./env";

const preset = () =>
  createEnv({
    client: { NEXT_PUBLIC_EXAMPLE_URL: z.url() },
    runtimeEnv: {
      NEXT_PUBLIC_EXAMPLE_URL: process.env.NEXT_PUBLIC_EXAMPLE_URL,
    },
    skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  });

const appEnv = () => {
  const presets = envPresets(preset());
  return withPresets(
    createEnv({
      client: {},
      extends: presets,
      runtimeEnv: {},
      server: {},
      skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
    }),
    presets
  );
};

describe("withPresets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("keeps preset values when validation is skipped", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("NEXT_PUBLIC_EXAMPLE_URL", "https://example.iq");
    expect(appEnv().NEXT_PUBLIC_EXAMPLE_URL).toBe("https://example.iq");
  });

  test("leaves validated environments unchanged", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "");
    vi.stubEnv("NEXT_PUBLIC_EXAMPLE_URL", "https://example.iq");
    expect(appEnv().NEXT_PUBLIC_EXAMPLE_URL).toBe("https://example.iq");
  });
});
