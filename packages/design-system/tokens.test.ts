import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { renderTokens, type TokenFile } from "./scripts/tokens";

const tokens = JSON.parse(
  readFileSync(join(import.meta.dirname, "tokens", "sal.tokens.json"), "utf8")
) as TokenFile & { contrast: Record<"light" | "dark", [string, string][]> };

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

describe("SAL tokens", () => {
  test("role tokens use only palette colours", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const [role, color] of Object.entries(tokens.roles[theme])) {
        expect(tokens.palette, `${theme}.${role}`).toHaveProperty(color);
      }
    }
  });

  test("crimson never sits on ink", () => {
    expect(tokens.roles.dark.surface).toBe("ink");
    for (const color of Object.values(tokens.roles.dark)) {
      expect(color.startsWith("crimson") && color !== "crimson-100").toBe(
        false
      );
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`text pairs reach 4.5:1 (${theme})`, () => {
      for (const [fg, bg] of tokens.contrast[theme]) {
        const fgHex = tokens.palette[tokens.roles[theme][fg] ?? ""] ?? "";
        const bgHex = tokens.palette[tokens.roles[theme][bg] ?? ""] ?? "";
        expect(ratio(fgHex, bgHex), `${fg} on ${bg}`).toBeGreaterThanOrEqual(
          4.5
        );
      }
    });
  }

  test("tokens.css is generated from the token file", () => {
    const css = readFileSync(
      join(import.meta.dirname, "styles", "tokens.css"),
      "utf8"
    );
    expect(css).toBe(renderTokens(tokens));
  });
});
