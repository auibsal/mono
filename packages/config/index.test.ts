import { describe, expect, test } from "vitest";
import { isPlaceholder, project } from "./index";

describe("project config", () => {
  test("detects template placeholders", () => {
    // Built at runtime so `bun run init` doesn't fill it in.
    const token = ["{{", "PROJECT_NAME", "}}"].join("");
    expect(isPlaceholder(token)).toBe(true);
    expect(isPlaceholder("Acme")).toBe(false);
    expect(isPlaceholder("{{ not a token }}")).toBe(false);
  });

  test("parses and keeps the default locale enabled", () => {
    expect(project.locale.enabled).toContain(project.locale.default);
  });

  test("defaults to Iraq regional settings", () => {
    expect(project.region.timeZone).toBe("Asia/Baghdad");
    expect(project.region.currency).toBe("IQD");
  });

  test("functional fields are undefined or valid, never a raw token", () => {
    for (const value of [project.url, project.supportEmail, project.bundleId]) {
      if (value !== undefined) {
        expect(isPlaceholder(value)).toBe(false);
      }
    }
  });
});
