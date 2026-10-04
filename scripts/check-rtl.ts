#!/usr/bin/env bun
/**
 * Flags physical Tailwind utilities (ml-*, pr-*, left-*, text-left, …) in
 * class strings. They break right-to-left layouts; logical equivalents
 * (ms-*, pe-*, start-*, text-start, …) work in both directions.
 *
 *   bun run check:rtl         # report
 *   bun run check:rtl --fix   # rewrite to logical utilities
 *
 * Not flagged: centering (left-1/2 with a translate is direction-neutral),
 * classes keyed to a side or direction (data-[side=left]:…, rtl:…), lines
 * marked with an `rtl-ignore` comment and files containing `rtl-ignore-file`
 * (e.g. overlays positioned from physical pixel coordinates).
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const ROOTS = ["apps", "packages"];
const IGNORED_DIRECTORIES = new Set([
  ".next",
  ".turbo",
  "dist",
  "node_modules",
  "out",
  "storybook-static",
]);

const LOGICAL: Record<string, string> = {
  "border-l": "border-s",
  "border-r": "border-e",
  "float-left": "float-start",
  "float-right": "float-end",
  left: "start",
  ml: "ms",
  mr: "me",
  pl: "ps",
  pr: "pe",
  right: "end",
  "rounded-bl": "rounded-es",
  "rounded-br": "rounded-ee",
  "rounded-l": "rounded-s",
  "rounded-r": "rounded-e",
  "rounded-tl": "rounded-ss",
  "rounded-tr": "rounded-se",
  "scroll-ml": "scroll-ms",
  "scroll-mr": "scroll-me",
  "scroll-pl": "scroll-ps",
  "scroll-pr": "scroll-pe",
  "text-left": "text-start",
  "text-right": "text-end",
};

const STRING_LITERAL = /"[^"\n]*"|'[^'\n]*'|`[^`]*`/g;
const VALUE = String.raw`-[\w[\]()./%,#-]+`;
// Insets, margins and paddings take spacing values (0, 1/2, px, auto, full,
// [10px]…), so prose like "left-to-right" isn't mistaken for a class.
const SPACING = String.raw`-(?:\[[^\]\s]*\]|px|auto|full|screen|\d[\w./%]*)`;
// A class token: variants (md:, data-[side=left]:, [&>svg]:), an optional
// "-" for negative values, then a physical utility. Insets, margins and
// paddings need a value (left-0, ml-2); borders, corners, floats and text
// alignment also exist bare (border-l, rounded-r, text-left).
const PHYSICAL = new RegExp(
  String.raw`(?<=^|[\s"'\`])((?:(?:[\w-]|\[[^\]\s]*\])+:)*)(!?-?)` +
    `(?:(left|right|scroll-[mp][lr]|[mp][lr])(${SPACING})` +
    `|(border-[lr]|rounded-(?:[tb][lr]|[lr])|float-(?:left|right)|text-(?:left|right))(${VALUE})?)` +
    String.raw`(?=[\s"'\`!]|$)`,
  "g"
);
const CENTERING = /^-(1\/2|\[50%\])$/;
// Variants that already pick a side on purpose.
const DIRECTIONAL_VARIANT = /(^|:)(rtl|ltr):|side=/;

interface Finding {
  column: number;
  file: string;
  line: number;
  token: string;
}

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ? [] : listFiles(path);
      }
      return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
    })
  );
  return nested.flat();
};

const isAllowed = (variants: string, utility: string, value: string) =>
  DIRECTIONAL_VARIANT.test(variants) ||
  ((utility === "left" || utility === "right") && CENTERING.test(value));

const rewriteLiteral = (
  literal: string,
  report: (token: string, offset: number) => void
) =>
  literal.replace(
    PHYSICAL,
    (
      token: string,
      variants: string,
      prefix: string,
      insetUtility: string | undefined,
      insetValue: string | undefined,
      edgeUtility: string | undefined,
      edgeValue: string | undefined,
      offset: number
    ) => {
      const utility = insetUtility ?? edgeUtility ?? "";
      const value = insetValue ?? edgeValue ?? "";
      if (isAllowed(variants, utility, value)) {
        return token;
      }
      report(token, offset);
      return `${variants}${prefix}${LOGICAL[utility]}${value}`;
    }
  );

const fix = process.argv.includes("--fix");
const root = process.cwd();
const findings: Finding[] = [];
const files = (
  await Promise.all(ROOTS.map((dir) => listFiles(join(root, dir))))
).flat();

for (const path of files) {
  // biome-ignore lint/performance/noAwaitInLoops: sequential IO keeps memory flat
  const source = await readFile(path, "utf8");
  if (source.includes("rtl-ignore-file")) {
    continue;
  }
  const lines = source.split("\n");

  const rewritten = lines.map((text, index) =>
    text.includes("rtl-ignore")
      ? text
      : text.replace(STRING_LITERAL, (literal, literalOffset: number) =>
          rewriteLiteral(literal, (token, offset) =>
            findings.push({
              column: literalOffset + offset + 1,
              file: relative(root, path),
              line: index + 1,
              token: token.trim(),
            })
          )
        )
  );

  if (fix && rewritten.join("\n") !== source) {
    await writeFile(path, rewritten.join("\n"));
  }
}

if (findings.length === 0) {
  console.log(
    `RTL OK: no physical direction utilities in ${files.length} files.`
  );
} else if (fix) {
  console.log(`Rewrote ${findings.length} physical utilities to logical ones.`);
} else {
  console.error(
    "Physical direction utilities (use logical ones, or run with --fix):"
  );
  for (const { column, file, line, token } of findings) {
    console.error(`  ${file}:${line}:${column}  ${token}`);
  }
  process.exit(1);
}
