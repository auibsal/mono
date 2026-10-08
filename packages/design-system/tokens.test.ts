import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { logoFiles } from "./brand/logos";
import {
  type BrandTokens,
  brandTokensPath,
  renderTokens,
  splitColors,
} from "./scripts/tokens";

const tokens = JSON.parse(readFileSync(brandTokensPath, "utf8")) as BrandTokens;
const { palette, roles } = splitColors(tokens);

const hex = (theme: "light" | "dark", role: string) => {
  const value = roles[role]?.[theme] ?? "";
  return palette[value.slice(1, -1)] ?? "";
};

const luminance = (color: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.039_28 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

/** Text pairs that must reach WCAG AA (4.5:1), from the brand's contrast table. */
const textPairs: Record<"light" | "dark", [string, string][]> = {
  dark: [
    ["text", "surface"],
    ["text", "surface-tint"],
    ["text-secondary", "surface"],
    ["text-meta", "surface"],
    ["title", "surface"],
    ["on-band", "band"],
  ],
  light: [
    ["text", "surface"],
    ["text", "surface-tint"],
    ["text-secondary", "surface"],
    ["text-secondary", "surface-tint"],
    ["text-meta", "surface"],
    ["title", "surface"],
    ["title", "surface-tint"],
    ["on-band", "band"],
  ],
};

describe("SAL tokens (brand/tokens.json)", () => {
  test("the palette is the brand's ten colors and nothing else", () => {
    expect(Object.keys(palette).sort()).toEqual(
      [
        "crimson",
        "crimson-100",
        "crimson-50",
        "crimson-700",
        "ink",
        "ink-50",
        "ink-70",
        "paper",
        "rule",
        "white",
      ].sort()
    );
  });

  test("every role references a palette color in both themes", () => {
    for (const [role, value] of Object.entries(roles)) {
      for (const theme of ["light", "dark"] as const) {
        expect(palette, `${theme}.${role}`).toHaveProperty(
          value[theme].slice(1, -1)
        );
      }
    }
  });

  test("crimson text never sits on ink", () => {
    expect(hex("dark", "surface")).toBe(palette.ink);
    for (const role of ["text", "text-secondary", "title"]) {
      expect(hex("dark", role)).not.toBe(palette.crimson);
    }
  });

  for (const theme of ["light", "dark"] as const) {
    test(`text pairs reach 4.5:1 (${theme})`, () => {
      for (const [fg, bg] of textPairs[theme]) {
        expect(
          ratio(hex(theme, fg), hex(theme, bg)),
          `${fg} on ${bg}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test("the retired Key's radius is not emitted", () => {
    expect(renderTokens(tokens)).not.toContain("radius-key");
  });

  test("tokens.css is generated from brand/tokens.json", () => {
    const css = readFileSync(
      join(import.meta.dirname, "styles", "tokens.css"),
      "utf8"
    );
    expect(css).toBe(renderTokens(tokens));
  });

  test("the self-hosted Ubuntu Arabic files are the brand's own", () => {
    for (const file of [
      "UbuntuArabic-Regular.woff2",
      "UbuntuArabic-Bold.woff2",
    ]) {
      const ours = readFileSync(join(import.meta.dirname, "fonts", file));
      const brand = readFileSync(join(brandTokensPath, "..", "fonts", file));
      expect(ours.equals(brand), file).toBe(true);
    }
  });
});

describe("SAL logos (brand/logos)", () => {
  const brandDir = join(brandTokensPath, "..", "logos");
  for (const app of ["web", "app"]) {
    test(`apps/${app}/public/brand holds the brand's files unchanged`, () => {
      for (const file of logoFiles) {
        const ours = readFileSync(
          join(
            import.meta.dirname,
            "..",
            "..",
            "apps",
            app,
            "public",
            "brand",
            file
          )
        );
        expect(ours.equals(readFileSync(join(brandDir, file))), file).toBe(
          true
        );
      }
    });
  }

  for (const app of ["web", "app"]) {
    test(`apps/${app}/app/icon.svg is the brand's avatar`, () => {
      const icon = readFileSync(
        join(import.meta.dirname, "..", "..", "apps", app, "app", "icon.svg")
      );
      expect(icon.equals(readFileSync(join(brandDir, "sal-avatar.svg")))).toBe(
        true
      );
    });
  }
});
