#!/usr/bin/env bun
/**
 * Fails when placeholder tokens are left behind.
 *
 * - In an initialized project (no `scripts/init.ts`), any placeholder fails.
 * - In the template itself, tokens are expected, but every token must be a
 *   known one and every module marker block must be balanced.
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const isTemplate = existsSync(join(root, "scripts/init.ts"));
const TOKEN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "dist",
  "node_modules",
  "out",
  "storybook-static",
]);
const TEXT_EXTENSIONS = new Set([
  "",
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mdx",
  ".mjs",
  ".mts",
  ".plist",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".xml",
  ".yaml",
  ".yml",
]);

const listFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ? [] : listFiles(path);
      }
      return TEXT_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
    })
  );
  return nested.flat();
};

const files = await listFiles(root);
const findings: string[] = [];
const known = isTemplate
  ? new Set<string>((await import("./template/tokens")).knownTokens)
  : new Set<string>();
const { stripModuleBlocks } = isTemplate
  ? await import("./template/markers")
  : { stripModuleBlocks: undefined };

for (const path of files) {
  const file = relative(root, path);
  // biome-ignore lint/performance/noAwaitInLoops: sequential IO keeps memory flat
  const content = await readFile(path, "utf8");

  for (const [line, text] of content.split("\n").entries()) {
    for (const match of text.matchAll(TOKEN)) {
      const token = match[1] as string;
      if (!(isTemplate && known.has(token))) {
        findings.push(`${file}:${line + 1}: {{${token}}}`);
      }
    }
  }

  if (stripModuleBlocks) {
    try {
      stripModuleBlocks(content, new Set(), file);
    } catch (error) {
      findings.push((error as Error).message);
    }
  }
}

if (findings.length > 0) {
  console.error(
    isTemplate
      ? "Unknown placeholder tokens or unbalanced module markers:"
      : "Unfilled placeholder tokens (run `bun run init` or replace them):"
  );
  for (const finding of findings) {
    console.error(`  ${finding}`);
  }
  process.exit(1);
}

console.log(
  isTemplate
    ? `Template OK: ${files.length} files checked, all tokens known, markers balanced.`
    : `No placeholder tokens left (${files.length} files checked).`
);
